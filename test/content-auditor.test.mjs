import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateChannelBenchmarks,
  computeHealthScore,
  computeSystemDiagnostics,
  detectDropoffPoint,
  detectHookRetention,
  parseIsoDuration,
  estimateVideoDuration,
  interpolate,
  generateHeuristicAudit,
  auditVideo
} from '../content-auditor.mjs';

test('interpolate smoothly maps values without cliff jumps', () => {
  const points = [[10, 40], [20, 60], [30, 80], [40, 100]];
  assert.equal(interpolate(5, points), 40);
  assert.equal(interpolate(15, points), 50);
  assert.equal(interpolate(25, points), 70);
  assert.equal(interpolate(50, points), 100);
});

test('calculateChannelBenchmarks computes typical range and ranking', () => {
  const channelVideos = [
    { id: 'v1', views: 10000, averageViewDuration: 400, averageViewPercentage: 35 },
    { id: 'v2', views: 5000, averageViewDuration: 300, averageViewPercentage: 28 },
    { id: 'v3', views: 2000, averageViewDuration: 200, averageViewPercentage: 20 }
  ];
  const bench = calculateChannelBenchmarks(channelVideos, 'v1');
  assert.ok(bench);
  assert.equal(bench.rank, 1);
  assert.equal(bench.totalRanked, 3);
  assert.equal(bench.views.median, 5000);
  assert.ok(bench.rankText.includes('Peringkat #1'));
});

test('parseIsoDuration correctly extracts duration in seconds', () => {
  assert.equal(parseIsoDuration('PT14M32S'), 872);
  assert.equal(parseIsoDuration('PT1H2M10S'), 3730);
  assert.equal(parseIsoDuration('PT45S'), 45);
  assert.equal(parseIsoDuration(''), 0);
  assert.equal(parseIsoDuration(null), 0);
});

test('estimateVideoDuration uses ISO string or derives from AVD / APV', () => {
  const r1 = { video: { duration: 'PT10M' } };
  assert.equal(estimateVideoDuration(r1), 600);

  const r2 = { summary: { averageViewDuration: 300 }, averageViewPercentage: 50 };
  assert.equal(estimateVideoDuration(r2), 600);
});

test('detectHookRetention finds early retention ratio', () => {
  const retention = [
    { position: 0.0, watchRatio: 1.0 },
    { position: 0.08, watchRatio: 0.78 },
    { position: 0.20, watchRatio: 0.65 }
  ];
  const hook = detectHookRetention(retention);
  assert.ok(hook);
  assert.equal(hook.watchRatio, 78);
  assert.equal(hook.score, 'Kuat');
});

test('detectDropoffPoint calculates exact timestamp formatted', () => {
  const retention = [
    { position: 0.0, watchRatio: 1.0 },
    { position: 0.1, watchRatio: 0.95 },
    { position: 0.2, watchRatio: 0.90 },
    { position: 0.35, watchRatio: 0.65 }, // drop 0.25 at 35%
    { position: 0.4, watchRatio: 0.60 }
  ];
  const drop = detectDropoffPoint(retention, 1200);
  assert.ok(drop);
  assert.equal(drop.position, 0.35);
  assert.equal(drop.dropPercent, 25);
  assert.equal(drop.timestampFormatted, '7:00');
});

test('computeHealthScore adapts to channel peer benchmarks accurately', () => {
  const channelVideos = [
    { id: 'v1', views: 18000, averageViewDuration: 410, averageViewPercentage: 34.2 },
    { id: 'v2', views: 8000, averageViewDuration: 300, averageViewPercentage: 28 },
    { id: 'v3', views: 4000, averageViewDuration: 240, averageViewPercentage: 24 },
    { id: 'v4', views: 1500, averageViewDuration: 180, averageViewPercentage: 20 }
  ];
  const currentReport = {
    id: 'v1',
    video: { duration: 'PT20M00S' },
    summary: { views: 18000, watchHours: 2000, averageViewDuration: 410, likes: 600, comments: 80, shares: 50, subscribersGained: 120, subscribersLost: 10 },
    averageViewPercentage: 34.2,
    reach: { ctr: 6.2, impressions: 250000 }
  };
  const health = computeHealthScore(currentReport, { channelVideos });
  assert.ok(health.overall >= 80);
  assert.ok(['S', 'A'].includes(health.grade));
  assert.equal(health.channelBench.rank, 1);
  assert.ok(health.viewsStatus.includes('Di Atas Tipikal'));
});

test('computeSystemDiagnostics produces deterministic metrics without AI dependency', () => {
  const report = {
    id: 'test-12345',
    summary: { views: 10000, subscribersGained: 50, subscribersLost: 5 },
    reach: { ctr: 5.4, impressions: 120000 },
    retention: [
      { position: 0.0, watchRatio: 1.0 },
      { position: 0.08, watchRatio: 0.75 },
      { position: 0.40, watchRatio: 0.50 }
    ]
  };
  const health = computeHealthScore(report);
  const diag = computeSystemDiagnostics(report, health);
  assert.equal(diag.hook.score, 'Kuat');
  assert.equal(diag.hook.ratio, 75);
  assert.ok(diag.dropoff.point);
  assert.equal(diag.clickability.score, 'Tipikal');
  assert.equal(diag.conversion.score, 'Standar');
});

test('generateHeuristicAudit and auditVideo generate consistent schema where AI only narrates', async () => {
  const report = {
    id: 'video-abc',
    video: { title: 'UJI PERFORMA INVESTIGASI' },
    summary: { views: 5000, averageViewDuration: 300, subscribersGained: 20, subscribersLost: 2 },
    averageViewPercentage: 30.0,
    reach: { ctr: 5.0, impressions: 50000 },
    retention: [
      { position: 0.0, watchRatio: 1.0 },
      { position: 0.1, watchRatio: 0.72 }
    ]
  };
  const audit = await auditVideo(report, {
    fetcher: async () => { throw new Error('Simulated network error'); }
  });
  assert.ok(audit);
  assert.ok(audit.health.overall);
  assert.ok(audit.executiveSummary);
  assert.equal(audit.actionItems.length, 3);
  assert.equal(audit.sequelIdeas.length, 2);
  assert.ok(audit.systemDiagnostics);
});
