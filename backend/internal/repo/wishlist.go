package repo

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/liyard/tinex-api/internal/model"
)

type WishlistRepo struct {
	db *pgxpool.Pool
}

func NewWishlistRepo(db *pgxpool.Pool) *WishlistRepo {
	return &WishlistRepo{db: db}
}

const wishlistCols = `id, user_id, name, COALESCE(description,''), created_at, updated_at`

func scanWishlist(row pgx.Row) (*model.Wishlist, error) {
	var w model.Wishlist
	if err := row.Scan(&w.ID, &w.UserID, &w.Name, &w.Description, &w.CreatedAt, &w.UpdatedAt); err != nil {
		return nil, err
	}
	return &w, nil
}

func (r *WishlistRepo) Create(ctx context.Context, userID string, input model.CreateWishlistInput) (*model.Wishlist, error) {
	row := r.db.QueryRow(ctx, `
		INSERT INTO wishlists (user_id, name, description) VALUES ($1,$2,$3)
		RETURNING `+wishlistCols,
		userID, input.Name, input.Description,
	)
	return scanWishlist(row)
}

func (r *WishlistRepo) GetByID(ctx context.Context, id string) (*model.Wishlist, error) {
	row := r.db.QueryRow(ctx, `SELECT `+wishlistCols+` FROM wishlists WHERE id = $1`, id)
	return scanWishlist(row)
}

func (r *WishlistRepo) GetByUserID(ctx context.Context, userID string) ([]model.Wishlist, error) {
	rows, err := r.db.Query(ctx,
		`SELECT `+wishlistCols+` FROM wishlists WHERE user_id = $1 ORDER BY created_at`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []model.Wishlist
	for rows.Next() {
		var w model.Wishlist
		if err := rows.Scan(&w.ID, &w.UserID, &w.Name, &w.Description, &w.CreatedAt, &w.UpdatedAt); err != nil {
			return nil, err
		}
		list = append(list, w)
	}
	return list, rows.Err()
}

func (r *WishlistRepo) Update(ctx context.Context, id string, input model.UpdateWishlistInput) error {
	_, err := r.db.Exec(ctx, `
		UPDATE wishlists SET
		  name        = COALESCE($2, name),
		  description = COALESCE($3, description),
		  updated_at  = $4
		WHERE id = $1
	`, id, input.Name, input.Description, time.Now())
	return err
}

func (r *WishlistRepo) Delete(ctx context.Context, id string) error {
	_, err := r.db.Exec(ctx, `DELETE FROM wishlists WHERE id = $1`, id)
	return err
}

func (r *WishlistRepo) DeleteAllForUser(ctx context.Context, userID string) error {
	_, err := r.db.Exec(ctx, `DELETE FROM wishlists WHERE user_id = $1`, userID)
	return err
}

// ---- WishlistItem ----

type WishlistItemRepo struct {
	db *pgxpool.Pool
}

func NewWishlistItemRepo(db *pgxpool.Pool) *WishlistItemRepo {
	return &WishlistItemRepo{db: db}
}

const wishlistItemCols = `id, wishlist_id, user_id, name, amount, currency,
	COALESCE(category_id,''), is_confirmed, added_at, created_at, updated_at`

func scanWishlistItem(row pgx.Row) (*model.WishlistItem, error) {
	var i model.WishlistItem
	if err := row.Scan(&i.ID, &i.WishlistID, &i.UserID, &i.Name, &i.Amount, &i.Currency,
		&i.CategoryID, &i.IsConfirmed, &i.AddedAt, &i.CreatedAt, &i.UpdatedAt); err != nil {
		return nil, err
	}
	return &i, nil
}

func (r *WishlistItemRepo) Create(ctx context.Context, userID, wishlistID string, input model.CreateWishlistItemInput) (*model.WishlistItem, error) {
	var catID *string
	if input.CategoryID != "" {
		catID = &input.CategoryID
	}
	row := r.db.QueryRow(ctx, `
		INSERT INTO wishlist_items (wishlist_id, user_id, name, amount, currency, category_id)
		VALUES ($1,$2,$3,$4,$5,$6)
		RETURNING `+wishlistItemCols,
		wishlistID, userID, input.Name, input.Amount, input.Currency, catID,
	)
	return scanWishlistItem(row)
}

func (r *WishlistItemRepo) GetByID(ctx context.Context, id string) (*model.WishlistItem, error) {
	row := r.db.QueryRow(ctx, `SELECT `+wishlistItemCols+` FROM wishlist_items WHERE id = $1`, id)
	return scanWishlistItem(row)
}

func (r *WishlistItemRepo) GetByWishlistID(ctx context.Context, wishlistID string) ([]model.WishlistItem, error) {
	rows, err := r.db.Query(ctx,
		`SELECT `+wishlistItemCols+` FROM wishlist_items WHERE wishlist_id = $1 ORDER BY added_at`, wishlistID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanWishlistItems(rows)
}

func (r *WishlistItemRepo) GetByUserID(ctx context.Context, userID string) ([]model.WishlistItem, error) {
	rows, err := r.db.Query(ctx,
		`SELECT `+wishlistItemCols+` FROM wishlist_items WHERE user_id = $1 ORDER BY added_at`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanWishlistItems(rows)
}

func scanWishlistItems(rows pgx.Rows) ([]model.WishlistItem, error) {
	var items []model.WishlistItem
	for rows.Next() {
		var i model.WishlistItem
		if err := rows.Scan(&i.ID, &i.WishlistID, &i.UserID, &i.Name, &i.Amount, &i.Currency,
			&i.CategoryID, &i.IsConfirmed, &i.AddedAt, &i.CreatedAt, &i.UpdatedAt); err != nil {
			return nil, err
		}
		items = append(items, i)
	}
	return items, rows.Err()
}

func (r *WishlistItemRepo) Update(ctx context.Context, id string, input model.UpdateWishlistItemInput) error {
	var catID *string
	if input.CategoryID != nil && *input.CategoryID != "" {
		catID = input.CategoryID
	}
	_, err := r.db.Exec(ctx, `
		UPDATE wishlist_items SET
		  name        = COALESCE($2, name),
		  amount      = COALESCE($3, amount),
		  currency    = COALESCE($4, currency),
		  category_id = COALESCE($5, category_id),
		  updated_at  = $6
		WHERE id = $1
	`, id, input.Name, input.Amount, input.Currency, catID, time.Now())
	return err
}

func (r *WishlistItemRepo) ToggleConfirmed(ctx context.Context, id string) error {
	_, err := r.db.Exec(ctx, `
		UPDATE wishlist_items SET is_confirmed = NOT is_confirmed, updated_at = $2 WHERE id = $1
	`, id, time.Now())
	return err
}

func (r *WishlistItemRepo) Delete(ctx context.Context, id string) error {
	_, err := r.db.Exec(ctx, `DELETE FROM wishlist_items WHERE id = $1`, id)
	return err
}

func (r *WishlistItemRepo) DeleteAllForWishlist(ctx context.Context, wishlistID string) error {
	_, err := r.db.Exec(ctx, `DELETE FROM wishlist_items WHERE wishlist_id = $1`, wishlistID)
	return err
}

func (r *WishlistItemRepo) DeleteAllForUser(ctx context.Context, userID string) error {
	_, err := r.db.Exec(ctx, `DELETE FROM wishlist_items WHERE user_id = $1`, userID)
	return err
}
