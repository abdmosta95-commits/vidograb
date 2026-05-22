import { callTikwm } from './tikwmClient.js';

function formatSize(bytes) {
  if (!bytes) return null;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function buildFormats(data, referer) {
  const formats = [];

  if (data.hdplay) {
    formats.push({
      label: 'HD — No Watermark',
      quality: 'hd',
      url: data.hdplay,
      direct: true,
      referer,
      size: formatSize(data.hd_size || data.size),
    });
  }

  if (data.play) {
    formats.push({
      label: 'No Watermark',
      quality: 'standard',
      url: data.play,
      direct: true,
      referer,
      size: formatSize(data.size),
    });
  }

  if (data.music) {
    formats.push({
      label: 'Audio Only (MP3)',
      quality: 'audio',
      url: data.music,
      direct: true,
      referer,
      ext: 'mp3',
    });
  }

  return formats;
}

function parseAuthor(data) {
  const author = data.author?.nickname || data.author?.unique_id || '';
  return author ? `@${author.replace(/^@/, '')}` : '';
}

export async function fetchViaTiktok(url) {
  const data = await callTikwm(url, { hd: 1 });
  const formats = buildFormats(data, 'https://www.tiktok.com/');

  if (!formats.length) {
    throw new Error('No TikTok download links found.');
  }

  return {
    title: (data.title || data.desc || 'TikTok Video').slice(0, 120),
    author: parseAuthor(data),
    thumbnail: data.origin_cover || data.cover || null,
    sourceUrl: url,
    formats,
    url: formats[0]?.url,
  };
}
