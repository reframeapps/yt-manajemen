import crypto from 'node:crypto';
import { safeFeed, parseFeed } from './radar-sync.mjs';

export const SOCIAL_PILLARS = [
  'Politik',
  'Ekonomi',
  'Geopolitik',
  'Sisi Gelap',
  'Hukum',
  'Investigasi',
  'Kebijakan'
];

export class RadarSocial {
  constructor(radarStore, radarAI, options = {}) {
    this.store = radarStore;
    this.ai = radarAI;
    this.fetcher = options.fetcher ?? fetch;
    this.now = options.now ?? (() => Date.now());
    this.isScanning = false;
  }

  async getReport() {
    const db = await this.store.contentStore.read();
    const data = db.radar?.socialIntelligence || {
      lastScanAt: null,
      status: 'idle',
      items: [],
      error: null
    };
    return {
      ...data,
      isScanning: this.isScanning,
      pillars: SOCIAL_PILLARS
    };
  }

  async fetchRawTrends() {
    const rawItems = [];

    // 1. Google Trends Indonesia RSS
    try {
      const trendsXml = await safeFeed('https://trends.google.com/trending/rss?geo=ID');
      const items = parseFeed(trendsXml, 'Google Trends ID');
      for (const item of items.slice(0, 15)) {
        rawItems.push({
          title: item.title,
          publisher: 'Google Trends Indonesia',
          url: item.url,
          publishedAt: item.publishedAt,
          platformHint: 'Tren Pencarian / Sosmed'
        });
      }
    } catch (e) {
      // Trends RSS may occasionally fail or be rate limited; non-fatal
    }

    // 2. Google News RSS: Pillar Focus A (Politik, Hukum, Kebijakan, Sisi Gelap)
    try {
      const q1 = encodeURIComponent('(politik OR hukum OR kebijakan OR "sisi gelap") (viral OR trending OR "di twitter" OR "di X" OR tiktok OR netizen OR perbincangan OR polemik)');
      const xml1 = await safeFeed(`https://news.google.com/rss/search?q=${q1}&hl=id&gl=ID&ceid=ID:id`);
      const items1 = parseFeed(xml1, 'Google News Sosmed');
      for (const item of items1.slice(0, 15)) {
        const titleLower = item.title.toLowerCase();
        const platform = titleLower.includes('tiktok') ? 'TikTok' : (titleLower.includes('twitter') || titleLower.includes('x.com')) ? 'X / Twitter' : 'Media / Netizen';
        rawItems.push({
          title: item.title,
          publisher: item.publisher || 'Media Nasional',
          url: item.url,
          publishedAt: item.publishedAt,
          platformHint: platform
        });
      }
    } catch (e) {
      // Non-fatal
    }

    // 3. Google News RSS: Pillar Focus B (Ekonomi, Geopolitik, Investigasi)
    try {
      const q2 = encodeURIComponent('(ekonomi OR geopolitik OR investigasi OR skandal) (korupsi OR "aliran dana" OR polemik OR heboh OR terbongkar OR kecurangan OR viral)');
      const xml2 = await safeFeed(`https://news.google.com/rss/search?q=${q2}&hl=id&gl=ID&ceid=ID:id`);
      const items2 = parseFeed(xml2, 'Google News Investigasi');
      for (const item of items2.slice(0, 15)) {
        const titleLower = item.title.toLowerCase();
        const platform = titleLower.includes('tiktok') ? 'TikTok' : (titleLower.includes('twitter') || titleLower.includes('x.com')) ? 'X / Twitter' : 'Media / Netizen';
        rawItems.push({
          title: item.title,
          publisher: item.publisher || 'Investigasi / Berita',
          url: item.url,
          publishedAt: item.publishedAt,
          platformHint: platform
        });
      }
    } catch (e) {
      // Non-fatal
    }

    // Deduplicate by title
    const seen = new Set();
    const unique = [];
    for (const item of rawItems) {
      const clean = item.title.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (!seen.has(clean)) {
        seen.add(clean);
        unique.push(item);
      }
    }

    return unique.slice(0, 30);
  }

  async synthesizeTop5(rawSignals) {
    const prompt = `Anda adalah Direktur Eksekutif Investigasi untuk channel YouTube investigasi dokumenter "REFRAME INVESTIGASI".
Gaya & DNA REFRAME INVESTIGASI:
- Membongkar skandal, aliran uang (follow the money), relasi kuasa politik-ekonomi, manipulasi kebijakan publik, hukum timpang, sisi gelap industri, dan geopolitik.
- Karakter: Berbobot, berbasis data empiris/dokumen, tajam, berani, mengungkap apa yang disembunyikan di balik narasi viral netizen.
- Format: Video dokumenter investigasi naratif berdurasi mendalam atau shorts investigasi berdampak tinggi.

Tugas Anda:
Analisis bahan mentah perbincangan viral, tren netizen, dan berita panas berikut.
Pilih dan rumuskan TEPAT 5 (TOP 5) IDE KONTEN INVESTIGASI PALING POTENSIAL DAN BERBOBOT.
Harus relevan dengan 7 Pilar Utama kami:
1. Politik
2. Ekonomi
3. Geopolitik
4. Sisi Gelap
5. Hukum
6. Investigasi
7. Kebijakan

Bahan mentah yang terpantau:
${JSON.stringify(rawSignals.map(s => ({ title: s.title, publisher: s.publisher, platformHint: s.platformHint, url: s.url })), null, 2)}

Ketentuan Penting:
1. Singkirkan gosip artis/selebriti remeh, olahraga tanpa skandal, atau lelucon receh.
2. Setiap ide harus memiliki judul yang sangat memikat dan bergaya dokumenter investigasi kelas tinggi.
3. viralityScore bernilai angka bulat 1 sampai 5 (5 = sangat mendesak/viral).
4. platform pilih salah satu dari: "X / Twitter", "TikTok", "Forum Publik".
5. pillar pilih salah satu dari 7 pilar: "Politik", "Ekonomi", "Geopolitik", "Sisi Gelap", "Hukum", "Investigasi", "Kebijakan".

Format balasan: Keluarkan HANYA JSON array murni berisi tepat 5 objek (tanpa tanda kutip backtick markdown, tanpa awalan/akhiran teks penjelasan):
[
  {
    "id": "1",
    "title": "Judul Investigasi Spektakuler",
    "platform": "X / Twitter",
    "pillar": "Kebijakan",
    "viralityScore": 5,
    "netizenSummary": "Ringkasan perbincangan panas netizen dan apa yang memicu kemarahan publik",
    "recommendedAngle": "Sudut pandang investigasi tajam khas REFRAME INVESTIGASI (aliran uang, regulasi yang dilanggar, aktor intelektual, dampak masyarakat)",
    "suggestedHook": "Kalimat hook narasi 5 detik pembuka video yang langsung mengunci perhatian penonton",
    "sourceUrl": "url sumber referensi"
  }
]`;

    // Try through AI complete
    let rawText = '';
    const geminiKey = process.env.GEMINI_API_KEY;
    const model = process.env.GEMINI_MODEL || 'gemini-3.5-flash';

    if (geminiKey) {
      const response = await this.fetcher(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': geminiKey
        },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 4000
          }
        })
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson?.error?.message || `Gemini API returned status ${response.status}`);
      }

      const data = await response.json();
      rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } else if (this.ai && typeof this.ai.complete === 'function') {
      rawText = await this.ai.complete('Output JSON only.', prompt);
    } else {
      throw new Error('API Key AI (Gemini) belum dikonfigurasi.');
    }

    // Clean JSON markdown blocks if any
    const cleanJson = rawText.trim().replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```$/i, '').trim();
    let parsed;
    try {
      parsed = JSON.parse(cleanJson);
    } catch (e) {
      throw new Error('Gagal mengurai format kurasi AI menjadi JSON: ' + e.message);
    }

    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error('Format hasil kurasi AI tidak valid (bukan array).');
    }

    // Sanitize and ensure exactly 5 items
    return parsed.slice(0, 5).map((item, idx) => ({
      id: String(item.id || idx + 1),
      title: String(item.title || 'Ide Investigasi Baru').trim(),
      platform: ['X / Twitter', 'TikTok', 'Forum Publik'].includes(item.platform) ? item.platform : 'X / Twitter',
      pillar: SOCIAL_PILLARS.includes(item.pillar) ? item.pillar : 'Investigasi',
      viralityScore: Number.isInteger(item.viralityScore) && item.viralityScore >= 1 && item.viralityScore <= 5 ? item.viralityScore : 4,
      netizenSummary: String(item.netizenSummary || '').trim(),
      recommendedAngle: String(item.recommendedAngle || '').trim(),
      suggestedHook: String(item.suggestedHook || '').trim(),
      sourceUrl: typeof item.sourceUrl === 'string' && /^https?:\/\//.test(item.sourceUrl) ? item.sourceUrl : ''
    }));
  }

  async scan({ force = false } = {}) {
    if (this.isScanning) {
      throw Object.assign(new Error('Pemindaian radar sosmed sedang berlangsung. Tunggu sebentar.'), { status: 409 });
    }

    this.isScanning = true;
    try {
      const rawSignals = await this.fetchRawTrends();
      if (!rawSignals.length) {
        throw new Error('Tidak ada sinyal tren sosmed yang berhasil dijangkau.');
      }

      const top5 = await this.synthesizeTop5(rawSignals);
      const scanTime = new Date(this.now()).toISOString();

      await this.store.mutate(r => {
        r.socialIntelligence = {
          lastScanAt: scanTime,
          status: 'ready',
          items: top5,
          rawSignalsCount: rawSignals.length,
          error: null
        };
      });

      return {
        ok: true,
        lastScanAt: scanTime,
        items: top5,
        rawSignalsCount: rawSignals.length
      };
    } catch (error) {
      await this.store.mutate(r => {
        r.socialIntelligence = {
          ...(r.socialIntelligence || {}),
          status: 'error',
          error: error.message
        };
      }).catch(() => {});
      throw error;
    } finally {
      this.isScanning = false;
    }
  }

  async toKanban(itemId) {
    if (!itemId) {
      throw Object.assign(new Error('ID item ide konten harus disertakan.'), { status: 400 });
    }

    const report = await this.getReport();
    const item = report.items.find(i => String(i.id) === String(itemId));
    if (!item) {
      throw Object.assign(new Error('Ide konten tidak ditemukan pada laporan radar sosmed terbaru.'), { status: 404 });
    }

    const payload = {
      title: item.title,
      brief: `[Radar Intelijen Sosmed - ${item.pillar} | ${item.platform}]\n\nKonteks Netizen:\n${item.netizenSummary}\n\nSudut Pandang Investigasi:\n${item.recommendedAngle}`,
      hook: item.suggestedHook,
      format: 'long',
      stage: 'idea',
      tags: `radar, sosmed, ${item.pillar.toLowerCase()}, investigasi`,
      sources: item.sourceUrl ? [{ label: `${item.platform} (${item.pillar})`, url: item.sourceUrl, notes: item.netizenSummary }] : []
    };

    const newContent = await this.store.contentStore.create(payload, { fillEngine: true });
    return {
      ok: true,
      content: newContent
    };
  }
}
