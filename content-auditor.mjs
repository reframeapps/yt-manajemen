const FINITE = (v, fallback = 0) => Number.isFinite(Number(v)) ? Number(v) : fallback;

export function interpolate(value, points) {
  if (!points || !points.length) return 70;
  if (value <= points[0][0]) return points[0][1];
  if (value >= points[points.length - 1][0]) return points[points.length - 1][1];
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[i + 1];
    if (value >= x0 && value <= x1) {
      const t = (value - x0) / (x1 - x0);
      return Math.round(y0 + t * (y1 - y0));
    }
  }
  return points[points.length - 1][1];
}

export function parseIsoDuration(durationStr) {
  if (!durationStr || typeof durationStr !== 'string') return 0;
  const match = durationStr.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);
  return hours * 3600 + minutes * 60 + seconds;
}

export function estimateVideoDuration(report) {
  const v = report.video || {};
  const s = report.summary || {};
  const avgDuration = FINITE(s.averageViewDuration);
  const avgPercentage = FINITE(report.averageViewPercentage);

  const isoSec = parseIsoDuration(v.duration);
  if (isoSec > 0) return isoSec;

  if (avgPercentage > 0 && avgDuration > 0) {
    return Math.round(avgDuration / (avgPercentage / 100));
  }

  return avgDuration > 0 ? avgDuration : 600;
}

export function detectHookRetention(retentionRows) {
  if (!Array.isArray(retentionRows) || retentionRows.length < 2) return null;
  const hookRow = retentionRows.find(r => r.position >= 0.05 && r.position <= 0.12) || retentionRows[1];
  if (!hookRow) return null;
  const ratio = Number(hookRow.watchRatio || 0);
  const pct = Math.round(ratio * 100);
  return {
    position: Number(hookRow.position || 0),
    watchRatio: pct,
    score: pct >= 75 ? 'Sangat Kuat' : pct >= 60 ? 'Standar' : 'Perlu Penguatan'
  };
}

export function detectDropoffPoint(retentionRows, totalDurationSec = 0) {
  if (!Array.isArray(retentionRows) || retentionRows.length < 3) return null;
  let maxDrop = 0;
  let dropPoint = null;

  for (let i = 1; i < retentionRows.length; i++) {
    const prev = Number(retentionRows[i - 1].watchRatio || 0);
    const curr = Number(retentionRows[i].watchRatio || 0);
    const diff = prev - curr;
    const pos = Number(retentionRows[i].position || 0);

    // Prioritaskan drop di atas 8% durasi (setelah intro) agar tidak tertukar dengan bounce awal
    const weightedDiff = pos >= 0.08 ? diff * 1.05 : diff;
    if (weightedDiff > maxDrop) {
      maxDrop = weightedDiff;
      const sec = totalDurationSec > 0 ? Math.round(pos * totalDurationSec) : null;
      const timestampFormatted = sec !== null
        ? `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
        : null;
      dropPoint = {
        position: pos,
        dropPercent: Math.round(diff * 100),
        fromRatio: Math.round(prev * 100),
        toRatio: Math.round(curr * 100),
        timestampSec: sec,
        timestampFormatted
      };
    }
  }
  return dropPoint;
}

export function computeHealthScore(report) {
  const summary = report.summary || {};
  const v = report.video || {};
  const views = FINITE(summary.views || v.lifetime?.views);
  const watchHours = FINITE(summary.watchHours);
  const avgDuration = FINITE(summary.averageViewDuration);
  const avgPercentage = FINITE(report.averageViewPercentage);
  const likes = FINITE(summary.likes);
  const comments = FINITE(summary.comments);
  const shares = FINITE(summary.shares);
  const subsGained = FINITE(summary.subscribersGained);
  const subsLost = FINITE(summary.subscribersLost);
  const netSubs = subsGained - subsLost;
  const ctr = report.reach?.ctr !== null && report.reach?.ctr !== undefined ? Number(report.reach.ctr) : null;
  const impressions = FINITE(report.reach?.impressions);

  // 1. Klasifikasi Durasi & Format Konten
  const totalDurationSec = estimateVideoDuration(report);
  let format = 'long';
  let formatLabel = 'Investigasi Panjang (>12m)';
  if (totalDurationSec <= 60) {
    format = 'shorts';
    formatLabel = 'Shorts (<=60s)';
  } else if (totalDurationSec <= 360) {
    format = 'short';
    formatLabel = `Video Ringkas (${Math.round(totalDurationSec / 60)}m)`;
  } else if (totalDurationSec <= 720) {
    format = 'medium';
    formatLabel = `Video Sedang (${Math.round(totalDurationSec / 60)}m)`;
  } else {
    format = 'long';
    formatLabel = `Investigasi Panjang (${Math.round(totalDurationSec / 60)}m)`;
  }

  // 2. Clickability Score (0-100) — Kurva Halus & Bonus Skala Impresi
  let clickScore = 70;
  let ctrSource = 'laporan';
  if (ctr !== null && Number.isFinite(ctr)) {
    const ctrPoints = [[1.0, 40], [2.5, 55], [4.0, 70], [5.5, 82], [7.5, 92], [10.0, 98]];
    let baseClick = interpolate(ctr, ctrPoints);
    if (impressions >= 10000 && ctr >= 4.5) {
      const scaleBonus = Math.min(6, Math.round(Math.log10(impressions / 5000) * 3));
      baseClick += scaleBonus;
    }
    clickScore = Math.min(99, Math.max(35, baseClick));
  } else if (impressions > 0 && views > 0) {
    const rawCtr = (views / impressions) * 100;
    const ctrPoints = [[1.0, 40], [2.5, 55], [4.0, 70], [5.5, 82], [7.5, 92], [10.0, 98]];
    clickScore = Math.min(95, Math.max(45, interpolate(rawCtr, ctrPoints)));
    ctrSource = 'estimasi_impresi';
  } else if (views >= 5000) {
    clickScore = 84;
    ctrSource = 'estimasi_views';
  } else if (views >= 1000) {
    clickScore = 76;
    ctrSource = 'estimasi_views';
  } else {
    clickScore = 70;
    ctrSource = 'estimasi_awal';
  }

  // 3. Retention Score (0-100) — Adaptif Format & Bobot Jam Tonton Riil (AVD)
  let retentionScore = 70;
  if (avgPercentage > 0) {
    let apvPoints;
    if (format === 'shorts') {
      apvPoints = [[25, 40], [45, 55], [60, 70], [75, 84], [90, 94], [115, 100]];
    } else if (format === 'short') {
      apvPoints = [[18, 40], [30, 55], [42, 70], [52, 83], [64, 93], [80, 100]];
    } else if (format === 'medium') {
      apvPoints = [[14, 40], [24, 55], [34, 70], [44, 83], [54, 93], [68, 100]];
    } else {
      // Long form investigasi: 35%+ APV adalah top tier, 26% sudah sehat
      apvPoints = [[10, 40], [18, 55], [26, 70], [35, 83], [44, 93], [55, 100]];
    }

    let baseRet = interpolate(avgPercentage, apvPoints);

    // Bonus kedalaman jam tonton per penonton (AVD)
    if (avgDuration >= 600) baseRet += 5; // 10+ menit AVD
    else if (avgDuration >= 420) baseRet += 3; // 7+ menit AVD
    else if (avgDuration >= 240) baseRet += 1; // 4+ menit AVD

    // Penyelarasan Relative Retention bawaan YouTube Analytics (bila tersedia)
    if (Array.isArray(report.retention) && report.retention.length > 0) {
      const validRelatives = report.retention.filter(r => Number.isFinite(r.relativePerformance));
      if (validRelatives.length > 0) {
        const avgRel = validRelatives.reduce((acc, r) => acc + r.relativePerformance, 0) / validRelatives.length;
        const relBonus = Math.round((avgRel - 0.5) * 10);
        baseRet += relBonus;
      }
    }

    retentionScore = Math.min(99, Math.max(35, baseRet));
  }

  // 4. Engagement Score (0-100) — Pembobotan Algoritma (Share 4x, Komentar 2.5x, Like 1x)
  let engagementScore = 70;
  let weightedEngRate = 0;
  if (views > 0) {
    const weightedTotal = likes * 1.0 + comments * 2.5 + shares * 4.0;
    weightedEngRate = (weightedTotal / views) * 100;
    const engPoints = [[0.4, 40], [1.0, 55], [2.0, 70], [3.5, 82], [5.5, 92], [8.5, 100]];
    engagementScore = Math.min(99, Math.max(35, interpolate(weightedEngRate, engPoints)));
  }

  // 5. Conversion & Loyalty Score (0-100) — Memperhitungkan Churn / Net Subscriber
  let conversionScore = 70;
  let netSubsPer1k = 0;
  if (views > 0) {
    netSubsPer1k = (netSubs / views) * 1000;
    const convPoints = [[-2.0, 30], [0.0, 50], [1.5, 65], [3.5, 78], [6.5, 88], [11.0, 96], [16.0, 100]];
    conversionScore = Math.min(99, Math.max(30, interpolate(netSubsPer1k, convPoints)));
  }

  // 6. Skor Mentah Terbobot
  const rawOverall = Math.round(
    clickScore * 0.25 +
    retentionScore * 0.35 +
    engagementScore * 0.20 +
    conversionScore * 0.20
  );

  // 7. Kalibrasi Sampel Bayes (Menghindari bias sampel mikro <300 views)
  const sampleConfidence = views > 0
    ? Math.min(1.0, Math.max(0.40, Math.log10(views + 5) / 2.8))
    : 0.5;
  const overall = Math.round(rawOverall * sampleConfidence + 70 * (1 - sampleConfidence));

  let confidenceLabel = 'Sampel Matang (>1.000 views)';
  if (views < 100) {
    confidenceLabel = 'Akumulasi Awal (<100 views, terkalibrasi)';
  } else if (views < 500) {
    confidenceLabel = 'Pertumbuhan Awal (100–500 views)';
  } else if (views < 1000) {
    confidenceLabel = 'Mendekati Stabil (500–1.000 views)';
  }

  // Pemetaan Grade & Status
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
    rawOverall,
    sampleConfidence: Math.round(sampleConfidence * 100) / 100,
    confidenceLabel,
    grade,
    status,
    badgeColor,
    format,
    formatLabel,
    totalDurationSec,
    breakdown: {
      clickScore,
      retentionScore,
      engagementScore,
      conversionScore
    },
    metricsSummary: {
      ctr: ctr !== null ? Math.round(ctr * 10) / 10 : null,
      ctrSource,
      apv: Math.round(avgPercentage * 10) / 10,
      avdSec: avgDuration,
      avdMin: Math.round((avgDuration / 60) * 10) / 10,
      weightedEngRate: Math.round(weightedEngRate * 10) / 10,
      netSubsPer1k: Math.round(netSubsPer1k * 10) / 10,
      views,
      impressions
    }
  };
}

export function generateHeuristicAudit(report, health) {
  const v = report.video || {};
  const s = report.summary || {};
  const reach = report.reach || {};
  const retention = report.retention || [];
  const searchTerms = (report.searchTerms || []).map(st => st.key).slice(0, 3);
  const totalDurationSec = health.totalDurationSec || estimateVideoDuration(report);
  const drop = detectDropoffPoint(retention, totalDurationSec);
  const hook = detectHookRetention(retention);
  const views = FINITE(s.views || v.lifetime?.views);
  const subsGained = FINITE(s.subscribersGained);
  const subsLost = FINITE(s.subscribersLost);
  const netSubs = subsGained - subsLost;
  const ctr = reach.ctr !== null && reach.ctr !== undefined ? Number(reach.ctr) : null;
  const avgPct = FINITE(report.averageViewPercentage);
  const m = health.metricsSummary || {};

  const executiveSummary = views > 5000 || health.overall >= 80
    ? `Video "${v.title || 'ini'}" (${health.formatLabel}) mencatatkan performa ${health.status} dengan indeks kesehatan ${health.overall}/100. Daya tahan penonton mencapai ${m.avdMin || 0} menit per pemutaran dengan konversi bersih +${netSubs} subscriber, membuktikan topik investigasi ini memiliki resonansi tinggi bagi audiens.`
    : `Video "${v.title || 'ini'}" (${health.formatLabel}) berada pada performa ${health.status} (${health.overall}/100) dalam status ${health.confidenceLabel}. Penonton awal merespons cukup baik, namun penguatan struktur hook 30 detik pertama dan pergantian ritme visual diperlukan agar durasi tonton meningkat signifikan.`;

  const hookDiag = hook
    ? {
        score: hook.score,
        explanation: `Retensi 30 detik pertama tercatat ${hook.watchRatio}%. ${hook.watchRatio >= 75 ? 'Pembukaan langsung ke inti misteri investigasi terbukti ampuh mempertahankan perhatian penonton awal.' : hook.watchRatio >= 60 ? 'Intro cukup stabil, namun sekitar ' + (100 - hook.watchRatio) + '% penonton melompat keluar sebelum pemaparan kasus utama.' : 'Terjadi penurunan drastis di awal. Pangkas bumper atau salam pembuka dan langsung sajikan fakta kontroversial di 15 detik pertama.'}`
      }
    : avgPct >= 35
      ? { score: 'Kuat', explanation: `Hook pembuka berhasil mempertahankan penonton dengan rata-rata ditonton ${avgPct.toFixed(1)}% (${m.avdMin || 0} menit). Pacing awal sudah sesuai standar dokumenter investigasi.` }
      : { score: 'Perlu Penguatan', explanation: `Rata-rata tonton berada di ${avgPct.toFixed(1)}%. Penonton membutuhkan visualisasi fakta mengejutkan atau pertanyaan provokatif di 15 detik pertama untuk mengunci rasa penasaran.` };

  const dropDiag = drop
    ? {
        point: drop.timestampFormatted ? `Menit ${drop.timestampFormatted} (${Math.round(drop.position * 100)}% durasi)` : `Posisi ${Math.round(drop.position * 100)}% durasi video`,
        dropPercent: `-${drop.dropPercent}%`,
        cause: `Penurunan terbesar (${drop.dropPercent}% penonton keluar) terdeteksi pada ${drop.timestampFormatted ? 'menit ' + drop.timestampFormatted : 'titik ini'}. Biasanya dipicu oleh paparan narasi statis tanpa variasi footage dokumen atau alur data teknis yang terlalu padat.`,
        recommendation: 'Ganti pembacaan teks panjang di segmen ini dengan potongan dokumen bertinta merah, infografis diagram hubungan aktor, atau perubahan tempo musik latar.'
      }
    : {
        point: 'Pertengahan Durasi',
        dropPercent: 'Normal',
        cause: 'Kurva retensi berjalan landai tanpa penurunan drastis mendadak.',
        recommendation: 'Pertahankan variasi b-roll dan transisi adegan setiap 8–12 detik untuk menjaga tensi investigasi.'
      };

  const clickDiag = ctr !== null
    ? {
        score: ctr >= 6.0 ? 'Tinggi' : ctr >= 4.0 ? 'Standar' : 'Rendah',
        explanation: `CTR thumbnail berada di angka ${ctr.toFixed(1)}%${reach.impressions ? ` dari total ${reach.impressions.toLocaleString('id-ID')} impresi` : ''}. ${ctr >= 6.0 ? 'Kombinasi judul dramatis dan thumbnail kontras bekerja sangat optimal menarik penonton.' : 'Judul dan thumbnail perlu penegasan kontras warna tokoh dan pengurangan kata agar lebih terbaca di feed smartphone.'}`
      }
    : {
        score: health.breakdown?.clickScore >= 80 ? 'Kuat (Estimasi)' : 'Standar',
        explanation: `Data CTR spesifik masih dalam antrean pemrosesan YouTube Reporting API. Pola distribusi judul (${m.views?.toLocaleString('id-ID') || 0} views) menunjukkan daya pikat yang sehat.`
      };

  const convDiag = {
    score: netSubs >= 20 ? 'Sangat Baik' : netSubs >= 5 ? 'Standar' : 'Perlu Optimasi',
    explanation: `Menghasilkan +${subsGained} subscriber baru (${subsLost > 0 ? `dengan -${subsLost} berhenti subscribe, ` : ''}bersih: ${netSubs > 0 ? '+' : ''}${netSubs}). ${m.netSubsPer1k >= 5 ? 'Rasio konversi sangat tinggi terhadap penonton baru, menandakan kredibilitas investigasi diakui audiens.' : 'Pastikan menyelipkan call-to-action ajakan berlangganan di momen puncak pembongkaran data penting.'}`
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
  const totalDurationSec = health.totalDurationSec || estimateVideoDuration(report);
  const drop = detectDropoffPoint(retention, totalDurationSec);
  const hook = detectHookRetention(retention);

  const geminiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || 'gemini-3.5-flash';

  if (!geminiKey) {
    return generateHeuristicAudit(report, health);
  }

  const payloadContext = {
    title: v.title || 'Video Investigasi',
    id: report.id,
    format: health.formatLabel,
    durationSec: totalDurationSec,
    durationFormatted: `${Math.floor(totalDurationSec / 60)}m ${totalDurationSec % 60}s`,
    views: FINITE(s.views || v.lifetime?.views),
    watchHours: FINITE(s.watchHours),
    avgDurationSec: FINITE(s.averageViewDuration),
    avgDurationMin: Math.round((FINITE(s.averageViewDuration) / 60) * 10) / 10,
    avgPercentage: FINITE(report.averageViewPercentage),
    ctr: reach.ctr !== null && reach.ctr !== undefined ? Number(reach.ctr) : null,
    impressions: FINITE(reach.impressions),
    likes: FINITE(s.likes),
    comments: FINITE(s.comments),
    shares: FINITE(s.shares),
    subscribersGained: FINITE(s.subscribersGained),
    subscribersLost: FINITE(s.subscribersLost),
    netSubscribers: FINITE(s.subscribersGained) - FINITE(s.subscribersLost),
    hook30sRetention: hook ? `${hook.watchRatio}% (${hook.score})` : null,
    biggestDropPoint: drop ? `${drop.timestampFormatted ? `Menit ${drop.timestampFormatted}` : `${Math.round(drop.position * 100)}%`} (drop -${drop.dropPercent}%)` : null,
    searchKeywords: searchTerms,
    sampleConfidence: health.confidenceLabel,
    linkedPillar: content?.pillarId || 'Investigasi',
    linkedTitle: content?.title || null
  };

  const prompt = `Anda adalah Senior Content Strategist & Video Editor untuk channel YouTube dokumenter investigasi "REFRAME INVESTIGASI" (@Reframe404).
Channel ini berfokus pada 7 pilar: Politik, Ekonomi, Geopolitik, Sisi Gelap, Hukum, Investigasi, Kebijakan.

Berikut data performa analitik riil yang telah diukur dengan metode penilaian multi-faktor terkalibrasi:
${JSON.stringify(payloadContext, null, 2)}

Skor kesehatan algoritma terhitung: ${health.overall}/100 (Grade: ${health.grade}, Status: ${health.status}).
Komponen breakdown:
- Daya Tarik (CTR): ${health.breakdown.clickScore}/100
- Retensi Durasi (${health.formatLabel}): ${health.breakdown.retentionScore}/100
- Interaksi Pemirsa (Bobot Share/Komentar): ${health.breakdown.engagementScore}/100
- Konversi Loyalitas Subscriber: ${health.breakdown.conversionScore}/100

Tugas Anda:
Berikan Rapor Evaluasi Performa yang tajam, kritis, profesional, dan SANGAT APLIKATIF (bukan sekadar mengulang angka).
Gunakan Bahasa Indonesia yang elegan, cerdas, dan bernas khas media investigasi.
Jika ada titik kebocoran retensi (menit tertentu), berikan analisis naskah/editing penyebabnya dan solusinya.

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
    "explanation": "Evaluasi efektivitas daya tarik judul dan thumbnail berdasarkan CTR dan impresi."
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
