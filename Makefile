# Open Skill Nepal - Development Makefile

.PHONY: help build up down logs clean test deploy

# Default target
help:
	@echo "Open Skill Nepal - Development Commands"
	@echo ""
	@echo "Usage:"
	@echo "  make [command]"
	@echo ""
	@echo "Commands:"
	@echo "  build     Build Docker images"
	@echo "  up        Start all services"
	@echo "  down      Stop all services"
	@echo "  logs      View service logs"
	@echo "  clean     Remove containers, volumes, and images"
	@echo "  test      Run tests"
	@echo "  deploy    Deploy to production"
	@echo "  shell     Open shell in backend container"
	@echo "  db-shell  Open MongoDB shell"
	@echo "  health    Check service health"

# Build images
build:
	docker-compose build --parallel

# Start services
up:
	docker-compose up -d

# Start services in development mode
dev:
	docker-compose up

# Stop services
down:
	docker-compose down

# View logs
logs:
	docker-compose logs -f backend

# Clean everything
clean:
	docker-compose down -v --rmi local

# Run tests
test:
	docker-compose exec backend npm test

# Run specific test
test-unit:
	docker-compose exec backend npm run test:unit

test-e2e:
	docker-compose exec backend npm run test:e2e

# Deploy to production
deploy:
	@echo "Building production image..."
	docker build -t open-skill-nepal:latest .
	@echo "Pushing to registry..."
	docker tag open-skill-nepal:latest gcr.io/open-skill-nepal-478611/open-skill-nepal:latest
	docker push gcr.io/open-skill-nepal-478611/open-skill-nepal:latest
	@echo "Deploying to Cloud Run..."
	gcloud run deploy open-skill-nepal \
		--image gcr.io/open-skill-nepal-478611/open-skill-nepal:latest \
		--platform managed \
		--region asia-south1 \
		--allow-unauthenticated

# Open shell in backend container
shell:
	docker-compose exec backend sh

# Open MongoDB shell
db-shell:
	docker-compose exec mongodb mongosh -u admin -p password

# Check health
health:
	@echo "Checking backend health..."
	@curl -f http://localhost:8080/health || echo "Backend is not healthy"
	@echo ""
	@echo "Checking MongoDB..."
	@docker-compose exec mongodb mongosh -u admin -p password --eval "db.adminCommand('ping')" | grep -q "ok.*1" && echo "✅ MongoDB is healthy" || echo "❌ MongoDB is not healthy"

# Database backup
backup:
	@echo "Creating database backup..."
	@mkdir -p backups
	@docker-compose exec mongodb mongodump -u admin -p password --authenticationDatabase admin --db open-skill-nepal --out /tmp/backup
	@docker cp open-skill-nepal-mongodb:/tmp/backup ./backups/$(shell date +%Y%m%d_%H%M%S)
	@echo "✅ Backup created"

# Database restore
restore:
	@if [ -z "$(BACKUP)" ]; then \
		echo "Usage: make restore BACKUP=backups/YYYYMMDD_HHMMSS"; \
		exit 1; \
	fi
	@echo "Restoring database from $(BACKUP)..."
	@docker cp $(BACKUP) open-skill-nepal-mongodb:/tmp/restore
	@docker-compose exec mongodb mongorestore -u admin -p password --authenticationDatabase admin --db open-skill-nepal /tmp/restore/open-skill-nepal
	@echo "✅ Database restored"

# Setup GCP credentials
setup-gcp:
	@if [ -z "$(GCP_KEY_BASE64)" ]; then \
		echo "Usage: make setup-gcp GCP_KEY_BASE64=your_base64_string"; \
		exit 1; \
	fi
	@echo "Setting up GCP credentials..."
	@echo $$GCP_KEY_BASE64 | base64 -d > service-account.json
	@chmod 400 service-account.json
	@echo "✅ GCP credentials setup complete"
