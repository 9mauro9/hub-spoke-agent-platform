# Multi-stage production build for Hub-and-Spoke Web Control Center
# Conforms to AES v3 Standard and Google Cloud Run specifications.

# Stage 1: Build static web assets
FROM node:22-alpine AS builder

WORKDIR /app

# Copy dependency manifests
COPY web/package*.json ./

# Clean install
RUN npm ci

# Copy application source code
COPY web/ ./

# Compile TypeScript and build production bundle
RUN npm run build

# Stage 2: Serve via Nginx
FROM nginx:alpine

# Remove default nginx config
RUN rm -rf /etc/nginx/conf.d/default.conf

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose Cloud Run default port
EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
