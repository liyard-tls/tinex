package handler

import (
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/liyard/tinex-api/internal/auth"
	"github.com/liyard/tinex-api/internal/model"
	"github.com/liyard/tinex-api/internal/repo"
	"github.com/liyard/tinex-api/internal/service"
)

type TransactionHandler struct {
	svc    *service.TransactionService
	txRepo *repo.TransactionRepo
}

func NewTransactionHandler(svc *service.TransactionService, txRepo *repo.TransactionRepo) *TransactionHandler {
	return &TransactionHandler{svc: svc, txRepo: txRepo}
}

// GET /api/v1/transactions
func (h *TransactionHandler) List(w http.ResponseWriter, r *http.Request) {
	userID := auth.GetUserID(r.Context())
	q := r.URL.Query()
	opts := model.TransactionListOptions{
		OrderBy:  q.Get("orderBy"),
		OrderDir: q.Get("orderDir"),
	}
	if lim := q.Get("limit"); lim != "" {
		opts.Limit, _ = strconv.Atoi(lim)
	}
	txs, err := h.txRepo.GetByUserID(r.Context(), userID, opts)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to list transactions")
		return
	}
	txs = h.svc.WithTags(r.Context(), txs)
	if txs == nil {
		txs = []model.Transaction{}
	}
	respondJSON(w, http.StatusOK, txs)
}

// POST /api/v1/transactions
func (h *TransactionHandler) Create(w http.ResponseWriter, r *http.Request) {
	userID := auth.GetUserID(r.Context())
	var input model.CreateTransactionInput
	if err := decodeJSON(r, &input); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	tx, err := h.svc.Create(r.Context(), userID, input)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to create transaction")
		return
	}
	respondJSON(w, http.StatusCreated, tx)
}

// GET /api/v1/transactions/:id
func (h *TransactionHandler) Get(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	tx, err := h.txRepo.GetByID(r.Context(), id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			respondError(w, http.StatusNotFound, "transaction not found")
			return
		}
		respondError(w, http.StatusInternalServerError, "failed to get transaction")
		return
	}
	respondJSON(w, http.StatusOK, tx)
}

// PUT /api/v1/transactions/:id
func (h *TransactionHandler) Update(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var input model.UpdateTransactionInput
	if err := decodeJSON(r, &input); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	tx, err := h.svc.Update(r.Context(), id, input)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to update transaction")
		return
	}
	respondJSON(w, http.StatusOK, tx)
}

// DELETE /api/v1/transactions/:id
func (h *TransactionHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := h.svc.Delete(r.Context(), id); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to delete transaction")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// GET /api/v1/transactions/by-account/:accountId
func (h *TransactionHandler) ListByAccount(w http.ResponseWriter, r *http.Request) {
	userID := auth.GetUserID(r.Context())
	accountID := chi.URLParam(r, "accountId")
	txs, err := h.txRepo.GetByAccountID(r.Context(), accountID, userID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to list transactions")
		return
	}
	txs = h.svc.WithTags(r.Context(), txs)
	if txs == nil {
		txs = []model.Transaction{}
	}
	respondJSON(w, http.StatusOK, txs)
}

// GET /api/v1/transactions/by-category/:categoryId
func (h *TransactionHandler) ListByCategory(w http.ResponseWriter, r *http.Request) {
	userID := auth.GetUserID(r.Context())
	categoryID := chi.URLParam(r, "categoryId")
	txs, err := h.txRepo.GetByCategoryID(r.Context(), userID, categoryID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to list transactions")
		return
	}
	txs = h.svc.WithTags(r.Context(), txs)
	if txs == nil {
		txs = []model.Transaction{}
	}
	respondJSON(w, http.StatusOK, txs)
}

// GET /api/v1/transactions/range?start=&end=
func (h *TransactionHandler) ListByRange(w http.ResponseWriter, r *http.Request) {
	userID := auth.GetUserID(r.Context())
	q := r.URL.Query()
	start, err := time.Parse(time.RFC3339, q.Get("start"))
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid start date (use RFC3339)")
		return
	}
	end, err := time.Parse(time.RFC3339, q.Get("end"))
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid end date (use RFC3339)")
		return
	}
	txs, err := h.txRepo.GetByDateRange(r.Context(), userID, start, end)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to list transactions")
		return
	}
	txs = h.svc.WithTags(r.Context(), txs)
	if txs == nil {
		txs = []model.Transaction{}
	}
	respondJSON(w, http.StatusOK, txs)
}

// GET /api/v1/transactions/stats?start=&end=
func (h *TransactionHandler) Stats(w http.ResponseWriter, r *http.Request) {
	userID := auth.GetUserID(r.Context())
	q := r.URL.Query()
	start, err := time.Parse(time.RFC3339, q.Get("start"))
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid start date (use RFC3339)")
		return
	}
	end, err := time.Parse(time.RFC3339, q.Get("end"))
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid end date (use RFC3339)")
		return
	}
	stats, err := h.txRepo.GetStats(r.Context(), userID, start, end)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to get stats")
		return
	}
	respondJSON(w, http.StatusOK, stats)
}
