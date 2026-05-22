import {
  fetchViaCobalt,
  createCobaltSession,
} from './cobaltProvider.js';
import { fetchViaRapidApi } from './rapidApiProvider.js';
import { fetchViaYtDlp } from './ytdlpProvider.js';
import { fetchViaTiktok } from './tiktokProvider.js';
import { fetchViaDouyin } from './douyinProvider.js';
import { fetchMock } from './mockProvider.js';
import { detectPlatform, validateUrl } from './platformDetector.js';

const TIKWM_PLATFORMS = {
  tiktok: fetchViaTiktok,
  douyin: fetchViaDouyin,
};

async function fetchByPlatform(url, platform, config) {
  if (TIKWM_PLATFORMS[platform]) {
    return TIKWM_PLATFORMS[platform](url);
  }
  return fetchViaYtDlp(url, config.YTDLP_PATH);
}

export async function downloadVideo(url, platformHint, config, { turnstileToken } = {}) {
  if (!validateUrl(url)) {
    throw new Error('Invalid video URL. Please check the link.');
  }

  const platform = detectPlatform(url, platformHint);
  if (!platform) {
    throw new Error('Please select the correct platform from the list.');
  }

  const provider = config.API_PROVIDER || 'mock';
  let result;

  switch (provider) {
    case 'cobalt':
      result = await downloadViaCobalt(url, config, turnstileToken);
      break;
    case 'rapidapi':
      if (!config.RAPIDAPI_KEY) throw new Error('RAPIDAPI_KEY is not set in .env');
      result = await fetchViaRapidApi(url, config.RAPIDAPI_KEY, config.RAPIDAPI_HOST);
      break;
    case 'ytdlp':
      result = await fetchByPlatform(url, platform, config);
      break;
    case 'mock':
    default:
      result = await fetchMock(url, platform);
      break;
  }

  return { ...result, platform };
}

async function downloadViaCobalt(url, config, turnstileToken) {
  const baseUrl = config.COBALT_API_URL;
  const apiKey = config.COBALT_API_KEY;

  if (apiKey) {
    return fetchViaCobalt(url, baseUrl, { apiKey });
  }

  if (!turnstileToken) {
    throw new Error('Complete Turnstile verification first (checkbox below the form).');
  }

  const session = await createCobaltSession(baseUrl, turnstileToken);
  return fetchViaCobalt(url, baseUrl, { bearerToken: session.token });
}
