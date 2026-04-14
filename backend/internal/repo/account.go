package repo

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/liyard/tinex-api/internal/model"
)

type AccountRepo struct {
	db *pgxpool.Pool
}

func NewAccountRepo(db *pgxpool.Pool) *AccountRepo {
	return &AccountRepo{db: db}
}

func scanAccount(row pgx.Row) (*model.Account, error) {
	var a model.Account
	err := row.Scan(
		&a.ID, &a.UserID, &a.Name, &a.Type, &a.Currency, &a.Balance,
		&a.Color, &a.Icon, &a.IsDefault, &a.IsSaving, &a.Notes,
		&a.CreatedAt, &a.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &a, nil
}

const accountCols = `id, user_id, name, type, currency, balance,
	COALESCE(color,''), COALESCE(icon,''), is_default, is_saving, COALESCE(notes,''),
	created_at, updated_at`

func (r *AccountRepo) Create(ctx context.Context, userID string, input model.CreateAccountInput) (*model.Account, error) {
	row := r.db.QueryRow(ctx, `
		INSERT INTO accounts (user_id, name, type, currency, balance, color, icon, is_default, is_saving, notes)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
		RETURNING `+accountCols,
		userID, input.Name, input.Type, input.Currency, input.Balance,
		input.Color, input.Icon, input.IsDefault, input.IsSaving, input.Notes,
	)
	return scanAccount(row)
}

func (r *AccountRepo) GetByID(ctx context.Context, id string) (*model.Account, error) {
	row := r.db.QueryRow(ctx, `SELECT `+accountCols+` FROM accounts WHERE id = $1`, id)
	return scanAccount(row)
}

func (r *AccountRepo) GetByUserID(ctx context.Context, userID string) ([]model.Account, error) {
	rows, err := r.db.Query(ctx, `SELECT `+accountCols+` FROM accounts WHERE user_id = $1 ORDER BY created_at`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var accounts []model.Account
	for rows.Next() {
		var a model.Account
		if err := rows.Scan(
			&a.ID, &a.UserID, &a.Name, &a.Type, &a.Currency, &a.Balance,
			&a.Color, &a.Icon, &a.IsDefault, &a.IsSaving, &a.Notes,
			&a.CreatedAt, &a.UpdatedAt,
		); err != nil {
			return nil, err
		}
		accounts = append(accounts, a)
	}
	return accounts, rows.Err()
}

func (r *AccountRepo) GetDefault(ctx context.Context, userID string) (*model.Account, error) {
	row := r.db.QueryRow(ctx, `SELECT `+accountCols+` FROM accounts WHERE user_id = $1 AND is_default = TRUE LIMIT 1`, userID)
	return scanAccount(row)
}

func (r *AccountRepo) Update(ctx context.Context, id string, input model.UpdateAccountInput) error {
	_, err := r.db.Exec(ctx, `
		UPDATE accounts SET
		  name       = COALESCE($2, name),
		  type       = COALESCE($3, type),
		  currency   = COALESCE($4, currency),
		  balance    = COALESCE($5, balance),
		  color      = COALESCE($6, color),
		  icon       = COALESCE($7, icon),
		  is_default = COALESCE($8, is_default),
		  is_saving  = COALESCE($9, is_saving),
		  notes      = COALESCE($10, notes),
		  updated_at = $11
		WHERE id = $1
	`, id, input.Name, input.Type, input.Currency, input.Balance,
		input.Color, input.Icon, input.IsDefault, input.IsSaving, input.Notes, time.Now())
	return err
}

func (r *AccountRepo) UpdateBalance(ctx context.Context, id string, newBalance float64) error {
	_, err := r.db.Exec(ctx,
		`UPDATE accounts SET balance = $2, updated_at = $3 WHERE id = $1`,
		id, newBalance, time.Now())
	return err
}

func (r *AccountRepo) SetDefault(ctx context.Context, userID, accountID string) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	if _, err := tx.Exec(ctx, `UPDATE accounts SET is_default = FALSE WHERE user_id = $1`, userID); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `UPDATE accounts SET is_default = TRUE WHERE id = $1 AND user_id = $2`, accountID, userID); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (r *AccountRepo) Delete(ctx context.Context, id string) error {
	_, err := r.db.Exec(ctx, `DELETE FROM accounts WHERE id = $1`, id)
	return err
}

func (r *AccountRepo) DeleteAllForUser(ctx context.Context, userID string) error {
	_, err := r.db.Exec(ctx, `DELETE FROM accounts WHERE user_id = $1`, userID)
	return err
}

func (r *AccountRepo) GetTotalBalance(ctx context.Context, userID string) (float64, error) {
	row := r.db.QueryRow(ctx, `SELECT COALESCE(SUM(balance),0) FROM accounts WHERE user_id = $1`, userID)
	var total float64
	if err := row.Scan(&total); err != nil {
		return 0, fmt.Errorf("get total balance: %w", err)
	}
	return total, nil
}
