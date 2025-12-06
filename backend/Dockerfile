# Backend Dockerfile for Starlight Network Monitor

# Development stage
FROM node:20-slim AS development

# Install OpenSSL for Prisma and iputils-ping for network monitoring
RUN apt-get update && apt-get install -y openssl iputils-ping && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy prisma schema
COPY prisma ./prisma/

# Generate Prisma client
RUN npx prisma generate

# Copy source code
COPY . .

# Expose port
EXPOSE 4000

# Start development server (regenerate prisma client on start)
CMD ["sh", "-c", "npx prisma generate && npx prisma db push --skip-generate && npm run dev"]

# Production build stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY prisma ./prisma/
RUN npx prisma generate

COPY . .
RUN npm run build

# Production stage
FROM node:20-slim AS production

# Install OpenSSL for Prisma and iputils-ping for network monitoring
RUN apt-get update && apt-get install -y openssl iputils-ping && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy only necessary files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/prisma ./prisma

EXPOSE 4000

# Run migrations and start server
CMD ["sh", "-c", "npx prisma db push --skip-generate && npm start"]


