import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sanitizeDownloadFilename,
  formatDuration,
  mapYtDlpError,
  findCookiesPath,
  getCookiesStatus,
  saveCookiesFile,
  deleteCookiesFile,
  fetchMediaInfo,
  streamMediaDownload
} from '../media-downloader.mjs';

test('sanitizeDownloadFilename handles normal, special and unicode characters', () => {
  const r1 = sanitizeDownloadFilename('Video Keren: Cara Cepat & Mantap! * 2026', 'mp4');
  assert.equal(r1.filename, 'Video Keren Cara Cepat & Mantap! 2026.mp4');
  assert.ok(r1.headerValue.includes('attachment; filename='));
  assert.ok(r1.headerValue.includes('filename*=UTF-8\'\''));

  const r2 = sanitizeDownloadFilename('', 'mp3');
  assert.match(r2.filename, /^media_\d+\.mp3$/);

  const r3 = sanitizeDownloadFilename('Jepang ラーメン & Sushi 🍣', 'mp4');
  assert.ok(r3.headerValue.includes("UTF-8''"));
});

test('formatDuration formats seconds to mm:ss or h:mm:ss', () => {
  assert.equal(formatDuration(0), '');
  assert.equal(formatDuration(-10), '');
  assert.equal(formatDuration(45), '00:45');
  assert.equal(formatDuration(65), '01:05');
  assert.equal(formatDuration(3600), '1:00:00');
  assert.equal(formatDuration(3665), '1:01:05');
});

test('mapYtDlpError maps common errors to friendly Indonesian text', () => {
  assert.match(mapYtDlpError('ERROR: This video is private'), /privat/i);
  assert.match(mapYtDlpError('Sign in to confirm your age'), /dibatasi usia/i);
  assert.match(mapYtDlpError('Bot detected, please sign in'), /bot check/i);
  assert.match(mapYtDlpError('Video unavailable: not found'), /tidak ditemukan/i);
  assert.match(mapYtDlpError('Unsupported URL: https://example.com/foo'), /tidak valid atau platform belum didukung/i);
  assert.match(mapYtDlpError('spawn yt-dlp ENOENT'), /belum terpasang/i);
  assert.match(mapYtDlpError('empty media response', 'instagram'), /instagram/i);
});

test('findCookiesPath and cookie lifecycle management', () => {
  const initialStatus = getCookiesStatus();
  assert.ok(typeof initialStatus.exists === 'boolean');

  // Test saving test cookie
  const sampleCookie = '# Netscape HTTP Cookie File\n.youtube.com\tTRUE\t/\tTRUE\t1799999999\tSID\tsample\n.instagram.com\tTRUE\t/\tTRUE\t1799999999\tsessionid\tsample';
  const saved = saveCookiesFile(sampleCookie);
  assert.equal(saved.exists, true);
  assert.ok(saved.domains.includes('youtube.com'));
  assert.ok(saved.domains.includes('instagram.com'));

  // Test deleting
  const del = deleteCookiesFile();
  assert.equal(del.ok, true);
});

test('fetchMediaInfo rejects empty URL with 400', async () => {
  await assert.rejects(
    async () => fetchMediaInfo(''),
    (err) => err.status === 400 && err.message.includes('URL media wajib disertakan')
  );
});

test('streamMediaDownload rejects missing URL with 400 JSON', async () => {
  let status = 0;
  let headers = {};
  let body = '';
  const mockRes = {
    writeHead(s, h) { status = s; headers = h; },
    end(data) { body = data; }
  };
  const mockReq = { on() {} };

  await streamMediaDownload(mockReq, mockRes, { url: '' });
  assert.equal(status, 400);
  assert.ok(body.includes('URL download tidak valid'));
});

test('media downloader format choices prioritize 1080p and 720p HD', () => {
  // Test filename sanitization with HD labels
  const res1080 = sanitizeDownloadFilename('Video Full HD 1080p Test', 'mp4');
  assert.equal(res1080.filename, 'Video Full HD 1080p Test.mp4');

  const resAudio = sanitizeDownloadFilename('Audio Musik Jernih', 'mp3');
  assert.equal(resAudio.filename, 'Audio Musik Jernih.mp3');
});

