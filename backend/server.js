import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { downloadVideo } from './services/downloader.js';
import { getCobaltInfo } from './services/cobaltProvider.js';
import {
  isAllowedStreamUrl,
  sanitizeFilename,
  pipeVideoStream,
} from './services/streamProxy.js';
import { streamYtDlpDownload } from './services/ytdlpDownload.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

const config = {
  API_PROVIDER: process.env.API_PROVIDER || 'mock',
  COBALT_API_URL: process.env.COBALT_API_URL || 'https://api.cobalt.tools',
  COBALT_API_KEY: process.env.COBALT_API_KEY,
  RAPIDAPI_KEY: process.env.RAPIDAPI_KEY,
  RAPIDAPI_HOST: process.env.RAPIDAPI_HOST,
  YTDLP_PATH: process.env.YTDLP_PATH || 'python3 -m yt_dlp',
};

app.use(cors());
app.use(express.json({ limit: '16kb' }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: 'Rate limit exceeded. Please try again in 15 minutes.' },
});
app.use('/api/', limiter);

app.use(express.static(path.join(__dirname, '../frontend')));

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    provider: config.API_PROVIDER,
    cobaltAuth: config.COBALT_API_KEY ? 'api-key' : 'turnstile',
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/cobalt/info', async (_req, res) => {
  if (config.API_PROVIDER !== 'cobalt') {
    return res.json({ authRequired: false });
  }

  if (config.COBALT_API_KEY) {
    return res.json({ authRequired: false, mode: 'api-key' });
  }

  try {
    const info = await getCobaltInfo(config.COBALT_API_URL);
    res.json({
      authRequired: true,
      mode: 'turnstile',
      turnstileSitekey: info.cobalt?.turnstileSitekey || null,
      services: info.cobalt?.services || [],
    });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.post('/api/download', async (req, res) => {
  const { url, platform, turnstileToken } = req.body;

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Video URL is required.' });
  }

  try {
    const result = await downloadVideo(url.trim(), platform, config, { turnstileToken });
    res.json(result);
  } catch (err) {
    console.error('[download]', err.message);
    res.status(422).json({ error: err.message || 'Failed to fetch video.' });
  }
});

app.get('/api/stream', async (req, res) => {
  const { url, name, source, format: formatId, referer } = req.query;

  const filename = sanitizeFilename(typeof name === 'string' ? name : 'video');

  try {
    if (source && typeof source === 'string') {
      if (config.API_PROVIDER !== 'ytdlp') {
        return res.status(400).json({ error: 'yt-dlp stream is not enabled.' });
      }
      await streamYtDlpDownload(
        source,
        typeof formatId === 'string' ? formatId : 'best',
        config.YTDLP_PATH,
        res,
        filename,
      );
      return;
    }

    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'Download URL is required.' });
    }

    if (!isAllowedStreamUrl(url)) {
      return res.status(403).json({ error: 'URL not allowed.' });
    }

    await pipeVideoStream(
      url,
      res,
      filename,
      typeof referer === 'string' ? referer : undefined,
    );
  } catch (err) {
    console.error('[stream]', err.message);
    if (!res.headersSent) {
      res.status(502).json({ error: err.message || 'Failed to download file.' });
    }
  }
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  VidoGrab running → port ${PORT}`);
  console.log(`  API provider    → ${config.API_PROVIDER}`);
  if (config.API_PROVIDER === 'cobalt') {
    console.log(`  Cobalt auth     → ${config.COBALT_API_KEY ? 'API Key' : 'Turnstile (JWT)'}\n`);
  } else {
    console.log('');
  }
});
