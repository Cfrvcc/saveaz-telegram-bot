FROM node:22-slim

# Install system dependencies: FFmpeg, Python, curl (for yt-dlp media extraction)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    python3 \
    python3-pip \
    curl \
    ca-certificates \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install yt-dlp
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp

WORKDIR /app

# Copy package descriptors
COPY package*.json ./

# Install npm dependencies
RUN npm install

# Copy application source code
COPY . .

# Build React admin panel and client assets
RUN npm run build

# Create data directory for SQLite persistence
RUN mkdir -p /app/data && chmod 777 /app/data

# Expose HTTP port
EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

# Start production server
CMD ["npm", "start"]
