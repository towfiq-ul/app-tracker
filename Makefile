.DEFAULT_GOAL := help
SHELL := /bin/bash

WORKER_DIR := worker
FRONTEND_DIR := frontend

.PHONY: help
help: ## Show this help
	@grep -E '^[a-zA-Z0-9_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

## --- Setup ---------------------------------------------------------------

.PHONY: install
install: install-worker install-frontend ## Install dependencies for both workspaces

.PHONY: install-worker
install-worker: ## Install worker dependencies
	cd $(WORKER_DIR) && npm install

.PHONY: install-frontend
install-frontend: ## Install frontend dependencies
	cd $(FRONTEND_DIR) && npm install

## --- Development ----------------------------------------------------------

.PHONY: dev-worker
dev-worker: ## Run the Cloudflare Worker dev server (wrangler dev)
	cd $(WORKER_DIR) && npm run dev

.PHONY: dev-frontend
dev-frontend: ## Run the frontend dev server (vite)
	cd $(FRONTEND_DIR) && npm run dev

.PHONY: dev
dev: ## Run worker + frontend dev servers together (Ctrl+C stops both cleanly)
	@trap 'kill 0' EXIT INT TERM; \
	$(MAKE) dev-worker & \
	$(MAKE) dev-frontend & \
	wait

## --- Quality ---------------------------------------------------------------

.PHONY: typecheck
typecheck: typecheck-worker typecheck-frontend ## Typecheck both workspaces

.PHONY: typecheck-worker
typecheck-worker: ## Typecheck the worker
	cd $(WORKER_DIR) && npm run typecheck

.PHONY: typecheck-frontend
typecheck-frontend: ## Typecheck the frontend
	cd $(FRONTEND_DIR) && npx tsc -b

.PHONY: lint
lint: ## Lint the frontend
	cd $(FRONTEND_DIR) && npm run lint

.PHONY: build
build: ## Build the frontend for production
	cd $(FRONTEND_DIR) && npm run build

## --- Database ---------------------------------------------------------------

.PHONY: db-apply-local
db-apply-local: ## Apply schema-auth.sql + schema-apps.sql to the local D1 databases
	cd $(WORKER_DIR) && npm run db:apply:local

.PHONY: db-apply-remote
db-apply-remote: ## Apply schema-auth.sql + schema-apps.sql to the remote D1 databases (real Cloudflare account)
	cd $(WORKER_DIR) && npm run db:apply:remote

.PHONY: seed-admin
seed-admin: ## Print the insert command for a bootstrap admin (usage: make seed-admin ADMIN_USER=admin ADMIN_PASSWORD=secret)
	@if [ -z "$(ADMIN_USER)" ] || [ -z "$(ADMIN_PASSWORD)" ]; then \
		echo "Usage: make seed-admin ADMIN_USER=<username> ADMIN_PASSWORD=<password>"; exit 1; \
	fi
	cd $(WORKER_DIR) && node scripts/seed-admin.mjs "$(ADMIN_USER)" "$(ADMIN_PASSWORD)"

.PHONY: seed-sample-apps
seed-sample-apps: ## Create two sample applications via the running local API (worker must be up)
	cd $(WORKER_DIR) && node scripts/seed-sample-apps.mjs

## --- Deploy ---------------------------------------------------------------

.PHONY: deploy-worker
deploy-worker: ## Deploy the Worker to Cloudflare
	cd $(WORKER_DIR) && npm run deploy

## --- Cleanup ---------------------------------------------------------------

.PHONY: clean
clean: ## Remove build output and local dev state (.wrangler, dist)
	rm -rf $(WORKER_DIR)/.wrangler $(FRONTEND_DIR)/dist

.PHONY: clean-all
clean-all: clean ## Also remove node_modules in both workspaces
	rm -rf $(WORKER_DIR)/node_modules $(FRONTEND_DIR)/node_modules
