package handler

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/liyard/tinex-api/internal/auth"
	"github.com/liyard/tinex-api/internal/model"
	"github.com/liyard/tinex-api/internal/repo"
)

type WishlistHandler struct {
	repo     *repo.WishlistRepo
	itemRepo *repo.WishlistItemRepo
}

func NewWishlistHandler(r *repo.WishlistRepo, ir *repo.WishlistItemRepo) *WishlistHandler {
	return &WishlistHandler{repo: r, itemRepo: ir}
}

// GET /api/v1/wishlists
func (h *WishlistHandler) List(w http.ResponseWriter, r *http.Request) {
	userID := auth.GetUserID(r.Context())
	list, err := h.repo.GetByUserID(r.Context(), userID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to list wishlists")
		return
	}
	if list == nil {
		list = []model.Wishlist{}
	}
	respondJSON(w, http.StatusOK, list)
}

// POST /api/v1/wishlists
func (h *WishlistHandler) Create(w http.ResponseWriter, r *http.Request) {
	userID := auth.GetUserID(r.Context())
	var input model.CreateWishlistInput
	if err := decodeJSON(r, &input); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	wl, err := h.repo.Create(r.Context(), userID, input)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to create wishlist")
		return
	}
	respondJSON(w, http.StatusCreated, wl)
}

// GET /api/v1/wishlists/:id
func (h *WishlistHandler) Get(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	wl, err := h.repo.GetByID(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "wishlist not found")
		return
	}
	respondJSON(w, http.StatusOK, wl)
}

// PUT /api/v1/wishlists/:id
func (h *WishlistHandler) Update(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var input model.UpdateWishlistInput
	if err := decodeJSON(r, &input); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if err := h.repo.Update(r.Context(), id, input); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to update wishlist")
		return
	}
	wl, _ := h.repo.GetByID(r.Context(), id)
	respondJSON(w, http.StatusOK, wl)
}

// DELETE /api/v1/wishlists/:id
func (h *WishlistHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := h.repo.Delete(r.Context(), id); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to delete wishlist")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// GET /api/v1/wishlists/:id/items
func (h *WishlistHandler) ListItems(w http.ResponseWriter, r *http.Request) {
	wishlistID := chi.URLParam(r, "id")
	items, err := h.itemRepo.GetByWishlistID(r.Context(), wishlistID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to list items")
		return
	}
	if items == nil {
		items = []model.WishlistItem{}
	}
	respondJSON(w, http.StatusOK, items)
}

// POST /api/v1/wishlists/:id/items
func (h *WishlistHandler) CreateItem(w http.ResponseWriter, r *http.Request) {
	userID := auth.GetUserID(r.Context())
	wishlistID := chi.URLParam(r, "id")
	var input model.CreateWishlistItemInput
	if err := decodeJSON(r, &input); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	item, err := h.itemRepo.Create(r.Context(), userID, wishlistID, input)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to create item")
		return
	}
	respondJSON(w, http.StatusCreated, item)
}

// PUT /api/v1/wishlists/:id/items/:itemId
func (h *WishlistHandler) UpdateItem(w http.ResponseWriter, r *http.Request) {
	itemID := chi.URLParam(r, "itemId")
	var input model.UpdateWishlistItemInput
	if err := decodeJSON(r, &input); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if err := h.itemRepo.Update(r.Context(), itemID, input); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to update item")
		return
	}
	item, _ := h.itemRepo.GetByID(r.Context(), itemID)
	respondJSON(w, http.StatusOK, item)
}

// PUT /api/v1/wishlists/:id/items/:itemId/toggle
func (h *WishlistHandler) ToggleItem(w http.ResponseWriter, r *http.Request) {
	itemID := chi.URLParam(r, "itemId")
	if err := h.itemRepo.ToggleConfirmed(r.Context(), itemID); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to toggle item")
		return
	}
	item, _ := h.itemRepo.GetByID(r.Context(), itemID)
	respondJSON(w, http.StatusOK, item)
}

// DELETE /api/v1/wishlists/:id/items/:itemId
func (h *WishlistHandler) DeleteItem(w http.ResponseWriter, r *http.Request) {
	itemID := chi.URLParam(r, "itemId")
	if err := h.itemRepo.Delete(r.Context(), itemID); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to delete item")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
