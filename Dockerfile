# ========================================
# Open Skill Nepal - Phase 2 Dockerfile
# Multi-stage production build
# ========================================

# ------------- Stage 1: Builder -------------
FROM node:18-alpine AS builder

# Install system dependencies
RUN apk update && apk upgrade && \
    apk add --no-cache \
    curl \
    python3 \
    make \
    g++ \
    git \
    openssl

WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./
COPY .npmrc ./

# Install ALL dependencies (including dev for building)
RUN npm ci

# Copy source code
COPY . .

# Remove unnecessary files
RUN rm -rf \
    node_modules/.cache \
    test \
    .git \
    .github \
    .vscode \
    *.md \
    Dockerfile.dev

# Prune dev dependencies for production
RUN npm prune --production

# ------------- Stage 2: Production -------------
FROM node:18-alpine AS production

# Install only essential system dependencies
RUN apk update && apk upgrade && \
    apk add --no-cache \
    curl \
    tzdata \
    ca-certificates

# Set timezone (Asia/Kathmandu)
RUN cp /usr/share/zoneinfo/Asia/Kathmandu /etc/localtime && \
    echo "Asia/Kathmandu" > /etc/timezone

WORKDIR /usr/src/app

# Create non-root user with specific IDs for better security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S openskill -u 1001 && \
    chown -R openskill:nodejs /usr/src/app

# Copy from builder stage
COPY --from=builder --chown=openskill:nodejs /usr/src/app .

USER openskill

# Health check with Node.js (more reliable than curl)
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=5 \
  CMD node -e "require('http').get('http://localhost:8080/health', (r) => {if(r.statusCode!==200)process.exit(1)}).on('error',()=>process.exit(1))"

# Labels for better container management
LABEL org.opencontainers.image.title="Open Skill Nepal Backend"
LABEL org.opencontainers.image.description="Phase 2 - Video Platform with GCP Integration"
LABEL org.opencontainers.image.version="2.0.0"
LABEL org.opencontainers.image.source="https://github.com/malliksenterprises-hue/open-skill-nepal"
LABEL org.opencontainers.image.licenses="MIT"

EXPOSE 8080

# Use exec form for better signal handling
CMD [ "node", "server.js" ]

# ------------- Optional: Development Stage -------------
FROM node:18-alpine AS development

RUN apk update && apk upgrade && \
    apk add --no-cache \
    curl \
    python3 \
    make \
    g++ \
    git \
    openssl \
    bash

WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./
COPY .npmrc ./

# Install all dependencies including dev
RUN npm ci

# Copy source code
COPY . .

# Create user for development
RUN addgroup -g 1001 -S nodejs && \
    adduser -S openskill -u 1001 && \
    chown -R openskill:nodejs /usr/src/app

USER openskill

EXPOSE 8080 9229

CMD [ "npm", "run", "dev" ]
