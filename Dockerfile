# Stage 1: Build the Vite React frontend
FROM node:18 AS frontend-build
WORKDIR /app/vitereact
# Copy package files and install dependencies with --legacy-peer-deps
COPY vitereact/package.json vitereact/package-lock.json ./
RUN npm install --legacy-peer-deps
# Copy the rest of the frontend files and build
COPY vitereact ./
RUN npm run build

# Stage 2: Set up the Node.js backend
FROM node:18
WORKDIR /app/backend
# Copy package files and install production dependencies
COPY backend/package.json backend/package-lock.json ./
# Install dependencies
RUN npm install --production
# Copy the backend files
COPY backend ./
# Copy the frontend build output to a directory served by the backend
COPY --from=frontend-build /app/vitereact/public /app/backend/public
# Expose the port the backend will run on
EXPOSE 3000
# Set environment variables
ENV PORT=3000
ENV HOST=0.0.0.0
# Command to start the backend server - make sure it listens on all interfaces
CMD ["sh", "-c", "node initdb.js && NODE_ENV=production node server.js"]