const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:3001/api'
  : '/api';

const IS_LOCAL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

const PLATFORM_LABELS = {
  tiktok: 'TikTok',
  pinterest: 'Pinterest',
  douyin: 'Douyin',
  x: 'X',
  tumblr: 'Tumblr',
  linkedin: 'LinkedIn',
};

const form = document.getElementById('download-form');
const urlInput = document.getElementById('url-input');
const platformSelect = document.getElementById('platform-select');
const downloadBtn = document.getElementById('download-btn');
const btnText = downloadBtn.querySelector('.btn-text');
const btnLoader = downloadBtn.querySelector('.btn-loader');
const errorBox = document.getElementById('error-box');
const resultsSection = document.getElementById('results');
const turnstileWrap = document.getElementById('turnstile-wrap');
const turnstileWidget = document.getElementById('turnstile-widget');
const turnstileStatus = document.getElementById('turnstile-status');

let turnstileRequired = false;
let turnstileToken = null;
let turnstileWidgetId = null;
let currentProvider = 'mock';

initApp();

async function initApp() {
  try {
    const res = await fetch(`${API_BASE}/health`);
    const health = await res.json();
    currentProvider = health.provider;

    if (currentProvider === 'cobalt' && health.cobaltAuth === 'turnstile') {
      if (IS_LOCAL) {
        turnstileWrap.classList.add('hidden');
        return;
      }

      const infoRes = await fetch(`${API_BASE}/cobalt/info`);
      const info = await infoRes.json();

      if (info.turnstileSitekey) {
        turnstileRequired = true;
        turnstileWrap.classList.remove('hidden');
        turnstileStatus.textContent = 'Waiting for verification...';
        downloadBtn.disabled = true;
        await waitForTurnstile();
        renderTurnstile(info.turnstileSitekey);
      }
    }
  } catch {
    // server offline
  }
}

function waitForTurnstile() {
  return new Promise((resolve) => {
    if (window.turnstile) return resolve();
    const check = setInterval(() => {
      if (window.turnstile) {
        clearInterval(check);
        resolve();
      }
    }, 100);
    setTimeout(() => { clearInterval(check); resolve(); }, 10000);
  });
}

function renderTurnstile(sitekey) {
  turnstileWidget.innerHTML = '';
  turnstileToken = null;

  turnstileWidgetId = window.turnstile.render(turnstileWidget, {
    sitekey,
    theme: 'dark',
    callback(token) {
      turnstileToken = token;
      turnstileStatus.textContent = '✓ Verified — you can download now';
      turnstileStatus.classList.add('ready');
      downloadBtn.disabled = false;
    },
    'expired-callback'() {
      turnstileToken = null;
      turnstileStatus.textContent = 'Verification expired — please try again';
      turnstileStatus.classList.remove('ready');
      downloadBtn.disabled = true;
    },
    'error-callback'() {
      turnstileToken = null;
      turnstileStatus.textContent = 'Verification failed';
      turnstileStatus.classList.remove('ready');
      downloadBtn.disabled = true;
      showError('Security verification failed on this domain.');
    },
  });
}

document.getElementById('paste-btn').addEventListener('click', async () => {
  try {
    const text = await navigator.clipboard.readText();
    if (text) {
      urlInput.value = text.trim();
      autoDetectPlatform(text);
    }
  } catch {
    showError('Could not access clipboard. Paste the link manually.');
  }
});

urlInput.addEventListener('input', () => {
  if (urlInput.value.trim()) autoDetectPlatform(urlInput.value);
});

function autoDetectPlatform(url) {
  const patterns = {
    tiktok: /tiktok\.com|vm\.tiktok\.com|vt\.tiktok\.com/,
    pinterest: /pinterest\.(com|fr|de|jp)|pin\.it/,
    douyin: /douyin\.com|v\.douyin\.com|iesdouyin\.com/,
    x: /twitter\.com|x\.com/,
    tumblr: /tumblr\.com/,
    linkedin: /linkedin\.com/,
  };

  for (const [platform, regex] of Object.entries(patterns)) {
    if (regex.test(url)) {
      platformSelect.value = platform;
      return;
    }
  }
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideError();
  resultsSection.classList.add('hidden');

  if (turnstileRequired && !turnstileToken) {
    showError('Complete security verification before downloading.');
    return;
  }

  setLoading(true);

  const url = urlInput.value.trim();
  const platform = platformSelect.value;

  try {
    const body = { url, platform };
    if (turnstileRequired && turnstileToken) body.turnstileToken = turnstileToken;

    const response = await fetch(`${API_BASE}/download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      throw new Error(
        response.status === 404
          ? 'API not found — the server may still be starting. Wait 30 seconds and try again.'
          : 'Server unavailable. If this is your first visit, wait ~50 seconds for Render to wake up, then retry.',
      );
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Something went wrong while fetching the video');
    }

    renderResults(data);

    if (turnstileRequired && window.turnstile && turnstileWidgetId !== null) {
      window.turnstile.reset(turnstileWidgetId);
      turnstileToken = null;
      turnstileStatus.textContent = 'Verify again for the next download';
      turnstileStatus.classList.remove('ready');
      downloadBtn.disabled = true;
    }
  } catch (err) {
    showError(err.message);
  } finally {
    setLoading(false);
  }
});

function setLoading(loading) {
  if (!turnstileRequired || turnstileToken) {
    downloadBtn.disabled = loading;
  }
  btnText.classList.toggle('hidden', loading);
  btnLoader.classList.toggle('hidden', !loading);
}

function showError(message) {
  errorBox.textContent = message;
  errorBox.classList.remove('hidden');
}

function hideError() {
  errorBox.classList.add('hidden');
}

async function triggerFileDownload(streamUrl, filename, btn) {
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.innerHTML = 'Downloading<span class="dl-spinner"></span>';

  try {
    const response = await fetch(streamUrl);
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || 'Download failed');
    }

    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(blobUrl);

    btn.textContent = '✓ Done';
    setTimeout(() => { btn.textContent = originalText; btn.disabled = false; }, 2000);
  } catch (err) {
    showError(err.message);
    btn.textContent = originalText;
    btn.disabled = false;
  }
}

function renderResults(data) {
  document.getElementById('detected-platform').textContent =
    PLATFORM_LABELS[data.platform] || data.platform;

  document.getElementById('video-title').textContent = data.title || 'Video';
  document.getElementById('video-author').textContent = data.author || '';

  const thumbnail = document.getElementById('thumbnail');
  if (data.thumbnail) {
    thumbnail.src = data.thumbnail;
    thumbnail.style.display = 'block';
  } else {
    thumbnail.src = '';
    thumbnail.style.display = 'none';
  }

  const qualityList = document.getElementById('quality-list');
  qualityList.innerHTML = '';

  const formats = data.formats?.length ? data.formats : [{ label: 'Download', url: data.url, quality: 'best' }];
  const safeTitle = (data.title || 'video').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_') || 'video';

  formats.forEach((fmt) => {
    const item = document.createElement('div');
    item.className = 'quality-item';

    const info = document.createElement('div');
    info.innerHTML = `
      <div class="quality-label">${fmt.label || fmt.quality || 'MP4'}</div>
      ${fmt.size ? `<div class="quality-meta">${fmt.size}</div>` : ''}
    `;

    const quality = (fmt.quality || fmt.label || 'best').replace(/\s+/g, '');
    const ext = fmt.ext || 'mp4';
    const filename = `${safeTitle}_${quality}.${ext}`;

    let streamUrl;
    if (fmt.direct && fmt.url) {
      streamUrl =
        `${API_BASE}/stream?url=${encodeURIComponent(fmt.url)}` +
        `&name=${encodeURIComponent(filename)}` +
        (fmt.referer ? `&referer=${encodeURIComponent(fmt.referer)}` : '');
    } else {
      streamUrl =
        `${API_BASE}/stream?source=${encodeURIComponent(data.sourceUrl || '')}` +
        `&format=${encodeURIComponent(fmt.formatId || 'best')}` +
        `&name=${encodeURIComponent(filename)}`;
    }

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'quality-download';
    btn.textContent = '⬇ Download';
    btn.addEventListener('click', () => triggerFileDownload(streamUrl, filename, btn));

    item.appendChild(info);
    item.appendChild(btn);
    qualityList.appendChild(item);
  });

  resultsSection.classList.remove('hidden');
  resultsSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
