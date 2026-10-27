import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeHealthScore,
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
  assert.equal(hook.score, 'Sangat Kuat');
});

test('detectDropoffPoint calculates exact timestamp formatted', () => {
  const retention = [
    { position: 0.0, watchRatio: 1.0 },
    { position: 0.1, watchRatio: 0.95 },
    { position: 0.2, watchRatio: 0.90 },
    { position: 0.35, watchRatio: 0.65 }, // drop 0.25 at 35%
    { position: 0.4, watchRatio: 0.60 }
  ];
  // 35% of 1200 seconds (20 mins) = 420 seconds = 07:00
  const drop = detectDropoffPoint(retention, 1200);
  assert.ok(drop);
  assert.equal(drop.position, 0.35);
  assert.equal(drop.dropPercent, 25);
  assert.equal(drop.timestampFormatted, '7:00');
});

test('computeHealthScore adapts fairly to long-form investigative content vs small samples', () => {
  // Long-form video (20 mins) with 34% APV has 6.8 mins AVD -> should get top grade
  const longReport = {
    video: { duration: 'PT20M00S' },
    summary: { views: 18000, watchHours: 2000, averageViewDuration: 410, likes: 600, comments: 80, shares: 50, subscribersGained: 120, subscribersLost: 10 },
    averageViewPercentage: 34.2,
    reach: { ctr: 6.2, impressions: 250000 }
  };
  const longHealth = computeHealthScore(longReport);
  assert.ok(longHealth.overall >= 80);
  assert.ok(['S', 'A'].includes(longHealth.grade));
  assert.equal(longHealth.format, 'long');
  assert.equal(longHealth.sampleConfidence, 1.0);

  // Small sample (30 views) should have tempered confidence, not jumping to S tier
  const tinyReport = {
    video: { duration: 'PT10M00S' },
    summary: { views: 30, averageViewDuration: 250, likes: 3, comments: 1, shares: 0, subscribersGained: 1, subscribersLost: 0 },
    averageViewPercentage: 41.0,
    reach: { ctr: 8.0, impressions: 300 }
  };
  const tinyHealth = computeHealthScore(tinyReport);
  assert.ok(tinyHealth.sampleConfidence < 0.8);
  assert.ok(tinyHealth.confidenceLabel.includes('Akumulasi Awal'));
});

test('generateHeuristicAudit produces complete audit schema with timestamped drop and hook', () => {
  const report = {
    id: 'test-12345',
    video: { title: 'KASUS ANGGARAN SILUMAN RP50 TRILIUN', duration: 'PT15M00S', lifetime: { views: 15000 } },
    summary: { views: 12000, averageViewDuration: 360, subscribersGained: 80, subscribersLost: 5 },
    averageViewPercentage: 40.0,
    reach: { ctr: 6.5, impressions: 150000 },
    retention: [
      { position: 0.0, watchRatio: 1.0 },
      { position: 0.08, watchRatio: 0.82 },
      { position: 0.40, watchRatio: 0.55 }
    ],
    searchTerms: [{ key: 'anggaran siluman' }]
  };
  const health = computeHealthScore(report);
  const audit = generateHeuristicAudit(report, health);

  assert.equal(audit.source, 'heuristic');
  assert.ok(audit.executiveSummary.length > 20);
  assert.ok(audit.hookDiagnosis.score);
  assert.ok(audit.dropoffDiagnosis.recommendation);
  assert.ok(audit.clickabilityDiagnosis.score);
  assert.ok(audit.conversionDiagnosis.score);
  assert.equal(audit.actionItems.length, 3);
  assert.equal(audit.sequelIdeas.length, 2);
});

test('auditVideo falls back cleanly when AI is absent or fails', async () => {
  const report = {
    id: 'video-abc',
    video: { title: 'UJI PERFORMA' },
    summary: { views: 500 }
  };
  const audit = await auditVideo(report, {
    fetcher: async () => { throw new Error('API simulated error'); }
  });
  assert.ok(audit);
  assert.ok(audit.executiveSummary);
  assert.ok(audit.health.grade);
});
