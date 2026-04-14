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

type AccountHandler struct {
	repo *repo.AccountRepo
}

func NewAccountHandler(r *repo.AccountRepo) *AccountHandler {
	return &AccountHandler{repo: r}
}

// GET /api/v1/accounts
func (h *AccountHandler) List(w http.ResponseWriter, r *http.Request) {
	userID := auth.GetUserID(r.Context())
	accounts, err := h.repo.GetByUserID(r.Context(), userID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to list accounts")
		return
	}
	if accounts == nil {
		accounts = []model.Account{}
	}
	respondJSON(w, http.StatusOK, accounts)
}

// POST /api/v1/accounts
func (h *AccountHandler) Create(w http.ResponseWriter, r *http.Request) {
	userID := auth.GetUserID(r.Context())
	var input model.CreateAccountInput
	if err := decodeJSON(r, &input); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	account, err := h.repo.Create(r.Context(), userID, input)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to create account")
		return
	}
	respondJSON(w, http.StatusCreated, account)
}

// GET /api/v1/accounts/default
func (h *AccountHandler) GetDefault(w http.ResponseWriter, r *http.Request) {
	userID := auth.GetUserID(r.Context())
	account, err := h.repo.GetDefault(r.Context(), userID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			respondError(w, http.StatusNotFound, "no default account")
			return
		}
		respondError(w, http.StatusInternalServerError, "failed to get default account")
		return
	}
	respondJSON(w, http.StatusOK, account)
}

// GET /api/v1/accounts/balance
func (h *AccountHandler) TotalBalance(w http.ResponseWriter, r *http.Request) {
	userID := auth.GetUserID(r.Context())
	total, err := h.repo.GetTotalBalance(r.Context(), userID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to get balance")
		return
	}
	respondJSON(w, http.StatusOK, map[string]float64{"total": total})
}

// GET /api/v1/accounts/:id
func (h *AccountHandler) Get(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	account, err := h.repo.GetByID(r.Context(), id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			respondError(w, http.StatusNotFound, "account not found")
			return
		}
		respondError(w, http.StatusInternalServerError, "failed to get account")
		return
	}
	respondJSON(w, http.StatusOK, account)
}

// PUT /api/v1/accounts/:id
func (h *AccountHandler) Update(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var input model.UpdateAccountInput
	if err := decodeJSON(r, &input); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if err := h.repo.Update(r.Context(), id, input); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to update account")
		return
	}
	account, _ := h.repo.GetByID(r.Context(), id)
	respondJSON(w, http.StatusOK, account)
}

// PUT /api/v1/accounts/:id/default
func (h *AccountHandler) SetDefault(w http.ResponseWriter, r *http.Request) {
	userID := auth.GetUserID(r.Context())
	id := chi.URLParam(r, "id")
	if err := h.repo.SetDefault(r.Context(), userID, id); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to set default account")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// DELETE /api/v1/accounts/:id
func (h *AccountHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := h.repo.Delete(r.Context(), id); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to delete account")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
