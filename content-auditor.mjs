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
    score: pct >= 70 ? 'Kuat' : pct >= 52 ? 'Standar' : 'Perlu Penguatan'
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

export function calculateChannelBenchmarks(channelVideos, currentVideoId) {
  if (!Array.isArray(channelVideos) || channelVideos.length < 3) {
    return null;
  }
  const valid = channelVideos.filter(v => Number.isFinite(v.views) && v.views >= 0);
  if (valid.length < 3) return null;

  const viewsArr = valid.map(v => v.views).sort((a, b) => a - b);
  const avdArr = valid.map(v => v.averageViewDuration || 0).sort((a, b) => a - b);
  const apvArr = valid.map(v => v.averageViewPercentage || 0).sort((a, b) => a - b);

  const getPercentile = (arr, p) => {
    if (!arr.length) return 0;
    const idx = (p / 100) * (arr.length - 1);
    const low = Math.floor(idx);
    const high = Math.ceil(idx);
    return Math.round((arr[low] + arr[high]) / 2);
  };

  const viewsQ1 = getPercentile(viewsArr, 25);
  const viewsMed = getPercentile(viewsArr, 50);
  const viewsQ3 = getPercentile(viewsArr, 75);

  const avdQ1 = getPercentile(avdArr, 25);
  const avdMed = getPercentile(avdArr, 50);
  const avdQ3 = getPercentile(avdArr, 75);

  const apvQ1 = getPercentile(apvArr, 25);
  const apvMed = getPercentile(apvArr, 50);
  const apvQ3 = getPercentile(apvArr, 75);

  const sorted = [...valid].sort((a, b) => (b.views || 0) - (a.views || 0));
  const rankIdx = sorted.findIndex(v => v.id === currentVideoId);
  const rank = rankIdx >= 0 ? rankIdx + 1 : null;
  const totalRanked = sorted.length;

  return {
    totalRanked,
    rank,
    rankText: rank ? `Peringkat #${rank} dari ${totalRanked} video channel` : `Peringkat #${totalRanked} dari ${totalRanked} video`,
    views: { q1: viewsQ1, median: viewsMed, q3: viewsQ3 },
    avd: { q1: avdQ1, median: avdMed, q3: avdQ3 },
    apv: { q1: apvQ1, median: apvMed, q3: apvQ3 }
  };
}

export function computeHealthScore(report, { channelVideos = [] } = {}) {
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

  const channelBench = calculateChannelBenchmarks(channelVideos, report.id);

  let viewsStatus = 'Tipikal Channel';
  let viewsPercentile = 60;
  let avdStatus = 'Tipikal Channel';
  let avdPercentile = 60;

  if (channelBench) {
    if (views > channelBench.views.q3) {
      viewsStatus = '🟢 Di Atas Tipikal Channel';
      viewsPercentile = Math.min(98, Math.max(78, channelBench.rank ? Math.round(((channelBench.totalRanked - channelBench.rank + 1) / channelBench.totalRanked) * 100) : 85));
    } else if (views < channelBench.views.q1) {
      viewsStatus = '🟠 Di Bawah Tipikal Channel';
      viewsPercentile = Math.max(20, channelBench.rank ? Math.round(((channelBench.totalRanked - channelBench.rank + 1) / channelBench.totalRanked) * 100) : 35);
    } else {
      viewsStatus = '🔵 Tipikal / Sesuai Rata-rata';
      viewsPercentile = channelBench.rank ? Math.round(((channelBench.totalRanked - channelBench.rank + 1) / channelBench.totalRanked) * 100) : 60;
    }

    if (avgDuration > channelBench.avd.q3) {
      avdStatus = '🟢 Di Atas Tipikal Channel';
      avdPercentile = 86;
    } else if (avgDuration < channelBench.avd.q1) {
      avdStatus = '🟠 Di Bawah Tipikal Channel';
      avdPercentile = 42;
    } else {
      avdStatus = '🔵 Tipikal Channel';
      avdPercentile = 65;
    }
  }

  // Clickability (CTR)
  let clickScore = 70;
  let ctrSource = 'laporan';
  if (ctr !== null && Number.isFinite(ctr)) {
    const ctrPoints = [[1.0, 40], [2.5, 55], [4.0, 70], [5.5, 82], [7.5, 92], [10.0, 98]];
    let baseClick = interpolate(ctr, ctrPoints);
    if (impressions >= 10000 && ctr >= 4.5) {
      baseClick += Math.min(6, Math.round(Math.log10(impressions / 5000) * 3));
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
  }

  // Retention Score
  let retentionScore = avdPercentile;
  if (!channelBench && avgPercentage > 0) {
    let apvPoints;
    if (format === 'shorts') apvPoints = [[25, 40], [45, 55], [60, 70], [75, 84], [90, 94], [115, 100]];
    else if (format === 'short') apvPoints = [[18, 40], [30, 55], [42, 70], [52, 83], [64, 93], [80, 100]];
    else if (format === 'medium') apvPoints = [[14, 40], [24, 55], [34, 70], [44, 83], [54, 93], [68, 100]];
    else apvPoints = [[10, 40], [18, 55], [26, 70], [35, 83], [44, 93], [55, 100]];
    retentionScore = Math.min(99, Math.max(35, interpolate(avgPercentage, apvPoints)));
    if (avgDuration >= 600) retentionScore += 5;
    else if (avgDuration >= 420) retentionScore += 3;
    else if (avgDuration >= 240) retentionScore += 1;
  }

  // Engagement Score
  let engagementScore = 70;
  let weightedEngRate = 0;
  if (views > 0) {
    const weightedTotal = likes * 1.0 + comments * 2.5 + shares * 4.0;
    weightedEngRate = (weightedTotal / views) * 100;
    const engPoints = [[0.4, 40], [1.0, 55], [2.0, 70], [3.5, 82], [5.5, 92], [8.5, 100]];
    engagementScore = Math.min(99, Math.max(35, interpolate(weightedEngRate, engPoints)));
  }

  // Conversion Score
  let conversionScore = 70;
  let netSubsPer1k = 0;
  if (views > 0) {
    netSubsPer1k = (netSubs / views) * 1000;
    const convPoints = [[-2.0, 30], [0.0, 50], [1.5, 65], [3.5, 78], [6.5, 88], [11.0, 96], [16.0, 100]];
    conversionScore = Math.min(99, Math.max(30, interpolate(netSubsPer1k, convPoints)));
  }

  // Sistem menghitung skor objektif keseluruhan (100% deterministik sistem)
  let overall = 70;
  if (channelBench) {
    overall = Math.round(viewsPercentile * 0.40 + avdPercentile * 0.35 + clickScore * 0.25);
  } else {
    overall = Math.round(clickScore * 0.25 + retentionScore * 0.35 + engagementScore * 0.20 + conversionScore * 0.20);
    const conf = views > 0 ? Math.min(1.0, Math.max(0.40, Math.log10(views + 5) / 2.8)) : 0.5;
    overall = Math.round(overall * conf + 70 * (1 - conf));
  }
  overall = Math.min(99, Math.max(30, overall));

  let grade = 'B';
  let status = 'Tipikal / Sesuai Ekspektasi';
  let badgeColor = '#2563eb';

  if (overall >= 88) {
    grade = 'S';
    status = '🔥 TIER-1 / OUTPERFORMING (Top Channel)';
    badgeColor = '#d97706';
  } else if (overall >= 78) {
    grade = 'A';
    status = '🟢 DI ATAS TIPIKAL CHANNEL';
    badgeColor = '#16a34a';
  } else if (overall >= 62) {
    grade = 'B';
    status = '🔵 TIPIKAL / SESUAI EKSPEKTASI';
    badgeColor = '#2563eb';
  } else if (overall >= 48) {
    grade = 'C';
    status = '🟠 DI BAWAH TIPIKAL CHANNEL';
    badgeColor = '#ea580c';
  } else {
    grade = 'D';
    status = '🔴 PERLU EVALUASI TOTAL';
    badgeColor = '#dc2626';
  }

  return {
    overall,
    grade,
    status,
    badgeColor,
    format,
    formatLabel,
    totalDurationSec,
    channelBench,
    viewsStatus,
    avdStatus,
    breakdown: {
      clickScore,
      retentionScore,
      engagementScore,
      conversionScore
    },
    metricsSummary: {
      views,
      impressions,
      ctr: ctr !== null ? Math.round(ctr * 10) / 10 : null,
      ctrSource,
      apv: Math.round(avgPercentage * 10) / 10,
      avdSec: avgDuration,
      avdMin: Math.round((avgDuration / 60) * 10) / 10,
      weightedEngRate: Math.round(weightedEngRate * 10) / 10,
      netSubs,
      netSubsPer1k: Math.round(netSubsPer1k * 10) / 10
    }
  };
}

export function computeSystemDiagnostics(report, health) {
  const s = report.summary || {};
  const reach = report.reach || {};
  const retention = report.retention || [];
  const m = health.metricsSummary || {};
  const totalDurationSec = health.totalDurationSec || estimateVideoDuration(report);
  const drop = detectDropoffPoint(retention, totalDurationSec);
  const hook = detectHookRetention(retention);
  const ctr = reach.ctr !== null && reach.ctr !== undefined ? Number(reach.ctr) : null;

  const clickability = {
    score: ctr !== null ? (ctr >= 6.0 ? 'Tinggi' : ctr >= 4.0 ? 'Tipikal' : 'Perlu Optimasi') : (health.breakdown.clickScore >= 80 ? 'Kuat (Estimasi)' : 'Standar'),
    ctr,
    impressions: reach.impressions || 0,
    text: ctr !== null
      ? `CTR thumbnail sebesar ${ctr.toFixed(1)}%${reach.impressions ? ` dari total ${reach.impressions.toLocaleString('id-ID')} impresi` : ''}.`
      : `Data CTR spesifik dalam pelaporan YouTube Reporting. Estimasi penonton: ${m.views?.toLocaleString('id-ID') || 0} views.`
  };

  const hookDiag = {
    score: hook ? hook.score : (m.apv >= 35 ? 'Kuat' : 'Perlu Penguatan'),
    ratio: hook ? hook.watchRatio : null,
    text: hook
      ? `Retensi 30 detik pertama sebesar ${hook.watchRatio}% penonton bertahan.`
      : `Rata-rata tonton sebesar ${m.apv}% durasi (${m.avdMin} menit).`
  };

  const dropoff = {
    point: drop ? (drop.timestampFormatted ? `Menit ${drop.timestampFormatted} (${Math.round(drop.position * 100)}% durasi)` : `Posisi ${Math.round(drop.position * 100)}% durasi`) : 'Pertengahan Durasi',
    dropPercent: drop ? `-${drop.dropPercent}%` : 'Normal',
    timestampFormatted: drop?.timestampFormatted || null,
    timestampSec: drop?.timestampSec || null,
    detected: !!drop
  };

  const conversion = {
    score: m.netSubsPer1k >= 5 ? 'Sangat Baik' : m.netSubsPer1k >= 1.5 ? 'Standar' : 'Perlu Optimasi',
    netSubs: m.netSubs,
    netSubsPer1k: m.netSubsPer1k,
    text: `Konversi netto ${m.netSubs > 0 ? '+' : ''}${m.netSubs} subscriber (${m.netSubsPer1k} per 1.000 views).`
  };

  return { clickability, hook: hookDiag, dropoff, conversion };
}

export function generateHeuristicAudit(report, health, diagnostics) {
  const diag = diagnostics || computeSystemDiagnostics(report, health);
  const v = report.video || {};
  const m = health.metricsSummary || {};
  const bench = health.channelBench;
  const searchTerms = (report.searchTerms || []).map(st => st.key).slice(0, 3);

  const rankStr = bench?.rankText ? `${bench.rankText} · ` : '';
  const executiveSummary = m.views > (bench?.views?.median || 3000) || health.overall >= 78
    ? `Video "${v.title || 'ini'}" (${health.formatLabel}) meraih status ${health.status} (${rankStr}skor ${health.overall}/100). Durasi tonton mencapai ${m.avdMin} menit (${health.avdStatus}) dengan konversi netto ${m.netSubs > 0 ? '+' : ''}${m.netSubs} subscriber, membuktikan investigasi ini berhasil mengikat audiens di atas rata-rata.`
    : `Video "${v.title || 'ini'}" (${health.formatLabel}) berada pada status ${health.status} (${rankStr}skor ${health.overall}/100). Penonton awal mencatatkan ${m.views.toLocaleString('id-ID')} views (${health.viewsStatus}), dengan ruang penguatan pada pacing naskah dan hook pembuka agar durasi tonton meningkat.`;

  const hookExplanation = `${diag.hook.text} ${diag.hook.score === 'Kuat' ? 'Pembukaan langsung ke inti investigasi terbukti efektif mempertahankan audiens sejak intro.' : 'Pangkas salam atau pembuka yang bertele-tele dan langsung letakkan fakta mengejutkan di 15 detik awal.'}`;

  const dropCause = diag.dropoff.detected
    ? `Terdeteksi penurunan ${diag.dropoff.dropPercent} penonton pada ${diag.dropoff.point}. Titik ini umumnya terjadi saat tempo narasi melambat atau pemaparan dokumen statis terlalu panjang tanpa pergantian visual.`
    : 'Kurva retensi penonton stabil tanpa penurunan ekstrem.';

  const dropRecom = diag.dropoff.detected
    ? 'Ganti pembacaan teks panjang di menit ini dengan motion graphic bagan alur, sorotan dokumen berlingkar merah, atau perubahan tensi musik latar.'
    : 'Pertahankan transisi adegan setiap 8–12 detik untuk menjaga tensi cerita investigasi.';

  const clickExplanation = `${diag.clickability.text} ${diag.clickability.score === 'Tinggi' ? 'Visual thumbnail kontras tinggi dan judul dramatis berhasil menarik klik.' : 'Tingkatkan kontras ekspresi tokoh dan kurangi teks thumbnail maksimal 3-4 kata kapital agar jelas di smartphone.'}`;

  const convExplanation = `${diag.conversion.text} ${diag.conversion.score === 'Sangat Baik' ? 'Rasio konversi sangat sehat, menandakan pemaparan materi memiliki kredibilitas tinggi.' : 'Sematkan ajakan berlangganan (call-to-action) tepat di momen pengungkapan fakta kunci investigasi.'}`;

  const actionItems = [
    m.views > 1000
      ? `Buat Part Lanjutan / Sekuel: Lanjutkan penelusuran dari video ini dengan mengangkat sudut pandang aktor atau aliran dana turunan.`
      : `Optimasi Thumbnail & Judul: Uji coba thumbnail alternatif dengan ekspresi tokoh dominan dan judul lebih provokatif.`,
    `Sematkan Komentar (Pin Comment): Berikan pertanyaan diskusi di kolom komentar untuk melipatgandakan engagement.`,
    `Evaluasi Menit Bocor: Pada naskah berikutnya, hindari jeda data teknis statis di titik serupa (${diag.dropoff.point}).`
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
    source: 'system',
    generatedAt: new Date().toISOString(),
    health,
    systemDiagnostics: diag,
    executiveSummary,
    hookDiagnosis: { score: diag.hook.score, explanation: hookExplanation },
    dropoffDiagnosis: { point: diag.dropoff.point, dropPercent: diag.dropoff.dropPercent, cause: dropCause, recommendation: dropRecom },
    clickabilityDiagnosis: { score: diag.clickability.score, explanation: clickExplanation },
    conversionDiagnosis: { score: diag.conversion.score, explanation: convExplanation },
    actionItems,
    sequelIdeas,
    topSearchTerms: searchTerms
  };
}

export async function auditVideo(report, { channelVideos = [], aiProvider, force = false, content = null, fetcher = fetch, now = Date.now } = {}) {
  // 1. SISTEM MENGHITUNG 100% METRIK & DIAGNOSTIK SECARA DETERMINISTIK
  const health = computeHealthScore(report, { channelVideos });
  const diag = computeSystemDiagnostics(report, health);
  const v = report.video || {};
  const s = report.summary || {};
  const reach = report.reach || {};
  const searchTerms = (report.searchTerms || []).map(st => st.key).slice(0, 5);
  const bench = health.channelBench;
  const m = health.metricsSummary;

  const geminiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || 'gemini-3.5-flash';

  if (!geminiKey) {
    return generateHeuristicAudit(report, health, diag);
  }

  // 2. FAKTA HASIL PERHITUNGAN SISTEM YANG DIKIRIM KE AI
  const systemCalculatedFacts = {
    title: v.title || 'Video Investigasi',
    id: report.id,
    format: health.formatLabel,
    channelRank: bench?.rankText || 'Tolok ukur sebanding',
    views: `${m.views.toLocaleString('id-ID')} views (${health.viewsStatus})`,
    typicalChannelViews: bench ? `${bench.views.q1.toLocaleString('id-ID')} - ${bench.views.q3.toLocaleString('id-ID')} views` : 'Data pembanding channel terbatas',
    avd: `${m.avdMin} menit (${health.avdStatus})`,
    typicalChannelAvd: bench ? `${Math.round(bench.avd.q1/60*10)/10}m - ${Math.round(bench.avd.q3/60*10)/10}m` : 'Data pembanding channel terbatas',
    ctr: m.ctr !== null ? `${m.ctr}% CTR` : 'Data CTR dalam antrean pelaporan',
    hook30s: diag.hook.text,
    biggestDropPoint: `${diag.dropoff.point} (penurunan ${diag.dropoff.dropPercent} penonton)`,
    conversion: diag.conversion.text,
    systemScore: `${health.overall}/100 (Grade: ${health.grade}, Status: ${health.status})`
  };

  const prompt = `Anda adalah Senior Content Editor & Strategist untuk channel berita investigasi "REFRAME INVESTIGASI" (@Reframe404).

SISTEM TELAH SELESAI MENGHITUNG FAKTA METRIK RIIL VIDEO BERIKUT:
${JSON.stringify(systemCalculatedFacts, null, 2)}

PERATURAN MUTLAK:
1. PERHITUNGAN TELAH SELESAI DILAKUKAN OLEH SISTEM. ANDA HANYA BERTUGAS MENARASIKAN FAKTA TERSEBUT.
2. JANGAN mengubah skor, persentase, peringkat, atau menit yang telah dihitung sistem di atas.
3. Gunakan Bahasa Indonesia yang berbobot, tajam, dan elegan khas jurnalisme investigasi.

Keluarkan HANYA JSON valid (tanpa markdown backtick, tanpa kata pengantar) dengan struktur:
{
  "executiveSummary": "2-3 kalimat narasi eksekutif merangkum performa video berdasarkan fakta peringkat dan rentang tipikal di atas.",
  "dropoffCause": "Penjelasan kemungkinan penyebab naskah atau tempo editing mengapa penonton keluar di ${diag.dropoff.point}.",
  "dropoffRecommendation": "Solusi konkret perbaikan editing/naskah di titik tersebut.",
  "actionItems": [
    "Tindakan konkret 1 (Langkah optimasi saat ini)",
    "Tindakan konkret 2 (Untuk video ini)",
    "Tindakan konkret 3 (Untuk naskah berikutnya)"
  ],
  "sequelIdeas": [
    {
      "title": "Ide Judul Naskah Sekuel 1 (Gaya REFRAME INVESTIGASI)",
      "hook": "Premis/inti investigasi lanjutan",
      "pillar": "Pilih dari: Politik / Ekonomi / Geopolitik / Sisi Gelap / Hukum / Investigasi / Kebijakan"
    },
    {
      "title": "Ide Judul Naskah Sekuel 2 (Gaya REFRAME INVESTIGASI)",
      "hook": "Premis/inti investigasi lanjutan",
      "pillar": "Pilih dari: Politik / Ekonomi / Geopolitik / Sisi Gelap / Hukum / Investigasi / Kebijakan"
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
      return generateHeuristicAudit(report, health, diag);
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
      systemDiagnostics: diag,
      executiveSummary: parsed.executiveSummary || `${systemCalculatedFacts.channelRank}. ${systemCalculatedFacts.views}.`,
      hookDiagnosis: {
        score: diag.hook.score,
        explanation: `${diag.hook.text} ${diag.hook.score === 'Kuat' ? 'Pembukaan langsung memikat perhatian penonton investigasi.' : 'Perlu penajaman visual di 15 detik awal.'}`
      },
      dropoffDiagnosis: {
        point: diag.dropoff.point,
        dropPercent: diag.dropoff.dropPercent,
        cause: parsed.dropoffCause || `Terdeteksi penurunan penonton pada ${diag.dropoff.point}.`,
        recommendation: parsed.dropoffRecommendation || 'Percepat transisi b-roll dan variasi visual di segmen serupa.'
      },
      clickabilityDiagnosis: {
        score: diag.clickability.score,
        explanation: diag.clickability.text
      },
      conversionDiagnosis: {
        score: diag.conversion.score,
        explanation: diag.conversion.text
      },
      actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems : ['Pertahankan konsistensi topik investigasi.'],
      sequelIdeas: Array.isArray(parsed.sequelIdeas) ? parsed.sequelIdeas : [],
      topSearchTerms: searchTerms
    };
  } catch (err) {
    return generateHeuristicAudit(report, health, diag);
  }
}
