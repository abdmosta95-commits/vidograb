FROM node:20-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg python3 python3-pip \
  && (apt-get install -y --no-install-recommends yt-dlp \
      || pip3 install --break-system-packages yt-dlp) \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev

COPY backend/ ./
COPY frontend/ /frontend/

RUN test -f server.js && test -f /frontend/index.html

ENV NODE_ENV=production
ENV API_PROVIDER=ytdlp
ENV YTDLP_PATH=yt-dlp

# Render sets PORT automatically — do NOT hardcode it here

EXPOSE 10000

CMD ["node", "server.js"]
