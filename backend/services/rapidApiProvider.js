/**
 * RapidAPI Social Media Video Downloader
 * https://rapidapi.com/hub — ابحث عن "social media video downloader"
 *
 * مزايا: موثوق، يدعم منصات متعددة
 * عيوب: مدفوع بعد الحصة المجانية
 */
export async function fetchViaRapidApi(url, apiKey, apiHost) {
  const response = await fetch(`https://${apiHost}/smvd/get/all`, {
    method: 'GET',
    headers: {
      'X-RapidAPI-Key': apiKey,
      'X-RapidAPI-Host': apiHost,
    },
    // بعض APIs تستخدم POST مع body
  });

  // Alternative endpoint pattern used by many RapidAPI downloaders:
  const altResponse = await fetch(
    `https://${apiHost}/download?url=${encodeURIComponent(url)}`,
    {
      headers: {
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': apiHost,
      },
    }
  );

  const res = altResponse.ok ? altResponse : response;

  if (!res.ok) {
    throw new Error(`RapidAPI error (${res.status})`);
  }

  const data = await res.json();
  return normalizeRapidApiResponse(data);
}

function normalizeRapidApiResponse(data) {
  const links = data.links || data.medias || data.data || [];
  const formats = (Array.isArray(links) ? links : [links])
    .filter((item) => item.url || item.link)
    .map((item) => ({
      label: item.quality || item.type || item.extension || 'MP4',
      quality: item.quality || 'default',
      url: item.url || item.link,
      size: item.size ? `${(item.size / 1024 / 1024).toFixed(1)} MB` : null,
    }));

  return {
    title: data.title || data.desc || 'Video',
    author: data.author || data.username || '',
    thumbnail: data.thumbnail || data.cover || data.image || null,
    formats: formats.length ? formats : [{ label: 'MP4', url: data.url, quality: 'best' }],
    url: formats[0]?.url || data.url,
  };
}
