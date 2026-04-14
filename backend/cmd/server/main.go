package main

import (
	"context"
	"log"
	"net/http"
	"os"

	firebase "firebase.google.com/go/v4"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"google.golang.org/api/option"

	appdb "github.com/liyard/tinex-api/internal/db"

	"github.com/liyard/tinex-api/internal/auth"
	"github.com/liyard/tinex-api/internal/handler"
	"github.com/liyard/tinex-api/internal/repo"
	"github.com/liyard/tinex-api/internal/service"
)

func main() {
	ctx := context.Background()

	// Database
	db, err := appdb.Connect(ctx)
	if err != nil {
		log.Fatalf("db connect: %v", err)
	}
	defer db.Close()
	log.Println("connected to database")

	// Firebase Auth
	var firebaseApp *firebase.App
	credFile := os.Getenv("FIREBASE_CREDENTIALS_FILE")
	if credFile != "" {
		firebaseApp, err = firebase.NewApp(ctx, nil, option.WithCredentialsFile(credFile))
	} else {
		// Falls back to GOOGLE_APPLICATION_CREDENTIALS env var
		firebaseApp, err = firebase.NewApp(ctx, nil)
	}
	if err != nil {
		log.Fatalf("firebase init: %v", err)
	}
	authClient, err := firebaseApp.Auth(ctx)
	if err != nil {
		log.Fatalf("firebase auth: %v", err)
	}
	authMiddleware := auth.NewMiddleware(authClient)

	// Repos
	userRepo := repo.NewUserRepo(db)
	settingsRepo := repo.NewUserSettingsRepo(db)
	accountRepo := repo.NewAccountRepo(db)
	categoryRepo := repo.NewCategoryRepo(db)
	tagRepo := repo.NewTagRepo(db)
	txRepo := repo.NewTransactionRepo(db)
	budgetRepo := repo.NewBudgetRepo(db)
	scheduledRepo := repo.NewScheduledRepo(db)
	wishlistRepo := repo.NewWishlistRepo(db)
	wishlistItemRepo := repo.NewWishlistItemRepo(db)
	analyticsRepo := repo.NewAnalyticsPresetRepo(db)
	chatRepo := repo.NewChatMessageRepo(db)
	importRepo := repo.NewImportedTransactionRepo(db)

	// Services
	txService := service.NewTransactionService(db, txRepo, accountRepo, tagRepo, importRepo)

	// Handlers
	userH := handler.NewUserHandler(userRepo, settingsRepo, categoryRepo)
	settingsH := handler.NewSettingsHandler(settingsRepo)
	accountH := handler.NewAccountHandler(accountRepo)
	categoryH := handler.NewCategoryHandler(categoryRepo)
	tagH := handler.NewTagHandler(tagRepo)
	txH := handler.NewTransactionHandler(txService, txRepo)
	budgetH := handler.NewBudgetHandler(budgetRepo)
	scheduledH := handler.NewScheduledHandler(scheduledRepo, tagRepo)
	wishlistH := handler.NewWishlistHandler(wishlistRepo, wishlistItemRepo)
	analyticsH := handler.NewAnalyticsPresetHandler(analyticsRepo)
	chatH := handler.NewChatMessageHandler(chatRepo)
	importH := handler.NewImportHandler(importRepo)

	// Router
	r := chi.NewRouter()
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.RequestID)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   allowedOrigins(),
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})

	r.Route("/api/v1", func(r chi.Router) {
		r.Use(authMiddleware.Authenticate)

		// Users
		r.Post("/users", userH.Upsert)
		r.Get("/users/me", userH.GetMe)
		r.Delete("/users/data", userH.DeleteAllData)

		// Settings
		r.Get("/settings", settingsH.Get)
		r.Put("/settings", settingsH.Update)
		r.Delete("/settings", settingsH.Delete)

		// Accounts
		r.Get("/accounts", accountH.List)
		r.Post("/accounts", accountH.Create)
		r.Get("/accounts/default", accountH.GetDefault)
		r.Get("/accounts/balance", accountH.TotalBalance)
		r.Get("/accounts/{id}", accountH.Get)
		r.Put("/accounts/{id}", accountH.Update)
		r.Put("/accounts/{id}/default", accountH.SetDefault)
		r.Delete("/accounts/{id}", accountH.Delete)

		// Categories
		r.Get("/categories", categoryH.List)
		r.Post("/categories", categoryH.Create)
		r.Post("/categories/defaults", categoryH.CreateDefaults)
		r.Get("/categories/type/{type}", categoryH.ListByType)
		r.Get("/categories/{id}", categoryH.Get)
		r.Put("/categories/{id}", categoryH.Update)
		r.Delete("/categories/{id}", categoryH.Delete)

		// Tags
		r.Get("/tags", tagH.List)
		r.Post("/tags", tagH.Create)
		r.Get("/tags/{id}", tagH.Get)
		r.Put("/tags/{id}", tagH.Update)
		r.Delete("/tags/{id}", tagH.Delete)

		// Transactions
		r.Get("/transactions", txH.List)
		r.Post("/transactions", txH.Create)
		r.Get("/transactions/range", txH.ListByRange)
		r.Get("/transactions/stats", txH.Stats)
		r.Get("/transactions/by-account/{accountId}", txH.ListByAccount)
		r.Get("/transactions/by-category/{categoryId}", txH.ListByCategory)
		r.Get("/transactions/{id}", txH.Get)
		r.Put("/transactions/{id}", txH.Update)
		r.Delete("/transactions/{id}", txH.Delete)

		// Budgets
		r.Get("/budgets", budgetH.List)
		r.Post("/budgets", budgetH.Create)
		r.Get("/budgets/by-category/{categoryId}", budgetH.ListByCategory)
		r.Get("/budgets/{id}", budgetH.Get)
		r.Put("/budgets/{id}", budgetH.Update)
		r.Delete("/budgets/{id}", budgetH.SoftDelete)
		r.Delete("/budgets/{id}/hard", budgetH.HardDelete)

		// Scheduled transactions
		r.Get("/scheduled", scheduledH.List)
		r.Post("/scheduled", scheduledH.Create)
		r.Get("/scheduled/upcoming", scheduledH.ListUpcoming)
		r.Put("/scheduled/{id}", scheduledH.Update)
		r.Delete("/scheduled/{id}", scheduledH.Delete)

		// Wishlists
		r.Get("/wishlists", wishlistH.List)
		r.Post("/wishlists", wishlistH.Create)
		r.Get("/wishlists/{id}", wishlistH.Get)
		r.Put("/wishlists/{id}", wishlistH.Update)
		r.Delete("/wishlists/{id}", wishlistH.Delete)
		r.Get("/wishlists/{id}/items", wishlistH.ListItems)
		r.Post("/wishlists/{id}/items", wishlistH.CreateItem)
		r.Put("/wishlists/{id}/items/{itemId}", wishlistH.UpdateItem)
		r.Put("/wishlists/{id}/items/{itemId}/toggle", wishlistH.ToggleItem)
		r.Delete("/wishlists/{id}/items/{itemId}", wishlistH.DeleteItem)

		// Analytics presets
		r.Get("/analytics-presets", analyticsH.List)
		r.Post("/analytics-presets", analyticsH.Create)
		r.Get("/analytics-presets/{id}", analyticsH.Get)
		r.Put("/analytics-presets/{id}", analyticsH.Update)
		r.Delete("/analytics-presets/{id}", analyticsH.Delete)

		// Chat messages
		r.Get("/chat-messages", chatH.List)
		r.Post("/chat-messages", chatH.Create)
		r.Delete("/chat-messages", chatH.DeleteAll)
		r.Delete("/chat-messages/{id}", chatH.Delete)

		// Import
		r.Post("/imported-transactions/batch", importH.CreateBatch)
		r.Get("/imported-transactions/hashes", importH.GetHashes)
		r.Delete("/imported-transactions/by-transaction/{transactionId}", importH.DeleteByTransaction)
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("server listening on :%s", port)
	if err := http.ListenAndServe(":"+port, r); err != nil {
		log.Fatalf("server error: %v", err)
	}
}

func allowedOrigins() []string {
	origins := []string{"http://localhost:3000"}
	if prod := os.Getenv("ALLOWED_ORIGINS"); prod != "" {
		origins = append(origins, prod)
	}
	return origins
}
