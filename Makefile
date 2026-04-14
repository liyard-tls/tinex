SHELL := /bin/bash
DB_URL ?= postgres://tinex:tinex@localhost:5432/tinex?sslmode=disable

.PHONY: help dev dev-bg stop \
        backend-dev backend-build \
        frontend-dev frontend-build \
        migrate-create db-shell \
        lint test

help: ## Show available targets
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

# ── Docker (backend only) ────────────────────────────────────────────────────

dev: ## Start postgres + backend (backend auto-migrates on startup)
	docker compose up --build

dev-bg: ## Start in the background
	docker compose up --build -d

stop: ## Stop containers
	docker compose down

db-shell: ## Open a psql shell into the running postgres container
	docker compose exec postgres psql -U tinex -d tinex

# ── Migrations ───────────────────────────────────────────────────────────────

migrate-create: ## Scaffold a new migration pair: make migrate-create NAME=add_foo
	@[ -n "$(NAME)" ] || (echo "Usage: make migrate-create NAME=your_migration_name" && exit 1)
	@NEXT=$$(ls backend/migrations/*.up.sql 2>/dev/null | wc -l | tr -d ' '); \
	 SEQ=$$(printf "%06d" $$((NEXT + 1))); \
	 touch "backend/migrations/$${SEQ}_$(NAME).up.sql" \
	       "backend/migrations/$${SEQ}_$(NAME).down.sql"; \
	 echo "created backend/migrations/$${SEQ}_$(NAME).{up,down}.sql"

# ── Local dev ────────────────────────────────────────────────────────────────

backend-dev: ## Run backend locally (sources backend/.env.local)
	cd backend && set -a && source .env.local && set +a && go run ./cmd/server

backend-build: ## Build backend binary to backend/bin/server
	cd backend && go build -o bin/server ./cmd/server

frontend-dev: ## Run Next.js dev server
	cd frontend && npm run dev

frontend-build: ## Build Next.js for production
	cd frontend && npm run build

# ── Quality ──────────────────────────────────────────────────────────────────

lint: ## go vet + eslint
	cd backend && go vet ./...
	cd frontend && npm run lint

test: ## Run Go tests
	cd backend && go test ./...
