package service

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/liyard/tinex-api/internal/model"
	"github.com/liyard/tinex-api/internal/repo"
)

// TransactionService handles business logic for transactions,
// including account balance updates within DB transactions.
type TransactionService struct {
	db          *pgxpool.Pool
	txRepo      *repo.TransactionRepo
	accountRepo *repo.AccountRepo
	tagRepo     *repo.TagRepo
	importRepo  *repo.ImportedTransactionRepo
}

func NewTransactionService(
	db *pgxpool.Pool,
	txRepo *repo.TransactionRepo,
	accountRepo *repo.AccountRepo,
	tagRepo *repo.TagRepo,
	importRepo *repo.ImportedTransactionRepo,
) *TransactionService {
	return &TransactionService{
		db:          db,
		txRepo:      txRepo,
		accountRepo: accountRepo,
		tagRepo:     tagRepo,
		importRepo:  importRepo,
	}
}

// Create creates a transaction and updates account balance atomically.
func (s *TransactionService) Create(ctx context.Context, userID string, input model.CreateTransactionInput) (*model.Transaction, error) {
	pgTx, err := s.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer pgTx.Rollback(ctx) //nolint:errcheck

	tx, err := s.txRepo.Create(ctx, userID, input)
	if err != nil {
		return nil, fmt.Errorf("create transaction: %w", err)
	}

	if err := s.applyBalanceDelta(ctx, input.AccountID, input.Amount, input.Type, +1); err != nil {
		return nil, fmt.Errorf("update balance: %w", err)
	}

	if len(input.TagIDs) > 0 {
		if err := s.txRepo.SetTags(ctx, tx.ID, input.TagIDs); err != nil {
			return nil, fmt.Errorf("set tags: %w", err)
		}
	}

	if err := pgTx.Commit(ctx); err != nil {
		return nil, err
	}

	tx.Tags, _ = s.tagRepo.GetByTransactionID(ctx, tx.ID)
	return tx, nil
}

// Update updates a transaction, reverting old balance and applying new balance.
func (s *TransactionService) Update(ctx context.Context, id string, input model.UpdateTransactionInput) (*model.Transaction, error) {
	old, err := s.txRepo.GetByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("get transaction: %w", err)
	}

	pgTx, err := s.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer pgTx.Rollback(ctx) //nolint:errcheck

	// Revert old balance effect
	if err := s.applyBalanceDelta(ctx, old.AccountID, old.Amount, old.Type, -1); err != nil {
		return nil, fmt.Errorf("revert old balance: %w", err)
	}

	// Apply update
	if err := s.txRepo.Update(ctx, id, input); err != nil {
		return nil, fmt.Errorf("update transaction: %w", err)
	}

	// Determine effective values after update
	newAccountID := old.AccountID
	if input.AccountID != nil {
		newAccountID = *input.AccountID
	}
	newAmount := old.Amount
	if input.Amount != nil {
		newAmount = *input.Amount
	}
	newType := old.Type
	if input.Type != nil {
		newType = *input.Type
	}

	// Apply new balance effect
	if err := s.applyBalanceDelta(ctx, newAccountID, newAmount, newType, +1); err != nil {
		return nil, fmt.Errorf("apply new balance: %w", err)
	}

	// Update tags if provided
	if input.TagIDs != nil {
		if err := s.txRepo.SetTags(ctx, id, input.TagIDs); err != nil {
			return nil, fmt.Errorf("set tags: %w", err)
		}
	}

	if err := pgTx.Commit(ctx); err != nil {
		return nil, err
	}

	updated, err := s.txRepo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	updated.Tags, _ = s.tagRepo.GetByTransactionID(ctx, id)
	return updated, nil
}

// Delete deletes a transaction, reverts balance, and removes import record.
func (s *TransactionService) Delete(ctx context.Context, id string) error {
	tx, err := s.txRepo.GetByID(ctx, id)
	if err != nil {
		return fmt.Errorf("get transaction: %w", err)
	}

	pgTx, err := s.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer pgTx.Rollback(ctx) //nolint:errcheck

	// If this is part of a transfer pair, delete the paired transaction too
	if tx.PairID != "" {
		paired, err := s.txRepo.GetByPairID(ctx, tx.PairID)
		if err == nil {
			for _, p := range paired {
				if p.ID != id {
					if err := s.applyBalanceDelta(ctx, p.AccountID, p.Amount, p.Type, -1); err != nil {
						return err
					}
					if err := s.txRepo.Delete(ctx, p.ID); err != nil {
						return err
					}
					_ = s.importRepo.DeleteByTransactionID(ctx, p.ID)
				}
			}
		}
	}

	if err := s.applyBalanceDelta(ctx, tx.AccountID, tx.Amount, tx.Type, -1); err != nil {
		return fmt.Errorf("revert balance: %w", err)
	}
	if err := s.txRepo.Delete(ctx, id); err != nil {
		return fmt.Errorf("delete transaction: %w", err)
	}
	_ = s.importRepo.DeleteByTransactionID(ctx, id)

	return pgTx.Commit(ctx)
}

// WithTags populates the Tags field on a slice of transactions.
func (s *TransactionService) WithTags(ctx context.Context, txs []model.Transaction) []model.Transaction {
	for i := range txs {
		txs[i].Tags, _ = s.tagRepo.GetByTransactionID(ctx, txs[i].ID)
		if txs[i].Tags == nil {
			txs[i].Tags = []model.Tag{}
		}
	}
	return txs
}

// applyBalanceDelta adjusts an account's balance.
// sign +1 applies the effect, -1 reverts it.
func (s *TransactionService) applyBalanceDelta(ctx context.Context, accountID string, amount float64, txType string, sign int) error {
	account, err := s.accountRepo.GetByID(ctx, accountID)
	if err != nil {
		return fmt.Errorf("get account %s: %w", accountID, err)
	}

	delta := amount * float64(sign)
	var newBalance float64
	switch txType {
	case "income":
		newBalance = account.Balance + delta
	case "expense":
		newBalance = account.Balance - delta
	case "transfer":
		// Transfer type is handled by create/delete per-account
		newBalance = account.Balance - delta
	default:
		return fmt.Errorf("unknown transaction type: %s", txType)
	}

	return s.accountRepo.UpdateBalance(ctx, accountID, newBalance)
}

// AdvanceNextDate calculates the next recurrence date.
func AdvanceNextDate(current time.Time, recurrence string) time.Time {
	switch recurrence {
	case "daily":
		return current.AddDate(0, 0, 1)
	case "weekly":
		return current.AddDate(0, 0, 7)
	case "monthly":
		return current.AddDate(0, 1, 0)
	case "yearly":
		return current.AddDate(1, 0, 0)
	default:
		return current
	}
}
