const FINITE = (v, fallback = 0) => Number.isFinite(Number(v)) ? Number(v) : fallback;

export function computeHealthScore(report) {
  const summary = report.summary || {};
  const views = FINITE(summary.views || report.video?.lifetime?.views);
  const watchHours = FINITE(summary.watchHours);
  const avgDuration = FINITE(summary.averageViewDuration);
  const avgPercentage = FINITE(report.averageViewPercentage);
  const likes = FINITE(summary.likes);
  const comments = FINITE(summary.comments);
  const shares = FINITE(summary.shares);
  const subsGained = FINITE(summary.subscribersGained);
  const ctr = report.reach?.ctr !== null && report.reach?.ctr !== undefined ? Number(report.reach.ctr) : null;
  const impressions = FINITE(report.reach?.impressions);

  // 1. Clickability Score (0-100)
  let clickScore = 70;
  if (ctr !== null) {
    if (ctr >= 8.0) clickScore = 95;
    else if (ctr >= 6.0) clickScore = 88;
    else if (ctr >= 4.5) clickScore = 78;
    else if (ctr >= 3.0) clickScore = 65;
    else clickScore = 50;
  } else if (impressions > 0 && views > 0) {
    const rawCtr = (views / impressions) * 100;
    clickScore = Math.min(95, Math.max(50, Math.round(rawCtr * 12)));
  } else if (views >= 5000) {
    clickScore = 85;
  } else if (views >= 1000) {
    clickScore = 75;
  }

  // 2. Retention Score (0-100)
  let retentionScore = 70;
  if (avgPercentage > 0) {
    if (avgPercentage >= 55) retentionScore = 95;
    else if (avgPercentage >= 45) retentionScore = 88;
    else if (avgPercentage >= 35) retentionScore = 78;
    else if (avgPercentage >= 25) retentionScore = 66;
    else retentionScore = 52;
  }

  // 3. Engagement Score (0-100)
  let engagementScore = 70;
  if (views > 0) {
    const engRate = ((likes + comments * 2 + shares * 3) / views) * 100;
    if (engRate >= 6.0) engagementScore = 95;
    else if (engRate >= 4.0) engagementScore = 87;
    else if (engRate >= 2.0) engagementScore = 76;
    else if (engRate >= 1.0) engagementScore = 65;
    else engagementScore = 52;
  }

  // 4. Conversion & Loyalty Score (0-100)
  let conversionScore = 70;
  if (views > 0) {
    const subRate = (subsGained / views) * 1000; // per 1k views
    if (subRate >= 12) conversionScore = 96;
    else if (subRate >= 7) conversionScore = 88;
    else if (subRate >= 3) conversionScore = 78;
    else if (subRate >= 1) conversionScore = 66;
    else conversionScore = 55;
  }

  // Overall Weighted Score
  const overall = Math.round(
    clickScore * 0.25 +
    retentionScore * 0.35 +
    engagementScore * 0.20 +
    conversionScore * 0.20
  );

  let grade = 'B';
  let status = 'Stabil / Solid Performer';
  let badgeColor = '#2563eb';

  if (overall >= 90) {
    grade = 'S';
    status = '🔥 TIER-1 / VIRAL BREAKTHROUGH';
    badgeColor = '#d97706';
  } else if (overall >= 80) {
    grade = 'A';
    status = '🟢 OUTPERFORMING (Top 15% Channel)';
    badgeColor = '#16a34a';
  } else if (overall >= 70) {
    grade = 'B+';
    status = '🔵 SOLID PERFORMER (Di Atas Rata-rata)';
    badgeColor = '#2563eb';
  } else if (overall >= 60) {
    grade = 'B';
    status = '🟡 AVERAGE (Performa Standar)';
    badgeColor = '#ca8a04';
  } else if (overall >= 50) {
    grade = 'C';
    status = '🟠 UNDERPERFORMING (Perlu Optimasi)';
    badgeColor = '#ea580c';
  } else {
    grade = 'D';
    status = '🔴 PERLU PEROMBAKAN TOTAL';
    badgeColor = '#dc2626';
  }

  return {
    overall,
    grade,
    status,
    badgeColor,
    breakdown: {
      clickScore,
      retentionScore,
      engagementScore,
      conversionScore
    }
  };
}

export function detectDropoffPoint(retentionRows) {
  if (!Array.isArray(retentionRows) || retentionRows.length < 3) return null;
  let maxDrop = 0;
  let dropPoint = null;
  for (let i = 1; i < retentionRows.length; i++) {
    const prev = Number(retentionRows[i - 1].watchRatio || 0);
    const curr = Number(retentionRows[i].watchRatio || 0);
    const diff = prev - curr;
    if (diff > maxDrop) {
      maxDrop = diff;
      dropPoint = {
        position: Number(retentionRows[i].position || 0),
        dropPercent: Math.round(diff * 100),
        fromRatio: Math.round(prev * 100),
        toRatio: Math.round(curr * 100)
      };
    }
  }
  return dropPoint;
}

export function generateHeuristicAudit(report, health) {
  const v = report.video || {};
  const s = report.summary || {};
  const reach = report.reach || {};
  const retention = report.retention || [];
  const searchTerms = (report.searchTerms || []).map(st => st.key).slice(0, 3);
  const drop = detectDropoffPoint(retention);
  const views = FINITE(s.views || v.lifetime?.views);
  const subsGained = FINITE(s.subscribersGained);
  const ctr = reach.ctr !== null && reach.ctr !== undefined ? Number(reach.ctr) : null;
  const avgPct = FINITE(report.averageViewPercentage);

  const executiveSummary = views > 5000 || health.overall >= 80
    ? `Video "${v.title || 'ini'}" mencatatkan performa ${health.status} dengan daya tarik yang solid bagi penonton investigasi. Algoritma YouTube aktif merekomendasikan konten ini dan menghasilkan konversi ${subsGained} subscriber baru, meskipun terdapat ruang efisiensi pada retensi bagian tengah.`
    : `Video "${v.title || 'ini'}" berada pada tingkat performa ${health.status}. Konten ini berhasil menjaring pemirsa awal, namun membutuhkan penajaman pada hook pembuka dan hook visual agar penonton tidak berpindah ke video lain sebelum durasi utama selesai.`;

  const hookDiag = avgPct >= 40
    ? { score: 'Kuat', explanation: `Hook pembuka berhasil mempertahankan perhatian penonton dengan rata-rata ditonton mencapai ${avgPct.toFixed(1)}%. Pembukaan langsung ke kasus tanpa basa-basi terbukti efektif.` }
    : { score: 'Perlu Penguatan', explanation: `Rata-rata tonton berada di ${avgPct.toFixed(1)}%. Penonton membutuhkan visualisasi fakta mengejutkan atau pertanyaan provokatif di 15 detik pertama untuk mengunci rasa penasaran.` };

  const dropDiag = drop
    ? {
        point: `Posisi ${Math.round(drop.position * 100)}% durasi video`,
        dropPercent: `-${drop.dropPercent}%`,
        cause: 'Terjadi penurunan penonton cukup tajam di titik ini, biasanya diakibatkan oleh tempo narasi yang melambat atau pemaparan data teknis tanpa pergantian visual.',
        recommendation: 'Ganti pembacaan teks panjang di titik ini dengan infografis alur dana, potongan dokumen berlingkar merah, atau sound design tensi.'
      }
    : {
        point: 'Tengah Video',
        dropPercent: 'Normal',
        cause: 'Kurva retensi relatif landai tanpa drop tajam ekstrem.',
        recommendation: 'Pertahankan variasi b-roll dan transisi adegan setiap 8–12 detik untuk menjaga tempo investigasi.'
      };

  const clickDiag = ctr !== null
    ? {
        score: ctr >= 6.0 ? 'Tinggi' : ctr >= 4.0 ? 'Standar' : 'Rendah',
        explanation: `CTR thumbnail berada di angka ${ctr.toFixed(1)}%. ${ctr >= 6.0 ? 'Kombinasi judul dramatis dan thumbnail kontras bekerja sangat baik.' : 'Judul dan thumbnail perlu penegasan kontras warna dan pengurangan teks agar lebih terbaca di smartphone.'}`
      }
    : {
        score: 'Netral',
        explanation: 'Data CTR spesifik masih dalam antrean pelaporan YouTube Reporting. Pola judul sudah selaras dengan tren investigasi.'
      };

  const convDiag = {
    score: subsGained >= 20 ? 'Sangat Baik' : 'Standar',
    explanation: `Menyumbang +${subsGained} subscriber baru. ${subsGained >= 20 ? 'Rasio konversi penonton menjadi subscriber sangat sehat, menandakan kredibilitas video tinggi.' : 'Pastikan menyelipkan call-to-action ajakan berlangganan di momen puncak pembongkaran data.'}`
  };

  const actionItems = [
    views > 1000
      ? `Buat Part Lanjutan / Sekuel: Lanjutkan sudut pandang dari video ini dengan mengangkat aktor atau aliran dana turunan.`
      : `Optimasi Thumbnail & Judul: Uji coba ganti thumbnail dengan ekspresi wajah tokoh dan teks maksimal 3-4 kata kapital.`,
    `Sematkan Komentar (Pin Comment): Taruh komentar pertanyaan pemancing diskusi penonton di kolom komentar untuk melipatgandakan engagement.`,
    `Evaluasi Naskah: Di naskah berikutnya, pastikan pemaparan dokumen resmi disajikan dalam bentuk poin cepat, bukan narasi panjang.`
  ];

  const sequelIdeas = [
    {
      title: `${(v.title || 'KASUS INVESTIGASI').replace(/PART \d+/i, '').replace(/#\w+/g, '').trim()} : BUKTI BARU TERBONGKAR!`,
      hook: 'Menelusuri ke mana sisa aliran dana mengalir setelah fakta pertama terungkap ke publik.',
      pillar: 'Sisi Gelap'
    },
    {
      title: `SIAPA DI BALIK KASUS INI? DOKUMEN RAHASIA AKHIRNYA BOCOR!`,
      hook: 'Membongkar jaringan aktor di balik layar yang belum sempat dibahas di video sebelumnya.',
      pillar: 'Investigasi'
    }
  ];

  return {
    source: 'heuristic',
    generatedAt: new Date().toISOString(),
    health,
    executiveSummary,
    hookDiagnosis: hookDiag,
    dropoffDiagnosis: dropDiag,
    clickabilityDiagnosis: clickDiag,
    conversionDiagnosis: convDiag,
    actionItems,
    sequelIdeas,
    topSearchTerms: searchTerms
  };
}

export async function auditVideo(report, { aiProvider, force = false, content = null, fetcher = fetch, now = Date.now } = {}) {
  const health = computeHealthScore(report);
  const v = report.video || {};
  const s = report.summary || {};
  const reach = report.reach || {};
  const retention = report.retention || [];
  const searchTerms = (report.searchTerms || []).map(st => st.key).slice(0, 5);
  const drop = detectDropoffPoint(retention);

  const geminiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || 'gemini-3.5-flash';

  if (!geminiKey) {
    return generateHeuristicAudit(report, health);
  }

  const payloadContext = {
    title: v.title || 'Video Investigasi',
    id: report.id,
    views: FINITE(s.views || v.lifetime?.views),
    watchHours: FINITE(s.watchHours),
    avgDurationSec: FINITE(s.averageViewDuration),
    avgPercentage: FINITE(report.averageViewPercentage),
    ctr: reach.ctr !== null && reach.ctr !== undefined ? Number(reach.ctr) : null,
    impressions: FINITE(reach.impressions),
    likes: FINITE(s.likes),
    comments: FINITE(s.comments),
    subscribersGained: FINITE(s.subscribersGained),
    nonSubscriberPercent: (report.subscribed || []).find(x => x.key === 'UNSUBSCRIBED')?.views || null,
    searchKeywords: searchTerms,
    biggestDropPoint: drop ? `${Math.round(drop.position * 100)}% durasi (drop -${drop.dropPercent}%)` : null,
    linkedPillar: content?.pillarId || 'Investigasi',
    linkedTitle: content?.title || null
  };

  const prompt = `Anda adalah Senior Content Strategist & Video Editor untuk channel YouTube dokumenter investigasi "REFRAME INVESTIGASI" (@Reframe404).
Channel ini berfokus pada 7 pilar: Politik, Ekonomi, Geopolitik, Sisi Gelap, Hukum, Investigasi, Kebijakan.

Berikut data performa analitik riil dari salah satu video channel:
${JSON.stringify(payloadContext, null, 2)}

Skor algoritma terhitung: ${health.overall}/100 (Grade: ${health.grade}, Status: ${health.status}).

Tugas Anda:
Berikan Rapor Evaluasi Performa yang tajam, kritis, profesional, dan SANGAT APLIKATIF (bukan sekadar mengulang angka).
Gunakan Bahasa Indonesia yang elegan dan bernas.

Keluarkan HANYA JSON valid (tanpa markdown backtick, tanpa teks pembuka/penutup) dengan struktur persis seperti ini:
{
  "executiveSummary": "2-3 kalimat padat merangkum status performa video, penyebab utama, dan dampaknya.",
  "hookDiagnosis": {
    "score": "Kuat / Perlu Penguatan / Lemah",
    "explanation": "Evaluasi apakah hook 30 detik pertama berhasil mengikat penonton dan sarannya."
  },
  "dropoffDiagnosis": {
    "point": "Sebutkan titik menit atau posisi durasi",
    "dropPercent": "persentase drop",
    "cause": "Penyebab kebosanan penonton dari sisi naskah atau tempo visual di titik itu.",
    "recommendation": "Saran perbaikan konkret untuk editing/naskah di titik serupa."
  },
  "clickabilityDiagnosis": {
    "score": "Tinggi / Standar / Rendah",
    "explanation": "Evaluasi efektivitas daya tarik judul dan thumbnail berdasarkan CTR dan kata kunci."
  },
  "conversionDiagnosis": {
    "score": "Sangat Baik / Standar / Kurang",
    "explanation": "Evaluasi konversi penonton menjadi subscriber dan kredibilitas materi."
  },
  "actionItems": [
    "Aksi konkret 1 (Lakukan sekarang)",
    "Aksi konkret 2 (Untuk video ini)",
    "Aksi konkret 3 (Untuk video berikutnya)"
  ],
  "sequelIdeas": [
    {
      "title": "Ide Judul Part Lanjutan 1 (Gaya REFRAME INVESTIGASI)",
      "hook": "Inti konflik / sudut pandang investigasi lanjutan",
      "pillar": "Pilih salah satu dari 7 pilar"
    },
    {
      "title": "Ide Judul Part Lanjutan 2 (Gaya REFRAME INVESTIGASI)",
      "hook": "Inti konflik / sudut pandang investigasi lanjutan",
      "pillar": "Pilih salah satu dari 7 pilar"
    }
  ]
}`;

  try {
    const response = await fetcher(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': geminiKey
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          responseMimeType: 'application/json'
        }
      }),
      signal: AbortSignal.timeout(30000)
    });

    if (!response.ok) {
      return generateHeuristicAudit(report, health);
    }

    const jsonResp = await response.json();
    const rawText = jsonResp.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const cleanJson = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanJson);

    return {
      source: 'gemini',
      model,
      generatedAt: new Date(now()).toISOString(),
      health,
      executiveSummary: parsed.executiveSummary || 'Ringkasan performa selesai dianalisis.',
      hookDiagnosis: parsed.hookDiagnosis || { score: 'Standar', explanation: 'Hook berjalan normal.' },
      dropoffDiagnosis: parsed.dropoffDiagnosis || { point: 'Pertengahan', dropPercent: 'Normal', cause: 'Fluktuasi wajar.', recommendation: 'Pertahankan ritme.' },
      clickabilityDiagnosis: parsed.clickabilityDiagnosis || { score: 'Standar', explanation: 'CTR thumbnail berada di rentang normal.' },
      conversionDiagnosis: parsed.conversionDiagnosis || { score: 'Standar', explanation: 'Konversi berjalan normal.' },
      actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems : ['Pertahankan konsistensi upload.'],
      sequelIdeas: Array.isArray(parsed.sequelIdeas) ? parsed.sequelIdeas : [],
      topSearchTerms: searchTerms
    };
  } catch (err) {
    return generateHeuristicAudit(report, health);
  }
}
