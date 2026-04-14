package repo

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/liyard/tinex-api/internal/model"
)

type CategoryRepo struct {
	db *pgxpool.Pool
}

func NewCategoryRepo(db *pgxpool.Pool) *CategoryRepo {
	return &CategoryRepo{db: db}
}

const categoryCols = `id, user_id, name, type, icon, color,
	COALESCE(parent_id,''), is_default, is_system, created_at, updated_at`

func scanCategory(row pgx.Row) (*model.Category, error) {
	var c model.Category
	if err := row.Scan(&c.ID, &c.UserID, &c.Name, &c.Type, &c.Icon, &c.Color,
		&c.ParentID, &c.IsDefault, &c.IsSystem, &c.CreatedAt, &c.UpdatedAt); err != nil {
		return nil, err
	}
	return &c, nil
}

func (r *CategoryRepo) Create(ctx context.Context, userID string, input model.CreateCategoryInput) (*model.Category, error) {
	var parentID *string
	if input.ParentID != "" {
		parentID = &input.ParentID
	}
	row := r.db.QueryRow(ctx, `
		INSERT INTO categories (user_id, name, type, icon, color, parent_id, is_default)
		VALUES ($1,$2,$3,$4,$5,$6,$7)
		RETURNING `+categoryCols,
		userID, input.Name, input.Type, input.Icon, input.Color, parentID, input.IsDefault,
	)
	return scanCategory(row)
}

func (r *CategoryRepo) createSystem(ctx context.Context, userID, name, typ, icon, color string) error {
	_, err := r.db.Exec(ctx, `
		INSERT INTO categories (user_id, name, type, icon, color, is_default, is_system)
		VALUES ($1,$2,$3,$4,$5,TRUE,TRUE)
		ON CONFLICT DO NOTHING`,
		userID, name, typ, icon, color)
	return err
}

func (r *CategoryRepo) CreateDefaultCategories(ctx context.Context, userID string) error {
	type cat struct{ name, typ, icon, color string }
	defaults := []cat{
		{"Transfer Out", "expense", "arrow-right-left", "#6B7280"},
		{"Transfer In", "income", "arrow-right-left", "#6B7280"},
		{"Salary", "income", "briefcase", "#10B981"},
		{"Freelance", "income", "laptop", "#3B82F6"},
		{"Investment", "income", "trending-up", "#8B5CF6"},
		{"Gift", "income", "gift", "#F59E0B"},
		{"Other Income", "income", "plus-circle", "#6B7280"},
		{"Food & Dining", "expense", "utensils", "#EF4444"},
		{"Transport", "expense", "car", "#F97316"},
		{"Shopping", "expense", "shopping-bag", "#EC4899"},
		{"Entertainment", "expense", "film", "#8B5CF6"},
		{"Bills & Utilities", "expense", "zap", "#EAB308"},
		{"Health", "expense", "heart", "#EF4444"},
		{"Education", "expense", "book", "#3B82F6"},
		{"Travel", "expense", "plane", "#06B6D4"},
		{"Housing", "expense", "home", "#10B981"},
		{"Personal Care", "expense", "user", "#F59E0B"},
		{"Other Expense", "expense", "minus-circle", "#6B7280"},
	}
	for _, d := range defaults {
		if err := r.createSystem(ctx, userID, d.name, d.typ, d.icon, d.color); err != nil {
			return err
		}
	}
	return nil
}

func (r *CategoryRepo) GetByID(ctx context.Context, id string) (*model.Category, error) {
	row := r.db.QueryRow(ctx, `SELECT `+categoryCols+` FROM categories WHERE id = $1`, id)
	return scanCategory(row)
}

func (r *CategoryRepo) GetByUserID(ctx context.Context, userID string) ([]model.Category, error) {
	rows, err := r.db.Query(ctx, `SELECT `+categoryCols+` FROM categories WHERE user_id = $1 ORDER BY name`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanCategories(rows)
}

func (r *CategoryRepo) GetByType(ctx context.Context, userID, typ string) ([]model.Category, error) {
	rows, err := r.db.Query(ctx, `SELECT `+categoryCols+` FROM categories WHERE user_id = $1 AND type = $2 ORDER BY name`, userID, typ)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanCategories(rows)
}

func scanCategories(rows pgx.Rows) ([]model.Category, error) {
	var cats []model.Category
	for rows.Next() {
		var c model.Category
		if err := rows.Scan(&c.ID, &c.UserID, &c.Name, &c.Type, &c.Icon, &c.Color,
			&c.ParentID, &c.IsDefault, &c.IsSystem, &c.CreatedAt, &c.UpdatedAt); err != nil {
			return nil, err
		}
		cats = append(cats, c)
	}
	return cats, rows.Err()
}

func (r *CategoryRepo) Update(ctx context.Context, id string, input model.UpdateCategoryInput) error {
	var parentID *string
	if input.ParentID != nil && *input.ParentID != "" {
		parentID = input.ParentID
	}
	_, err := r.db.Exec(ctx, `
		UPDATE categories SET
		  name      = COALESCE($2, name),
		  type      = COALESCE($3, type),
		  icon      = COALESCE($4, icon),
		  color     = COALESCE($5, color),
		  parent_id = COALESCE($6, parent_id),
		  updated_at = $7
		WHERE id = $1 AND is_system = FALSE
	`, id, input.Name, input.Type, input.Icon, input.Color, parentID, time.Now())
	return err
}

func (r *CategoryRepo) Delete(ctx context.Context, id string) error {
	_, err := r.db.Exec(ctx, `DELETE FROM categories WHERE id = $1 AND is_system = FALSE`, id)
	return err
}

func (r *CategoryRepo) DeleteAllForUser(ctx context.Context, userID string) error {
	_, err := r.db.Exec(ctx, `DELETE FROM categories WHERE user_id = $1 AND is_system = FALSE`, userID)
	return err
}
