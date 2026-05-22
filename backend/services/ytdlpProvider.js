import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

function resolveYtDlpCommand(ytdlpPath = 'python3 -m yt_dlp') {
  const parts = ytdlpPath.trim().split(/\s+/);
  if (parts.length > 1) {
    return { cmd: parts[0], args: parts.slice(1) };
  }
  return { cmd: parts[0], args: [] };
}

function isProgressiveFormat(f) {
  const protocol = f.protocol || '';
  return (
    f.vcodec !== 'none'
    && f.url
    && !protocol.includes('m3u8')
    && !protocol.includes('dash')
    && f.ext !== 'mhtml'
  );
}

export async function fetchViaYtDlp(url, ytdlpPath = 'python3 -m yt_dlp') {
  const { cmd, args } = resolveYtDlpCommand(ytdlpPath);

  const { stdout } = await execFileAsync(cmd, [
    ...args,
    '--dump-json',
    '--no-playlist',
    '--no-warnings',
    url,
  ], { timeout: 90000, maxBuffer: 10 * 1024 * 1024 });

  const info = JSON.parse(stdout);
  const sourceUrl = info.original_url || info.webpage_url || url;

  const progressive = (info.formats || [])
    .filter(isProgressiveFormat)
    .sort((a, b) => (b.height || 0) - (a.height || 0))
    .filter((f, i, arr) => arr.findIndex((x) => x.height === f.height) === i)
    .slice(0, 5)
    .map((f) => ({
      label: `${f.height || '?'}p ${(f.ext || 'mp4').toUpperCase()}`,
      quality: `${f.height || 'best'}p`,
      formatId: f.format_id,
      url: f.url,
      direct: true,
      size: f.filesize ? `${(f.filesize / 1024 / 1024).toFixed(1)} MB` : null,
    }));

  const hlsVideo = (info.formats || [])
    .filter((f) => f.vcodec !== 'none' && f.height)
    .sort((a, b) => (b.height || 0) - (a.height || 0))
    .filter((f, i, arr) => arr.findIndex((x) => x.height === f.height) === i)
    .slice(0, 5)
    .map((f) => ({
      label: `${f.height}p MP4`,
      quality: `${f.height}p`,
      formatId: f.format_id,
      direct: false,
      size: f.filesize ? `${(f.filesize / 1024 / 1024).toFixed(1)} MB` : null,
    }));

  const formats = progressive.length ? progressive : hlsVideo;

  if (!formats.length && info.url) {
    formats.push({
      label: 'MP4',
      quality: 'best',
      formatId: 'best',
      url: info.url,
      direct: true,
    });
  }

  if (!formats.length) {
    throw new Error('No video links found. Try a different URL.');
  }

  return {
    title: info.title || info.fulltitle || 'Video',
    author: info.uploader || info.channel || info.creator || '',
    thumbnail: info.thumbnail || null,
    sourceUrl,
    formats,
    url: formats[0]?.url,
  };
}
