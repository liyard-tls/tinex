package repo

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/liyard/tinex-api/internal/model"
)

type BudgetRepo struct {
	db *pgxpool.Pool
}

func NewBudgetRepo(db *pgxpool.Pool) *BudgetRepo {
	return &BudgetRepo{db: db}
}

const budgetCols = `id, user_id, COALESCE(category_id,''), amount, currency, period,
	start_date, end_date, alert_threshold, is_active, created_at, updated_at`

func scanBudget(row pgx.Row) (*model.Budget, error) {
	var b model.Budget
	if err := row.Scan(
		&b.ID, &b.UserID, &b.CategoryID, &b.Amount, &b.Currency, &b.Period,
		&b.StartDate, &b.EndDate, &b.AlertThreshold, &b.IsActive, &b.CreatedAt, &b.UpdatedAt,
	); err != nil {
		return nil, err
	}
	return &b, nil
}

func (r *BudgetRepo) Create(ctx context.Context, userID string, input model.CreateBudgetInput) (*model.Budget, error) {
	var catID *string
	if input.CategoryID != "" {
		catID = &input.CategoryID
	}
	row := r.db.QueryRow(ctx, `
		INSERT INTO budgets (user_id, category_id, amount, currency, period, start_date, end_date, alert_threshold)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
		RETURNING `+budgetCols,
		userID, catID, input.Amount, input.Currency, input.Period,
		input.StartDate, input.EndDate, input.AlertThreshold,
	)
	return scanBudget(row)
}

func (r *BudgetRepo) GetByID(ctx context.Context, id string) (*model.Budget, error) {
	row := r.db.QueryRow(ctx, `SELECT `+budgetCols+` FROM budgets WHERE id = $1`, id)
	return scanBudget(row)
}

func (r *BudgetRepo) GetByUserID(ctx context.Context, userID string) ([]model.Budget, error) {
	rows, err := r.db.Query(ctx,
		`SELECT `+budgetCols+` FROM budgets WHERE user_id = $1 ORDER BY created_at DESC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanBudgets(rows)
}

func (r *BudgetRepo) GetByCategoryID(ctx context.Context, userID, categoryID string) ([]model.Budget, error) {
	rows, err := r.db.Query(ctx,
		`SELECT `+budgetCols+` FROM budgets WHERE user_id = $1 AND category_id = $2`, userID, categoryID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanBudgets(rows)
}

func scanBudgets(rows pgx.Rows) ([]model.Budget, error) {
	var budgets []model.Budget
	for rows.Next() {
		var b model.Budget
		if err := rows.Scan(
			&b.ID, &b.UserID, &b.CategoryID, &b.Amount, &b.Currency, &b.Period,
			&b.StartDate, &b.EndDate, &b.AlertThreshold, &b.IsActive, &b.CreatedAt, &b.UpdatedAt,
		); err != nil {
			return nil, err
		}
		budgets = append(budgets, b)
	}
	return budgets, rows.Err()
}

func (r *BudgetRepo) Update(ctx context.Context, id string, input model.UpdateBudgetInput) error {
	_, err := r.db.Exec(ctx, `
		UPDATE budgets SET
		  category_id     = COALESCE($2, category_id),
		  amount          = COALESCE($3, amount),
		  currency        = COALESCE($4, currency),
		  period          = COALESCE($5, period),
		  start_date      = COALESCE($6, start_date),
		  end_date        = COALESCE($7, end_date),
		  alert_threshold = COALESCE($8, alert_threshold),
		  is_active       = COALESCE($9, is_active),
		  updated_at      = $10
		WHERE id = $1
	`, id, input.CategoryID, input.Amount, input.Currency, input.Period,
		input.StartDate, input.EndDate, input.AlertThreshold, input.IsActive, time.Now())
	return err
}

// SoftDelete sets is_active = FALSE.
func (r *BudgetRepo) SoftDelete(ctx context.Context, id string) error {
	_, err := r.db.Exec(ctx, `UPDATE budgets SET is_active = FALSE, updated_at = $2 WHERE id = $1`, id, time.Now())
	return err
}

// Delete permanently removes the budget.
func (r *BudgetRepo) Delete(ctx context.Context, id string) error {
	_, err := r.db.Exec(ctx, `DELETE FROM budgets WHERE id = $1`, id)
	return err
}

func (r *BudgetRepo) DeleteAllForUser(ctx context.Context, userID string) error {
	_, err := r.db.Exec(ctx, `DELETE FROM budgets WHERE user_id = $1`, userID)
	return err
}
