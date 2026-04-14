package model

import "time"

// ---- User ----

type User struct {
	ID          string    `json:"id"`
	Email       string    `json:"email"`
	DisplayName string    `json:"displayName"`
	PhotoURL    string    `json:"photoUrl"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

type UpsertUserInput struct {
	Email       string `json:"email"`
	DisplayName string `json:"displayName"`
	PhotoURL    string `json:"photoUrl"`
}

// ---- UserSettings ----

type UserSettings struct {
	UserID                  string    `json:"userId"`
	BaseCurrency            string    `json:"baseCurrency"`
	ActiveAnalyticsPresetID string    `json:"activeAnalyticsPresetId"`
	SeenVersion             string    `json:"seenVersion"`
	CreatedAt               time.Time `json:"createdAt"`
	UpdatedAt               time.Time `json:"updatedAt"`
}

type UpdateUserSettingsInput struct {
	BaseCurrency            *string `json:"baseCurrency"`
	ActiveAnalyticsPresetID *string `json:"activeAnalyticsPresetId"`
	SeenVersion             *string `json:"seenVersion"`
}

// ---- Account ----

type Account struct {
	ID        string    `json:"id"`
	UserID    string    `json:"userId"`
	Name      string    `json:"name"`
	Type      string    `json:"type"`
	Currency  string    `json:"currency"`
	Balance   float64   `json:"balance"`
	Color     string    `json:"color"`
	Icon      string    `json:"icon"`
	IsDefault bool      `json:"isDefault"`
	IsSaving  bool      `json:"isSaving"`
	Notes     string    `json:"notes"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type CreateAccountInput struct {
	Name      string  `json:"name"`
	Type      string  `json:"type"`
	Currency  string  `json:"currency"`
	Balance   float64 `json:"balance"`
	Color     string  `json:"color"`
	Icon      string  `json:"icon"`
	IsDefault bool    `json:"isDefault"`
	IsSaving  bool    `json:"isSaving"`
	Notes     string  `json:"notes"`
}

type UpdateAccountInput struct {
	Name      *string  `json:"name"`
	Type      *string  `json:"type"`
	Currency  *string  `json:"currency"`
	Balance   *float64 `json:"balance"`
	Color     *string  `json:"color"`
	Icon      *string  `json:"icon"`
	IsDefault *bool    `json:"isDefault"`
	IsSaving  *bool    `json:"isSaving"`
	Notes     *string  `json:"notes"`
}

// ---- Category ----

type Category struct {
	ID        string    `json:"id"`
	UserID    string    `json:"userId"`
	Name      string    `json:"name"`
	Type      string    `json:"type"`
	Icon      string    `json:"icon"`
	Color     string    `json:"color"`
	ParentID  string    `json:"parentId"`
	IsDefault bool      `json:"isDefault"`
	IsSystem  bool      `json:"isSystem"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type CreateCategoryInput struct {
	Name      string `json:"name"`
	Type      string `json:"type"`
	Icon      string `json:"icon"`
	Color     string `json:"color"`
	ParentID  string `json:"parentId"`
	IsDefault bool   `json:"isDefault"`
}

type UpdateCategoryInput struct {
	Name     *string `json:"name"`
	Type     *string `json:"type"`
	Icon     *string `json:"icon"`
	Color    *string `json:"color"`
	ParentID *string `json:"parentId"`
}

// ---- Tag ----

type Tag struct {
	ID        string    `json:"id"`
	UserID    string    `json:"userId"`
	Name      string    `json:"name"`
	Color     string    `json:"color"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type CreateTagInput struct {
	Name  string `json:"name"`
	Color string `json:"color"`
}

type UpdateTagInput struct {
	Name  *string `json:"name"`
	Color *string `json:"color"`
}

// ---- Transaction ----

type Transaction struct {
	ID                    string    `json:"id"`
	UserID                string    `json:"userId"`
	AccountID             string    `json:"accountId"`
	Type                  string    `json:"type"`
	Amount                float64   `json:"amount"`
	Currency              string    `json:"currency"`
	Description           string    `json:"description"`
	Date                  time.Time `json:"date"`
	CategoryID            string    `json:"categoryId"`
	MerchantName          string    `json:"merchantName"`
	Notes                 string    `json:"notes"`
	ExcludeFromAnalytics  bool      `json:"excludeFromAnalytics"`
	ExchangeRate          float64   `json:"exchangeRate"`
	Fee                   float64   `json:"fee"`
	PairID                string    `json:"pairId"`
	SourceID              string    `json:"sourceId"`
	SourceName            string    `json:"sourceName"`
	Tags                  []Tag     `json:"tags"`
	CreatedAt             time.Time `json:"createdAt"`
	UpdatedAt             time.Time `json:"updatedAt"`
}

type CreateTransactionInput struct {
	AccountID            string    `json:"accountId"`
	Type                 string    `json:"type"`
	Amount               float64   `json:"amount"`
	Currency             string    `json:"currency"`
	Description          string    `json:"description"`
	Date                 time.Time `json:"date"`
	CategoryID           string    `json:"categoryId"`
	MerchantName         string    `json:"merchantName"`
	Notes                string    `json:"notes"`
	ExcludeFromAnalytics bool      `json:"excludeFromAnalytics"`
	ExchangeRate         float64   `json:"exchangeRate"`
	Fee                  float64   `json:"fee"`
	PairID               string    `json:"pairId"`
	SourceID             string    `json:"sourceId"`
	SourceName           string    `json:"sourceName"`
	TagIDs               []string  `json:"tagIds"`
}

type UpdateTransactionInput struct {
	AccountID            *string    `json:"accountId"`
	Type                 *string    `json:"type"`
	Amount               *float64   `json:"amount"`
	Currency             *string    `json:"currency"`
	Description          *string    `json:"description"`
	Date                 *time.Time `json:"date"`
	CategoryID           *string    `json:"categoryId"`
	MerchantName         *string    `json:"merchantName"`
	Notes                *string    `json:"notes"`
	ExcludeFromAnalytics *bool      `json:"excludeFromAnalytics"`
	ExchangeRate         *float64   `json:"exchangeRate"`
	Fee                  *float64   `json:"fee"`
	TagIDs               []string   `json:"tagIds"`
}

type TransactionStats struct {
	Income           float64 `json:"income"`
	Expenses         float64 `json:"expenses"`
	Balance          float64 `json:"balance"`
	TransactionCount int     `json:"transactionCount"`
}

type TransactionListOptions struct {
	Limit     int
	OrderBy   string
	OrderDir  string
}

// ---- Budget ----

type Budget struct {
	ID             string    `json:"id"`
	UserID         string    `json:"userId"`
	CategoryID     string    `json:"categoryId"`
	Amount         float64   `json:"amount"`
	Currency       string    `json:"currency"`
	Period         string    `json:"period"`
	StartDate      time.Time `json:"startDate"`
	EndDate        *time.Time `json:"endDate"`
	AlertThreshold float64   `json:"alertThreshold"`
	IsActive       bool      `json:"isActive"`
	CreatedAt      time.Time `json:"createdAt"`
	UpdatedAt      time.Time `json:"updatedAt"`
}

type CreateBudgetInput struct {
	CategoryID     string     `json:"categoryId"`
	Amount         float64    `json:"amount"`
	Currency       string     `json:"currency"`
	Period         string     `json:"period"`
	StartDate      time.Time  `json:"startDate"`
	EndDate        *time.Time `json:"endDate"`
	AlertThreshold float64    `json:"alertThreshold"`
}

type UpdateBudgetInput struct {
	CategoryID     *string    `json:"categoryId"`
	Amount         *float64   `json:"amount"`
	Currency       *string    `json:"currency"`
	Period         *string    `json:"period"`
	StartDate      *time.Time `json:"startDate"`
	EndDate        *time.Time `json:"endDate"`
	AlertThreshold *float64   `json:"alertThreshold"`
	IsActive       *bool      `json:"isActive"`
}

// ---- Scheduled Transaction ----

type ScheduledTransaction struct {
	ID             string    `json:"id"`
	UserID         string    `json:"userId"`
	AccountID      string    `json:"accountId"`
	Type           string    `json:"type"`
	Amount         float64   `json:"amount"`
	Currency       string    `json:"currency"`
	Description    string    `json:"description"`
	CategoryID     string    `json:"categoryId"`
	Fee            float64   `json:"fee"`
	NextDate       time.Time `json:"nextDate"`
	Recurrence     string    `json:"recurrence"`
	EndDate        *time.Time `json:"endDate"`
	IsActive       bool      `json:"isActive"`
	LastExecutedAt *time.Time `json:"lastExecutedAt"`
	Tags           []Tag     `json:"tags"`
	CreatedAt      time.Time `json:"createdAt"`
	UpdatedAt      time.Time `json:"updatedAt"`
}

type CreateScheduledTransactionInput struct {
	AccountID   string     `json:"accountId"`
	Type        string     `json:"type"`
	Amount      float64    `json:"amount"`
	Currency    string     `json:"currency"`
	Description string     `json:"description"`
	CategoryID  string     `json:"categoryId"`
	Fee         float64    `json:"fee"`
	NextDate    time.Time  `json:"nextDate"`
	Recurrence  string     `json:"recurrence"`
	EndDate     *time.Time `json:"endDate"`
	TagIDs      []string   `json:"tagIds"`
}

type UpdateScheduledTransactionInput struct {
	AccountID   *string    `json:"accountId"`
	Type        *string    `json:"type"`
	Amount      *float64   `json:"amount"`
	Currency    *string    `json:"currency"`
	Description *string    `json:"description"`
	CategoryID  *string    `json:"categoryId"`
	Fee         *float64   `json:"fee"`
	NextDate    *time.Time `json:"nextDate"`
	Recurrence  *string    `json:"recurrence"`
	EndDate     *time.Time `json:"endDate"`
	IsActive    *bool      `json:"isActive"`
	TagIDs      []string   `json:"tagIds"`
}

// ---- Wishlist ----

type Wishlist struct {
	ID          string    `json:"id"`
	UserID      string    `json:"userId"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

type CreateWishlistInput struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}

type UpdateWishlistInput struct {
	Name        *string `json:"name"`
	Description *string `json:"description"`
}

// ---- WishlistItem ----

type WishlistItem struct {
	ID          string    `json:"id"`
	WishlistID  string    `json:"wishlistId"`
	UserID      string    `json:"userId"`
	Name        string    `json:"name"`
	Amount      float64   `json:"amount"`
	Currency    string    `json:"currency"`
	CategoryID  string    `json:"categoryId"`
	IsConfirmed bool      `json:"isConfirmed"`
	AddedAt     time.Time `json:"addedAt"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

type CreateWishlistItemInput struct {
	Name       string  `json:"name"`
	Amount     float64 `json:"amount"`
	Currency   string  `json:"currency"`
	CategoryID string  `json:"categoryId"`
}

type UpdateWishlistItemInput struct {
	Name       *string  `json:"name"`
	Amount     *float64 `json:"amount"`
	Currency   *string  `json:"currency"`
	CategoryID *string  `json:"categoryId"`
}

// ---- AnalyticsPreset ----

type AnalyticsPreset struct {
	ID          string    `json:"id"`
	UserID      string    `json:"userId"`
	Name        string    `json:"name"`
	CategoryIDs []string  `json:"categoryIds"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

type CreateAnalyticsPresetInput struct {
	Name        string   `json:"name"`
	CategoryIDs []string `json:"categoryIds"`
}

type UpdateAnalyticsPresetInput struct {
	Name        *string  `json:"name"`
	CategoryIDs []string `json:"categoryIds"`
}

// ---- ChatMessage ----

type ChatMessage struct {
	ID        string    `json:"id"`
	UserID    string    `json:"userId"`
	Role      string    `json:"role"`
	Content   string    `json:"content"`
	CreatedAt time.Time `json:"createdAt"`
}

type CreateChatMessageInput struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// ---- ImportedTransaction ----

type ImportedTransaction struct {
	ID            string    `json:"id"`
	UserID        string    `json:"userId"`
	TransactionID string    `json:"transactionId"`
	Hash          string    `json:"hash"`
	Source        string    `json:"source"`
	ImportDate    time.Time `json:"importDate"`
	CreatedAt     time.Time `json:"createdAt"`
}

type CreateImportedTransactionInput struct {
	TransactionID string `json:"transactionId"`
	Hash          string `json:"hash"`
	Source        string `json:"source"`
}
