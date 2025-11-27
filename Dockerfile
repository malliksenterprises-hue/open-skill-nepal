FROM node:18-alpine

WORKDIR /app

# Copy package files from current directory
COPY package*.json ./

# Install dependencies
RUN npm install --only=production

# Copy entire current directory (should be backend/)
COPY . .

EXPOSE 8080

# Simple health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

CMD ["node", "server.js"]
