package handler

import (
	"errors"
	"net/http"

	"github.com/jackc/pgx/v5"
	"github.com/liyard/tinex-api/internal/auth"
	"github.com/liyard/tinex-api/internal/model"
	"github.com/liyard/tinex-api/internal/repo"
)

type UserHandler struct {
	users    *repo.UserRepo
	settings *repo.UserSettingsRepo
	cats     *repo.CategoryRepo
}

func NewUserHandler(users *repo.UserRepo, settings *repo.UserSettingsRepo, cats *repo.CategoryRepo) *UserHandler {
	return &UserHandler{users: users, settings: settings, cats: cats}
}

// POST /api/v1/users — upsert user on first login, seed default categories.
func (h *UserHandler) Upsert(w http.ResponseWriter, r *http.Request) {
	userID := auth.GetUserID(r.Context())

	var input model.UpsertUserInput
	if err := decodeJSON(r, &input); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	user, err := h.users.Upsert(r.Context(), userID, input)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to upsert user")
		return
	}

	// Ensure settings and default categories exist
	if _, err := h.settings.GetOrCreate(r.Context(), userID); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to init settings")
		return
	}
	_ = h.cats.CreateDefaultCategories(r.Context(), userID)

	respondJSON(w, http.StatusOK, user)
}

// GET /api/v1/users/me
func (h *UserHandler) GetMe(w http.ResponseWriter, r *http.Request) {
	userID := auth.GetUserID(r.Context())
	user, err := h.users.GetByID(r.Context(), userID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			respondError(w, http.StatusNotFound, "user not found")
			return
		}
		respondError(w, http.StatusInternalServerError, "failed to get user")
		return
	}
	respondJSON(w, http.StatusOK, user)
}

// DELETE /api/v1/users/data — wipe all user data.
func (h *UserHandler) DeleteAllData(w http.ResponseWriter, r *http.Request) {
	userID := auth.GetUserID(r.Context())
	if err := h.users.DeleteAllData(r.Context(), userID); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to delete user data")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ---- UserSettings ----

type SettingsHandler struct {
	repo *repo.UserSettingsRepo
}

func NewSettingsHandler(r *repo.UserSettingsRepo) *SettingsHandler {
	return &SettingsHandler{repo: r}
}

// GET /api/v1/settings
func (h *SettingsHandler) Get(w http.ResponseWriter, r *http.Request) {
	userID := auth.GetUserID(r.Context())
	s, err := h.repo.GetOrCreate(r.Context(), userID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to get settings")
		return
	}
	respondJSON(w, http.StatusOK, s)
}

// PUT /api/v1/settings
func (h *SettingsHandler) Update(w http.ResponseWriter, r *http.Request) {
	userID := auth.GetUserID(r.Context())
	var input model.UpdateUserSettingsInput
	if err := decodeJSON(r, &input); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if err := h.repo.Update(r.Context(), userID, input); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to update settings")
		return
	}
	s, _ := h.repo.Get(r.Context(), userID)
	respondJSON(w, http.StatusOK, s)
}

// DELETE /api/v1/settings
func (h *SettingsHandler) Delete(w http.ResponseWriter, r *http.Request) {
	userID := auth.GetUserID(r.Context())
	if err := h.repo.Delete(r.Context(), userID); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to delete settings")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
