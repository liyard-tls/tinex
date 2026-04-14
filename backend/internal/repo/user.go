package repo

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/liyard/tinex-api/internal/model"
)

type UserRepo struct {
	db *pgxpool.Pool
}

func NewUserRepo(db *pgxpool.Pool) *UserRepo {
	return &UserRepo{db: db}
}

func (r *UserRepo) Upsert(ctx context.Context, id string, input model.UpsertUserInput) (*model.User, error) {
	row := r.db.QueryRow(ctx, `
		INSERT INTO users (id, email, display_name, photo_url)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (id) DO UPDATE
		  SET email        = EXCLUDED.email,
		      display_name = EXCLUDED.display_name,
		      photo_url    = EXCLUDED.photo_url,
		      updated_at   = now()
		RETURNING id, email, COALESCE(display_name,''), COALESCE(photo_url,''), created_at, updated_at
	`, id, input.Email, input.DisplayName, input.PhotoURL)

	var u model.User
	if err := row.Scan(&u.ID, &u.Email, &u.DisplayName, &u.PhotoURL, &u.CreatedAt, &u.UpdatedAt); err != nil {
		return nil, err
	}
	return &u, nil
}

func (r *UserRepo) GetByID(ctx context.Context, id string) (*model.User, error) {
	row := r.db.QueryRow(ctx, `
		SELECT id, email, COALESCE(display_name,''), COALESCE(photo_url,''), created_at, updated_at
		FROM users WHERE id = $1
	`, id)

	var u model.User
	if err := row.Scan(&u.ID, &u.Email, &u.DisplayName, &u.PhotoURL, &u.CreatedAt, &u.UpdatedAt); err != nil {
		return nil, err
	}
	return &u, nil
}

func (r *UserRepo) DeleteAllData(ctx context.Context, userID string) error {
	// Cascading deletes handle child rows; just delete the user row.
	// But we keep the user record — only wipe data.
	tables := []string{
		"imported_transactions", "chat_messages", "analytics_presets",
		"wishlist_items", "wishlists", "scheduled_transactions",
		"budgets", "transactions", "tags", "categories", "accounts",
		"user_settings",
	}
	for _, tbl := range tables {
		if _, err := r.db.Exec(ctx, "DELETE FROM "+tbl+" WHERE user_id = $1", userID); err != nil {
			return err
		}
	}
	return nil
}

// ---- UserSettings ----

type UserSettingsRepo struct {
	db *pgxpool.Pool
}

func NewUserSettingsRepo(db *pgxpool.Pool) *UserSettingsRepo {
	return &UserSettingsRepo{db: db}
}

func (r *UserSettingsRepo) GetOrCreate(ctx context.Context, userID string) (*model.UserSettings, error) {
	_, err := r.db.Exec(ctx, `
		INSERT INTO user_settings (user_id) VALUES ($1)
		ON CONFLICT (user_id) DO NOTHING
	`, userID)
	if err != nil {
		return nil, err
	}
	return r.Get(ctx, userID)
}

func (r *UserSettingsRepo) Get(ctx context.Context, userID string) (*model.UserSettings, error) {
	row := r.db.QueryRow(ctx, `
		SELECT user_id, base_currency,
		       COALESCE(active_analytics_preset_id,''),
		       COALESCE(seen_version,''),
		       created_at, updated_at
		FROM user_settings WHERE user_id = $1
	`, userID)

	var s model.UserSettings
	if err := row.Scan(&s.UserID, &s.BaseCurrency, &s.ActiveAnalyticsPresetID, &s.SeenVersion, &s.CreatedAt, &s.UpdatedAt); err != nil {
		return nil, err
	}
	return &s, nil
}

func (r *UserSettingsRepo) Update(ctx context.Context, userID string, input model.UpdateUserSettingsInput) error {
	now := time.Now()
	_, err := r.db.Exec(ctx, `
		UPDATE user_settings SET
		  base_currency              = COALESCE($2, base_currency),
		  active_analytics_preset_id = COALESCE($3, active_analytics_preset_id),
		  seen_version               = COALESCE($4, seen_version),
		  updated_at                 = $5
		WHERE user_id = $1
	`, userID, input.BaseCurrency, input.ActiveAnalyticsPresetID, input.SeenVersion, now)
	return err
}

func (r *UserSettingsRepo) Delete(ctx context.Context, userID string) error {
	_, err := r.db.Exec(ctx, "DELETE FROM user_settings WHERE user_id = $1", userID)
	return err
}
