import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { detectMediaPlatform } from './radar-transcript.mjs';

/**
 * Universal Social Media Downloader Engine
 * Supports YouTube, TikTok (No Watermark), Instagram Reels/Post, X/Twitter, Facebook, Threads, and generic web video.
 */

export function sanitizeDownloadFilename(title, ext = 'mp4') {
  const safeExt = (ext || 'mp4').replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'mp4';
  let clean = (title || '')
    .normalize('NFKD')
    .replace(/[\x00-\x1f\x80-\x9f]/g, '')
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!clean || clean === '.') clean = `media_${Date.now()}`;
  if (clean.length > 80) clean = clean.slice(0, 80).trim();

  const fullName = `${clean}.${safeExt}`;
  const asciiFallback = clean.replace(/[^\x20-\x7E]/g, '_') + `.${safeExt}`;
  const utf8Encoded = encodeURIComponent(fullName);

  return {
    filename: fullName,
    asciiFallback,
    headerValue: `attachment; filename="${asciiFallback.replace(/"/g, '')}"; filename*=UTF-8''${utf8Encoded}`
  };
}

export function findCookiesPath() {
  if (process.env.COOKIES_PATH && fs.existsSync(process.env.COOKIES_PATH)) {
    return process.env.COOKIES_PATH;
  }
  const searchPaths = [
    path.join(process.cwd(), 'data', 'cookies.txt'),
    path.join(process.cwd(), 'cookies.txt'),
    path.join(process.cwd(), 'data', 'youtube_cookies.txt')
  ];
  for (const p of searchPaths) {
    try {
      if (fs.existsSync(p) && fs.statSync(p).size > 0) return p;
    } catch {}
  }
  return null;
}

export function resolveBinary(envVar, fallbackNames) {
  if (process.env[envVar] && fs.existsSync(process.env[envVar])) {
    return process.env[envVar];
  }
  for (const name of fallbackNames) {
    try {
      if (path.isAbsolute(name) && fs.existsSync(name)) return name;
    } catch {}
  }
  return fallbackNames[0];
}

export function resolveYtDlp() {
  return resolveBinary('YT_DLP_PATH', [
    '/usr/local/bin/yt-dlp',
    '/usr/bin/yt-dlp',
    'yt-dlp',
    'yt-dlp.exe'
  ]);
}

export function resolveFfmpeg() {
  return resolveBinary('FFMPEG_PATH', [
    '/usr/bin/ffmpeg',
    '/usr/local/bin/ffmpeg',
    'ffmpeg',
    'ffmpeg.exe'
  ]);
}

export function resolveNodeBinary() {
  return resolveBinary('NODE_PATH', [
    '/usr/bin/node',
    '/usr/local/bin/node',
    'node',
    'node.exe'
  ]);
}

export function formatDuration(seconds) {
  const s = Math.floor(Number(seconds) || 0);
  if (s <= 0) return '';
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function mapYtDlpError(rawError, platform = '') {
  const msg = String(rawError || '').toLowerCase();
  if (msg.includes('private video') || msg.includes('this video is private') || msg.includes('login required') || msg.includes('account is private')) {
    return 'Video ini bersifat privat atau akun kreator dikunci.';
  }
  if (msg.includes('sign in to confirm your age') || msg.includes('age-restricted') || msg.includes('confirm your age')) {
    return 'Video dibatasi usia (age-restricted). Silakan sediakan cookies.txt pada server untuk mengunduh konten ini.';
  }
  if (msg.includes('bot') || msg.includes('sign in') || msg.includes('cookies') || msg.includes('automated queries')) {
    return 'Platform membatasi akses otomatis (bot check). Tambahkan file cookies.txt ke server untuk verifikasi sesi.';
  }
  if (msg.includes('video unavailable') || msg.includes('not found') || msg.includes('404')) {
    return 'Video tidak ditemukan atau telah dihapus oleh pengunggah.';
  }
  if (msg.includes('unsupported url') || msg.includes('is not a valid url')) {
    return 'Format tautan URL tidak valid atau platform belum didukung.';
  }
  if (msg.includes('enoent') || msg.includes('not found: yt-dlp') || msg.includes('spawn yt-dlp')) {
    return 'Engine backend yt-dlp belum terpasang di sistem server. Silakan install yt-dlp terlebih dahulu.';
  }
  return rawError || 'Gagal mengekstrak informasi media dari tautan yang diberikan.';
}

/**
 * Fetch video metadata and supported download formats
 */
export async function fetchMediaInfo(url, options = {}) {
  if (!url || typeof url !== 'string' || !url.trim()) {
    throw Object.assign(new Error('URL media wajib disertakan.'), { status: 400 });
  }

  const cleanUrl = url.trim();
  let detectedPlatform = 'web';
  try {
    const p = detectMediaPlatform(cleanUrl);
    detectedPlatform = p.platform || 'web';
  } catch {}

  const ytDlpBin = resolveYtDlp();
  const cookiesPath = options.cookiesPath || findCookiesPath();
  const nodeBin = resolveNodeBinary();

  const args = [
    '--dump-single-json',
    '--no-warnings',
    '--no-playlist',
    '--skip-download',
    '--js-runtimes', `node:${nodeBin}`
  ];

  if (cookiesPath) {
    args.push('--cookies', cookiesPath);
  }

  args.push(cleanUrl);

  return new Promise((resolve, reject) => {
    let stdoutData = '';
    let stderrData = '';
    let timedOut = false;

    const child = spawn(ytDlpBin, args, { windowsHide: true });

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
      reject(Object.assign(new Error('Proses pengambilan info video melebihi batas waktu (timeout 40 detik).'), { status: 504 }));
    }, options.timeout || 40000);

    child.stdout.on('data', chunk => {
      stdoutData += chunk.toString();
    });

    child.stderr.on('data', chunk => {
      stderrData += chunk.toString();
    });

    child.on('error', err => {
      clearTimeout(timer);
      if (timedOut) return;
      reject(Object.assign(new Error(mapYtDlpError(err.message, detectedPlatform)), { status: 500, raw: err.message }));
    });

    child.on('close', code => {
      clearTimeout(timer);
      if (timedOut) return;

      if (code !== 0) {
        const errorMsg = mapYtDlpError(stderrData, detectedPlatform);
        return reject(Object.assign(new Error(errorMsg), { status: 422, raw: stderrData }));
      }

      try {
        const data = JSON.parse(stdoutData);
        const title = data.title || 'Video Tanpa Judul';
        const thumbnail = data.thumbnail || (Array.isArray(data.thumbnails) && data.thumbnails.length ? data.thumbnails[data.thumbnails.length - 1].url : '');
        const author = data.uploader || data.channel || data.creator || data.uploader_id || '';
        const duration = Math.floor(Number(data.duration) || 0);
        const durationFormatted = formatDuration(duration);

        // Determine available resolutions
        const rawFormats = Array.isArray(data.formats) ? data.formats : [];
        let maxHeight = 0;
        for (const f of rawFormats) {
          const h = Number(f.height) || 0;
          if (h > maxHeight && f.vcodec !== 'none') {
            maxHeight = h;
          }
        }

        const formatOptions = [];
        if (maxHeight >= 1080) {
          formatOptions.push({ id: '1080p', label: '1080p Full HD', resolution: '1080p', ext: 'mp4', type: 'video', qualityNote: 'Kualitas tertinggi (HD)' });
        }
        if (maxHeight >= 720) {
          formatOptions.push({ id: '720p', label: '720p HD', resolution: '720p', ext: 'mp4', type: 'video', qualityNote: 'Kualitas standar jernih' });
        }
        if (maxHeight >= 480) {
          formatOptions.push({ id: '480p', label: '480p SD', resolution: '480p', ext: 'mp4', type: 'video', qualityNote: 'Kualitas hemat kuota' });
        }
        if (maxHeight >= 360 && maxHeight < 480) {
          formatOptions.push({ id: '360p', label: '360p', resolution: '360p', ext: 'mp4', type: 'video', qualityNote: 'Ukuran ringan' });
        }

        // If no height detected (TikTok/Instagram Reels or custom platforms), provide Best Video
        if (formatOptions.length === 0) {
          formatOptions.push({ id: 'best', label: 'Resolusi Terbaik (Auto)', resolution: 'Best HD', ext: 'mp4', type: 'video', qualityNote: 'Format optimal platform (No Watermark)' });
        }

        // Audio MP3 option
        formatOptions.push({ id: 'mp3', label: 'Audio MP3', resolution: 'Audio only', ext: 'mp3', type: 'audio', qualityNote: 'Hanya suara / musik jernih' });

        resolve({
          ok: true,
          url: cleanUrl,
          id: data.id || '',
          title,
          thumbnail,
          author,
          duration,
          durationFormatted,
          platform: detectedPlatform,
          platformLabel: detectedPlatform === 'youtube' ? 'YouTube'
            : detectedPlatform === 'tiktok' ? 'TikTok (No Watermark)'
            : detectedPlatform === 'instagram' ? 'Instagram'
            : detectedPlatform === 'twitter' ? 'X / Twitter'
            : detectedPlatform === 'facebook' ? 'Facebook'
            : detectedPlatform === 'threads' ? 'Threads'
            : 'Video Web',
          maxHeight,
          formats: formatOptions,
          cookiesActive: !!cookiesPath
        });
      } catch (e) {
        reject(Object.assign(new Error('Gagal memproses data metadata dari output video: ' + e.message), { status: 500 }));
      }
    });
  });
}

/**
 * Stream video/audio download directly into HTTP response
 */
export function streamMediaDownload(req, res, { url, quality = 'best', title = '' }) {
  if (!url || typeof url !== 'string' || !url.trim()) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: false, error: 'URL download tidak valid.' }));
  }

  const cleanUrl = url.trim();
  const isAudio = quality === 'mp3' || quality === 'audio';
  const targetExt = isAudio ? 'mp3' : 'mp4';
  const disposition = sanitizeDownloadFilename(title || 'download', targetExt);

  const ytDlpBin = resolveYtDlp();
  const ffmpegBin = resolveFfmpeg();
  const cookiesPath = findCookiesPath();
  const nodeBin = resolveNodeBinary();

  let childYtDlp = null;
  let childFfmpeg = null;
  let headersSent = false;

  const cleanup = () => {
    if (childYtDlp) {
      try { childYtDlp.kill('SIGTERM'); } catch {}
      childYtDlp = null;
    }
    if (childFfmpeg) {
      try { childFfmpeg.kill('SIGTERM'); } catch {}
      childFfmpeg = null;
    }
  };

  req.on('close', cleanup);
  req.on('aborted', cleanup);

  if (isAudio) {
    // AUDIO STREAMING PIPELINE: yt-dlp -> ffmpeg -> res
    const ytArgs = [
      '--no-warnings',
      '--no-playlist',
      '--js-runtimes', `node:${nodeBin}`,
      '-f', 'ba/b',
      '-o', '-'
    ];
    if (cookiesPath) ytArgs.push('--cookies', cookiesPath);
    ytArgs.push(cleanUrl);

    const ffmpegArgs = [
      '-v', 'error',
      '-i', 'pipe:0',
      '-vn',
      '-c:a', 'libmp3lame',
      '-b:a', '192k',
      '-f', 'mp3',
      'pipe:1'
    ];

    try {
      childYtDlp = spawn(ytDlpBin, ytArgs, { windowsHide: true });
      childFfmpeg = spawn(ffmpegBin, ffmpegArgs, { windowsHide: true });
    } catch (err) {
      cleanup();
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: false, error: 'Gagal menjalankan binary streaming: ' + err.message }));
    }

    let ytStderr = '';
    childYtDlp.stderr.on('data', d => { ytStderr += d.toString(); });
    childYtDlp.on('error', err => {
      cleanup();
      if (!headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'Proses download audio bermasalah: ' + err.message }));
      }
    });

    childFfmpeg.on('error', err => {
      cleanup();
      if (!headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'Konversi FFmpeg audio gagal: ' + err.message }));
      }
    });

    childFfmpeg.stdout.once('data', chunk => {
      if (!headersSent) {
        headersSent = true;
        res.writeHead(200, {
          'Content-Type': 'audio/mpeg',
          'Content-Disposition': disposition.headerValue,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'X-Content-Type-Options': 'nosniff'
        });
      }
      res.write(chunk);
    });

    childYtDlp.stdout.pipe(childFfmpeg.stdin);
    childFfmpeg.stdout.pipe(res);

    childYtDlp.on('close', code => {
      if (code !== 0 && !headersSent) {
        cleanup();
        res.writeHead(422, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: mapYtDlpError(ytStderr) }));
      }
    });

    return;
  }

  // VIDEO STREAMING PIPELINE: yt-dlp -> res
  let formatSelector = 'bestvideo+bestaudio/best';
  if (quality === '1080p') {
    formatSelector = 'bestvideo[height<=1080]+bestaudio/best[height<=1080]/best';
  } else if (quality === '720p') {
    formatSelector = 'bestvideo[height<=720]+bestaudio/best[height<=720]/best';
  } else if (quality === '480p') {
    formatSelector = 'bestvideo[height<=480]+bestaudio/best[height<=480]/best';
  } else if (quality === '360p') {
    formatSelector = 'bestvideo[height<=360]+bestaudio/best[height<=360]/best';
  }

  const ytArgs = [
    '--no-warnings',
    '--no-playlist',
    '--js-runtimes', `node:${nodeBin}`,
    '-f', formatSelector,
    '--downloader-args', 'ffmpeg_o:-movflags frag_keyframe+empty_moov+default_base_moof',
    '-o', '-'
  ];

  if (cookiesPath) ytArgs.push('--cookies', cookiesPath);
  ytArgs.push(cleanUrl);

  try {
    childYtDlp = spawn(ytDlpBin, ytArgs, { windowsHide: true });
  } catch (err) {
    cleanup();
    res.writeHead(500, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: false, error: 'Gagal menjalankan yt-dlp: ' + err.message }));
  }

  let ytStderr = '';
  childYtDlp.stderr.on('data', d => { ytStderr += d.toString(); });

  childYtDlp.stdout.once('data', chunk => {
    if (!headersSent) {
      headersSent = true;
      res.writeHead(200, {
        'Content-Type': 'video/mp4',
        'Content-Disposition': disposition.headerValue,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Content-Type-Options': 'nosniff'
      });
    }
    res.write(chunk);
  });

  childYtDlp.stdout.pipe(res);

  childYtDlp.on('error', err => {
    cleanup();
    if (!headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'Proses streaming video gagal: ' + err.message }));
    }
  });

  childYtDlp.on('close', code => {
    if (code !== 0 && !headersSent) {
      cleanup();
      res.writeHead(422, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: mapYtDlpError(ytStderr) }));
    }
  });
}
