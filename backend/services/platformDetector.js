const PATTERNS = {
  tiktok: /(?:tiktok\.com|vm\.tiktok\.com|vt\.tiktok\.com)/i,
  pinterest: /(?:pinterest\.(?:com|fr|de|jp|ca|co\.uk)|pin\.it)/i,
  douyin: /(?:douyin\.com|v\.douyin\.com|iesdouyin\.com)/i,
  x: /(?:twitter\.com|x\.com)/i,
  tumblr: /(?:tumblr\.com)/i,
  linkedin: /(?:linkedin\.com)/i,
};

export const SUPPORTED_PLATFORMS = Object.keys(PATTERNS);

export function detectPlatform(url, hint) {
  if (hint && SUPPORTED_PLATFORMS.includes(hint)) return hint;

  for (const [platform, regex] of Object.entries(PATTERNS)) {
    if (regex.test(url)) return platform;
  }

  return null;
}

export function validateUrl(url) {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}
