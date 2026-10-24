import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ContentStore } from '../content-store.mjs';
import { RadarStore } from '../radar-store.mjs';
import { RadarSocial, SOCIAL_PILLARS } from '../radar-social.mjs';

test('RadarSocial: report structure, curation synthesis, and toKanban conversion', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'radar-social-test-'));
  const content = new ContentStore(path.join(dir, 'contents.json'));
  const radar = new RadarStore(content);

  t.after(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  // Verify social pillars
  assert.equal(SOCIAL_PILLARS.length, 7);
  assert.ok(SOCIAL_PILLARS.includes('Politik'));
  assert.ok(SOCIAL_PILLARS.includes('Ekonomi'));
  assert.ok(SOCIAL_PILLARS.includes('Geopolitik'));
  assert.ok(SOCIAL_PILLARS.includes('Sisi Gelap'));
  assert.ok(SOCIAL_PILLARS.includes('Hukum'));
  assert.ok(SOCIAL_PILLARS.includes('Investigasi'));
  assert.ok(SOCIAL_PILLARS.includes('Kebijakan'));

  // Mock fetcher for raw trends
  const mockFetcher = async url => {
    if (url.includes('trends.google.com')) {
      return {
        ok: true,
        text: async () => `<?xml version="1.0"?><rss><channel><item><title>Tren Pencarian Isu Pajak</title><link>https://trends.example/1</link><pubDate>Wed, 21 Oct 2026 10:00:00 GMT</pubDate></item></channel></rss>`
      };
    }
    if (url.includes('news.google.com')) {
      return {
        ok: true,
        text: async () => `<?xml version="1.0"?><rss><channel><item><title>Viral di X Dugaan Aliran Dana Siluman ke Rekening Pejabat</title><link>https://news.example/2</link><pubDate>Thu, 22 Oct 2026 12:00:00 GMT</pubDate></item></channel></rss>`
      };
    }
    return { ok: false, status: 404 };
  };

  const radarSocial = new RadarSocial(radar, null, {
    fetcher: mockFetcher,
    now: () => Date.parse('2026-10-25T03:00:00Z')
  });

  // 1. Initial report state
  const initial = await radarSocial.getReport();
  assert.equal(initial.lastScanAt, null);
  assert.equal(initial.items.length, 0);
  assert.equal(initial.isScanning, false);
  assert.equal(initial.pillars.length, 7);

  // 2. Synthesize with mocked AI response
  const mockSignals = [
    { title: 'Viral di X Skandal Pajak dan Aliran Dana Fiktif', publisher: 'Media Nasional', platformHint: 'X / Twitter', url: 'https://news.example/1' }
  ];

  const mockAiFetcher = async () => ({
    ok: true,
    json: async () => ({
      candidates: [{
        content: {
          parts: [{
            text: JSON.stringify([
              {
                id: "1",
                title: "Skandal Aliran Dana Pajak: Siapa Pejabat di Balik Akun Siluman?",
                platform: "X / Twitter",
                pillar: "Kebijakan",
                viralityScore: 5,
                netizenSummary: "Netizen membongkar pola aliran dana mencurigakan yang diduga melibatkan oknum kementerian.",
                recommendedAngle: "Telusuri laporan audit BPK dan bandingkan dengan data kepemilikan aset perusahaan cangkang.",
                suggestedHook: "Di balik potongan pajak yang mencekik rakyat, triliunan rupiahnya diduga mengalir ke rekening siluman.",
                sourceUrl: "https://news.example/1"
              },
              {
                id: "2",
                title: "Bisnis Tambang Pasir Laut: Jeratan Oligarki dan Dampak Nelayan",
                platform: "Forum Publik",
                pillar: "Sisi Gelap",
                viralityScore: 5,
                netizenSummary: "Protes keras atas diterbitkannya izin ekspor baru yang merusak ekosistem.",
                recommendedAngle: "Audit daftar konsorsium pemenang izin dan relasi kedekatan dengan elite politik.",
                suggestedHook: "Pasir laut kita dikeruk demi dalih devisa, tapi pundi-pundinya hanya dinikmati segelintir elite.",
                sourceUrl: "https://news.example/2"
              },
              {
                id: "3",
                title: "Dilema PPN 12 Persen dan Ketimpangan Tax Holiday Korporasi",
                platform: "X / Twitter",
                pillar: "Ekonomi",
                viralityScore: 4,
                netizenSummary: "Kemarahan publik atas rencana kenaikan tarif pajak di tengah badai PHK massal.",
                recommendedAngle: "Hitung kontras penerimaan pajak UMKM versus insentif bebas pajak korporasi besar.",
                suggestedHook: "Saat UMKM diperas demi target penerimaan negara, konglomerat justru mendapatkan karpet merah tax holiday.",
                sourceUrl: "https://news.example/3"
              },
              {
                id: "4",
                title: "Fenomena No Viral No Justice: Ketika Keadilan Tergantung Algoritma",
                platform: "TikTok",
                pillar: "Hukum",
                viralityScore: 4,
                netizenSummary: "Kritik keras atas lambatnya proses penegakan hukum kecuali sudah meledak di media sosial.",
                recommendedAngle: "Bongkar beban biaya dan trauma korban sebelum laporannya digubris aparat.",
                suggestedHook: "Jika kasus Anda tidak viral di media sosial, apakah hukum di negeri ini akan tetap bekerja?",
                sourceUrl: "https://news.example/4"
              },
              {
                id: "5",
                title: "Ketegangan Geopolitik Laut Natuna: Anggaran Pertahanan vs Kedaulatan Riil",
                platform: "X / Twitter",
                pillar: "Geopolitik",
                viralityScore: 4,
                netizenSummary: "Sorotan atas intrusi kapal asing di Natuna dan efektivitas pengadaan alutsista bernilai puluhan triliun.",
                recommendedAngle: "Lacak transparansi pengadaan alutsista dan kesiapan armada patroli penjaga laut.",
                suggestedHook: "Puluhan triliun anggaran pertahanan telah dibelanjakan, tapi mengapa perairan Natuna masih bebas dimasuki kapal asing?",
                sourceUrl: "https://news.example/5"
              }
            ])
          }]
        }
      }]
    })
  });

  process.env.GEMINI_API_KEY = 'mock-key';
  const radarSocialWithAi = new RadarSocial(radar, null, {
    fetcher: mockAiFetcher,
    now: () => Date.parse('2026-10-25T03:00:00Z')
  });

  const top5 = await radarSocialWithAi.synthesizeTop5(mockSignals);
  assert.equal(top5.length, 5);
  assert.equal(top5[0].pillar, 'Kebijakan');
  assert.equal(top5[0].platform, 'X / Twitter');
  assert.equal(top5[0].viralityScore, 5);
  assert.ok(top5[0].suggestedHook.length > 10);

  // 3. Scan & Save into Radar Store
  process.env.GEMINI_API_KEY = 'mock-key';
  radarSocialWithAi.fetchRawTrends = async () => mockSignals;
  const scanResult = await radarSocialWithAi.scan({ force: true });
  assert.equal(scanResult.ok, true);
  assert.equal(scanResult.items.length, 5);

  const updatedReport = await radarSocialWithAi.getReport();
  assert.equal(updatedReport.items.length, 5);
  assert.equal(updatedReport.status, 'ready');
  assert.equal(updatedReport.lastScanAt, '2026-10-25T03:00:00.000Z');

  // 4. Coverage in radarStore.read() should now show X & TikTok as 'Dipantau'
  const radarData = await radar.read();
  assert.equal(radarData.coverage.X, 'Dipantau');
  assert.equal(radarData.coverage.TikTok, 'Dipantau');

  // 5. Convert to Kanban Card
  const kanbanResult = await radarSocialWithAi.toKanban('1');
  assert.equal(kanbanResult.ok, true);
  assert.ok(kanbanResult.content.id);
  assert.equal(kanbanResult.content.stage, 'idea');
  assert.match(kanbanResult.content.title, /Skandal Aliran Dana Pajak/);
  assert.match(kanbanResult.content.brief, /Radar Intelijen Sosmed/);
  assert.match(kanbanResult.content.brief, /Kebijakan/);
  assert.match(kanbanResult.content.hook, /Di balik potongan pajak/);

  // Verify it exists in contentStore
  const allContents = await content.read();
  assert.equal(allContents.contents.length, 1);
  assert.equal(allContents.contents[0].id, kanbanResult.content.id);
});
