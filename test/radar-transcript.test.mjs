import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { ContentStore } from '../content-store.mjs';
import {
  DEFAULT_SHORTS_PROMPT,
  formatTimestamp,
  extractVideoId,
  generateHeuristicIdea,
  generateHeuristicScript,
  extractYouTubeTranscript,
  synthesizeIdeaFromTranscript,
  synthesizeScriptFromTranscript,
  saveTranscriptIdeaToKanban,
  saveTranscriptScriptToKanban
} from '../radar-transcript.mjs';

test('formatTimestamp accurately handles milliseconds, minutes, and hours', () => {
  assert.equal(formatTimestamp(0), '00:00');
  assert.equal(formatTimestamp(15000), '00:15');
  assert.equal(formatTimestamp(65000), '01:05');
  assert.equal(formatTimestamp(3665000), '01:01:05');
});

test('extractVideoId accurately parses raw ID and various YouTube URLs', () => {
  assert.equal(extractVideoId('aks6P_onYqo'), 'aks6P_onYqo');
  assert.equal(extractVideoId('https://www.youtube.com/watch?v=aks6P_onYqo'), 'aks6P_onYqo');
  assert.equal(extractVideoId('https://youtu.be/aks6P_onYqo?si=123'), 'aks6P_onYqo');
  assert.equal(extractVideoId('https://www.youtube.com/shorts/aks6P_onYqo'), 'aks6P_onYqo');
  assert.equal(extractVideoId('https://www.youtube.com/embed/aks6P_onYqo'), 'aks6P_onYqo');
  assert.throws(() => extractVideoId('not-a-youtube-url'), /tidak valid/);
  assert.throws(() => extractVideoId(''), /wajib diisi/);
});

test('generateHeuristicIdea produces structured investigative schema', () => {
  const dummyTranscript = {
    title: 'Skandal Pajak dan Konglomerat 2026',
    channelName: 'Kanal Berita',
    fullText: 'Narasi data tentang laporan audit keuangan negara...',
    durationFormatted: '15:20',
    wordCount: 1800
  };

  const idea = generateHeuristicIdea(dummyTranscript, { format: 'long' });
  assert.equal(idea.format, 'long');
  assert.equal(idea.pillar, 'Investigasi');
  assert.match(idea.title, /Skandal Pajak/i);
  assert.ok(idea.recommendedAngle.length > 20);
  assert.ok(idea.suggestedHook.length > 20);
  assert.ok(Array.isArray(idea.keyFindings) && idea.keyFindings.length >= 3);
  assert.match(idea.counterPerspective, /The System/);
});

test('generateHeuristicScript creates production-ready script format for long and shorts', () => {
  const dummyTranscript = {
    title: 'Monopoli Impor Komoditas',
    channelName: 'Investigasi Mitra',
    durationFormatted: '12:00'
  };
  const dummyIdea = {
    title: 'Siapa Dalang di Balik Monopoli?',
    suggestedHook: 'Jangan terkecoh oleh alasan kelangkaan pasar.'
  };

  const longScript = generateHeuristicScript(dummyTranscript, dummyIdea, { format: 'long' });
  assert.equal(longScript.format, 'long');
  assert.match(longScript.script, /\[SCENE 1: PROLOGUE/);
  assert.match(longScript.script, /VISUAL:/);
  assert.match(longScript.script, /AUDIO\/VO:/);
  assert.ok(longScript.estimatedDurationMin >= 10);

  const shortScript = generateHeuristicScript(dummyTranscript, dummyIdea, { format: 'shorts' });
  assert.equal(shortScript.format, 'shorts');
  assert.match(shortScript.script, /\[HOOK/);
  assert.match(shortScript.script, /\[CONTEXT/);
  assert.match(shortScript.script, /\[BRIDGE/);
  assert.match(shortScript.script, /\[CLIMAX/);
  assert.match(shortScript.script, /\[DISCLAIMER/);
  assert.match(shortScript.script, /\[CTA/);
  assert.ok(shortScript.wordCount <= 90);
  assert.ok(shortScript.hooks.main && shortScript.hooks.controversial);
  assert.equal(shortScript.estimatedDurationMin, 0.5);
});

test('saveTranscriptIdeaToKanban persists idea to content store with source link and brief', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'transcript-idea-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const store = new ContentStore(path.join(dir, 'contents.json'));

  const idea = {
    title: 'Menguak Skandal Pasir Laut',
    format: 'long',
    pillar: 'Kebijakan',
    recommendedAngle: 'Bukan sekadar isu lingkungan, melainkan konsesi tambang.',
    suggestedHook: 'Mengapa izin ekspor dibuka kembali setelah 20 tahun?',
    keyFindings: ['Ditemukan 3 perusahaan baru terafiliasi.', 'Pendapatan negara sangat minim.']
  };
  const sourceVideo = {
    id: 'abc12345678',
    title: 'Ekspor Pasir Laut Resmi Dibuka',
    channelName: 'Kompetitor News',
    url: 'https://www.youtube.com/watch?v=abc12345678'
  };

  const result = await saveTranscriptIdeaToKanban(store, idea, sourceVideo);
  assert.equal(result.ok, true);
  assert.equal(result.content.title, 'Menguak Skandal Pasir Laut');
  assert.equal(result.content.stage, 'idea');
  assert.match(result.content.brief, /Sumber Video Pantauan: Ekspor Pasir Laut Resmi Dibuka/);
  assert.equal(result.content.sources.length, 1);
  assert.equal(result.content.sources[0].url, sourceVideo.url);
});

test('saveTranscriptScriptToKanban persists full script to content store', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'transcript-script-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const store = new ContentStore(path.join(dir, 'contents.json'));

  const scriptData = {
    title: 'Naskah Investigasi Kereta Cepat',
    format: 'long',
    hook: 'Berapa triliun APBN yang tersedot?',
    script: '[SCENE 1: HOOK]\nVISUAL: Kereta melaju.\nAUDIO: "Berapa triliun APBN yang tersedot?"',
    productionNotes: 'Perlu grafik pinjaman bunga bank Cina.',
    estimatedDurationMin: 14
  };
  const sourceVideo = {
    id: 'xyz12345678',
    title: 'Utang Kereta Cepat Membengkak',
    channelName: 'Ekonomi Review',
    url: 'https://www.youtube.com/watch?v=xyz12345678'
  };

  const result = await saveTranscriptScriptToKanban(store, scriptData, sourceVideo);
  assert.equal(result.ok, true);
  assert.equal(result.content.title, 'Naskah Investigasi Kereta Cepat');
  assert.equal(result.content.stage, 'script');
  assert.equal(result.content.script, scriptData.script);
  assert.equal(result.content.hook, scriptData.hook);
  assert.equal(result.content.productionNotes, scriptData.productionNotes);
});

test('synthesizeIdeaFromTranscript gracefully uses heuristic when AI is not configured', async () => {
  const oldGeminiKey = process.env.GEMINI_API_KEY;
  const oldGroqKey = process.env.GROQ_API_KEY;
  delete process.env.GEMINI_API_KEY;
  delete process.env.GROQ_API_KEY;
  try {
    const dummyTranscript = {
      title: 'Krisis Air Bersih Jakarta',
      channelName: 'Channel A',
      fullText: 'Air tanah makin langka...',
      durationFormatted: '08:45',
      wordCount: 950
    };
    const res = await synthesizeIdeaFromTranscript(dummyTranscript, { format: 'long' });
    assert.equal(res.ok, true);
    assert.equal(res.source, 'heuristic');
    assert.ok(res.idea.title.includes('Krisis Air Bersih'));
  } finally {
    if (oldGeminiKey) process.env.GEMINI_API_KEY = oldGeminiKey;
    if (oldGroqKey) process.env.GROQ_API_KEY = oldGroqKey;
  }
});

test('DEFAULT_SHORTS_PROMPT contains H-C-B-C-D-C formula and word limits', () => {
  assert.ok(DEFAULT_SHORTS_PROMPT.includes('H-C-B-C-D-C'));
  assert.ok(DEFAULT_SHORTS_PROMPT.includes('Senior Short-Form Scriptwriter'));
  assert.ok(DEFAULT_SHORTS_PROMPT.includes('Maksimal 90 kata'));
  assert.ok(DEFAULT_SHORTS_PROMPT.includes('CORE ANGLE'));
  assert.ok(DEFAULT_SHORTS_PROMPT.includes('HOOK UTAMA & 3 ALTERNATIF'));
});
