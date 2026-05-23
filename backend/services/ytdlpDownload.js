import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { sanitizeFilename, contentDispositionHeader } from './streamProxy.js';
import { createReadStream, unlink } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { pipeline } from 'node:stream/promises';

const execFileAsync = promisify(execFile);

function resolveYtDlpCommand(ytdlpPath = 'python3 -m yt_dlp') {
  const parts = ytdlpPath.trim().split(/\s+/);
  if (parts.length > 1) {
    return { cmd: parts[0], args: parts.slice(1) };
  }
  return { cmd: parts[0], args: [] };
}

async function findFfmpeg() {
  const paths = [
    process.env.FFMPEG_PATH,
    '/opt/homebrew/bin/ffmpeg',
    '/usr/local/bin/ffmpeg',
  ].filter(Boolean);

  for (const p of paths) {
    try {
      await execFileAsync(p, ['-version']);
      return p;
    } catch { /* try next */ }
  }

  try {
    const { stdout } = await execFileAsync('which', ['ffmpeg']);
    const found = stdout.trim();
    if (found) return found;
  } catch { /* not in PATH */ }

  return null;
}

export async function streamYtDlpDownload(sourceUrl, formatId, ytdlpPath, res, filename) {
  const ffmpeg = await findFfmpeg();
  if (!ffmpeg) {
    throw new Error(
      'ffmpeg is not installed. Install it with: brew install ffmpeg — required for Pinterest/TikTok video merging.'
    );
  }

  const { cmd, args } = resolveYtDlpCommand(ytdlpPath);
  const tempFile = join(tmpdir(), `vidograb-${randomUUID()}.mp4`);

  const formatSelector = formatId
    ? `${formatId}+bestaudio/best`
    : 'bestvideo+bestaudio/best';

  await new Promise((resolve, reject) => {
    const proc = spawn(cmd, [
      ...args,
      '-f', formatSelector,
      '--merge-output-format', 'mp4',
      '--ffmpeg-location', ffmpeg,
      '--no-playlist',
      '--no-warnings',
      '-o', tempFile,
      sourceUrl,
    ], { stdio: ['ignore', 'pipe', 'pipe'] });

    let stderr = '';
    proc.stderr.on('data', (d) => { stderr += d.toString(); });

    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.slice(-300) || `yt-dlp exit ${code}`));
    });
    proc.on('error', reject);

    res.on('close', () => {
      if (!proc.killed) proc.kill('SIGTERM');
    });
  });

  const safeName = sanitizeFilename(filename);
  res.setHeader('Content-Type', 'video/mp4');
  res.setHeader('Content-Disposition', contentDispositionHeader(safeName));

  try {
    await pipeline(createReadStream(tempFile), res);
  } catch (err) {
    if (!res.headersSent) throw err;
  } finally {
    unlink(tempFile, () => {});
  }
}
