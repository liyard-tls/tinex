package handler

import (
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/liyard/tinex-api/internal/auth"
	"github.com/liyard/tinex-api/internal/model"
	"github.com/liyard/tinex-api/internal/repo"
)

// ---- AnalyticsPreset ----

type AnalyticsPresetHandler struct {
	repo *repo.AnalyticsPresetRepo
}

func NewAnalyticsPresetHandler(r *repo.AnalyticsPresetRepo) *AnalyticsPresetHandler {
	return &AnalyticsPresetHandler{repo: r}
}

// GET /api/v1/analytics-presets
func (h *AnalyticsPresetHandler) List(w http.ResponseWriter, r *http.Request) {
	userID := auth.GetUserID(r.Context())
	presets, err := h.repo.GetByUserID(r.Context(), userID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to list presets")
		return
	}
	if presets == nil {
		presets = []model.AnalyticsPreset{}
	}
	respondJSON(w, http.StatusOK, presets)
}

// POST /api/v1/analytics-presets
func (h *AnalyticsPresetHandler) Create(w http.ResponseWriter, r *http.Request) {
	userID := auth.GetUserID(r.Context())
	var input model.CreateAnalyticsPresetInput
	if err := decodeJSON(r, &input); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	preset, err := h.repo.Create(r.Context(), userID, input)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to create preset")
		return
	}
	respondJSON(w, http.StatusCreated, preset)
}

// GET /api/v1/analytics-presets/:id
func (h *AnalyticsPresetHandler) Get(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	preset, err := h.repo.GetByID(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "preset not found")
		return
	}
	respondJSON(w, http.StatusOK, preset)
}

// PUT /api/v1/analytics-presets/:id
func (h *AnalyticsPresetHandler) Update(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var input model.UpdateAnalyticsPresetInput
	if err := decodeJSON(r, &input); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if err := h.repo.Update(r.Context(), id, input); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to update preset")
		return
	}
	preset, _ := h.repo.GetByID(r.Context(), id)
	respondJSON(w, http.StatusOK, preset)
}

// DELETE /api/v1/analytics-presets/:id
func (h *AnalyticsPresetHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := h.repo.Delete(r.Context(), id); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to delete preset")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ---- ChatMessage ----

type ChatMessageHandler struct {
	repo *repo.ChatMessageRepo
}

func NewChatMessageHandler(r *repo.ChatMessageRepo) *ChatMessageHandler {
	return &ChatMessageHandler{repo: r}
}

// GET /api/v1/chat-messages?limit=50
func (h *ChatMessageHandler) List(w http.ResponseWriter, r *http.Request) {
	userID := auth.GetUserID(r.Context())
	limit := 50
	if l := r.URL.Query().Get("limit"); l != "" {
		limit, _ = strconv.Atoi(l)
	}
	msgs, err := h.repo.GetRecentByUserID(r.Context(), userID, limit)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to list messages")
		return
	}
	if msgs == nil {
		msgs = []model.ChatMessage{}
	}
	respondJSON(w, http.StatusOK, msgs)
}

// POST /api/v1/chat-messages
func (h *ChatMessageHandler) Create(w http.ResponseWriter, r *http.Request) {
	userID := auth.GetUserID(r.Context())
	var input model.CreateChatMessageInput
	if err := decodeJSON(r, &input); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	msg, err := h.repo.Create(r.Context(), userID, input)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to create message")
		return
	}
	respondJSON(w, http.StatusCreated, msg)
}

// DELETE /api/v1/chat-messages/:id
func (h *ChatMessageHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := h.repo.Delete(r.Context(), id); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to delete message")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// DELETE /api/v1/chat-messages
func (h *ChatMessageHandler) DeleteAll(w http.ResponseWriter, r *http.Request) {
	userID := auth.GetUserID(r.Context())
	if err := h.repo.DeleteAllForUser(r.Context(), userID); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to delete messages")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ---- ImportedTransaction ----

type ImportHandler struct {
	repo *repo.ImportedTransactionRepo
}

func NewImportHandler(r *repo.ImportedTransactionRepo) *ImportHandler {
	return &ImportHandler{repo: r}
}

// POST /api/v1/imported-transactions/batch
func (h *ImportHandler) CreateBatch(w http.ResponseWriter, r *http.Request) {
	userID := auth.GetUserID(r.Context())
	var inputs []model.CreateImportedTransactionInput
	if err := decodeJSON(r, &inputs); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if err := h.repo.CreateBatch(r.Context(), userID, inputs); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to save import records")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// GET /api/v1/imported-transactions/hashes?source=trustee
func (h *ImportHandler) GetHashes(w http.ResponseWriter, r *http.Request) {
	userID := auth.GetUserID(r.Context())
	source := r.URL.Query().Get("source")
	hashes, err := h.repo.GetHashes(r.Context(), userID, source)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to get hashes")
		return
	}
	keys := make([]string, 0, len(hashes))
	for k := range hashes {
		keys = append(keys, k)
	}
	respondJSON(w, http.StatusOK, keys)
}

// DELETE /api/v1/imported-transactions/by-transaction/:transactionId
func (h *ImportHandler) DeleteByTransaction(w http.ResponseWriter, r *http.Request) {
	txID := chi.URLParam(r, "transactionId")
	if err := h.repo.DeleteByTransactionID(r.Context(), txID); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to delete import record")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
