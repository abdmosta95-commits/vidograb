FROM node:20-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg python3 python3-pip \
  && pip3 install --break-system-packages yt-dlp \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY backend/package*.json ./
RUN npm ci --omit=dev

COPY backend/ ./
COPY frontend/ /frontend/

ENV NODE_ENV=production
ENV API_PROVIDER=ytdlp
ENV YTDLP_PATH=python3 -m yt_dlp

EXPOSE 10000

CMD ["node", "server.js"]
