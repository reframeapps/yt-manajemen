import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SYSTEM_PROMPT_THUMBNAIL_SEO,
  buildMasterThumbnailPrompt,
  generateHeuristicThumbnailSeo,
  generateThumbnailAndSeo
} from '../thumbnail-seo.mjs';

test('buildMasterThumbnailPrompt generates horizontal 16:9 prompt with neon green accents', () => {
  const dummyVariant = {
    title: 'UANG RAKYAT LENYAP',
    sub_headline: 'Jejak aliran dana disamarkan',
    main_element: '2 serious corporate figures in dark suits',
    content_gist: 'Mengungkap alur transaksi rahasia.',
    ctr_hook: 'Memicu rasa takut dan penasaran'
  };
  const dummyCtx = {
    niche: 'Investigasi / Politik',
    mood: 'Mencekam, tegang',
    symbol_object: 'A heavy metallic gavel',
    background_element: 'Dark silhouette of high-rise building',
    warning_points: ['KERUGIAN TRILIUNAN', 'DOKUMEN DIRAHASIAKAN'],
    real_figures_note: 'Gunakan foto asli tokoh publik'
  };

  const p16 = buildMasterThumbnailPrompt(dummyVariant, dummyCtx, 'thumbnail');
  assert.match(p16, /\[MAGNETS MEDIA — MASTER THUMBNAIL PROMPT\]/);
  assert.match(p16, /1280x720px/);
  assert.match(p16, /JUDUL: "UANG RAKYAT LENYAP"/);
  assert.match(p16, /Neon Hijau \(#00FF41 \/ #39FF14\)/);
  assert.match(p16, /━━ STRUKTUR LAYOUT \(HORIZONTAL 16:9\) ━━/);
  assert.match(p16, /safe zone 40px/);
  assert.match(p16, /CATATAN FIGUR NYATA/);
});

test('buildMasterThumbnailPrompt generates vertical 9:16 prompt for Shorts', () => {
  const dummyVariant = {
    title: 'SIAPA DALANG UTAMA?',
    sub_headline: 'Bukan kelalaian biasa',
    main_element: 'Silhouette of key power broker',
    content_gist: 'Menelusuri aktor intelektual.',
    ctr_hook: 'Membuka curiosity gap yang kuat'
  };
  const dummyCtx = {
    niche: 'Investigasi',
    mood: 'Urgent, misterius',
    symbol_object: 'A golden key over redacted files',
    background_element: 'Night skyline',
    warning_points: ['FAKTA 1', 'FAKTA 2'],
    real_figures_note: ''
  };

  const p9 = buildMasterThumbnailPrompt(dummyVariant, dummyCtx, 'short');
  assert.match(p9, /1080x1920px/);
  assert.match(p9, /━━ STRUKTUR LAYOUT \(VERTIKAL 9:16\) ━━/);
  assert.match(p9, /ZONA AMAN kosong di 12% paling bawah/);
});

test('generateHeuristicThumbnailSeo produces valid schema and 3-word titles', () => {
  const script = 'Kasus korupsi dana desa mencapai ratusan miliar rupiah di wilayah pesisir...';
  const res = generateHeuristicThumbnailSeo(script, 'thumbnail');

  assert.ok(res.seo_title.length > 10);
  assert.ok(res.seo_caption.length > 20);
  assert.equal(res.warning_points.length, 2);
  assert.equal(res.variants.length, 3);

  for (const v of res.variants) {
    const wordCount = v.title.trim().split(/\s+/).length;
    assert.equal(wordCount, 3, `Title "${v.title}" must have exactly 3 words`);
    assert.ok(v.sub_headline.length > 5);
    assert.ok(v.ctr_hook.length > 5);
  }
});

test('generateThumbnailAndSeo attaches master_prompt to all variants', async () => {
  const oldGroq = process.env.GROQ_API_KEY;
  const oldGemini = process.env.GEMINI_API_KEY;
  delete process.env.GROQ_API_KEY;
  delete process.env.GEMINI_API_KEY;

  try {
    const out = await generateThumbnailAndSeo({
      script: 'Investigasi kebakaran hutan di lahan gambut sawit raksasa.',
      format: 'thumbnail'
    });

    assert.equal(out.ok, true);
    assert.equal(out.data.variants.length, 3);
    for (const v of out.data.variants) {
      assert.ok(v.master_prompt.includes('[MAGNETS MEDIA — MASTER THUMBNAIL PROMPT]'));
      assert.ok(v.master_prompt.includes('#00FF41'));
    }
  } finally {
    if (oldGroq) process.env.GROQ_API_KEY = oldGroq;
    if (oldGemini) process.env.GEMINI_API_KEY = oldGemini;
  }
});
