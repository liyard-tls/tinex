package repo

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/liyard/tinex-api/internal/model"
)

type ScheduledRepo struct {
	db *pgxpool.Pool
}

func NewScheduledRepo(db *pgxpool.Pool) *ScheduledRepo {
	return &ScheduledRepo{db: db}
}

const scheduledCols = `id, user_id, account_id, type, amount, currency, description,
	COALESCE(category_id,''), COALESCE(fee,0), next_date, recurrence,
	end_date, is_active, last_executed_at, created_at, updated_at`

func scanScheduled(row pgx.Row) (*model.ScheduledTransaction, error) {
	var s model.ScheduledTransaction
	if err := row.Scan(
		&s.ID, &s.UserID, &s.AccountID, &s.Type, &s.Amount, &s.Currency,
		&s.Description, &s.CategoryID, &s.Fee, &s.NextDate, &s.Recurrence,
		&s.EndDate, &s.IsActive, &s.LastExecutedAt,
		&s.CreatedAt, &s.UpdatedAt,
	); err != nil {
		return nil, err
	}
	return &s, nil
}

func (r *ScheduledRepo) Create(ctx context.Context, userID string, input model.CreateScheduledTransactionInput) (*model.ScheduledTransaction, error) {
	var catID *string
	var fee *float64
	if input.CategoryID != "" {
		catID = &input.CategoryID
	}
	if input.Fee != 0 {
		fee = &input.Fee
	}

	row := r.db.QueryRow(ctx, `
		INSERT INTO scheduled_transactions
		  (user_id, account_id, type, amount, currency, description, category_id,
		   fee, next_date, recurrence, end_date)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
		RETURNING `+scheduledCols,
		userID, input.AccountID, input.Type, input.Amount, input.Currency,
		input.Description, catID, fee, input.NextDate, input.Recurrence, input.EndDate,
	)
	return scanScheduled(row)
}

func (r *ScheduledRepo) SetTags(ctx context.Context, scheduledID string, tagIDs []string) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	if _, err := tx.Exec(ctx, `DELETE FROM scheduled_transaction_tags WHERE scheduled_transaction_id = $1`, scheduledID); err != nil {
		return err
	}
	for _, tid := range tagIDs {
		if _, err := tx.Exec(ctx,
			`INSERT INTO scheduled_transaction_tags (scheduled_transaction_id, tag_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
			scheduledID, tid); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

func (r *ScheduledRepo) GetByUserID(ctx context.Context, userID string) ([]model.ScheduledTransaction, error) {
	rows, err := r.db.Query(ctx,
		`SELECT `+scheduledCols+` FROM scheduled_transactions WHERE user_id = $1 ORDER BY next_date`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanScheduleds(rows)
}

func (r *ScheduledRepo) GetUpcoming(ctx context.Context, userID string, days int) ([]model.ScheduledTransaction, error) {
	cutoff := time.Now().AddDate(0, 0, days)
	rows, err := r.db.Query(ctx, `
		SELECT `+scheduledCols+` FROM scheduled_transactions
		WHERE user_id = $1 AND is_active = TRUE AND next_date <= $2
		ORDER BY next_date
	`, userID, cutoff)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanScheduleds(rows)
}

func scanScheduleds(rows pgx.Rows) ([]model.ScheduledTransaction, error) {
	var list []model.ScheduledTransaction
	for rows.Next() {
		var s model.ScheduledTransaction
		if err := rows.Scan(
			&s.ID, &s.UserID, &s.AccountID, &s.Type, &s.Amount, &s.Currency,
			&s.Description, &s.CategoryID, &s.Fee, &s.NextDate, &s.Recurrence,
			&s.EndDate, &s.IsActive, &s.LastExecutedAt,
			&s.CreatedAt, &s.UpdatedAt,
		); err != nil {
			return nil, err
		}
		list = append(list, s)
	}
	return list, rows.Err()
}

func (r *ScheduledRepo) Update(ctx context.Context, id string, input model.UpdateScheduledTransactionInput) error {
	_, err := r.db.Exec(ctx, `
		UPDATE scheduled_transactions SET
		  account_id  = COALESCE($2, account_id),
		  type        = COALESCE($3, type),
		  amount      = COALESCE($4, amount),
		  currency    = COALESCE($5, currency),
		  description = COALESCE($6, description),
		  category_id = COALESCE($7, category_id),
		  fee         = COALESCE($8, fee),
		  next_date   = COALESCE($9, next_date),
		  recurrence  = COALESCE($10, recurrence),
		  end_date    = COALESCE($11, end_date),
		  is_active   = COALESCE($12, is_active),
		  updated_at  = $13
		WHERE id = $1
	`, id, input.AccountID, input.Type, input.Amount, input.Currency,
		input.Description, input.CategoryID, input.Fee, input.NextDate,
		input.Recurrence, input.EndDate, input.IsActive, time.Now())
	return err
}

func (r *ScheduledRepo) MarkExecuted(ctx context.Context, id string, nextDate time.Time, isActive bool) error {
	now := time.Now()
	_, err := r.db.Exec(ctx, `
		UPDATE scheduled_transactions
		SET next_date = $2, is_active = $3, last_executed_at = $4, updated_at = $4
		WHERE id = $1
	`, id, nextDate, isActive, now)
	return err
}

func (r *ScheduledRepo) Delete(ctx context.Context, id string) error {
	_, err := r.db.Exec(ctx, `DELETE FROM scheduled_transactions WHERE id = $1`, id)
	return err
}

func (r *ScheduledRepo) DeleteAllForUser(ctx context.Context, userID string) error {
	_, err := r.db.Exec(ctx, `DELETE FROM scheduled_transactions WHERE user_id = $1`, userID)
	return err
}
