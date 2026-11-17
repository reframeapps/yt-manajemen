import { headline, publisherKey, profileConflicts, sourceMaterialKey } from './radar-methodology.mjs';
import { materialText, plainSource, buildIssueReport } from './radar-engine.mjs';
import { buildResearchPlan, matchesResearchTopic } from './radar-research-plan.mjs';
import { sourceQuality } from './radar-editorial.mjs';

const HOUR = 3600000;
const DAY = 86400000;

export const PRECISION_V6_METHOD = {
  version: 6,
  name: 'Precision Radar V6',
  description: 'Pemisahan tegas antara Priority Score (urgensi & nilai jurnalistik) dan Verification Status (validitas bukti & fakta). Mendukung Early Signal 1-sumber primer, deteksi Underreported, timeline Event History terstruktur, dan klasifikasi 6 dashboard.',
  weights: {
    relevance: 30,    // Kesesuaian DNA Reframe (sistem, kekuasaan, ekonomi, sejarah, manusia)
    publicImpact: 25, // Skala dampak sistemik & kepentingan publik (anggaran, regulasi, korban)
    novelty: 20,      // Kebaruan sudut pandang & narrative gap terhadap workspace
    velocity: 15,     // Laju pertumbuhan aktual (momentum kemunculan sumber per jam)
    actionability: 10 // Kesiapan bahan/dokumen untuk dieksekusi menjadi naskah
  },
  buckets: [
    'hot_verified',    // Prioritas tinggi (>=65) & terverifikasi (multi-sumber atau dokumen primer)
    'early_signal',    // Sinyal awal dari 1 sumber primer/resmi atau liputan investigasi awal
    'underreported',   // Berdampak besar (>=65) namun minim diliput media mainstream (<=3 sumber)
    'material_update', // Isu aktif yang mendapatkan penambahan fakta/dokumen baru signifikan (<24h)
    'needs_factcheck', // Isu viral/klaim yang diragukan, terjadi sengketa angka, atau sumber anonim
    'watchlist'        // Isu yang sedang dipantau perkembangan buktinya
  ]
};

const normalize = s => plainSource(s || '').normalize('NFKC').toLocaleLowerCase('id-ID').replace(/[^\p{L}\p{N}%]+/gu, ' ').trim().replace(/\s+/g, ' ');

// Kamus leksikon investigatif mendalam Reframe V6
const LEXICONS = {
  system: /\b(pajak|subsidi|kebijakan|regulasi|monopoli|anggaran|laba|pendapatan|utang|modal|insentif|perusahaan|bank|harga|upah|biaya|phk|pekerja|korupsi|kpk|suap|gratifikasi|pengadaan|tender|bumn|apbn|apbd|bpk|bpkp|kartel|oligarki)\b/,
  history: /\b(sejarah|kronologi|arsip|dulu|krisis|rekam jejak|perubahan|berubah|runtuh|bangkrut|gagal|kegagalan|strategi|investigasi|audit|preseden|modus)\b/,
  human: /\b(warga|pekerja|keluarga|masyarakat|mahasiswa|siswa|konsumen|pelanggan|biaya hidup|kelas menengah|burnout|kehidupan|penghasilan|korban|kemiskinan|buruh|petani|nelayan|rakyat)\b/,
  impact: /\b(triliun|miliar|juta jiwa|nasional|seluruh indonesia|darurat|krisis|sistemik|perpres|uu|undang undang|aturan pemerintah|kerugian negara|bencana|massal)\b/,
  suspicion: /\b(diduga|dugaan|klaim|hoaks|viral|heboh|geger|katanya|rumor|spekulasi|tudingan|kontroversial|beredar narasi)\b/
};

// Domain & entitas rilis resmi / dokumen primer Indonesia
const PRIMARY_DOMAINS = /\.(go\.id|bpk\.go\.id|kpk\.go\.id|mahkamahagung\.go\.id|polri\.go\.id|dpr\.go\.id|kemenkeu\.go\.id|kejaksaan\.go\.id|bps\.go\.id|ojk\.go\.id|bi\.go\.id)$/i;

/**
 * Deteksi apakah sebuah sumber memiliki indikasi sumber primer resmi / dokumen hukum
 */
export function isPrimarySource(source) {
  if (!source) return false;
  if (source.sourceRole === 'primary') return true;
  if (source.verification === 'verified') return true;
  try {
    const host = new URL(source.url || '').hostname.toLowerCase();
    if (PRIMARY_DOMAINS.test(host)) return true;
  } catch {}
  const hay = normalize((source.title || '') + ' ' + (source.excerpt || ''));
  return /\b(dokumen resmi|laporan audit|putusan pengadilan|rilis resmi|siaran pers resmi|hasil penyelidikan|bpk temukan|kpk geledah|penetapan tersangka|surat edaran)\b/.test(hay);
}

/**
 * Deteksi kecepatan pertumbuhan aktual kemunculan sumber (Velocity & Acceleration)
 */
export function calculateActualVelocity(issue, now = Date.now()) {
  const sources = issue.sources || [];
  const validTimes = sources.map(s => Date.parse(s.publishedAt || s.discoveredAt || '')).filter(Number.isFinite);
  if (!validTimes.length) {
    return { state: 'unavailable', delta24h: 0, deltaPublishers24h: 0, score: 0, note: 'Belum ada data waktu publikasi.' };
  }

  const daySources = sources.filter(s => {
    const t = Date.parse(s.publishedAt || s.discoveredAt || '');
    return Number.isFinite(t) && now - t >= 0 && now - t < 24 * HOUR;
  });

  const prevDaySources = sources.filter(s => {
    const t = Date.parse(s.publishedAt || s.discoveredAt || '');
    return Number.isFinite(t) && now - t >= 24 * HOUR && now - t < 48 * HOUR;
  });

  const dayPublishers = new Set(daySources.map(publisherKey).filter(Boolean));
  const prevDayPublishers = new Set(prevDaySources.map(publisherKey).filter(Boolean));

  const deltaSources = daySources.length - prevDaySources.length;
  const deltaPublishers = dayPublishers.size - prevDayPublishers.size;

  let state = 'stable';
  if (daySources.length >= 3 && deltaSources >= 2) state = 'accelerating';
  else if (daySources.length >= 1 && (deltaSources > 0 || prevDaySources.length === 0)) state = 'rising';
  else if (prevDaySources.length > 0 && daySources.length === 0) state = 'cooling';

  // Nilai velocity (0 - 15 poin)
  let score = 0;
  if (state === 'accelerating') score = 15;
  else if (state === 'rising') score = dayPublishers.size >= 2 ? 12 : 8;
  else if (state === 'stable') score = daySources.length ? 5 : 2;
  else score = 1;

  return {
    state,
    dayCount: daySources.length,
    prevDayCount: prevDaySources.length,
    deltaSources,
    dayPublishers: dayPublishers.size,
    deltaPublishers,
    score,
    latestAt: new Date(Math.max(...validTimes)).toISOString()
  };
}

/**
 * Menentukan status verifikasi (Verification Status) secara terpisah dari skor prioritas
 */
export function determineVerificationStatus(issue, quality, report) {
  const sources = issue.sources || [];
  const uniquePublishers = quality.publishers || 0;
  const verifiedSources = sources.filter(s => s.verification === 'verified');
  const primarySources = sources.filter(isPrimarySource);
  const conflicts = (report.conflicts || []).length + (report.differences || []).length;
  const hay = normalize(issue.title + ' ' + sources.map(s => s.title + ' ' + (s.excerpt || '')).join(' '));

  // 1. Cek adanya konflik atau bantahan langsung
  const hasContradiction = /\b(bantah|membantah|menyangkal|hoaks|tidak benar|keliru|klarifikasi)\b/.test(hay);
  if (conflicts > 0 || (hasContradiction && sources.length >= 2)) {
    return {
      status: 'disputed',
      label: 'Klaim Berbeda / Sengketa',
      confidence: 'medium',
      reason: conflicts ? `${conflicts} perbedaan angka/pernyataan terdeteksi.` : 'Terdapat bantahan atau perbedaan versi antara sumber.'
    };
  }

  const hasPrimarySource = primarySources.length >= 1 || verifiedSources.length >= 1;

  // 2. Cek apakah ada indikasi rumor/viral tanpa bukti kuat
  const isSuspicious = !hasPrimarySource && LEXICONS.suspicion.test(hay) && quality.fullSources === 0;
  if (isSuspicious) {
    return {
      status: 'needs_factcheck',
      label: 'Perlu Cek Fakta',
      confidence: 'low',
      reason: 'Narasi bernada dugaan/viral tanpa bukti dokumen atau artikel lengkap.'
    };
  }

  // 3. Konfirmasi kuat (dokumen resmi / editor verified + multi publisher)
  if (hasPrimarySource && uniquePublishers >= 2) {
    return {
      status: 'confirmed',
      label: 'Terkonfirmasi & Berdokumen',
      confidence: 'high',
      reason: `Didukung sumber primer/dokumen resmi dan dikonfirmasi minimal ${uniquePublishers} media independen.`
    };
  }

  // 4. Multi-sourced (dilaporkan oleh >= 3 media independen)
  if (uniquePublishers >= 3) {
    return {
      status: 'multi_sourced',
      label: 'Multi-Sumber Independen',
      confidence: 'high',
      reason: `Dilaporkan oleh ${uniquePublishers} penerbit berbeda secara konsisten.`
    };
  }

  // 5. Early Signal (1 atau 2 sumber, tetapi memiliki sumber primer atau laporan mendalam)
  if (hasPrimarySource || quality.fullSources >= 1) {
    return {
      status: 'single_primary',
      label: 'Sinyal Awal Primer',
      confidence: 'medium_high',
      reason: 'Berasal dari 1 sumber primer resmi atau laporan awal dengan bukti substansial.'
    };
  }

  // 6. Belum diverifikasi (hanya headline atau agregator)
  return {
    status: 'unverified',
    label: 'Belum Terverifikasi',
    confidence: 'low',
    reason: 'Liputan masih berupa rangkuman awal tanpa bukti dokumen atau verifikasi primer.'
  };
}

/**
 * Menyusun riwayat kronologis peristiwa & perkembangan bukti (Event History)
 */
export function buildEventHistory(issue) {
  const sources = issue.sources || [];
  const events = [];

  const sortedSources = [...sources].sort((a, b) => {
    const ta = Date.parse(a.publishedAt || a.discoveredAt || 0);
    const tb = Date.parse(b.publishedAt || b.discoveredAt || 0);
    return ta - tb;
  });

  const seenKeys = new Set();
  for (const s of sortedSources) {
    const pubTime = s.publishedAt || s.discoveredAt || null;
    const cleanTitle = normalize(s.title);
    if (seenKeys.has(cleanTitle)) continue;
    seenKeys.add(cleanTitle);

    const isPrimary = isPrimarySource(s);
    const hasArticle = !!(s.article?.text || s.transcript?.text);
    const hay = normalize(s.title + ' ' + (s.excerpt || ''));

    let type = 'report';
    if (isPrimary) type = 'primary_release';
    else if (/\b(bantah|klarifikasi|respons|tanggapan)\b/.test(hay)) type = 'official_response';
    else if (/\b(temuan|audit|tersangka|geledah|sita|vonis)\b/.test(hay)) type = 'escalation';
    else if (hasArticle) type = 'in_depth';

    events.push({
      id: 'evt-' + (s.id || crypto.randomUUID()),
      timestamp: pubTime,
      type,
      title: s.title,
      publisher: s.publisher || 'Sumber Media',
      url: s.url,
      platform: s.platform,
      evidenceSnippet: s.excerpt ? s.excerpt.slice(0, 240) : '',
      isPrimary,
      hasFullText: hasArticle
    });
  }

  return events;
}

/**
 * Evaluasi Precision Radar V6 secara menyeluruh
 */
export function evaluatePrecisionV6(issue, { topics = [], contents = [], now = Date.now() } = {}) {
  const sources = issue.sources || [];
  const quality = sourceQuality(issue);
  const report = buildIssueReport(issue);
  const research = buildResearchPlan(issue, report, quality);

  const hay = normalize(issue.title + ' ' + sources.map(s => s.title + ' ' + (s.excerpt || '')).join(' '));
  const matchingTopics = topics.filter(t => matchesResearchTopic({ title: issue.title, excerpt: hay }, t));

  // --- KOMPONEN SKOR PRIORITAS V6 (0 - 100 POIN) ---

  // 1. Relevansi DNA Reframe (0 - 30 Poin)
  const hasSystem = LEXICONS.system.test(hay);
  const hasHistory = LEXICONS.history.test(hay);
  const hasHuman = LEXICONS.human.test(hay);
  let relevance = (matchingTopics.length ? 12 : 4);
  if (hasSystem) relevance += 8;
  if (hasHistory) relevance += 5;
  if (hasHuman) relevance += 5;
  relevance = Math.min(30, relevance);

  // 2. Skala Dampak Sistemik & Kepentingan Publik (0 - 25 Poin)
  // Menilai skala dampak riil (bukan sekadar sensasi selebriti / percekcokan pribadi)
  let publicImpact = 5;
  if (LEXICONS.impact.test(hay)) publicImpact += 10;
  if (/\b(korupsi|apbn|apbd|pajak|subsidi|bumn|bgn|kpk|bpk|pengadaan)\b/.test(hay)) publicImpact += 6;
  if (hasSystem && hasHuman) publicImpact += 4; // Dampak kebijakan ke masyarakat
  publicImpact = Math.min(25, publicImpact);

  // 3. Kebaruan & Celah Narasi / Workspace (0 - 20 Poin)
  const linked = (issue.contentIds || []).map(id => contents.find(c => c.id === id)).filter(Boolean);
  let novelty = 20;
  if (linked.some(c => c.youtubeVideoId)) novelty = 4;
  else if (linked.length > 0) novelty = 8;
  else if (issue.status === 'discussed') novelty = 10;

  // 4. Laju Pertumbuhan Aktual (Velocity) (0 - 15 Poin)
  const velocity = calculateActualVelocity(issue, now);
  const velocityScore = velocity.score;

  // 5. Kesiapan Bukti & Tindak Lanjut (0 - 10 Poin)
  const primaryCount = sources.filter(isPrimarySource).length;
  let actionability = 2;
  if (quality.fullSources >= 1) actionability += 3;
  if (primaryCount >= 1) actionability += 3;
  if (research.lead?.text) actionability += 2;
  actionability = Math.min(10, actionability);

  const components = {
    relevance,
    publicImpact,
    novelty,
    velocity: velocityScore,
    actionability
  };

  const priorityScore = Object.values(components).reduce((sum, v) => sum + v, 0);

  // --- SISTEM VERIFIKASI TERPISAH ---
  const verification = determineVerificationStatus(issue, quality, report);

  // --- EVENT HISTORY TIMELINE ---
  const eventHistory = buildEventHistory(issue);

  // --- DETEKSI MATERIAL UPDATE ---
  // Isu yang telah memiliki riwayat lama dan menerima sumber/klaim baru dalam 24 jam terakhir dengan jeda minimal 12 jam
  const recentEvents = eventHistory.filter(e => {
    const t = Date.parse(e.timestamp || '');
    return Number.isFinite(t) && now - t < 24 * HOUR;
  });
  const eventTimes = eventHistory.map(e => Date.parse(e.timestamp || '')).filter(Number.isFinite);
  const eventSpanHours = eventTimes.length >= 2 ? (Math.max(...eventTimes) - Math.min(...eventTimes)) / HOUR : 0;
  const issueCreatedTime = Date.parse(issue.createdAt || '');
  const issueAgeHours = Number.isFinite(issueCreatedTime) ? (now - issueCreatedTime) / HOUR : 0;
  const hasMaterialUpdate = eventHistory.length >= 2 && eventSpanHours >= 12 && (issueAgeHours >= 12 || !Number.isFinite(issueCreatedTime)) && recentEvents.length >= 1;

  // --- KLASIFIKASI KE DALAM 6 DASHBOARD BUCKET V6 ---
  let bucket = 'watchlist';

  if (verification.status === 'needs_factcheck' || verification.status === 'disputed') {
    bucket = 'needs_factcheck';
  } else if (hasMaterialUpdate && priorityScore >= 50) {
    bucket = 'material_update';
  } else if (priorityScore >= 65 && verification.status === 'multi_sourced') {
    // Hot Verified: Isu prioritas tinggi dengan verifikasi multi-sumber luas (>=3 media)
    bucket = 'hot_verified';
  } else if (sources.length === 1 && (verification.status === 'single_primary' || primaryCount >= 1)) {
    // Early Signal: 1 sumber primer resmi / investigasi awal pertama yang belum diliput media lain
    bucket = 'early_signal';
  } else if (priorityScore >= 55 && sources.length >= 2 && quality.publishers <= 3 && ['single_primary', 'confirmed', 'multi_sourced'].includes(verification.status)) {
    // Underreported: Isu berdampak sistemik tinggi namun minim diliput media mainstream
    bucket = 'underreported';
  } else if (priorityScore >= 55 && verification.status === 'single_primary') {
    bucket = 'early_signal';
  } else if (priorityScore >= 65 && verification.status === 'confirmed') {
    bucket = 'hot_verified';
  } else if (priorityScore >= 45) {
    bucket = 'watchlist';
  } else {
    bucket = 'watchlist';
  }

  // Label UI & Badge
  const bucketLabels = {
    hot_verified: 'Hot Verified',
    early_signal: 'Early Signal',
    underreported: 'Underreported',
    material_update: 'Material Update',
    needs_factcheck: 'Needs Fact-Check',
    watchlist: 'Watchlist'
  };

  return {
    version: 6,
    priorityScore,
    priorityRating: priorityScore >= 80 ? 5 : priorityScore >= 65 ? 4 : priorityScore >= 50 ? 3 : priorityScore >= 35 ? 2 : 1,
    components,
    verificationStatus: verification.status,
    verificationLabel: verification.label,
    verificationConfidence: verification.confidence,
    verificationReason: verification.reason,
    bucket,
    bucketLabel: bucketLabels[bucket] || 'Watchlist',
    velocity,
    hasMaterialUpdate,
    eventHistory,
    signals: {
      hasSystem,
      hasHistory,
      hasHuman,
      isPrimaryCovered: primaryCount > 0,
      totalSources: sources.length,
      uniquePublishers: quality.publishers
    },
    note: PRECISION_V6_METHOD.description
  };
}

/**
 * Konversi entitas Isu Radar Precision V6 ke payload kartu Kanban (stage: 'idea')
 */
export function issueToKanbanPayload(issue, { format = 'long', pillarId = 'Investigasi' } = {}) {
  const v6 = issue.precisionV6 || evaluatePrecisionV6(issue);
  const events = v6.eventHistory || [];
  const timelineText = events.slice(0, 5).map(e => `• [${e.timestamp ? e.timestamp.slice(0, 10) : 'Waktu N/A'}] ${e.publisher}: ${e.title}`).join('\n');

  const brief = [
    `[Radar V6 Precision — ${v6.bucketLabel.toUpperCase()} | Prioritas ${v6.priorityScore}/100]`,
    `Status Verifikasi: ${v6.verificationLabel} (${v6.verificationReason})`,
    '',
    'Kronologi Peristiwa & Bukti Sumber:',
    timelineText || 'Belum ada kronologi peristiwa tercatat.',
    '',
    issue.editorial?.angle ? `Sudut Pandang Investigasi:\n${issue.editorial.angle}` : '',
    issue.editorial?.gaps?.length ? `Kebutuhan Riset & Konfirmasi:\n- ${issue.editorial.gaps.join('\n- ')}` : ''
  ].filter(Boolean).join('\n');

  const sources = (issue.sources || []).map(s => ({
    label: s.title || s.url,
    url: s.url,
    publisher: s.publisher || '',
    notes: s.excerpt || '',
    isPrimary: isPrimarySource(s),
    verified: s.verification === 'verified'
  }));

  return {
    title: issue.title,
    stage: 'idea',
    format: ['short', 'long'].includes(format) ? format : 'long',
    pillarId: pillarId || 'Investigasi',
    brief,
    radarIssueId: issue.id,
    tags: `radar-v6, ${v6.bucket}, ${v6.verificationStatus}, investigasi`,
    sources
  };
}

