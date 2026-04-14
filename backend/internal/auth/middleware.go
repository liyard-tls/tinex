package auth

import (
	"context"
	"net/http"
	"strings"

	firebaseAuth "firebase.google.com/go/v4/auth"
)

type contextKey string

const UserIDKey contextKey = "userID"

type Middleware struct {
	client *firebaseAuth.Client
}

func NewMiddleware(client *firebaseAuth.Client) *Middleware {
	return &Middleware{client: client}
}

func (m *Middleware) Authenticate(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			http.Error(w, "missing authorization header", http.StatusUnauthorized)
			return
		}

		token := strings.TrimPrefix(authHeader, "Bearer ")
		if token == authHeader {
			http.Error(w, "invalid authorization header format", http.StatusUnauthorized)
			return
		}

		decoded, err := m.client.VerifyIDToken(r.Context(), token)
		if err != nil {
			http.Error(w, "invalid token", http.StatusUnauthorized)
			return
		}

		ctx := context.WithValue(r.Context(), UserIDKey, decoded.UID)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func GetUserID(ctx context.Context) string {
	uid, _ := ctx.Value(UserIDKey).(string)
	return uid
}
