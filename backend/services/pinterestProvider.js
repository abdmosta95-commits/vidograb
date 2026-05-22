const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const PINTEREST_REFERER = 'https://www.pinterest.com/';

function extractPinId(url) {
  const match = url.match(/\/pin\/(\d+)/);
  if (!match) throw new Error('Could not extract Pinterest pin ID from the URL.');
  return match[1];
}

async function resolvePinterestUrl(url) {
  const response = await fetch(url, {
    redirect: 'follow',
    headers: { 'User-Agent': UA },
  });
  return response.url || url;
}

async function fetchPinPage(pinId) {
  const pageUrl = `https://www.pinterest.com/pin/${pinId}/`;
  const response = await fetch(pageUrl, {
    headers: {
      'User-Agent': UA,
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });

  if (!response.ok) {
    throw new Error(`Could not load Pinterest pin (${response.status}).`);
  }

  return response.text();
}

async function fetchPinMeta(pinId) {
  const data = encodeURIComponent(JSON.stringify({ options: { id: pinId }, context: {} }));
  const apiUrl =
    `https://www.pinterest.com/resource/PinResource/get/?source_url=/pin/${pinId}/&data=${data}`;

  const response = await fetch(apiUrl, {
    headers: {
      'User-Agent': UA,
      'x-pinterest-pws-handler': 'www/pin/[id].js',
      Accept: 'application/json',
    },
  });

  if (!response.ok) return null;

  const json = await response.json();
  return json?.resource_response?.data || null;
}

function extractVideoUrls(html) {
  const mp4 = [...new Set(
    (html.match(/https:\/\/v1\.pinimg\.com\/videos\/[^"'\\]+\.mp4/g) || [])
      .map((u) => u.replace(/\\u002F/g, '/')),
  )];

  const hls = [...new Set(
    (html.match(/https:\/\/v1\.pinimg\.com\/videos\/[^"'\\]+\.m3u8/g) || [])
      .map((u) => u.replace(/\\u002F/g, '/')),
  )];

  return { mp4, hls };
}

function labelFromMp4(url) {
  const match = url.match(/_(\d+)w\.mp4$/i);
  return match ? `${match[1]}p MP4` : 'MP4';
}

function buildFormats(mp4Urls, hlsUrls, sourceUrl) {
  const formats = [];

  mp4Urls
    .sort((a, b) => {
      const aw = Number(a.match(/_(\d+)w\.mp4/i)?.[1] || 0);
      const bw = Number(b.match(/_(\d+)w\.mp4/i)?.[1] || 0);
      return bw - aw;
    })
    .forEach((url, i) => {
      formats.push({
        label: labelFromMp4(url),
        quality: labelFromMp4(url).replace(/\s+/g, ''),
        url,
        direct: true,
        referer: PINTEREST_REFERER,
      });
    });

  if (!formats.length && hlsUrls.length) {
    hlsUrls.forEach((url, i) => {
      formats.push({
        label: i === 0 ? 'HLS Video' : `HLS ${i + 1}`,
        quality: `hls${i + 1}`,
        formatId: 'best',
        direct: false,
        url,
        referer: PINTEREST_REFERER,
      });
    });
  }

  if (!formats.length) {
    throw new Error('No video found on this pin — it may be an image, not a video.');
  }

  return {
    sourceUrl,
    formats,
    url: formats[0]?.url,
  };
}

export async function fetchViaPinterest(inputUrl) {
  let url = await resolvePinterestUrl(inputUrl.trim());
  const pinId = extractPinId(url);

  const [html, meta] = await Promise.all([
    fetchPinPage(pinId),
    fetchPinMeta(pinId),
  ]);

  const { mp4, hls } = extractVideoUrls(html);
  const result = buildFormats(mp4, hls, url);

  const title =
    meta?.grid_title ||
    meta?.seo_title ||
    meta?.title ||
    'Pinterest Video';

  const author = meta?.closeup_unified_attribution?.username
    ? `@${meta.closeup_unified_attribution.username}`
    : meta?.pinner?.username
      ? `@${meta.pinner.username}`
      : '';

  const thumbnail =
    meta?.image_large_url ||
    meta?.images?.orig?.url ||
    meta?.images?.['736x']?.url ||
    null;

  return {
    title: String(title).slice(0, 120),
    author,
    thumbnail,
    ...result,
  };
}
