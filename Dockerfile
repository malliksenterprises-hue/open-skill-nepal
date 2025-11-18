FROM node:18-alpine

WORKDIR /usr/src/app

# Copy package files from backend folder
COPY backend/package*.json ./

# Install dependencies (use install instead of ci)
RUN npm install --production

# Copy backend source code
COPY backend/ ./

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

USER nextjs

EXPOSE 8080

CMD ["node", "server.js"]
