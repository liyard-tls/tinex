package repo

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/liyard/tinex-api/internal/model"
)

type AnalyticsPresetRepo struct {
	db *pgxpool.Pool
}

func NewAnalyticsPresetRepo(db *pgxpool.Pool) *AnalyticsPresetRepo {
	return &AnalyticsPresetRepo{db: db}
}

func (r *AnalyticsPresetRepo) Create(ctx context.Context, userID string, input model.CreateAnalyticsPresetInput) (*model.AnalyticsPreset, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	var preset model.AnalyticsPreset
	if err := tx.QueryRow(ctx, `
		INSERT INTO analytics_presets (user_id, name) VALUES ($1,$2)
		RETURNING id, user_id, name, created_at, updated_at
	`, userID, input.Name).Scan(&preset.ID, &preset.UserID, &preset.Name, &preset.CreatedAt, &preset.UpdatedAt); err != nil {
		return nil, err
	}

	preset.CategoryIDs = input.CategoryIDs
	for _, catID := range input.CategoryIDs {
		if _, err := tx.Exec(ctx,
			`INSERT INTO analytics_preset_categories (preset_id, category_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
			preset.ID, catID); err != nil {
			return nil, err
		}
	}
	return &preset, tx.Commit(ctx)
}

func (r *AnalyticsPresetRepo) GetByID(ctx context.Context, id string) (*model.AnalyticsPreset, error) {
	var p model.AnalyticsPreset
	if err := r.db.QueryRow(ctx, `
		SELECT id, user_id, name, created_at, updated_at FROM analytics_presets WHERE id = $1
	`, id).Scan(&p.ID, &p.UserID, &p.Name, &p.CreatedAt, &p.UpdatedAt); err != nil {
		return nil, err
	}
	catIDs, err := r.getCategoryIDs(ctx, id)
	if err != nil {
		return nil, err
	}
	p.CategoryIDs = catIDs
	return &p, nil
}

func (r *AnalyticsPresetRepo) GetByUserID(ctx context.Context, userID string) ([]model.AnalyticsPreset, error) {
	rows, err := r.db.Query(ctx,
		`SELECT id, user_id, name, created_at, updated_at FROM analytics_presets WHERE user_id = $1 ORDER BY created_at`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var presets []model.AnalyticsPreset
	for rows.Next() {
		var p model.AnalyticsPreset
		if err := rows.Scan(&p.ID, &p.UserID, &p.Name, &p.CreatedAt, &p.UpdatedAt); err != nil {
			return nil, err
		}
		presets = append(presets, p)
	}
	if rows.Err() != nil {
		return nil, rows.Err()
	}

	for i := range presets {
		catIDs, err := r.getCategoryIDs(ctx, presets[i].ID)
		if err != nil {
			return nil, err
		}
		presets[i].CategoryIDs = catIDs
	}
	return presets, nil
}

func (r *AnalyticsPresetRepo) getCategoryIDs(ctx context.Context, presetID string) ([]string, error) {
	rows, err := r.db.Query(ctx,
		`SELECT category_id FROM analytics_preset_categories WHERE preset_id = $1`, presetID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}

func (r *AnalyticsPresetRepo) Update(ctx context.Context, id string, input model.UpdateAnalyticsPresetInput) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	if input.Name != nil {
		if _, err := tx.Exec(ctx,
			`UPDATE analytics_presets SET name = $2, updated_at = $3 WHERE id = $1`,
			id, *input.Name, time.Now()); err != nil {
			return err
		}
	}

	if input.CategoryIDs != nil {
		if _, err := tx.Exec(ctx, `DELETE FROM analytics_preset_categories WHERE preset_id = $1`, id); err != nil {
			return err
		}
		for _, catID := range input.CategoryIDs {
			if _, err := tx.Exec(ctx,
				`INSERT INTO analytics_preset_categories (preset_id, category_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
				id, catID); err != nil {
				return err
			}
		}
	}
	return tx.Commit(ctx)
}

func (r *AnalyticsPresetRepo) Delete(ctx context.Context, id string) error {
	_, err := r.db.Exec(ctx, `DELETE FROM analytics_presets WHERE id = $1`, id)
	return err
}

func (r *AnalyticsPresetRepo) DeleteAllForUser(ctx context.Context, userID string) error {
	_, err := r.db.Exec(ctx, `DELETE FROM analytics_presets WHERE user_id = $1`, userID)
	return err
}

// ---- ChatMessage ----

type ChatMessageRepo struct {
	db *pgxpool.Pool
}

func NewChatMessageRepo(db *pgxpool.Pool) *ChatMessageRepo {
	return &ChatMessageRepo{db: db}
}

func (r *ChatMessageRepo) Create(ctx context.Context, userID string, input model.CreateChatMessageInput) (*model.ChatMessage, error) {
	var msg model.ChatMessage
	if err := r.db.QueryRow(ctx, `
		INSERT INTO chat_messages (user_id, role, content) VALUES ($1,$2,$3)
		RETURNING id, user_id, role, content, created_at
	`, userID, input.Role, input.Content).Scan(&msg.ID, &msg.UserID, &msg.Role, &msg.Content, &msg.CreatedAt); err != nil {
		return nil, err
	}
	return &msg, nil
}

func (r *ChatMessageRepo) GetRecentByUserID(ctx context.Context, userID string, limit int) ([]model.ChatMessage, error) {
	if limit <= 0 {
		limit = 50
	}
	rows, err := r.db.Query(ctx, `
		SELECT id, user_id, role, content, created_at
		FROM chat_messages WHERE user_id = $1
		ORDER BY created_at DESC LIMIT $2
	`, userID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var msgs []model.ChatMessage
	for rows.Next() {
		var m model.ChatMessage
		if err := rows.Scan(&m.ID, &m.UserID, &m.Role, &m.Content, &m.CreatedAt); err != nil {
			return nil, err
		}
		msgs = append(msgs, m)
	}
	return msgs, rows.Err()
}

func (r *ChatMessageRepo) Delete(ctx context.Context, id string) error {
	_, err := r.db.Exec(ctx, `DELETE FROM chat_messages WHERE id = $1`, id)
	return err
}

func (r *ChatMessageRepo) DeleteAllForUser(ctx context.Context, userID string) error {
	_, err := r.db.Exec(ctx, `DELETE FROM chat_messages WHERE user_id = $1`, userID)
	return err
}

// ---- ImportedTransaction ----

type ImportedTransactionRepo struct {
	db *pgxpool.Pool
}

func NewImportedTransactionRepo(db *pgxpool.Pool) *ImportedTransactionRepo {
	return &ImportedTransactionRepo{db: db}
}

func (r *ImportedTransactionRepo) CreateBatch(ctx context.Context, userID string, inputs []model.CreateImportedTransactionInput) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	for _, inp := range inputs {
		if _, err := tx.Exec(ctx, `
			INSERT INTO imported_transactions (user_id, transaction_id, hash, source)
			VALUES ($1,$2,$3,$4)
			ON CONFLICT (user_id, hash, source) DO NOTHING
		`, userID, inp.TransactionID, inp.Hash, inp.Source); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

func (r *ImportedTransactionRepo) GetHashes(ctx context.Context, userID, source string) (map[string]struct{}, error) {
	rows, err := r.db.Query(ctx,
		`SELECT hash FROM imported_transactions WHERE user_id = $1 AND source = $2`, userID, source)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	hashes := make(map[string]struct{})
	for rows.Next() {
		var h string
		if err := rows.Scan(&h); err != nil {
			return nil, err
		}
		hashes[h] = struct{}{}
	}
	return hashes, rows.Err()
}

func (r *ImportedTransactionRepo) IsDuplicate(ctx context.Context, userID, hash, source string) (bool, error) {
	var exists bool
	err := r.db.QueryRow(ctx, `
		SELECT EXISTS(SELECT 1 FROM imported_transactions WHERE user_id = $1 AND hash = $2 AND source = $3)
	`, userID, hash, source).Scan(&exists)
	return exists, err
}

func (r *ImportedTransactionRepo) DeleteByTransactionID(ctx context.Context, txID string) error {
	_, err := r.db.Exec(ctx, `DELETE FROM imported_transactions WHERE transaction_id = $1`, txID)
	return err
}

func (r *ImportedTransactionRepo) DeleteAllForUser(ctx context.Context, userID string) error {
	_, err := r.db.Exec(ctx, `DELETE FROM imported_transactions WHERE user_id = $1`, userID)
	return err
}

// ensure pgx.Rows is used to avoid lint error
var _ pgx.Rows = nil
