/**
 * Cobalt API — https://github.com/imputnet/cobalt
 *
 * Authentication:
 * - Api-Key: self-hosted (COBALT_API_KEY)
 * - Bearer JWT: public API via Turnstile (cf-turnstile-response → POST /session)
 */
export async function getCobaltInfo(baseUrl) {
  const response = await fetch(`${baseUrl}/`, {
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Cobalt info error (${response.status})`);
  }

  return response.json();
}

export async function createCobaltSession(baseUrl, turnstileToken) {
  const response = await fetch(`${baseUrl}/session`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'cf-turnstile-response': turnstileToken,
    },
  });

  const data = await response.json();

  if (!response.ok || data.status === 'error') {
    throw new Error(data.error?.code || 'Turnstile verification failed');
  }

  return data;
}

export async function fetchViaCobalt(url, baseUrl, { apiKey, bearerToken } = {}) {
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };

  if (apiKey) {
    headers.Authorization = `Api-Key ${apiKey}`;
  } else if (bearerToken) {
    headers.Authorization = `Bearer ${bearerToken}`;
  }

  const response = await fetch(`${baseUrl}/`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      url,
      videoQuality: '1080',
      downloadMode: 'auto',
    }),
  });

  const data = await response.json();

  if (!response.ok || data.status === 'error') {
    const code = data.error?.code || '';
    if (code.includes('auth.jwt.missing') || code.includes('auth.api-key.missing')) {
      throw new Error(
        'Cobalt requires authentication. Complete Turnstile verification on the page, or use COBALT_API_KEY / yt-dlp.'
      );
    }
    throw new Error(code || data.text || `Cobalt error (${response.status})`);
  }

  return normalizeCobaltResponse(data);
}

function normalizeCobaltResponse(data) {
  const formats = [];

  if (data.status === 'picker' && Array.isArray(data.picker)) {
    data.picker.forEach((item, i) => {
      if (item.url) {
        formats.push({
          label: `${item.type || 'media'} ${i + 1}`,
          quality: item.type || 'default',
          url: item.url,
        });
      }
    });
  }

  if (data.url) {
    formats.unshift({
      label: 'MP4 — Best Quality',
      quality: 'best',
      url: data.url,
    });
  }

  if (data.audio && typeof data.audio === 'string') {
    formats.push({
      label: 'Audio Only',
      quality: 'audio',
      url: data.audio,
    });
  }

  return {
    title: data.filename || data.output?.filename || 'Video',
    author: data.service || '',
    thumbnail: data.thumb || data.picker?.[0]?.thumb || null,
    formats: formats.length ? formats : [{ label: 'MP4', url: data.url, quality: 'best' }],
    url: data.url || formats[0]?.url,
    raw: data,
  };
}
