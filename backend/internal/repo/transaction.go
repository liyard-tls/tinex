package repo

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/liyard/tinex-api/internal/model"
)

type TransactionRepo struct {
	db *pgxpool.Pool
}

func NewTransactionRepo(db *pgxpool.Pool) *TransactionRepo {
	return &TransactionRepo{db: db}
}

const txCols = `id, user_id, account_id, type, amount, currency, description, date,
	COALESCE(category_id,''), COALESCE(merchant_name,''), COALESCE(notes,''),
	exclude_from_analytics, COALESCE(exchange_rate,0), COALESCE(fee,0),
	COALESCE(pair_id,''), COALESCE(source_id,''), COALESCE(source_name,''),
	created_at, updated_at`

func scanTx(row pgx.Row) (*model.Transaction, error) {
	var t model.Transaction
	if err := row.Scan(
		&t.ID, &t.UserID, &t.AccountID, &t.Type, &t.Amount, &t.Currency,
		&t.Description, &t.Date, &t.CategoryID, &t.MerchantName, &t.Notes,
		&t.ExcludeFromAnalytics, &t.ExchangeRate, &t.Fee,
		&t.PairID, &t.SourceID, &t.SourceName,
		&t.CreatedAt, &t.UpdatedAt,
	); err != nil {
		return nil, err
	}
	return &t, nil
}

func (r *TransactionRepo) Create(ctx context.Context, userID string, input model.CreateTransactionInput) (*model.Transaction, error) {
	var catID, merchantName, notes, pairID, sourceID, sourceName *string
	var exchangeRate, fee *float64

	if input.CategoryID != "" {
		catID = &input.CategoryID
	}
	if input.MerchantName != "" {
		merchantName = &input.MerchantName
	}
	if input.Notes != "" {
		notes = &input.Notes
	}
	if input.PairID != "" {
		pairID = &input.PairID
	}
	if input.SourceID != "" {
		sourceID = &input.SourceID
	}
	if input.SourceName != "" {
		sourceName = &input.SourceName
	}
	if input.ExchangeRate != 0 {
		exchangeRate = &input.ExchangeRate
	}
	if input.Fee != 0 {
		fee = &input.Fee
	}

	row := r.db.QueryRow(ctx, `
		INSERT INTO transactions
		  (user_id, account_id, type, amount, currency, description, date,
		   category_id, merchant_name, notes, exclude_from_analytics,
		   exchange_rate, fee, pair_id, source_id, source_name)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
		RETURNING `+txCols,
		userID, input.AccountID, input.Type, input.Amount, input.Currency,
		input.Description, input.Date, catID, merchantName, notes,
		input.ExcludeFromAnalytics, exchangeRate, fee, pairID, sourceID, sourceName,
	)
	return scanTx(row)
}

func (r *TransactionRepo) SetTags(ctx context.Context, txID string, tagIDs []string) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	if _, err := tx.Exec(ctx, `DELETE FROM transaction_tags WHERE transaction_id = $1`, txID); err != nil {
		return err
	}
	for _, tid := range tagIDs {
		if _, err := tx.Exec(ctx, `INSERT INTO transaction_tags (transaction_id, tag_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, txID, tid); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

func (r *TransactionRepo) GetByID(ctx context.Context, id string) (*model.Transaction, error) {
	row := r.db.QueryRow(ctx, `SELECT `+txCols+` FROM transactions WHERE id = $1`, id)
	return scanTx(row)
}

func (r *TransactionRepo) GetByUserID(ctx context.Context, userID string, opts model.TransactionListOptions) ([]model.Transaction, error) {
	orderBy := "date"
	orderDir := "DESC"
	if opts.OrderBy != "" {
		orderBy = opts.OrderBy
	}
	if opts.OrderDir == "asc" {
		orderDir = "ASC"
	}

	q := fmt.Sprintf(`SELECT `+txCols+` FROM transactions WHERE user_id = $1 ORDER BY %s %s`, orderBy, orderDir)
	args := []any{userID}
	if opts.Limit > 0 {
		q += fmt.Sprintf(` LIMIT %d`, opts.Limit)
	}

	rows, err := r.db.Query(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanTransactions(rows)
}

func (r *TransactionRepo) GetByAccountID(ctx context.Context, accountID, userID string) ([]model.Transaction, error) {
	rows, err := r.db.Query(ctx,
		`SELECT `+txCols+` FROM transactions WHERE account_id = $1 AND user_id = $2 ORDER BY date DESC`,
		accountID, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanTransactions(rows)
}

func (r *TransactionRepo) GetByCategoryID(ctx context.Context, userID, categoryID string) ([]model.Transaction, error) {
	rows, err := r.db.Query(ctx,
		`SELECT `+txCols+` FROM transactions WHERE user_id = $1 AND category_id = $2 ORDER BY date DESC`,
		userID, categoryID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanTransactions(rows)
}

func (r *TransactionRepo) GetByDateRange(ctx context.Context, userID string, start, end time.Time) ([]model.Transaction, error) {
	rows, err := r.db.Query(ctx,
		`SELECT `+txCols+` FROM transactions WHERE user_id = $1 AND date >= $2 AND date <= $3 ORDER BY date DESC`,
		userID, start, end)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanTransactions(rows)
}

func scanTransactions(rows pgx.Rows) ([]model.Transaction, error) {
	var txs []model.Transaction
	for rows.Next() {
		var t model.Transaction
		if err := rows.Scan(
			&t.ID, &t.UserID, &t.AccountID, &t.Type, &t.Amount, &t.Currency,
			&t.Description, &t.Date, &t.CategoryID, &t.MerchantName, &t.Notes,
			&t.ExcludeFromAnalytics, &t.ExchangeRate, &t.Fee,
			&t.PairID, &t.SourceID, &t.SourceName,
			&t.CreatedAt, &t.UpdatedAt,
		); err != nil {
			return nil, err
		}
		txs = append(txs, t)
	}
	return txs, rows.Err()
}

func (r *TransactionRepo) Update(ctx context.Context, id string, input model.UpdateTransactionInput) error {
	_, err := r.db.Exec(ctx, `
		UPDATE transactions SET
		  account_id             = COALESCE($2, account_id),
		  type                   = COALESCE($3, type),
		  amount                 = COALESCE($4, amount),
		  currency               = COALESCE($5, currency),
		  description            = COALESCE($6, description),
		  date                   = COALESCE($7, date),
		  category_id            = COALESCE($8, category_id),
		  merchant_name          = COALESCE($9, merchant_name),
		  notes                  = COALESCE($10, notes),
		  exclude_from_analytics = COALESCE($11, exclude_from_analytics),
		  exchange_rate          = COALESCE($12, exchange_rate),
		  fee                    = COALESCE($13, fee),
		  updated_at             = $14
		WHERE id = $1
	`, id, input.AccountID, input.Type, input.Amount, input.Currency,
		input.Description, input.Date, input.CategoryID, input.MerchantName,
		input.Notes, input.ExcludeFromAnalytics, input.ExchangeRate, input.Fee, time.Now())
	return err
}

func (r *TransactionRepo) Delete(ctx context.Context, id string) error {
	_, err := r.db.Exec(ctx, `DELETE FROM transactions WHERE id = $1`, id)
	return err
}

func (r *TransactionRepo) DeleteAllForUser(ctx context.Context, userID string) error {
	_, err := r.db.Exec(ctx, `DELETE FROM transactions WHERE user_id = $1`, userID)
	return err
}

func (r *TransactionRepo) GetStats(ctx context.Context, userID string, start, end time.Time) (*model.TransactionStats, error) {
	row := r.db.QueryRow(ctx, `
		SELECT
		  COALESCE(SUM(CASE WHEN type = 'income'  THEN amount ELSE 0 END), 0),
		  COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0),
		  COUNT(*)
		FROM transactions
		WHERE user_id = $1 AND date >= $2 AND date <= $3
		  AND exclude_from_analytics = FALSE
	`, userID, start, end)

	var s model.TransactionStats
	if err := row.Scan(&s.Income, &s.Expenses, &s.TransactionCount); err != nil {
		return nil, err
	}
	s.Balance = s.Income - s.Expenses
	return &s, nil
}

// GetByPairID returns both sides of a transfer.
func (r *TransactionRepo) GetByPairID(ctx context.Context, pairID string) ([]model.Transaction, error) {
	rows, err := r.db.Query(ctx, `SELECT `+txCols+` FROM transactions WHERE pair_id = $1`, pairID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanTransactions(rows)
}
