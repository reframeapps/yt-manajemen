import crypto from 'node:crypto';
import { YoutubeTranscript, YoutubeTranscriptError } from 'youtube-transcript';

export const PILLARS_MAP = {
  'Investigasi': 'investigasi',
  'Politik': 'politik',
  'Ekonomi': 'ekonomi',
  'Geopolitik': 'geopolitik',
  'Sisi Gelap': 'sisi-gelap',
  'Hukum': 'hukum',
  'Kebijakan': 'kebijakan'
};

export function formatTimestamp(ms) {
  const totalSeconds = Math.max(0, Math.floor((ms || 0) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function extractVideoId(input) {
  if (typeof input !== 'string' || !input.trim()) {
    throw Object.assign(new Error('ID atau URL video YouTube wajib diisi.'), { status: 400 });
  }
  const clean = input.trim();
  if (/^[\w-]{11}$/.test(clean)) return clean;
  const match = clean.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([\w-]{11})/i);
  if (match && match[1]) return match[1];
  throw Object.assign(new Error('Format ID atau URL video YouTube tidak valid.'), { status: 400 });
}

export async function fetchVideoMetadata(videoId, fetcher = fetch) {
  try {
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
    const res = await fetcher(oembedUrl, { signal: AbortSignal.timeout(8000) });
    if (res.ok) {
      const data = await res.json();
      return {
        title: data.title || '',
        author_name: data.author_name || '',
        author_url: data.author_url || '',
        thumbnail_url: data.thumbnail_url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
      };
    }
  } catch {}
  return {
    title: '',
    author_name: '',
    author_url: '',
    thumbnail_url: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
  };
}

export async function extractYouTubeTranscript(videoIdOrUrl, { lang = 'id', fetcher = fetch } = {}) {
  const videoId = extractVideoId(videoIdOrUrl);
  let rawSegments = [];
  let detectedLang = lang;

  try {
    // Attempt 1: Try requested language (default 'id')
    rawSegments = await YoutubeTranscript.fetchTranscript(videoId, { lang, fetch: fetcher });
  } catch (err1) {
    // Attempt 2: If failed with specific language, retry without language constraint (take whatever is available)
    try {
      rawSegments = await YoutubeTranscript.fetchTranscript(videoId, { fetch: fetcher });
      if (rawSegments?.[0]?.lang) {
        detectedLang = rawSegments[0].lang;
      }
    } catch (err2) {
      const msg = err2.message || err1.message || 'Transkrip tidak tersedia untuk video ini.';
      throw Object.assign(new Error(`Gagal mengekstrak transkrip YouTube: ${msg.replace(/^\[YoutubeTranscript\]\s*🚨?\s*/, '')}`), {
        status: 422,
        code: 'transcript_unavailable',
        videoId
      });
    }
  }

  if (!Array.isArray(rawSegments) || rawSegments.length === 0) {
    throw Object.assign(new Error('Transkrip kosong atau tidak ditemukan pada video ini.'), {
      status: 422,
      code: 'empty_transcript',
      videoId
    });
  }

  const meta = await fetchVideoMetadata(videoId, fetcher);

  const segments = rawSegments.map(s => {
    const offsetMs = Number(s.offset || 0);
    const durMs = Number(s.duration || 0);
    return {
      text: s.text.replace(/\s+/g, ' ').trim(),
      offset: offsetMs,
      duration: durMs,
      timestamp: formatTimestamp(offsetMs)
    };
  }).filter(s => Boolean(s.text));

  // Build clean paragraphs (grouping every ~4-5 segments or ~30 seconds)
  const paragraphs = [];
  let currentGroup = [];
  let currentStart = 0;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (currentGroup.length === 0) {
      currentStart = seg.offset;
    }
    currentGroup.push(seg.text);

    if (currentGroup.length >= 5 || (seg.offset - currentStart) >= 28000 || i === segments.length - 1) {
      paragraphs.push({
        timestamp: formatTimestamp(currentStart),
        text: currentGroup.join(' ')
      });
      currentGroup = [];
    }
  }

  const fullText = paragraphs.map(p => p.text).join('\n\n');
  const timedText = paragraphs.map(p => `[${p.timestamp}] ${p.text}`).join('\n\n');
  const words = fullText.split(/\s+/).filter(Boolean);
  const lastSeg = segments[segments.length - 1];
  const durationSec = Math.round((lastSeg.offset + lastSeg.duration) / 1000);

  return {
    videoId,
    url: `https://www.youtube.com/watch?v=${videoId}`,
    title: meta.title || `Video ${videoId}`,
    channelName: meta.author_name || 'Channel YouTube',
    thumbnailUrl: meta.thumbnail_url,
    language: detectedLang,
    wordCount: words.length,
    durationSec,
    durationFormatted: formatTimestamp(durationSec * 1000),
    segmentCount: segments.length,
    segments,
    paragraphs,
    fullText,
    timedText
  };
}

export function generateHeuristicIdea(transcriptData, { format = 'long' } = {}) {
  const titleBase = transcriptData.title || 'Investigasi Isu Publik';
  const cleanTitle = titleBase.replace(/[|!-].*$/, '').trim();
  const words = (transcriptData.fullText || '').split(/\s+/).slice(0, 500).join(' ');

  return {
    title: `Sisi Gelap di Balik ${cleanTitle}: Apa yang Sengaja Tidak Diungkap ke Publik?`,
    format: format === 'shorts' ? 'shorts' : 'long',
    pillar: 'Investigasi',
    recommendedAngle: `Membongkar alur kekuasaan dan motif ekonomi di balik narasi ${cleanTitle}. Video kompetitor hanya menyoroti permukaan sensasional, sementara aspek kebijakan struktural dan pihak yang diuntungkan belum dibedah.`,
    suggestedHook: `Semua orang fokus pada potongan video yang viral, tapi hampir tidak ada yang bertanya: siapa sebenarnya yang paling diuntungkan dari skenario ini?`,
    keyFindings: [
      `Fakta 1: Muncul pola anomali narasi yang terkonfirmasi dalam transkrip berdurasi ${transcriptData.durationFormatted}.`,
      `Fakta 2: Ada pihak pemegang otoritas dan regulasi yang belum dimintai pertanggungjawaban terbuka.`,
      `Fakta 3: Dampak sistemik langsung membebani masyarakat kelas menengah ke bawah tanpa solusi kompensasi nyata.`
    ],
    counterPerspective: `Menggunakan 3 Lensa REFRAME:\n1. The System: Telusuri alur dana APBN/anggaran swasta dan izin birokrasi.\n2. The Hidden History: Bandingkan dengan skandal serupa di masa lalu.\n3. The Human Mirror: Tampilkan kerugian riil masyarakat biasa sebagai cermin sosial.`,
    editorialNotes: `Verifikasi data laporan keuangan dan dokumen audit resmi terkait topik ini sebelum visualisasi grafis.`
  };
}

export function generateHeuristicScript(transcriptData, ideaData, { format = 'long' } = {}) {
  const title = ideaData?.title || `Investigasi: ${transcriptData.title}`;
  const hook = ideaData?.suggestedHook || `Semua orang mengira kasus ini sederhana, sampai kita melihat data di balik layarnya.`;
  const channel = transcriptData.channelName || 'Kompetitor';

  if (format === 'shorts') {
    return {
      title,
      format: 'shorts',
      hook,
      script: `[SCENE 1: HOOK (00:00 - 00:15)]
VISUAL: Cuplikan headline berita cepat, transisi glitch merah hitam.
AUDIO/VO: "${hook}"
TEKS LAYAR: JANGAN PERCAYA BEGITU SAJA!

[SCENE 2: BEDAH FAKTA & ANOMALI (00:15 - 00:45)]
VISUAL: Tampilan data statistik, dokumen resmi, dan sorotan grafik angka kerugian.
AUDIO/VO: "Banyak yang mengira isu ini cuma kebetulan. Padahal kalau kita telusuri transkrip dan jejak kebijakannya, ada pola berulang yang terstruktur. Ini bukan sekadar kelalaian individu, tapi desain sistem."
TEKS LAYAR: 3 FAKTA TERSEMBUNYI

[SCENE 3: REFLEKSI & CALL TO ACTION (00:45 - 00:60)]
VISUAL: Host REFRAME to camera / motion graphic logo REFRAME INVESTIGASI.
AUDIO/VO: "Menurut kalian, apakah ini murni ketidaksengajaan atau permainan kepentingan? Tulis argumen kalian di komentar, dan subscribe REFRAME untuk investigasi lengkapnya."
TEKS LAYAR: BAGAIMANA MENURUTMU? #REFRAME`,
      productionNotes: `Gunakan musik suspense tempo 120 bpm, sound effect whoosh & typing data, durasi total 58 detik.`,
      estimatedDurationMin: 1
    };
  }

  return {
    title,
    format: 'long',
    hook,
    script: `[SCENE 1: PROLOGUE & HOOK PEMBUKA] (Menit 00:00 - 01:15)
VISUAL: Cinematic drone footage kota metropolitan gelap. Grafik kontras hitam, putih, dan aksen merah REFRAME.
AUDIO/VO: "${hook} Selama beberapa pekan terakhir, jagat publik dihebohkan oleh satu isu besar. Namun di balik riuhnya perdebatan media sosial, ada satu pertanyaan krusial yang luput dari radar publik: mengapa pola ini terus berulang tanpa ada yang berani menyentuh akar masalahnya?"
TEKS LAYAR: REFRAME INVESTIGASI | BEDAH KASUS

[SCENE 2: REKONSTRUKSI KRONOLOGI & DOKUMEN] (Menit 01:15 - 04:30)
VISUAL: Animasi timeline interaktif, potongan arsip koran tempo doeloe dan rilis resmi kementerian.
AUDIO/VO: "Untuk memahami apa yang terjadi hari ini, kita harus menarik garis waktu mundur ke belakang. Mari kita bedah transkrip dan fakta-fakta lapangan yang berhasil dihimpun tim redaksi..."
TEKS LAYAR: JEJAK ANOMALI & PERISTIWA

[SCENE 3: THE SYSTEM & CAPITAL - SIAPA MENDAPAT APA?] (Menit 04:30 - 09:00)
VISUAL: Skema bagan kepemilikan modal, aliran transaksi keuangan, dan tabel izin konsesi/regulasi.
AUDIO/VO: "Di titik inilah kita menemukan pertemuan antara kekuasaan dan akumulasi modal. Aturan yang tampak dibuat demi kepentingan umum, ternyata memiliki klausul pengecualian yang sangat menguntungkan segelintir konglomerasi."
TEKS LAYAR: STRUKTUR KEPENTINGAN

[SCENE 4: THE HUMAN MIRROR - KORBAN NYATA DI BALIK ANGKA] (Menit 09:00 - 13:00)
VISUAL: Footage human interest, wawancara warga terdampak, sunyi tanpa latar musik berlebihan.
AUDIO/VO: "Bagi para pengambil kebijakan di gedung berpendingin udara, dampak ini mungkin hanya sekadar angka persentase. Namun bagi jutaan keluarga di lapangan, ini adalah soal kelangsungan hidup sehari-hari."
TEKS LAYAR: REALITAS LAPANGAN

[SCENE 5: EPILOG & REFLEKSI AKHIR] (Menit 13:00 - 15:30)
VISUAL: Host statement / motion graphic kesimpulan investigasi. Logo REFRAME INVESTIGASI.
AUDIO/VO: "Pertanyaannya kini bukan lagi siapa yang salah, melainkan apakah kita sebagai publik akan terus membiarkan siklus ini berputar tanpa pernah meminta pertanggungjawaban nyata? Saya tim Reframe Investigasi, terima kasih telah berpikir kritis bersama kami."
TEKS LAYAR: SIMAK DOKUMEN SELENGKAPNYA DI DESKRIPSI`,
    productionNotes: `Daftar Aset Produksi:
1. Rekaman arsip pemberitaan awal.
2. Data laporan BPS & regulasi terkait.
3. Footage B-roll masyarakat dan gedung pemerintahan.
4. Voiceover tone: tenang, tajam, objektif, tanpa teriakan sensasional.`,
    estimatedDurationMin: 15
  };
}

async function generateAiJson(prompt, { fetcher = fetch, timeoutMs = 25000, temperature = 0.4 } = {}) {
  const preferred = (process.env.AI_PROVIDER || 'groq').toLowerCase();
  const groqKey = process.env.GROQ_API_KEY;
  const groqModel = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
  const geminiKey = process.env.GEMINI_API_KEY;
  const geminiModel = process.env.GEMINI_MODEL || 'gemini-3.5-flash';

  const providers = preferred === 'gemini'
    ? [{ name: 'gemini', key: geminiKey, model: geminiModel }, { name: 'groq', key: groqKey, model: groqModel }]
    : [{ name: 'groq', key: groqKey, model: groqModel }, { name: 'gemini', key: geminiKey, model: geminiModel }];

  for (const p of providers) {
    if (!p.key) continue;
    try {
      if (p.name === 'groq') {
        const res = await fetcher('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${p.key}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: p.model,
            messages: [{ role: 'user', content: prompt }],
            response_format: { type: 'json_object' }
          }),
          signal: AbortSignal.timeout(timeoutMs)
        });
        if (res.ok) {
          const d = await res.json();
          const raw = d.choices?.[0]?.message?.content || '';
          const clean = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
          const parsed = JSON.parse(clean);
          if (parsed && typeof parsed === 'object') {
            return { ok: true, source: 'groq', model: p.model, data: parsed };
          }
        }
      } else if (p.name === 'gemini') {
        const res = await fetcher(`https://generativelanguage.googleapis.com/v1beta/models/${p.model}:generateContent`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': p.key
          },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
              temperature,
              responseMimeType: 'application/json'
            }
          }),
          signal: AbortSignal.timeout(timeoutMs)
        });
        if (res.ok) {
          const d = await res.json();
          const raw = d.candidates?.[0]?.content?.parts?.[0]?.text || '';
          const clean = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
          const parsed = JSON.parse(clean);
          if (parsed && typeof parsed === 'object') {
            return { ok: true, source: 'gemini', model: p.model, data: parsed };
          }
        }
      }
    } catch {}
  }
  return null;
}

export async function synthesizeIdeaFromTranscript(transcriptData, { format = 'long', fetcher = fetch } = {}) {
  if (!process.env.GEMINI_API_KEY && !process.env.GROQ_API_KEY) {
    return {
      ok: true,
      source: 'heuristic',
      idea: generateHeuristicIdea(transcriptData, { format })
    };
  }

  // Sample relevant portion of transcript to prevent token overflow (first 10,000 chars)
  const transcriptSnippet = (transcriptData.fullText || '').slice(0, 12000);

  const prompt = `Anda adalah Produser Eksekutif Redaksi Investigasi senior di channel YouTube "REFRAME INVESTIGASI" (@Reframe404).
Channel Anda dikenal menyajikan video investigasi mendalam bertema politik, ekonomi, hukum, dan kekuasaan dengan standar jurnalisme tinggi, kritis, dan berbobot (gaya mirip Vox, Johnny Harris, atau investigasi Tempo).

Tugas Anda:
Pelajari transkrip video dari channel YouTube pemantauan berikut ini:
- Judul Video Asli: "${transcriptData.title}"
- Nama Channel: "${transcriptData.channelName}"
- Durasi: ${transcriptData.durationFormatted} (${transcriptData.wordCount} kata)

Transkrip Cuplikan:
"""
${transcriptSnippet}
"""

Berdasarkan transkrip di atas, rancang 1 IDE KONTEN INVESTIGASI ORISINAL untuk REFRAME INVESTIGASI.
PENTING:
- JANGAN sekadar menjiplak atau merangkum ulang isi video kompetitor!
- Temukan sudut pandang (counter-angle / unexplored dimension) yang belum dibahas atau sengaja dilewatkan oleh video tersebut.
- Gunakan 3 Lensa Editorial REFRAME: (1) The System & Capital (struktur kekuasaan & uang), (2) The Hidden History (konteks sejarah & data bukti), (3) The Human Mirror (dampak nyata pada rakyat/manusia).
- Buat judul yang sangat memancing rasa penasaran intelektual, provokatif, namun tetap faktual dan elegan.

Berikan jawaban HANYA dalam format JSON valid (tanpa markdown pembuka/penutup):
{
  "title": "Judul Investigasi Orisinal yang Menggugah Rasa Ingin Tahu",
  "format": "${format === 'shorts' ? 'shorts' : 'long'}",
  "pillar": "Pilih salah satu: Investigasi / Politik / Ekonomi / Geopolitik / Sisi Gelap / Hukum / Kebijakan",
  "recommendedAngle": "Penjelasan sudut pandang counter-investigasi unik yang membedakan video kita dari kompetitor",
  "suggestedHook": "Hook pembuka 15-30 detik pertama yang tajam, mempertanyakan premis umum yang beredar",
  "keyFindings": [
    "Fakta penting 1 yang terungkap dari data/transkrip",
    "Fakta penting 2 tentang pihak yang memiliki kepentingan",
    "Fakta penting 3 mengenai dampak struktural yang diabaikan"
  ],
  "counterPerspective": "Analisis tajam menghubungkan kasus ini ke masalah sistemik yang lebih besar",
  "editorialNotes": "Catatan kritis untuk reporter & editor naskah mengenai dokumen/arsip yang wajib dicari"
}`;

  const aiRes = await generateAiJson(prompt, { fetcher, timeoutMs: 25000, temperature: 0.4 });
  if (!aiRes || !aiRes.data) {
    return {
      ok: true,
      source: 'heuristic-fallback',
      idea: generateHeuristicIdea(transcriptData, { format })
    };
  }

  const parsed = aiRes.data;
  return {
    ok: true,
    source: aiRes.source,
    model: aiRes.model,
    idea: {
      title: parsed.title || generateHeuristicIdea(transcriptData, { format }).title,
      format: parsed.format || format,
      pillar: parsed.pillar || 'Investigasi',
      recommendedAngle: parsed.recommendedAngle || '',
      suggestedHook: parsed.suggestedHook || '',
      keyFindings: Array.isArray(parsed.keyFindings) ? parsed.keyFindings : [],
      counterPerspective: parsed.counterPerspective || '',
      editorialNotes: parsed.editorialNotes || ''
    }
  };
}

export async function synthesizeScriptFromTranscript(transcriptData, ideaData, { format = 'long', fetcher = fetch } = {}) {
  if (!process.env.GEMINI_API_KEY && !process.env.GROQ_API_KEY) {
    return {
      ok: true,
      source: 'heuristic',
      scriptData: generateHeuristicScript(transcriptData, ideaData, { format })
    };
  }

  const transcriptSnippet = (transcriptData.fullText || '').slice(0, 12000);
  const ideaContext = ideaData ? `
Angle yang dipilih: ${ideaData.recommendedAngle || ''}
Hook pembuka yang disiapkan: ${ideaData.suggestedHook || ''}
Temuan kunci: ${(ideaData.keyFindings || []).join('; ')}
` : '';

  const prompt = `Anda adalah Lead Scriptwriter & Peneliti Narasi di kanal YouTube "REFRAME INVESTIGASI" (@Reframe404).
Channel Anda memproduksi video investigasi dokumenter berkualitas tinggi dengan gaya bercerita mendalam, sinematik, padat data, dan menyentuh emosi pemirsa.

Tugas Anda:
Tuliskan NASKAH LENGKAP PRODUKSI untuk video investigasi orisinal berdasarkan transkrip video referensi berikut:
- Video Asli: "${transcriptData.title}" (${transcriptData.channelName})
${ideaContext}
Format: ${format === 'shorts' ? 'Shorts (Durasi 55–60 detik, retensi tinggi)' : 'Long Video Investigasi (12–16 menit, narasi terstruktur dan kaya visual)'}

Cuplikan Transkrip Referensi:
"""
${transcriptSnippet}
"""

Instruksi Format Naskah:
- Struktur naskah harus jelas terbagi per Scene (Visual, Audio/Voiceover, Teks Layar).
- Bahasa Indonesia yang cerdas, lugas, elegan, tidak bertele-tele, namun menciptakan ketegangan dan rasa penasaran kuat.
- Hook 30 detik pertama harus luar biasa memikat penonton agar tidak skip.

Berikan jawaban HANYA dalam format JSON valid (tanpa markdown pembuka/penutup):
{
  "title": "Judul Naskah Siap Produksi",
  "format": "${format === 'shorts' ? 'shorts' : 'long'}",
  "hook": "Teks hook 15-30 detik pertama",
  "script": "Naskah lengkap format Scene 1, Scene 2, dst dengan rincian VISUAL, AUDIO/VO, dan TEKS LAYAR",
  "productionNotes": "Rekomendasi aset grafis, arsip berita, dan dokumen primer yang perlu disiapkan editor",
  "estimatedDurationMin": ${format === 'shorts' ? 1 : 14}
}`;

  const aiRes = await generateAiJson(prompt, { fetcher, timeoutMs: 35000, temperature: 0.5 });
  if (!aiRes || !aiRes.data) {
    return {
      ok: true,
      source: 'heuristic-fallback',
      scriptData: generateHeuristicScript(transcriptData, ideaData, { format })
    };
  }

  const parsed = aiRes.data;
  return {
    ok: true,
    source: aiRes.source,
    model: aiRes.model,
    scriptData: {
      title: parsed.title || ideaData?.title || transcriptData.title,
      format: parsed.format || format,
      hook: parsed.hook || ideaData?.suggestedHook || '',
      script: parsed.script || '',
      productionNotes: parsed.productionNotes || '',
      estimatedDurationMin: parsed.estimatedDurationMin || (format === 'shorts' ? 1 : 14)
    }
  };
}

export async function saveTranscriptIdeaToKanban(contentStore, idea, sourceVideo) {
  if (!contentStore) throw new Error('ContentStore wajib disediakan.');
  if (!idea || !idea.title) throw new Error('Data ide tidak valid.');

  const db = await contentStore.read();
  const pillars = db.pillars || [];
  const matchedPillar = pillars.find(p => p.name?.toLowerCase().includes((idea.pillar || '').toLowerCase())) || pillars[0];

  const brief = `[RADAR PANTAUAN TRANSKRIP - ${idea.pillar || 'Investigasi'}]
Sumber Video Pantauan: ${sourceVideo.title || ''} (${sourceVideo.channelName || 'YouTube'})
URL Sumber: ${sourceVideo.url || ''}

SUDUT PANDANG INVESTIGASI:
${idea.recommendedAngle || ''}

TEMUAN KUNCI:
${(idea.keyFindings || []).map((f, i) => `${i + 1}. ${f}`).join('\n')}

ANALISIS SISTEMIK (3 LENSA):
${idea.counterPerspective || ''}

PANDUAN REDAKSI:
${idea.editorialNotes || ''}`;

  const payload = {
    title: idea.title,
    format: idea.format === 'shorts' ? 'shorts' : 'long',
    pillarId: matchedPillar ? matchedPillar.id : '',
    stage: 'idea',
    priority: 'high',
    brief,
    hook: idea.suggestedHook || '',
    tags: `radar, pantauan, transkrip, ${idea.pillar?.toLowerCase() || 'investigasi'}`,
    sources: sourceVideo.url ? [{
      id: crypto.randomUUID(),
      label: `${sourceVideo.channelName || 'YouTube'}: ${sourceVideo.title}`,
      url: sourceVideo.url,
      notes: `Transkrip diekstrak dari channel pantauan Radar.\nTemuan kunci:\n${(idea.keyFindings || []).join('\n')}`
    }] : []
  };

  const newContent = await contentStore.create(payload, { fillEngine: true });
  return {
    ok: true,
    content: newContent
  };
}

export async function saveTranscriptScriptToKanban(contentStore, scriptData, sourceVideo) {
  if (!contentStore) throw new Error('ContentStore wajib disediakan.');
  if (!scriptData || !scriptData.title) throw new Error('Data naskah tidak valid.');

  const db = await contentStore.read();
  const pillars = db.pillars || [];
  const matchedPillar = pillars.find(p => p.name?.toLowerCase().includes('investigasi')) || pillars[0];

  const brief = `[NASKAH INVESTIGASI DARI PANTAUAN TRANSKRIP]
Inspirasi: ${sourceVideo.title || ''} (${sourceVideo.channelName || 'YouTube'})
URL: ${sourceVideo.url || ''}
Estimasi Durasi: ${scriptData.estimatedDurationMin || 14} Menit`;

  const payload = {
    title: scriptData.title,
    format: scriptData.format === 'shorts' ? 'shorts' : 'long',
    pillarId: matchedPillar ? matchedPillar.id : '',
    stage: 'script',
    priority: 'high',
    brief,
    hook: scriptData.hook || '',
    script: scriptData.script || '',
    productionNotes: scriptData.productionNotes || '',
    tags: `radar, pantauan, transkrip, naskah, investigasi`,
    sources: sourceVideo.url ? [{
      id: crypto.randomUUID(),
      label: `${sourceVideo.channelName || 'YouTube'}: ${sourceVideo.title}`,
      url: sourceVideo.url,
      notes: 'Transkrip diekstrak dari video pantauan Radar.'
    }] : []
  };

  const newContent = await contentStore.create(payload, { fillEngine: true });
  return {
    ok: true,
    content: newContent
  };
}
