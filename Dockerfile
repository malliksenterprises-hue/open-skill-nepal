FROM node:18-alpine

WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./
COPY backend/package*.json ./backend/

# Install dependencies
RUN npm install

# Copy all source code
COPY . .

# Install backend dependencies
RUN cd backend && npm install

# Create non-root user (optional for Cloud Run)
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

USER nextjs

EXPOSE 8080

CMD ["node", "backend/server.js"]
