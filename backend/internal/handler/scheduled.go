package handler

import (
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/liyard/tinex-api/internal/auth"
	"github.com/liyard/tinex-api/internal/model"
	"github.com/liyard/tinex-api/internal/repo"
)

type ScheduledHandler struct {
	repo    *repo.ScheduledRepo
	tagRepo *repo.TagRepo
}

func NewScheduledHandler(r *repo.ScheduledRepo, tagRepo *repo.TagRepo) *ScheduledHandler {
	return &ScheduledHandler{repo: r, tagRepo: tagRepo}
}

// GET /api/v1/scheduled
func (h *ScheduledHandler) List(w http.ResponseWriter, r *http.Request) {
	userID := auth.GetUserID(r.Context())
	list, err := h.repo.GetByUserID(r.Context(), userID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to list scheduled transactions")
		return
	}
	if list == nil {
		list = []model.ScheduledTransaction{}
	}
	respondJSON(w, http.StatusOK, list)
}

// GET /api/v1/scheduled/upcoming?days=7
func (h *ScheduledHandler) ListUpcoming(w http.ResponseWriter, r *http.Request) {
	userID := auth.GetUserID(r.Context())
	days := 7
	if d := r.URL.Query().Get("days"); d != "" {
		days, _ = strconv.Atoi(d)
	}
	list, err := h.repo.GetUpcoming(r.Context(), userID, days)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to list upcoming")
		return
	}
	if list == nil {
		list = []model.ScheduledTransaction{}
	}
	respondJSON(w, http.StatusOK, list)
}

// POST /api/v1/scheduled
func (h *ScheduledHandler) Create(w http.ResponseWriter, r *http.Request) {
	userID := auth.GetUserID(r.Context())
	var input model.CreateScheduledTransactionInput
	if err := decodeJSON(r, &input); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	s, err := h.repo.Create(r.Context(), userID, input)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to create scheduled transaction")
		return
	}
	if len(input.TagIDs) > 0 {
		_ = h.repo.SetTags(r.Context(), s.ID, input.TagIDs)
	}
	respondJSON(w, http.StatusCreated, s)
}

// PUT /api/v1/scheduled/:id
func (h *ScheduledHandler) Update(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var input model.UpdateScheduledTransactionInput
	if err := decodeJSON(r, &input); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if err := h.repo.Update(r.Context(), id, input); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to update scheduled transaction")
		return
	}
	if input.TagIDs != nil {
		_ = h.repo.SetTags(r.Context(), id, input.TagIDs)
	}
	list, _ := h.repo.GetByUserID(r.Context(), auth.GetUserID(r.Context()))
	for _, s := range list {
		if s.ID == id {
			respondJSON(w, http.StatusOK, s)
			return
		}
	}
	w.WriteHeader(http.StatusNoContent)
}

// DELETE /api/v1/scheduled/:id
func (h *ScheduledHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := h.repo.Delete(r.Context(), id); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to delete scheduled transaction")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
