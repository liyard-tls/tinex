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

type BudgetHandler struct {
	repo *repo.BudgetRepo
}

func NewBudgetHandler(r *repo.BudgetRepo) *BudgetHandler {
	return &BudgetHandler{repo: r}
}

// GET /api/v1/budgets
func (h *BudgetHandler) List(w http.ResponseWriter, r *http.Request) {
	userID := auth.GetUserID(r.Context())
	budgets, err := h.repo.GetByUserID(r.Context(), userID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to list budgets")
		return
	}
	if budgets == nil {
		budgets = []model.Budget{}
	}
	respondJSON(w, http.StatusOK, budgets)
}

// POST /api/v1/budgets
func (h *BudgetHandler) Create(w http.ResponseWriter, r *http.Request) {
	userID := auth.GetUserID(r.Context())
	var input model.CreateBudgetInput
	if err := decodeJSON(r, &input); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	budget, err := h.repo.Create(r.Context(), userID, input)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to create budget")
		return
	}
	respondJSON(w, http.StatusCreated, budget)
}

// GET /api/v1/budgets/:id
func (h *BudgetHandler) Get(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	budget, err := h.repo.GetByID(r.Context(), id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			respondError(w, http.StatusNotFound, "budget not found")
			return
		}
		respondError(w, http.StatusInternalServerError, "failed to get budget")
		return
	}
	respondJSON(w, http.StatusOK, budget)
}

// GET /api/v1/budgets/by-category/:categoryId
func (h *BudgetHandler) ListByCategory(w http.ResponseWriter, r *http.Request) {
	userID := auth.GetUserID(r.Context())
	categoryID := chi.URLParam(r, "categoryId")
	budgets, err := h.repo.GetByCategoryID(r.Context(), userID, categoryID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to list budgets")
		return
	}
	if budgets == nil {
		budgets = []model.Budget{}
	}
	respondJSON(w, http.StatusOK, budgets)
}

// PUT /api/v1/budgets/:id
func (h *BudgetHandler) Update(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var input model.UpdateBudgetInput
	if err := decodeJSON(r, &input); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if err := h.repo.Update(r.Context(), id, input); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to update budget")
		return
	}
	budget, _ := h.repo.GetByID(r.Context(), id)
	respondJSON(w, http.StatusOK, budget)
}

// DELETE /api/v1/budgets/:id — soft delete
func (h *BudgetHandler) SoftDelete(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := h.repo.SoftDelete(r.Context(), id); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to delete budget")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// DELETE /api/v1/budgets/:id/hard — hard delete
func (h *BudgetHandler) HardDelete(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := h.repo.Delete(r.Context(), id); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to delete budget")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
