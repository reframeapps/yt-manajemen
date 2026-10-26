import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeHealthScore, detectDropoffPoint, generateHeuristicAudit, auditVideo } from '../content-auditor.mjs';

test('computeHealthScore handles empty, average and high-performing reports', () => {
  const emptyReport = {};
  const emptyHealth = computeHealthScore(emptyReport);
  assert.equal(typeof emptyHealth.overall, 'number');
  assert.ok(['S', 'A', 'B+', 'B', 'C', 'D'].includes(emptyHealth.grade));

  const highReport = {
    summary: { views: 25000, watchHours: 1200, averageViewDuration: 300, likes: 1500, comments: 200, shares: 100, subscribersGained: 300 },
    averageViewPercentage: 58.5,
    reach: { ctr: 8.4, impressions: 200000 }
  };
  const highHealth = computeHealthScore(highReport);
  assert.ok(highHealth.overall >= 80);
  assert.ok(['S', 'A'].includes(highHealth.grade));
});

test('detectDropoffPoint locates biggest retention drop', () => {
  const retention = [
    { position: 0.0, watchRatio: 1.0 },
    { position: 0.1, watchRatio: 0.95 },
    { position: 0.2, watchRatio: 0.90 },
    { position: 0.3, watchRatio: 0.65 }, // drop 0.25
    { position: 0.4, watchRatio: 0.60 }
  ];
  const drop = detectDropoffPoint(retention);
  assert.ok(drop);
  assert.equal(drop.position, 0.3);
  assert.equal(drop.dropPercent, 25);
});

test('generateHeuristicAudit produces complete audit schema without error', () => {
  const report = {
    id: 'test-12345',
    video: { title: 'KASUS ANGGARAN SILUMAN RP50 TRILIUN', lifetime: { views: 15000 } },
    summary: { views: 12000, subscribersGained: 80 },
    averageViewPercentage: 42.0,
    reach: { ctr: 6.5 },
    retention: [
      { position: 0.0, watchRatio: 1.0 },
      { position: 0.5, watchRatio: 0.4 }
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
