import contentDisposition from 'content-disposition';

const PRIVATE_IP =
  /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|0\.0\.0\.0|localhost)/;

export function isAllowedStreamUrl(urlString) {
  try {
    const u = new URL(urlString);
    if (!['http:', 'https:'].includes(u.protocol)) return false;
    if (PRIVATE_IP.test(u.hostname)) return false;
    return true;
  } catch {
    return false;
  }
}

export function sanitizeFilename(name, ext = 'mp4') {
  let base = (name || 'video')
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 80) || 'video';

  if (base.endsWith(`.${ext}`)) return base;
  return `${base}.${ext}`;
}

export function contentDispositionHeader(filename) {
  return contentDisposition(sanitizeFilename(filename));
}

export async function pipeVideoStream(url, res, filename, referer) {
  const headers = {
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    Accept: '*/*',
  };

  if (referer) {
    headers.Referer = referer;
  } else if (/tiktokcdn|tiktokv\.com|douyinvod|douyinpic|snssdk/i.test(url)) {
    headers.Referer = 'https://www.douyin.com/';
  } else if (/pinimg\.com/i.test(url)) {
    headers.Referer = 'https://www.pinterest.com/';
  } else if (/tiktokcdn|tiktokv\.com/i.test(url)) {
    headers.Referer = 'https://www.tiktok.com/';
  }

  const upstream = await fetch(url, {
    headers,
    redirect: 'follow',
  });

  if (!upstream.ok) {
    throw new Error(`Could not fetch file (${upstream.status})`);
  }

  const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
  const contentLength = upstream.headers.get('content-length');

  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', contentDispositionHeader(filename));
  res.setHeader('Cache-Control', 'no-store');

  if (contentLength) {
    res.setHeader('Content-Length', contentLength);
  }

  const { Readable } = await import('node:stream');
  const { pipeline } = await import('node:stream/promises');

  await pipeline(Readable.fromWeb(upstream.body), res);
}
