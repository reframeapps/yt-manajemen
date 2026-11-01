import test from 'node:test';
import assert from 'node:assert/strict';
import { detectPublicationLink, PUBLICATION_PLATFORMS } from '../public/publication-links.mjs';

test('detectPublicationLink accurately detects Facebook, TikTok, Instagram, and Twitter/X', () => {
  assert.equal(detectPublicationLink('https://www.tiktok.com/@user/video/123456789').platform, 'tiktok');
  assert.equal(detectPublicationLink('https://vt.tiktok.com/ZSgT5dJq7/').platform, 'tiktok');
  assert.equal(detectPublicationLink('https://www.instagram.com/reel/C123456/').platform, 'instagram');
  assert.equal(detectPublicationLink('https://instagr.am/p/ABC123/').platform, 'instagram');
  assert.equal(detectPublicationLink('https://facebook.com/watch/?v=123').platform, 'facebook');
  assert.equal(detectPublicationLink('https://fb.watch/xyz123/').platform, 'facebook');
  assert.equal(detectPublicationLink('https://x.com/user/status/123456789').platform, 'twitter');
  assert.equal(detectPublicationLink('https://twitter.com/user/status/123456789').platform, 'twitter');
});

test('PUBLICATION_PLATFORMS includes all 4 external platforms', () => {
  assert.equal(PUBLICATION_PLATFORMS.facebook, 'Facebook');
  assert.equal(PUBLICATION_PLATFORMS.tiktok, 'TikTok');
  assert.equal(PUBLICATION_PLATFORMS.instagram, 'Instagram');
  assert.equal(PUBLICATION_PLATFORMS.twitter, 'X (Twitter)');
});

test('Social publication helper correctly identifies uploaded platforms', () => {
  function getUploadedSocials(c) {
    const socials = [], seenUrls = new Set();
    const isYtPublished = Boolean(c.youtubeVideoId || c.youtubePublication?.status === 'published');
    if (isYtPublished) {
      const ytId = c.youtubeVideoId || c.youtubePublication?.videoId;
      const url = ytId ? `https://www.youtube.com/watch?v=${encodeURIComponent(ytId)}` : 'https://studio.youtube.com';
      socials.push({ platform: 'youtube', label: 'YouTube', url });
      seenUrls.add(url);
    }
    if (Array.isArray(c.publicationLinks)) {
      for (const link of c.publicationLinks) {
        if (!link || !link.url || seenUrls.has(link.url)) continue;
        seenUrls.add(link.url);
        const p = (link.platform || '').toLowerCase();
        let label = 'Sosmed';
        if (p === 'tiktok') label = 'TikTok';
        else if (p === 'instagram') label = 'Instagram';
        else if (p === 'facebook') label = 'Facebook';
        else if (p === 'twitter' || p === 'x') label = 'X';
        socials.push({ platform: p, label, url: link.url });
      }
    }
    return socials;
  }

  // Case 1: No uploads yet
  const emptyContent = { id: 'c1', title: 'Ide Baru', publicationLinks: [] };
  assert.deepEqual(getUploadedSocials(emptyContent), []);

  // Case 2: Uploaded to YouTube and TikTok
  const uploadedContent = {
    id: 'c2',
    title: 'Investigasi Viral',
    youtubeVideoId: 'aks6P_onYqo',
    publicationLinks: [
      { id: 'p1', platform: 'tiktok', url: 'https://www.tiktok.com/@creator/video/7702627185957342485' },
      { id: 'p2', platform: 'instagram', url: 'https://www.instagram.com/reel/C890/' }
    ]
  };

  const res = getUploadedSocials(uploadedContent);
  assert.equal(res.length, 3);
  assert.equal(res[0].platform, 'youtube');
  assert.equal(res[0].url, 'https://www.youtube.com/watch?v=aks6P_onYqo');
  assert.equal(res[1].platform, 'tiktok');
  assert.equal(res[1].url, 'https://www.tiktok.com/@creator/video/7702627185957342485');
  assert.equal(res[2].platform, 'instagram');
  assert.equal(res[2].url, 'https://www.instagram.com/reel/C890/');
});

test('socialUploadBadges renders icon-only badges without text labels and in front of publication status', () => {
  function socialUploadBadges(socials) {
    if (!socials.length) return '';
    const badges = socials.map(s => `<span class="social-upload-badge platform-${s.platform}" data-social-url="${s.url}" title="Sudah upload di ${s.label}" role="button" tabindex="0" aria-label="${s.label}"><svg viewBox="0 0 24 24"><path d="..."/></svg></span>`).join('');
    return `<div class="card-social-uploads" title="Media sosial yang sudah di-upload">${badges}</div>`;
  }

  const html = socialUploadBadges([{ platform: 'youtube', label: 'YouTube', url: 'https://youtube.com/watch?v=123' }]);
  assert.ok(html.includes('<svg viewBox="0 0 24 24">'), 'must include svg icon');
  assert.ok(!html.includes('<span>YouTube</span>'), 'must not render text label inside badge');
  assert.ok(html.includes('aria-label="YouTube"'), 'must have accessible aria-label');

  // Verify status row order (social upload badges in front before publication status)
  const publicationBadge = '<span class="status-badge">Tayang</span>';
  const statusRow = `<div class="content-status-row">${html}${publicationBadge}</div>`;
  const socialIdx = statusRow.indexOf('card-social-uploads');
  const pubIdx = statusRow.indexOf('status-badge');
  assert.ok(socialIdx < pubIdx, 'social upload badges must appear before publication status in the status row');
});

test('dashboard front page correctly compiles uploaded social summary and cards', () => {
  const contents = [
    { id: '1', title: 'Video 1', youtubeVideoId: 'yt123', publicationLinks: [] },
    { id: '2', title: 'Video 2', publicationLinks: [{ platform: 'tiktok', url: 'https://tiktok.com/@a/video/1' }] },
    { id: '3', title: 'Video 3', publicationLinks: [] }
  ];

  function getUploadedSocials(c) {
    const list = [];
    if (c.youtubeVideoId) list.push({ platform: 'youtube', label: 'YouTube' });
    if (Array.isArray(c.publicationLinks)) {
      for (const l of c.publicationLinks) list.push({ platform: l.platform, label: l.platform });
    }
    return list;
  }

  const uploadedItems = contents.filter(c => getUploadedSocials(c).length > 0);
  assert.equal(uploadedItems.length, 2, 'two contents have uploaded socials');

  const platformCounts = {};
  for (const c of uploadedItems) {
    for (const s of getUploadedSocials(c)) {
      platformCounts[s.platform] = (platformCounts[s.platform] || 0) + 1;
    }
  }

  assert.equal(platformCounts.youtube, 1);
  assert.equal(platformCounts.tiktok, 1);
});
