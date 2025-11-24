FROM node:18-alpine

WORKDIR /usr/src/app

# Copy ONLY backend package files
COPY backend/package*.json ./

# Install ONLY backend dependencies
RUN npm install --only=production

# Copy ONLY backend source code
COPY backend/ .

EXPOSE 8080

CMD ["node", "server.js"]
