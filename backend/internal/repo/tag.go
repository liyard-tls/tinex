package repo

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/liyard/tinex-api/internal/model"
)

type TagRepo struct {
	db *pgxpool.Pool
}

func NewTagRepo(db *pgxpool.Pool) *TagRepo {
	return &TagRepo{db: db}
}

const tagCols = `id, user_id, name, color, created_at, updated_at`

func scanTag(row pgx.Row) (*model.Tag, error) {
	var t model.Tag
	if err := row.Scan(&t.ID, &t.UserID, &t.Name, &t.Color, &t.CreatedAt, &t.UpdatedAt); err != nil {
		return nil, err
	}
	return &t, nil
}

func (r *TagRepo) Create(ctx context.Context, userID string, input model.CreateTagInput) (*model.Tag, error) {
	row := r.db.QueryRow(ctx, `
		INSERT INTO tags (user_id, name, color) VALUES ($1,$2,$3)
		RETURNING `+tagCols,
		userID, input.Name, input.Color,
	)
	return scanTag(row)
}

func (r *TagRepo) GetByID(ctx context.Context, id string) (*model.Tag, error) {
	row := r.db.QueryRow(ctx, `SELECT `+tagCols+` FROM tags WHERE id = $1`, id)
	return scanTag(row)
}

func (r *TagRepo) GetByUserID(ctx context.Context, userID string) ([]model.Tag, error) {
	rows, err := r.db.Query(ctx, `SELECT `+tagCols+` FROM tags WHERE user_id = $1 ORDER BY name`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tags []model.Tag
	for rows.Next() {
		var t model.Tag
		if err := rows.Scan(&t.ID, &t.UserID, &t.Name, &t.Color, &t.CreatedAt, &t.UpdatedAt); err != nil {
			return nil, err
		}
		tags = append(tags, t)
	}
	return tags, rows.Err()
}

func (r *TagRepo) GetByTransactionID(ctx context.Context, txID string) ([]model.Tag, error) {
	rows, err := r.db.Query(ctx, `
		SELECT t.id, t.user_id, t.name, t.color, t.created_at, t.updated_at
		FROM tags t
		JOIN transaction_tags tt ON tt.tag_id = t.id
		WHERE tt.transaction_id = $1
	`, txID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tags []model.Tag
	for rows.Next() {
		var t model.Tag
		if err := rows.Scan(&t.ID, &t.UserID, &t.Name, &t.Color, &t.CreatedAt, &t.UpdatedAt); err != nil {
			return nil, err
		}
		tags = append(tags, t)
	}
	return tags, rows.Err()
}

func (r *TagRepo) Update(ctx context.Context, id string, input model.UpdateTagInput) error {
	_, err := r.db.Exec(ctx, `
		UPDATE tags SET
		  name       = COALESCE($2, name),
		  color      = COALESCE($3, color),
		  updated_at = $4
		WHERE id = $1
	`, id, input.Name, input.Color, time.Now())
	return err
}

func (r *TagRepo) Delete(ctx context.Context, id string) error {
	_, err := r.db.Exec(ctx, `DELETE FROM tags WHERE id = $1`, id)
	return err
}

func (r *TagRepo) DeleteAllForUser(ctx context.Context, userID string) error {
	_, err := r.db.Exec(ctx, `DELETE FROM tags WHERE user_id = $1`, userID)
	return err
}
