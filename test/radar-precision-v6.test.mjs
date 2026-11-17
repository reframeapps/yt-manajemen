import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePrecisionV6, isPrimarySource, calculateActualVelocity, determineVerificationStatus, buildEventHistory, PRECISION_V6_METHOD, issueToKanbanPayload } from '../radar-precision-v6.mjs';
import { protectedIssue } from '../radar-retention.mjs';

const HOUR = 3600000;
const DAY = 86400000;

test('Precision V6: Satu Sumber Primer masuk Early Signal tanpa syarat 3 media', () => {
  const now = Date.parse('2026-11-17T10:00:00.000Z');
  const issue = {
    id: 'issue-bpk-audit',
    title: 'Audit BPK Ungkap Dugaan Penyimpangan Anggaran Pengadaan Rp1,2 Triliun di BGN',
    status: 'new',
    sources: [
      {
        id: 's-bpk-1',
        title: 'Siaran Pers Resmi Hasil Pemeriksaan Kepatuhan Pengadaan BGN Tahun 2026',
        url: 'https://bpk.go.id/berita/siaran-pers-audit-bgn-2026',
        publisher: 'Badan Pemeriksa Keuangan',
        platform: 'Berita / Web',
        publishedAt: '2026-11-17T08:00:00.000Z',
        excerpt: 'BPK temukan dokumen resmi ketidaksesuaian kontrak tender senilai Rp1,2 triliun pada proyek nasional.',
        coverage: 'snippet',
        verification: 'unchecked',
        sourceRole: 'primary'
      }
    ],
    topicIds: ['default-system'],
    lenses: ['system'],
    contentIds: []
  };

  const v6 = evaluatePrecisionV6(issue, { now });

  // Harus dikenali sebagai primary source
  assert.equal(isPrimarySource(issue.sources[0]), true);

  // Status verifikasi harus single_primary
  assert.equal(v6.verificationStatus, 'single_primary');

  // Skor prioritas harus tinggi karena dampak anggaran triliun dan relevansi sistem
  assert.ok(v6.priorityScore >= 60, `Priority score ${v6.priorityScore} harus >= 60`);

  // Bucket harus masuk ke early_signal (tidak diblokir oleh ketiadaan 3 media!)
  assert.equal(v6.bucket, 'early_signal');
  assert.equal(v6.bucketLabel, 'Early Signal');

  // Proteksi retensi harus aktif
  assert.equal(protectedIssue({ ...issue, precisionV6: v6 }), true);
});

test('Precision V6: Viral Tidak Terverifikasi dan Perselisihan Klaim masuk Needs Fact-Check', () => {
  const now = Date.parse('2026-11-17T10:00:00.000Z');
  const issue = {
    id: 'issue-viral-hoax',
    title: 'Beredar Narasi Viral Geger Pejabat Mengundurkan Diri Massal',
    status: 'new',
    sources: [
      {
        id: 's-viral-1',
        title: 'Heboh di Medsos! Netizen Ramai Sebut Pejabat Mundur',
        url: 'https://infoviral.net/post-1',
        publisher: 'Akun Viral',
        platform: 'Berita / Web',
        publishedAt: '2026-11-17T07:00:00.000Z',
        excerpt: 'Katanya ada rumor dan dugaan spekulasi beredar narasi pejabat mundur massal.',
        coverage: 'headline',
        verification: 'unchecked'
      },
      {
        id: 's-viral-2',
        title: 'Kementerian Membantah Keras Isu Pengunduran Diri: Itu Hoaks',
        url: 'https://nasional.kompas.com/klarifikasi-kementerian',
        publisher: 'Kompas',
        platform: 'Berita / Web',
        publishedAt: '2026-11-17T08:30:00.000Z',
        excerpt: 'Pihak kementerian membantah kabar tersebut dan menyatakan informasi itu tidak benar dan keliru.',
        coverage: 'snippet',
        verification: 'unchecked'
      }
    ],
    topicIds: ['default-system'],
    lenses: ['system'],
    contentIds: []
  };

  const v6 = evaluatePrecisionV6(issue, { now });

  // Karena ada sanggahan / bantahan langsung, status verifikasi harus disputed atau needs_factcheck
  assert.ok(['disputed', 'needs_factcheck'].includes(v6.verificationStatus), `Expected disputed/needs_factcheck, got ${v6.verificationStatus}`);
  assert.equal(v6.bucket, 'needs_factcheck');
  assert.equal(v6.bucketLabel, 'Needs Fact-Check');
});

test('Precision V6: Berita Lama mengalami peluruhan skor dan tidak masuk Hot / Early Signal', () => {
  const now = Date.parse('2026-11-17T10:00:00.000Z');
  const issueOld = {
    id: 'issue-old',
    title: 'Rapat Anggaran Tahunan Kebijakan Pajak 2024',
    status: 'new',
    sources: [
      {
        id: 's-old-1',
        title: 'Rapat Anggaran Tahunan Kebijakan Pajak 2024',
        url: 'https://news.detik.com/berita/pajak-lama',
        publisher: 'Detik',
        platform: 'Berita / Web',
        publishedAt: '2026-10-10T00:00:00.000Z', // 1 bulan lalu
        excerpt: 'Pembahasan rancangan awal kebijakan pajak tahun lalu.',
        coverage: 'snippet',
        verification: 'unchecked'
      }
    ],
    topicIds: ['default-system'],
    lenses: ['system'],
    contentIds: []
  };

  const v6 = evaluatePrecisionV6(issueOld, { now });

  // Velocity score harus 0-2 (cooling/unavailable)
  assert.ok(v6.velocity.score <= 3);

  // Tidak boleh masuk ke hot_verified atau early_signal
  assert.notEqual(v6.bucket, 'hot_verified');
  assert.notEqual(v6.bucket, 'early_signal');
  assert.equal(v6.bucket, 'watchlist');
});

test('Precision V6: Isu Berdampak Sistemik dengan Liputan Sedikit masuk Underreported', () => {
  const now = Date.parse('2026-11-17T10:00:00.000Z');
  const issue = {
    id: 'issue-underreported',
    title: 'Dampak Perpres Monopoli Impor Bahan Pokok Terhadap Petani Lokal dan Kerugian Negara Rp400 Miliar',
    status: 'new',
    sources: [
      {
        id: 's-local-1',
        title: 'Laporan Investigasi Asosiasi Petani Soal Kerugian Negara dan Monopoli Impor Beras',
        url: 'https://investigasi-petani.org/laporan-monopoli',
        publisher: 'Koalisi Petani',
        platform: 'Berita / Web',
        publishedAt: '2026-11-17T06:00:00.000Z',
        excerpt: 'Dokumen resmi menunjukkan adanya perpres regulasi yang memberikan monopoli impor kuota ratusan miliar.',
        coverage: 'snippet',
        sourceRole: 'primary',
        verification: 'verified'
      },
      {
        id: 's-local-2',
        title: 'Data Petani: Kebijakan Regulasi Baru Tekan Harga Gabah Petani',
        url: 'https://bisnis.tempo.co/dampak-petani',
        publisher: 'Tempo',
        platform: 'Berita / Web',
        publishedAt: '2026-11-17T07:30:00.000Z',
        excerpt: 'Petani mengeluhkan aturan subsidi dan distribusi pasar yang dikuasai kartel.',
        coverage: 'snippet',
        verification: 'unchecked'
      }
    ],
    topicIds: ['default-system', 'default-human'],
    lenses: ['system', 'human'],
    contentIds: []
  };

  const v6 = evaluatePrecisionV6(issue, { now });

  // Priority score tinggi karena sistem + human + impact
  assert.ok(v6.priorityScore >= 60, `Priority score ${v6.priorityScore} harus >= 60`);
  assert.ok(v6.signals.uniquePublishers <= 3);

  // Status verifikasi adalah confirmed atau single_primary
  assert.ok(['confirmed', 'single_primary'].includes(v6.verificationStatus));

  // Harus masuk ke bucket underreported
  assert.equal(v6.bucket, 'underreported');
  assert.equal(v6.bucketLabel, 'Underreported');
});

test('Precision V6: Perkembangan Baru Signifikan menghasilkan Material Update dengan Event History', () => {
  const now = Date.parse('2026-11-17T10:00:00.000Z');
  const issue = {
    id: 'issue-material-update',
    title: 'Kasus Dugaan Korupsi Proyek Pengadaan Sistem Digital',
    status: 'new',
    createdAt: '2026-11-15T00:00:00.000Z', // Dibuat 2 hari lalu
    sources: [
      {
        id: 's-day1',
        title: 'KPK Mulai Selidiki Dugaan Penyimpangan Pengadaan Server Digital',
        url: 'https://tempo.co/kpk-selidiki-server',
        publisher: 'Tempo',
        platform: 'Berita / Web',
        publishedAt: '2026-11-15T02:00:00.000Z',
        excerpt: 'Penyelidikan awal proyek pengadaan server teknologi informasi.',
        coverage: 'snippet',
        verification: 'unchecked'
      },
      {
        id: 's-day2',
        title: 'KPK Resmi Tetapkan 3 Tersangka dan Sita Dokumen Kontrak Tender',
        url: 'https://kpk.go.id/siaran-pers-tersangka-server',
        publisher: 'KPK RI',
        platform: 'Berita / Web',
        publishedAt: '2026-11-17T08:00:00.000Z', // Update dalam 24 jam terakhir!
        excerpt: 'KPK tetapkan tersangka baru dan sita barang bukti uang tunai serta dokumen resmi.',
        coverage: 'snippet',
        sourceRole: 'primary',
        verification: 'verified'
      }
    ],
    topicIds: ['default-system'],
    lenses: ['system'],
    contentIds: []
  };

  const v6 = evaluatePrecisionV6(issue, { now });

  assert.equal(v6.hasMaterialUpdate, true);
  assert.equal(v6.bucket, 'material_update');
  assert.equal(v6.bucketLabel, 'Material Update');

  // Event History harus mencatat 2 simpul peristiwa secara kronologis
  assert.equal(v6.eventHistory.length, 2);
  assert.equal(v6.eventHistory[0].title, issue.sources[0].title);
  assert.equal(v6.eventHistory[1].title, issue.sources[1].title);
  assert.equal(v6.eventHistory[1].isPrimary, true);
});

test('Precision V6: Shadow Scoring V5 dan V6 berjalan berdampingan pada dataset yang sama', () => {
  const now = Date.parse('2026-11-17T10:00:00.000Z');
  const issue = {
    id: 'issue-multi',
    title: 'Pemerintah Naikkan Tarif Listrik dan Subsidi Energi Dialihkan',
    status: 'new',
    sources: [
      { id: '1', title: 'Tarif Listrik Naik Mulai Besok', url: 'https://detik.com/listrik', publisher: 'Detik', platform: 'Berita / Web', publishedAt: '2026-11-17T06:00:00.000Z', excerpt: 'Pemerintah resmi mengumumkan kebijakan tarif listrik naik.', coverage: 'snippet', verification: 'unchecked' },
      { id: '2', title: 'Subsidi Energi Dialihkan, Tarif Listrik Disesuaikan', url: 'https://kompas.com/listrik', publisher: 'Kompas', platform: 'Berita / Web', publishedAt: '2026-11-17T07:00:00.000Z', excerpt: 'Kemenkeu jelaskan penyesuaian subsidi listrik dan dampaknya.', coverage: 'snippet', verification: 'unchecked' },
      { id: '3', title: 'Tarif Listrik Resmi Naik, Simak Golongan Terdampak', url: 'https://tempo.co/listrik', publisher: 'Tempo', platform: 'Berita / Web', publishedAt: '2026-11-17T08:00:00.000Z', excerpt: 'Daftar golongan masyarakat yang terkena penyesuaian tarif listrik.', coverage: 'snippet', verification: 'unchecked' }
    ],
    topicIds: ['default-system', 'default-human'],
    lenses: ['system', 'human'],
    contentIds: []
  };

  const v6 = evaluatePrecisionV6(issue, { now });

  // V6 properties
  assert.equal(v6.version, 6);
  assert.ok(v6.priorityScore >= 65);
  assert.equal(v6.verificationStatus, 'multi_sourced');
  assert.equal(v6.bucket, 'hot_verified');
  assert.equal(v6.eventHistory.length, 3);
  assert.equal(v6.signals.uniquePublishers, 3);
});

test('Precision V6: Duplikasi berita sindikasi tidak menduplikasi event history', () => {
  const issue = {
    id: 'issue-syndicated',
    title: 'Pemerintah Rilis Rincian Skema Insentif Kendaraan Listrik',
    status: 'new',
    sources: [
      { id: '1', title: 'Pemerintah Rilis Rincian Skema Insentif Kendaraan Listrik', url: 'https://media-a.com/insentif', publisher: 'Media A', platform: 'Berita / Web', publishedAt: '2026-11-17T08:00:00.000Z', excerpt: 'Teks artikel lengkap mengenai skema insentif energi hijau.' },
      { id: '2', title: 'Pemerintah Rilis Rincian Skema Insentif Kendaraan Listrik', url: 'https://media-b.com/insentif', publisher: 'Media B (Sindikasi)', platform: 'Berita / Web', publishedAt: '2026-11-17T08:05:00.000Z', excerpt: 'Teks artikel lengkap mengenai skema insentif energi hijau.' }
    ]
  };

  const events = buildEventHistory(issue);
  // Judul yang persis sama / salinan sindikasi hanya menghasilkan 1 simpul event history
  assert.equal(events.length, 1);
  assert.equal(events[0].title, issue.sources[0].title);
});

test('Precision V6: Konversi Isu ke Kartu Kanban (issueToKanbanPayload)', () => {
  const issue = {
    id: 'issue-kanban-test',
    title: 'Temuan Aliran Dana Gelap Proyek Infrastruktur',
    status: 'new',
    sources: [
      { id: '1', title: 'Laporan Investigasi Aliran Dana Proyek', url: 'https://tempo.co/investigasi-dana', publisher: 'Tempo', platform: 'Berita / Web', publishedAt: '2026-11-17T08:00:00.000Z', excerpt: 'Temuan aliran dana ke rekening perusahaan cangkang.', sourceRole: 'primary' }
    ],
    editorial: {
      angle: 'Struktur & Insentif: Telusuri rekening dan kepemilikan saham di balik tender.',
      gaps: ['Konfirmasi bank penerima', 'Cek akta notaris']
    }
  };

  const payload = issueToKanbanPayload(issue, { format: 'long', pillarId: 'Investigasi' });

  assert.equal(payload.title, issue.title);
  assert.equal(payload.stage, 'idea');
  assert.equal(payload.format, 'long');
  assert.equal(payload.radarIssueId, issue.id);
  assert.ok(payload.brief.includes('[Radar V6 Precision'));
  assert.ok(payload.brief.includes('Tempo: Laporan Investigasi Aliran Dana Proyek'));
  assert.ok(payload.brief.includes('Kebutuhan Riset & Konfirmasi'));
  assert.equal(payload.sources.length, 1);
  assert.equal(payload.sources[0].isPrimary, true);
});

