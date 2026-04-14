package handler

import (
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/liyard/tinex-api/internal/auth"
	"github.com/liyard/tinex-api/internal/model"
	"github.com/liyard/tinex-api/internal/repo"
)

type CategoryHandler struct {
	repo *repo.CategoryRepo
}

func NewCategoryHandler(r *repo.CategoryRepo) *CategoryHandler {
	return &CategoryHandler{repo: r}
}

// GET /api/v1/categories
func (h *CategoryHandler) List(w http.ResponseWriter, r *http.Request) {
	userID := auth.GetUserID(r.Context())
	cats, err := h.repo.GetByUserID(r.Context(), userID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to list categories")
		return
	}
	if cats == nil {
		cats = []model.Category{}
	}
	respondJSON(w, http.StatusOK, cats)
}

// POST /api/v1/categories
func (h *CategoryHandler) Create(w http.ResponseWriter, r *http.Request) {
	userID := auth.GetUserID(r.Context())
	var input model.CreateCategoryInput
	if err := decodeJSON(r, &input); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	cat, err := h.repo.Create(r.Context(), userID, input)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to create category")
		return
	}
	respondJSON(w, http.StatusCreated, cat)
}

// POST /api/v1/categories/defaults
func (h *CategoryHandler) CreateDefaults(w http.ResponseWriter, r *http.Request) {
	userID := auth.GetUserID(r.Context())
	if err := h.repo.CreateDefaultCategories(r.Context(), userID); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to seed default categories")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// GET /api/v1/categories/:id
func (h *CategoryHandler) Get(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	cat, err := h.repo.GetByID(r.Context(), id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			respondError(w, http.StatusNotFound, "category not found")
			return
		}
		respondError(w, http.StatusInternalServerError, "failed to get category")
		return
	}
	respondJSON(w, http.StatusOK, cat)
}

// GET /api/v1/categories/type/:type
func (h *CategoryHandler) ListByType(w http.ResponseWriter, r *http.Request) {
	userID := auth.GetUserID(r.Context())
	typ := chi.URLParam(r, "type")
	cats, err := h.repo.GetByType(r.Context(), userID, typ)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to list categories")
		return
	}
	if cats == nil {
		cats = []model.Category{}
	}
	respondJSON(w, http.StatusOK, cats)
}

// PUT /api/v1/categories/:id
func (h *CategoryHandler) Update(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var input model.UpdateCategoryInput
	if err := decodeJSON(r, &input); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if err := h.repo.Update(r.Context(), id, input); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to update category")
		return
	}
	cat, _ := h.repo.GetByID(r.Context(), id)
	respondJSON(w, http.StatusOK, cat)
}

// DELETE /api/v1/categories/:id
func (h *CategoryHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := h.repo.Delete(r.Context(), id); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to delete category")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
