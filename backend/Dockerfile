# Use Node.js LTS version
FROM node:18-alpine AS builder

# Install dependencies for node-gyp
RUN apk add --no-cache python3 make g++

# Set working directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs
RUN adduser -S openskill -u 1001

# Change ownership to non-root user
RUN chown -R openskill:nodejs /usr/src/app
USER openskill

# Expose port (Cloud Run expects 8080)
EXPOSE 8080

# Health check for Cloud Run
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Start the application
CMD ["node", "server.js"]

# Labels for better maintainability
LABEL maintainer="Open Skill Nepal <tech@openskillnepal.com>"
LABEL description="Open Skill Nepal Backend API"
LABEL version="1.0.0"
LABEL org.opencontainers.image.source="https://github.com/openskillnepal/backend"
