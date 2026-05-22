const MOBILE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1';

function extractUrl(text) {
  const match = text.match(/https?:\/\/[^\s]+/);
  return match ? match[0] : text.trim();
}

async function resolveShortUrl(url) {
  if (!/v\.douyin\.com|douyin\.com/i.test(url)) return url;

  const response = await fetch(url, {
    redirect: 'follow',
    headers: { 'User-Agent': MOBILE_UA },
  });
  return response.url || url;
}

function extractVideoId(url) {
  const match = url.match(/video\/(\d+)/);
  if (!match) throw new Error('Could not extract video ID from the URL.');
  return match[1];
}

function findItemList(obj, depth = 0) {
  if (depth > 12 || !obj) return null;
  if (typeof obj === 'object' && !Array.isArray(obj)) {
    if (Array.isArray(obj.item_list)) return obj.item_list;
    for (const value of Object.values(obj)) {
      const found = findItemList(value, depth + 1);
      if (found) return found;
    }
  } else if (Array.isArray(obj)) {
    for (const item of obj) {
      const found = findItemList(item, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

function buildPlayUrl(uri, ratio = '720p') {
  if (uri.startsWith('http')) return uri;
  return `https://aweme.snssdk.com/aweme/v1/play/?video_id=${uri}&ratio=${ratio}&line=0`;
}

function formatSize(bytes) {
  if (!bytes) return null;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

async function fetchSharePage(videoId) {
  const shareUrl = `https://www.iesdouyin.com/share/video/${videoId}/`;
  const response = await fetch(shareUrl, {
    headers: {
      'User-Agent': MOBILE_UA,
      Referer: 'https://www.douyin.com/',
    },
  });

  if (!response.ok) {
    throw new Error('Could not reach Douyin. The video may be private or removed.');
  }

  const html = await response.text();
  const match = html.match(/window\._ROUTER_DATA\s*=\s*(\{.+?\})\s*</s);

  if (!match) {
    throw new Error('Could not read video data — it may be private or deleted.');
  }

  return JSON.parse(match[1]);
}

export async function fetchViaDouyin(inputUrl) {
  let url = extractUrl(inputUrl);
  url = await resolveShortUrl(url);
  const videoId = extractVideoId(url);
  const routerData = await fetchSharePage(videoId);
  const items = findItemList(routerData);

  if (!items?.length) {
    throw new Error('Video not found.');
  }

  const item = items[0];
  const video = item.video || {};
  const playAddr = video.play_addr || {};
  const uri = playAddr.uri || playAddr.url_list?.[0];

  if (!uri) {
    throw new Error('No playback URL found — this may be a photo post, not a video.');
  }

  const formats = [];
  const bitRates = Array.isArray(video.bit_rate) ? video.bit_rate : [];

  bitRates
    .filter((br) => br?.play_addr?.uri)
    .sort((a, b) => (b.bit_rate || 0) - (a.bit_rate || 0))
    .slice(0, 3)
    .forEach((br) => {
      const brUri = br.play_addr.uri;
      formats.push({
        label: `${br.gear_name || br.bit_rate || 'Quality'} — No Watermark`,
        quality: String(br.bit_rate || br.gear_name || 'hd'),
        url: buildPlayUrl(brUri),
        direct: true,
        referer: 'https://www.douyin.com/',
        size: formatSize(br.play_addr.data_size),
      });
    });

  const defaultUrl = buildPlayUrl(typeof uri === 'string' && uri.startsWith('http') ? uri : playAddr.uri);
  if (!formats.length) {
    formats.push({
      label: 'No Watermark',
      quality: 'standard',
      url: defaultUrl,
      direct: true,
      referer: 'https://www.douyin.com/',
      size: formatSize(playAddr.data_size),
    });
  }

  const author = item.author || {};
  const cover = video.cover?.url_list?.[0] || video.origin_cover?.url_list?.[0] || null;

  return {
    title: (item.desc || item.title || 'Douyin Video').slice(0, 120),
    author: author.nickname ? `@${author.nickname}` : '',
    thumbnail: cover,
    sourceUrl: inputUrl,
    formats,
    url: formats[0]?.url,
  };
}
