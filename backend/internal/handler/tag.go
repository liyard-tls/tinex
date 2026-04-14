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

type TagHandler struct {
	repo *repo.TagRepo
}

func NewTagHandler(r *repo.TagRepo) *TagHandler {
	return &TagHandler{repo: r}
}

// GET /api/v1/tags
func (h *TagHandler) List(w http.ResponseWriter, r *http.Request) {
	userID := auth.GetUserID(r.Context())
	tags, err := h.repo.GetByUserID(r.Context(), userID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to list tags")
		return
	}
	if tags == nil {
		tags = []model.Tag{}
	}
	respondJSON(w, http.StatusOK, tags)
}

// POST /api/v1/tags
func (h *TagHandler) Create(w http.ResponseWriter, r *http.Request) {
	userID := auth.GetUserID(r.Context())
	var input model.CreateTagInput
	if err := decodeJSON(r, &input); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	tag, err := h.repo.Create(r.Context(), userID, input)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to create tag")
		return
	}
	respondJSON(w, http.StatusCreated, tag)
}

// GET /api/v1/tags/:id
func (h *TagHandler) Get(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	tag, err := h.repo.GetByID(r.Context(), id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			respondError(w, http.StatusNotFound, "tag not found")
			return
		}
		respondError(w, http.StatusInternalServerError, "failed to get tag")
		return
	}
	respondJSON(w, http.StatusOK, tag)
}

// PUT /api/v1/tags/:id
func (h *TagHandler) Update(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var input model.UpdateTagInput
	if err := decodeJSON(r, &input); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if err := h.repo.Update(r.Context(), id, input); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to update tag")
		return
	}
	tag, _ := h.repo.GetByID(r.Context(), id)
	respondJSON(w, http.StatusOK, tag)
}

// DELETE /api/v1/tags/:id
func (h *TagHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := h.repo.Delete(r.Context(), id); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to delete tag")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
