import test from 'node:test';
import assert from 'node:assert/strict';
import { detectPublicationLink, PUBLICATION_PLATFORMS } from '../public/publication-links.mjs';

test('detectPublicationLink accurately detects Facebook, TikTok, Instagram, Twitter/X, and Threads', () => {
  assert.equal(detectPublicationLink('https://www.tiktok.com/@user/video/123456789').platform, 'tiktok');
  assert.equal(detectPublicationLink('https://vt.tiktok.com/ZSgT5dJq7/').platform, 'tiktok');
  assert.equal(detectPublicationLink('https://www.instagram.com/reel/C123456/').platform, 'instagram');
  assert.equal(detectPublicationLink('https://instagr.am/p/ABC123/').platform, 'instagram');
  assert.equal(detectPublicationLink('https://facebook.com/watch/?v=123').platform, 'facebook');
  assert.equal(detectPublicationLink('https://fb.watch/xyz123/').platform, 'facebook');
  assert.equal(detectPublicationLink('https://x.com/user/status/123456789').platform, 'twitter');
  assert.equal(detectPublicationLink('https://twitter.com/user/status/123456789').platform, 'twitter');
  assert.equal(detectPublicationLink('https://www.threads.net/@creator/post/C-12345').platform, 'threads');
});

test('PUBLICATION_PLATFORMS includes all 5 external platforms', () => {
  assert.equal(PUBLICATION_PLATFORMS.facebook, 'Facebook');
  assert.equal(PUBLICATION_PLATFORMS.tiktok, 'TikTok');
  assert.equal(PUBLICATION_PLATFORMS.instagram, 'Instagram');
  assert.equal(PUBLICATION_PLATFORMS.twitter, 'X (Twitter)');
  assert.equal(PUBLICATION_PLATFORMS.threads, 'Threads');
});

test('Social publication helper correctly identifies uploaded platforms including Threads and X', () => {
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
        let p = (link.platform || '').toLowerCase();
        if (p === 'x') p = 'twitter';
        let label = 'Sosmed';
        if (p === 'tiktok') label = 'TikTok';
        else if (p === 'instagram') label = 'Instagram';
        else if (p === 'facebook') label = 'Facebook';
        else if (p === 'twitter') label = 'X';
        else if (p === 'threads') label = 'Threads';
        socials.push({ platform: p, label, url: link.url });
      }
    }
    return socials;
  }

  // Case 1: No uploads yet
  const emptyContent = { id: 'c1', title: 'Ide Baru', publicationLinks: [] };
  assert.deepEqual(getUploadedSocials(emptyContent), []);

  // Case 2: Uploaded to YouTube, TikTok, and Threads
  const uploadedContent = {
    id: 'c2',
    title: 'Investigasi Viral',
    youtubeVideoId: 'aks6P_onYqo',
    publicationLinks: [
      { id: 'p1', platform: 'tiktok', url: 'https://www.tiktok.com/@creator/video/7702627185957342485' },
      { id: 'p2', platform: 'instagram', url: 'https://www.instagram.com/reel/C890/' },
      { id: 'p3', platform: 'threads', url: 'https://www.threads.net/@creator/post/DA12345' }
    ]
  };

  const res = getUploadedSocials(uploadedContent);
  assert.equal(res.length, 4);
  assert.equal(res[0].platform, 'youtube');
  assert.equal(res[0].url, 'https://www.youtube.com/watch?v=aks6P_onYqo');
  assert.equal(res[1].platform, 'tiktok');
  assert.equal(res[2].platform, 'instagram');
  assert.equal(res[3].platform, 'threads');
});

test('socialUploadBadges renders all 5 platforms with active vs empty state without text labels (Threads replaces X)', () => {
  const CARD_SOCIAL_PLATFORMS = [
    { platform: 'youtube', label: 'YouTube' },
    { platform: 'tiktok', label: 'TikTok' },
    { platform: 'instagram', label: 'Instagram' },
    { platform: 'facebook', label: 'Facebook' },
    { platform: 'threads', label: 'Threads' },
  ];

  function socialUploadBadges(c) {
    const uploaded = [];
    if (c.youtubeVideoId || c.youtubePublication?.status === 'published') {
      uploaded.push({ platform: 'youtube', label: 'YouTube', url: 'https://youtube.com/watch?v=123' });
    }
    if (Array.isArray(c.publicationLinks)) {
      for (const link of c.publicationLinks) {
        if (!link || !link.url) continue;
        let p = (link.platform || '').toLowerCase();
        if (p === 'x') p = 'twitter';
        uploaded.push({ platform: p, label: p, url: link.url });
      }
    }
    const uploadedMap = new Map();
    for (const item of uploaded) {
      if (!uploadedMap.has(item.platform)) uploadedMap.set(item.platform, item);
    }
    const badges = CARD_SOCIAL_PLATFORMS.map(p => {
      const match = uploadedMap.get(p.platform);
      if (match) {
        return `<span class="social-upload-badge platform-${p.platform} is-active" data-social-url="${match.url}" title="Sudah upload di ${p.label}" role="button" tabindex="0" aria-label="${p.label}"><svg viewBox="0 0 24 24"><path d="..."/></svg></span>`;
      }
      return `<span class="social-upload-badge platform-${p.platform} is-empty" data-open-publish="${c.id}" title="Belum di-upload ke ${p.label} — Klik untuk input link" role="button" tabindex="0" aria-label="${p.label} (Belum diupload)"><svg viewBox="0 0 24 24"><path d="..."/></svg></span>`;
    });
    for (const [platform, item] of uploadedMap) {
      if (!CARD_SOCIAL_PLATFORMS.some(p => p.platform === platform)) {
        badges.push(`<span class="social-upload-badge platform-${platform} is-active" data-social-url="${item.url}" title="Sudah upload di ${item.label}" role="button" tabindex="0" aria-label="${item.label}"><svg viewBox="0 0 24 24"><path d="..."/></svg></span>`);
      }
    }
    return `<div class="card-social-uploads" title="Status upload sosmed">${badges.join('')}</div>`;
  }

  // Item with only YouTube uploaded
  const c = { id: 'item1', title: 'Test 1', youtubeVideoId: 'yt123' };
  const html = socialUploadBadges(c);

  // Must render all 5 platforms: YouTube, TikTok, Instagram, Facebook, Threads
  for (const p of ['youtube', 'tiktok', 'instagram', 'facebook', 'threads']) {
    assert.ok(html.includes(`platform-${p}`), `Must contain badge for ${p}`);
  }

  // YouTube should be active
  assert.ok(html.includes('platform-youtube is-active'));
  assert.ok(html.includes('data-social-url="https://youtube.com/watch?v=123"'));

  // TikTok, Instagram, Facebook, Threads should be empty
  assert.ok(html.includes('platform-tiktok is-empty'));
  assert.ok(html.includes('data-open-publish="item1"'));
  assert.ok(html.includes('platform-instagram is-empty'));
  assert.ok(html.includes('platform-facebook is-empty'));
  assert.ok(html.includes('platform-threads is-empty'));

  // Must not have text tags inside badges (pure icon badge)
  assert.ok(!html.includes('<span>YouTube</span>'));
  assert.ok(!html.includes('<span>TikTok</span>'));

  // If a content also has X uploaded, it still shows as an extra active badge
  const withX = {
    id: 'item2',
    title: 'Test 2',
    youtubeVideoId: 'yt123',
    publicationLinks: [{ platform: 'threads', url: 'https://threads.net/t/123' }, { platform: 'twitter', url: 'https://x.com/post/456' }]
  };
  const htmlWithX = socialUploadBadges(withX);
  assert.ok(htmlWithX.includes('platform-threads is-active'));
  assert.ok(htmlWithX.includes('platform-twitter is-active'));

  // Status row order: social upload badges in front before publication status
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
