import crypto from 'node:crypto';
import { YoutubeTranscript, YoutubeTranscriptError } from 'youtube-transcript';

export const PILLARS_MAP = {
  'Investigasi': 'investigasi',
  'Politik': 'politik',
  'Ekonomi': 'ekonomi',
  'Geopolitik': 'geopolitik',
  'Sisi Gelap': 'sisi-gelap',
  'Hukum': 'hukum',
  'Kebijakan': 'kebijakan'
};

export function formatTimestamp(ms) {
  const totalSeconds = Math.max(0, Math.floor((ms || 0) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function extractVideoId(input) {
  if (typeof input !== 'string' || !input.trim()) {
    throw Object.assign(new Error('ID atau URL video YouTube wajib diisi.'), { status: 400 });
  }
  const clean = input.trim();
  if (/^[\w-]{11}$/.test(clean)) return clean;
  const match = clean.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([\w-]{11})/i);
  if (match && match[1]) return match[1];
  throw Object.assign(new Error('Format ID atau URL video YouTube tidak valid.'), { status: 400 });
}

export function detectMediaPlatform(input) {
  if (typeof input !== 'string' || !input.trim()) {
    throw Object.assign(new Error('ID atau URL video sosial media wajib diisi.'), { status: 400 });
  }
  const clean = input.trim();
  if (/^[\w-]{11}$/.test(clean)) return { platform: 'youtube', id: clean, url: `https://www.youtube.com/watch?v=${clean}` };
  const ytMatch = clean.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts|live)\/|.*[?&]v=)|youtu\.be\/)([\w-]{11})/i);
  if (ytMatch && ytMatch[1]) return { platform: 'youtube', id: ytMatch[1], url: clean };

  if (/tiktok\.com/i.test(clean)) return { platform: 'tiktok', url: clean };
  if (/instagram\.com|instagr\.am/i.test(clean)) return { platform: 'instagram', url: clean };
  if (/facebook\.com|fb\.com|fb\.watch/i.test(clean)) return { platform: 'facebook', url: clean };
  if (/threads\.(?:net|com)/i.test(clean)) return { platform: 'threads', url: clean };
  if (/twitter\.com|x\.com/i.test(clean)) return { platform: 'twitter', url: clean };
  if (/^https?:\/\//i.test(clean)) return { platform: 'web', url: clean };

  throw Object.assign(new Error('Format link video tidak dikenali. Masukkan link YouTube, TikTok, Instagram, Threads, Facebook, atau X (Twitter).'), { status: 400 });
}

export function parseWebVtt(vtt) {
  const segments = [];
  const lines = (vtt || '').split(/\r?\n/);
  let currentTime = 0;
  let currentText = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const timeMatch = line.match(/^(\d{2}:)?(\d{2}):(\d{2})\.(\d{3})\s*-->\s*(\d{2}:)?(\d{2}):(\d{2})\.(\d{3})/);
    if (timeMatch) {
      if (currentText.trim()) {
        segments.push({
          text: currentText.trim(),
          offset: currentTime,
          duration: 3000,
          timestamp: formatTimestamp(currentTime)
        });
        currentText = '';
      }
      const h = Number(timeMatch[1]?.replace(':', '') || 0);
      const m = Number(timeMatch[2]);
      const s = Number(timeMatch[3]);
      const ms = Number(timeMatch[4]);
      currentTime = (h * 3600 + m * 60 + s) * 1000 + ms;
    } else if (line && !line.startsWith('WEBVTT') && !line.startsWith('NOTE') && !/^\d+$/.test(line)) {
      currentText += ' ' + line;
    }
  }
  if (currentText.trim()) {
    segments.push({
      text: currentText.trim(),
      offset: currentTime,
      duration: 3000,
      timestamp: formatTimestamp(currentTime)
    });
  }
  return segments;
}

export function parseCustomTranscriptText(rawInput, { title = '', channelName = '', platform = 'Sosmed', durationFormatted = '' } = {}) {
  if (typeof rawInput !== 'string' || !rawInput.trim()) {
    throw Object.assign(new Error('Teks transkrip wajib diisi.'), { status: 400 });
  }

  const lines = rawInput.split('\n').map(l => l.trim()).filter(Boolean);
  const segments = [];
  let currentTimeMs = 0;

  for (const line of lines) {
    const timeMatch = line.match(/^(?:\[|\()?(\d{1,2}:(?:\d{2}:)?\d{2})(?:\]|\))?[\s:-]*(.*)$/);
    if (timeMatch) {
      const timeStr = timeMatch[1];
      const text = timeMatch[2].trim();
      const parts = timeStr.split(':').map(Number);
      let sec = 0;
      if (parts.length === 3) sec = parts[0] * 3600 + parts[1] * 60 + parts[2];
      else sec = parts[0] * 60 + parts[1];
      currentTimeMs = sec * 1000;
      if (text) {
        segments.push({
          text,
          offset: currentTimeMs,
          duration: 3500,
          timestamp: formatTimestamp(currentTimeMs)
        });
      }
    } else {
      segments.push({
        text: line,
        offset: currentTimeMs,
        duration: 3500,
        timestamp: formatTimestamp(currentTimeMs)
      });
      currentTimeMs += 4000;
    }
  }

  const fullText = segments.map(s => s.text).join('\n\n');
  const timedText = segments.map(s => `[${s.timestamp}] ${s.text}`).join('\n\n');
  const words = fullText.split(/\s+/).filter(Boolean);
  const durationSec = Math.max(15, Math.round(currentTimeMs / 1000));

  return {
    videoId: 'custom-' + crypto.randomUUID().slice(0, 8),
    url: '',
    title: title || 'Transkrip Video Sosmed',
    channelName: channelName || 'Kreator Sosmed',
    thumbnailUrl: '',
    language: 'id',
    wordCount: words.length,
    durationSec,
    durationFormatted: durationFormatted || formatTimestamp(durationSec * 1000),
    segmentCount: segments.length,
    segments,
    paragraphs: segments.map(s => ({ timestamp: s.timestamp, text: s.text })),
    fullText,
    timedText,
    platform: platform || 'Sosmed'
  };
}

export async function fetchVideoMetadata(videoId, fetcher = fetch) {
  try {
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
    const res = await fetcher(oembedUrl, { signal: AbortSignal.timeout(8000) });
    if (res.ok) {
      const data = await res.json();
      return {
        title: data.title || '',
        author_name: data.author_name || '',
        author_url: data.author_url || '',
        thumbnail_url: data.thumbnail_url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
      };
    }
  } catch {}
  return {
    title: '',
    author_name: '',
    author_url: '',
    thumbnail_url: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
  };
}

export async function extractYouTubeTranscript(videoIdOrUrl, { lang = 'id', fetcher = fetch } = {}) {
  const videoId = extractVideoId(videoIdOrUrl);
  let rawSegments = [];
  let detectedLang = lang;

  try {
    // Attempt 1: Try requested language (default 'id')
    rawSegments = await YoutubeTranscript.fetchTranscript(videoId, { lang, fetch: fetcher });
  } catch (err1) {
    // Attempt 2: If failed with specific language, retry without language constraint (take whatever is available)
    try {
      rawSegments = await YoutubeTranscript.fetchTranscript(videoId, { fetch: fetcher });
      if (rawSegments?.[0]?.lang) {
        detectedLang = rawSegments[0].lang;
      }
    } catch (err2) {
      const msg = err2.message || err1.message || 'Transkrip tidak tersedia untuk video ini.';
      throw Object.assign(new Error(`Gagal mengekstrak transkrip YouTube: ${msg.replace(/^\[YoutubeTranscript\]\s*🚨?\s*/, '')}`), {
        status: 422,
        code: 'transcript_unavailable',
        videoId
      });
    }
  }

  if (!Array.isArray(rawSegments) || rawSegments.length === 0) {
    throw Object.assign(new Error('Transkrip kosong atau tidak ditemukan pada video ini.'), {
      status: 422,
      code: 'empty_transcript',
      videoId
    });
  }

  const meta = await fetchVideoMetadata(videoId, fetcher);

  const segments = rawSegments.map(s => {
    const offsetMs = Number(s.offset || 0);
    const durMs = Number(s.duration || 0);
    return {
      text: s.text.replace(/\s+/g, ' ').trim(),
      offset: offsetMs,
      duration: durMs,
      timestamp: formatTimestamp(offsetMs)
    };
  }).filter(s => Boolean(s.text));

  // Build clean paragraphs (grouping every ~4-5 segments or ~30 seconds)
  const paragraphs = [];
  let currentGroup = [];
  let currentStart = 0;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (currentGroup.length === 0) {
      currentStart = seg.offset;
    }
    currentGroup.push(seg.text);

    if (currentGroup.length >= 5 || (seg.offset - currentStart) >= 28000 || i === segments.length - 1) {
      paragraphs.push({
        timestamp: formatTimestamp(currentStart),
        text: currentGroup.join(' ')
      });
      currentGroup = [];
    }
  }

  const fullText = paragraphs.map(p => p.text).join('\n\n');
  const timedText = paragraphs.map(p => `[${p.timestamp}] ${p.text}`).join('\n\n');
  const words = fullText.split(/\s+/).filter(Boolean);
  const lastSeg = segments[segments.length - 1];
  const durationSec = Math.round((lastSeg.offset + lastSeg.duration) / 1000);

  return {
    videoId,
    url: `https://www.youtube.com/watch?v=${videoId}`,
    title: meta.title || `Video ${videoId}`,
    channelName: meta.author_name || 'Channel YouTube',
    thumbnailUrl: meta.thumbnail_url,
    language: detectedLang,
    wordCount: words.length,
    durationSec,
    durationFormatted: formatTimestamp(durationSec * 1000),
    segmentCount: segments.length,
    segments,
    paragraphs,
    fullText,
    timedText,
    platform: 'youtube'
  };
}

export async function resolveRedirectUrl(url, fetcher = fetch) {
  if (typeof url !== 'string' || !url.trim()) return url;
  const clean = url.trim();
  if (/vt\.tiktok\.com|vm\.tiktok\.com|fb\.watch|youtu\.be|bit\.ly|t\.co|threads\.(?:net|com)/i.test(clean)) {
    try {
      const res = await fetcher(clean, {
        method: 'GET',
        redirect: 'follow',
        signal: AbortSignal.timeout(6000),
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      if (res && res.url && res.url !== clean) {
        return res.url;
      }
    } catch {}
  }
  return clean;
}

export async function transcribeAudioWithWhisper(audioBufferOrUrl, { lang = 'id', timeoutMs = 25000, fetcher = fetch } = {}) {
  let audioBuffer = null;
  if (typeof audioBufferOrUrl === 'string') {
    try {
      const res = await fetcher(audioBufferOrUrl, {
        signal: AbortSignal.timeout(12000),
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      if (!res.ok) return null;
      audioBuffer = await res.arrayBuffer();
    } catch {
      return null;
    }
  } else if (audioBufferOrUrl instanceof ArrayBuffer || (typeof Buffer !== 'undefined' && Buffer.isBuffer(audioBufferOrUrl))) {
    audioBuffer = audioBufferOrUrl;
  }

  if (!audioBuffer || audioBuffer.byteLength < 500) return null;

  // Layer 3A: Groq Whisper (whisper-large-v3, ultrafast ~2-3s)
  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    try {
      const formData = new FormData();
      formData.append('file', new Blob([audioBuffer], { type: 'audio/mpeg' }), 'media_audio.mp3');
      formData.append('model', 'whisper-large-v3');
      formData.append('response_format', 'verbose_json');
      if (lang) formData.append('language', lang);

      const whisperRes = await fetcher('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${groqKey}` },
        body: formData,
        signal: AbortSignal.timeout(timeoutMs)
      });

      if (whisperRes.ok) {
        const data = await whisperRes.json();
        const text = (data.text || '').trim();
        const rawSegments = Array.isArray(data.segments) ? data.segments : [];
        if (text || rawSegments.length > 0) {
          const segments = rawSegments.map(s => {
            const offsetMs = Math.round((s.start || 0) * 1000);
            const durMs = Math.max(1000, Math.round(((s.end || 0) - (s.start || 0)) * 1000));
            return {
              text: (s.text || '').trim(),
              offset: offsetMs,
              duration: durMs,
              timestamp: formatTimestamp(offsetMs)
            };
          }).filter(s => Boolean(s.text));

          return {
            text,
            segments,
            engine: 'groq-whisper-large-v3'
          };
        }
      }
    } catch {}
  }

  // Layer 3B: OpenAI Whisper (whisper-1 fallback)
  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey && !openaiKey.startsWith('key_')) {
    try {
      const formData = new FormData();
      formData.append('file', new Blob([audioBuffer], { type: 'audio/mpeg' }), 'media_audio.mp3');
      formData.append('model', 'whisper-1');
      formData.append('response_format', 'verbose_json');
      if (lang) formData.append('language', lang);

      const whisperRes = await fetcher('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${openaiKey}` },
        body: formData,
        signal: AbortSignal.timeout(timeoutMs)
      });

      if (whisperRes.ok) {
        const data = await whisperRes.json();
        const text = (data.text || '').trim();
        const rawSegments = Array.isArray(data.segments) ? data.segments : [];
        if (text || rawSegments.length > 0) {
          const segments = rawSegments.map(s => {
            const offsetMs = Math.round((s.start || 0) * 1000);
            const durMs = Math.max(1000, Math.round(((s.end || 0) - (s.start || 0)) * 1000));
            return {
              text: (s.text || '').trim(),
              offset: offsetMs,
              duration: durMs,
              timestamp: formatTimestamp(offsetMs)
            };
          }).filter(s => Boolean(s.text));

          return {
            text,
            segments,
            engine: 'openai-whisper-1'
          };
        }
      }
    } catch {}
  }

  return null;
}

export async function extractSocialTranscript(urlOrId, { lang = 'id', fetcher = fetch } = {}) {
  const detected = detectMediaPlatform(urlOrId);
  if (detected.platform === 'youtube') {
    const res = await extractYouTubeTranscript(detected.id || detected.url, { lang, fetcher });
    res.platform = 'youtube';
    return res;
  }

  const { platform, url } = detected;

  // Platform: TikTok (Multi-Layer Engine)
  if (platform === 'tiktok') {
    const resolvedUrl = await resolveRedirectUrl(url, fetcher);
    let tikwmData = null;

    // Layer 1: Query TikWM API for media metadata & direct audio/video streams
    try {
      const tikRes = await fetcher(`https://www.tikwm.com/api/?url=${encodeURIComponent(resolvedUrl)}`, {
        signal: AbortSignal.timeout(8000),
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
      });
      if (tikRes.ok) {
        const json = await tikRes.json();
        if (json.code === 0 && json.data) {
          tikwmData = json.data;
        }
      }
    } catch {}

    const title = (tikwmData?.title || '').trim();
    const authorNickname = tikwmData?.author?.nickname || '';
    const authorUniqueId = tikwmData?.author?.unique_id || '';
    const channelName = authorNickname && authorUniqueId
      ? `${authorNickname} (@${authorUniqueId})`
      : authorUniqueId ? `@${authorUniqueId}` : authorNickname || 'Kreator TikTok';
    const thumbnailUrl = tikwmData?.cover || tikwmData?.origin_cover || '';
    const durationSec = Number(tikwmData?.duration || 0) || 30;
    const durationFormatted = formatTimestamp(durationSec * 1000);

    // Layer 2: Audio Stream Speech-to-Text via Whisper AI
    const audioUrl = tikwmData?.music || tikwmData?.play;
    if (audioUrl) {
      const transcribed = await transcribeAudioWithWhisper(audioUrl, { lang, fetcher });
      if (transcribed && (transcribed.segments?.length > 0 || transcribed.text)) {
        let segments = transcribed.segments || [];
        if (segments.length === 0 && transcribed.text) {
          segments = [{
            text: transcribed.text,
            offset: 0,
            duration: durationSec * 1000,
            timestamp: '00:00'
          }];
        }

        // Build clean paragraphs
        const paragraphs = [];
        let currentGroup = [];
        let currentStart = 0;
        for (let i = 0; i < segments.length; i++) {
          const seg = segments[i];
          if (currentGroup.length === 0) currentStart = seg.offset;
          currentGroup.push(seg.text);
          if (currentGroup.length >= 4 || (seg.offset - currentStart) >= 20000 || i === segments.length - 1) {
            paragraphs.push({
              timestamp: formatTimestamp(currentStart),
              text: currentGroup.join(' ')
            });
            currentGroup = [];
          }
        }

        const fullText = paragraphs.map(p => p.text).join('\n\n');
        const timedText = paragraphs.map(p => `[${p.timestamp}] ${p.text}`).join('\n\n');
        const words = fullText.split(/\s+/).filter(Boolean);

        return {
          videoId: 'tiktok-' + (tikwmData?.id || crypto.randomUUID().slice(0, 8)),
          url: resolvedUrl || url,
          title: title || `Video TikTok ${channelName}`,
          channelName,
          thumbnailUrl,
          language: lang,
          wordCount: words.length,
          durationSec,
          durationFormatted,
          segmentCount: segments.length,
          segments,
          paragraphs,
          fullText,
          timedText,
          platform: 'tiktok',
          engine: transcribed.engine || 'whisper'
        };
      }
    }

    // Layer 3: Check TikWM direct subtitles if any
    if (Array.isArray(tikwmData?.subtitles) && tikwmData.subtitles.length > 0) {
      const sub = tikwmData.subtitles.find(s => s.language?.includes('id') || s.language?.includes('in')) || tikwmData.subtitles[0];
      if (sub?.url) {
        try {
          const subRes = await fetcher(sub.url, { signal: AbortSignal.timeout(6000) });
          if (subRes.ok) {
            const subContent = await subRes.text();
            if (subContent.includes('WEBVTT')) {
              const vttSegs = parseWebVtt(subContent);
              if (vttSegs.length > 0) {
                const parsed = parseCustomTranscriptText(vttSegs.map(s => `[${s.timestamp}] ${s.text}`).join('\n'), {
                  title: title || `Video TikTok ${channelName}`,
                  channelName,
                  platform: 'tiktok',
                  durationFormatted
                });
                parsed.url = resolvedUrl || url;
                parsed.thumbnailUrl = thumbnailUrl;
                return parsed;
              }
            }
          }
        } catch {}
      }
    }

    // Layer 4: TikTok oEmbed & Rehydration HTML scrape fallback
    let oembed = null;
    try {
      const oembedRes = await fetcher(`https://www.tiktok.com/oembed?url=${encodeURIComponent(resolvedUrl)}`, {
        signal: AbortSignal.timeout(6000),
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
      });
      if (oembedRes.ok) oembed = await oembedRes.json();
    } catch {}

    const fallbackTitle = title || oembed?.title || 'Video TikTok';
    const fallbackChannel = channelName !== 'Kreator TikTok' ? channelName : (oembed?.author_name || 'Kreator TikTok');
    const fallbackThumb = thumbnailUrl || oembed?.thumbnail_url || '';

    // Attempt HTML regex rehydration subtitles
    try {
      const pageRes = await fetcher(resolvedUrl, {
        signal: AbortSignal.timeout(6000),
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'id-ID,id;q=0.9,en;q=0.8'
        }
      });
      if (pageRes.ok) {
        const html = await pageRes.text();
        const sigiMatch = html.match(/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/) ||
                         html.match(/<script id="SIGI_STATE"[^>]*>([\s\S]*?)<\/script>/);
        if (sigiMatch && sigiMatch[1]) {
          try {
            const data = JSON.parse(sigiMatch[1]);
            const itemStruct = data?.__DEFAULT_SCOPE__?.['webapp.video-detail']?.itemInfo?.itemStruct ||
                               data?.ItemModule?.[Object.keys(data?.ItemModule || {})[0]];
            const subtitleInfos = itemStruct?.video?.subtitleInfos;
            if (Array.isArray(subtitleInfos) && subtitleInfos.length > 0) {
              const subUrl = subtitleInfos.find(s => s.LanguageCodeName === 'ind-ID' || s.LanguageCodeName === 'id')?.Url || subtitleInfos[0]?.Url;
              if (subUrl) {
                const subRes = await fetcher(subUrl, { signal: AbortSignal.timeout(6000) });
                if (subRes.ok) {
                  const subContent = await subRes.text();
                  if (subContent.includes('WEBVTT')) {
                    const vttSegs = parseWebVtt(subContent);
                    if (vttSegs.length > 0) {
                      const parsed = parseCustomTranscriptText(vttSegs.map(s => `[${s.timestamp}] ${s.text}`).join('\n'), {
                        title: fallbackTitle,
                        channelName: fallbackChannel,
                        platform: 'tiktok',
                        durationFormatted
                      });
                      parsed.url = resolvedUrl || url;
                      parsed.thumbnailUrl = fallbackThumb;
                      return parsed;
                    }
                  }
                }
              }
            }
          } catch {}
        }
      }
    } catch {}

    // Layer 5: Fallback to Rich Caption/Hashtags (Bila video tidak memiliki suara ucapan/hanya musik latar)
    if (fallbackTitle && fallbackTitle.split(/\s+/).filter(Boolean).length >= 2) {
      const parsed = parseCustomTranscriptText(fallbackTitle, {
        title: fallbackTitle.slice(0, 70),
        channelName: fallbackChannel,
        platform: 'tiktok',
        durationFormatted
      });
      parsed.url = resolvedUrl || url;
      parsed.thumbnailUrl = fallbackThumb;
      parsed.isSynthesizedCaption = true;
      return parsed;
    }

    // Layer 6: Structured Error with prefilled metadata for Manual Tab
    throw Object.assign(new Error(`Transkrip/subtitle otomatis TikTok tidak dapat diambil langsung dari link ini. Silakan gunakan tab "Tempel Transkrip Manual" untuk menempel naskah/subtitle video TikTok tersebut.`), {
      status: 422,
      code: 'tiktok_transcript_manual_needed',
      metadata: { title: fallbackTitle, channelName: fallbackChannel, thumbnailUrl: fallbackThumb, url: resolvedUrl || url }
    });
  }

  // Platform: Twitter / X
  if (platform === 'twitter') {
    let oembed = null;
    try {
      const oembedRes = await fetcher(`https://publish.twitter.com/oembed?url=${encodeURIComponent(url)}`, {
        signal: AbortSignal.timeout(8000)
      });
      if (oembedRes.ok) oembed = await oembedRes.json();
    } catch {}

    const rawHtml = oembed?.html || '';
    const cleanText = rawHtml.replace(/<[^>]+>/g, ' ').replace(/&mdash;[\s\S]*$/, '').replace(/\s+/g, ' ').trim();
    const title = cleanText.slice(0, 70) || 'Postingan X / Twitter';
    const channelName = oembed?.author_name || 'Kreator X';

    if (cleanText && cleanText.split(/\s+/).filter(Boolean).length >= 2) {
      const parsed = parseCustomTranscriptText(cleanText, {
        title,
        channelName,
        platform: 'twitter',
        durationFormatted: '00:30'
      });
      parsed.url = url;
      return parsed;
    }
  }

  // Generic fallback: Instagram, Facebook, Web via OpenGraph meta
  try {
    const resolvedUrl = await resolveRedirectUrl(url, fetcher);
    const res = await fetcher(resolvedUrl, {
      signal: AbortSignal.timeout(8000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    if (res.ok) {
      const html = await res.text();
      const ogTitleMatch = html.match(/<meta\s+property=["']og:title["']\s+content=["'](.*?)["']/i) ||
                           html.match(/<title>(.*?)<\/title>/i);
      const ogDescMatch = html.match(/<meta\s+property=["']og:description["']\s+content=["'](.*?)["']/i) ||
                          html.match(/<meta\s+name=["']description["']\s+content=["'](.*?)["']/i);
      const ogImageMatch = html.match(/<meta\s+property=["']og:image["']\s+content=["'](.*?)["']/i);

      const title = (ogTitleMatch?.[1] || `Video ${platform.toUpperCase()}`).replace(/&quot;/g, '"').replace(/&#39;/g, "'");
      const desc = (ogDescMatch?.[1] || '').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
      const thumbnailUrl = ogImageMatch?.[1] || '';

      const contentText = desc || title;
      if (contentText && contentText.split(/\s+/).filter(Boolean).length >= 2) {
        const parsed = parseCustomTranscriptText(contentText, {
          title: title.slice(0, 70),
          channelName: `Kreator ${platform.toUpperCase()}`,
          platform,
          durationFormatted: '00:45'
        });
        parsed.url = resolvedUrl || url;
        parsed.thumbnailUrl = thumbnailUrl;
        return parsed;
      }
    }
  } catch {}

  throw Object.assign(new Error(`Transkrip otomatis untuk ${platform.toUpperCase()} tidak dapat diambil langsung (diblokir proteksi bot atau tidak memiliki subtitle publik). Silakan buka tab "Tempel Transkrip Manual" untuk menempel naskah/subtitle teks video ini.`), {
    status: 422,
    code: 'social_transcript_manual_needed',
    platform
  });
}

export function generateHeuristicIdea(transcriptData, { format = 'long' } = {}) {
  const titleBase = transcriptData.title || 'Investigasi Isu Publik';
  const cleanTitle = titleBase.replace(/[|!-].*$/, '').trim();
  const words = (transcriptData.fullText || '').split(/\s+/).slice(0, 500).join(' ');

  return {
    title: `Sisi Gelap di Balik ${cleanTitle}: Apa yang Sengaja Tidak Diungkap ke Publik?`,
    format: format === 'shorts' ? 'shorts' : 'long',
    pillar: 'Investigasi',
    recommendedAngle: `Membongkar alur kekuasaan dan motif ekonomi di balik narasi ${cleanTitle}. Video kompetitor hanya menyoroti permukaan sensasional, sementara aspek kebijakan struktural dan pihak yang diuntungkan belum dibedah.`,
    suggestedHook: `Semua orang fokus pada potongan video yang viral, tapi hampir tidak ada yang bertanya: siapa sebenarnya yang paling diuntungkan dari skenario ini?`,
    keyFindings: [
      `Fakta 1: Muncul pola anomali narasi yang terkonfirmasi dalam transkrip berdurasi ${transcriptData.durationFormatted}.`,
      `Fakta 2: Ada pihak pemegang otoritas dan regulasi yang belum dimintai pertanggungjawaban terbuka.`,
      `Fakta 3: Dampak sistemik langsung membebani masyarakat kelas menengah ke bawah tanpa solusi kompensasi nyata.`
    ],
    counterPerspective: `Menggunakan 3 Lensa REFRAME:\n1. The System: Telusuri alur dana APBN/anggaran swasta dan izin birokrasi.\n2. The Hidden History: Bandingkan dengan skandal serupa di masa lalu.\n3. The Human Mirror: Tampilkan kerugian riil masyarakat biasa sebagai cermin sosial.`,
    editorialNotes: `Verifikasi data laporan keuangan dan dokumen audit resmi terkait topik ini sebelum visualisasi grafis.`
  };
}

export const DEFAULT_SHORTS_PROMPT = `Bertindaklah sebagai Senior Short-Form Scriptwriter & Retention Strategist.
Tugasmu adalah membuat naskah voice over (VO) video vertikal durasi maksimal 30 detik berdasarkan topik yang saya berikan. Naskah harus terasa seperti mini investigative documentary / business thriller yang cepat, tajam, provokatif, dan mempertahankan retensi penonton hingga detik terakhir.
Gunakan formula narasi retensi tinggi: H-C-B-C-D-C (Hook – Context – Bridge – Climax – Disclaimer – CTA).
ATURAN VO & KATA (DURASI 30 DETIK)
Target Ideal: 65 – 85 kata.
HARD LIMIT: Maksimal 90 kata (Tidak boleh lebih dari 90 kata).
Gaya Bahasa: Kalimat pendek (4–8 kata per kalimat), active voice, kata konkret, ritme cepat, padat, dan komunikatif (conversational storytelling). Buang semua kata hubung yang tidak perlu.
Aturan Angka: Maksimal gunakan 1 data/statistik paling brutal/mengejutkan.
Dilarang: Jangan gunakan salam pembuka ("Halo guys", "Tahukah kamu"), kalimat penyambung bertele-tele, filler words, atau kesimpulan normatif ("Kita harus lebih bijak").
STRUKTUR NARASI (30 DETIK)
A. HOOK (0–3 DETIK)
Menghentikan scroll & membuka curiosity gap. Hancurkan asumsi umum, berikan hipotesis/pernyataan kontroversial yang faktual. Langsung ke inti.
B. CONTEXT (3–8 DETIK)
Bangun latar belakang dan stakes (apa yang dipertaruhkan) dalam 1-2 kalimat ultra-singkat.
C. BRIDGE (8–11 DETIK)
Pertanyaan retoris atau transisi tajam menuju inti masalah (misal: "Tapi siapa yang sebenarnya untung?" atau "Ini rahasia kotornya.").
D. CLIMAX / WOW FACTOR (11–21 DETIK)
Sajian utama. Tembakkan 1 data terkuat, bedah mekanisme/insentif di balik layar, atau ungkap fakta tersembunyi yang membuktikan hook.
E. DISCLAIMER / LOGIC LOCK (21–25 DETIK)
Antisipasi keraguan penonton kritis. Kunci logika naskah dalam 1 kalimat pendek agar tetap kredibel dan faktual.
F. CTA (25–30 DETIK)
1 kalimat penutup yang memicu perspective shift atau pertanyaan pancingan diskusi keras di kolom komentar.
OUTPUT FINAL
Berikan output hanya dalam format berikut:
A. CORE ANGLE
(1 kalimat: Perspektif utama yang membuat cerita ini menarik).
B. HOOK UTAMA & 3 ALTERNATIF
Hook Utama (Terpilih):
Alternatif A (Kontroversial):
Alternatif B (Misteri):
Alternatif C (Contrarian):
C. NASKAH VOICE OVER FINAL (30 DETIK)
Tuliskan naskah VO utuh lengkap dengan penanda strukturnya:
TOTAL KATA: [Tuliskan jumlah kata di sini, wajib ≤ 90 kata]`;

export function generateHeuristicScript(transcriptData, ideaData, { format = 'long' } = {}) {
  const title = ideaData?.title || `Investigasi: ${transcriptData.title}`;
  const hook = ideaData?.suggestedHook || `Semua orang mengira kasus ini sederhana, sampai kita melihat data di balik layarnya.`;
  const channel = transcriptData.channelName || 'Kompetitor';

  if (format === 'shorts') {
    const cleanHook = hook.replace(/^["'\s]+|["'\s]+$/g, '');
    const coreAngle = ideaData?.recommendedAngle || `Membongkar alur kekuasaan dan motif tersembunyi di balik kasus ${transcriptData.title}.`;
    const hooks = {
      main: cleanHook,
      controversial: `Semua orang fokus pada sensasi, tapi sengaja menutup mata dari aliran uangnya.`,
      mystery: `Di balik kabar viral ini, ada satu dokumen yang sengaja tidak pernah dibahas.`,
      contrarian: `Ini bukan sekadar kelalaian individu, melainkan desain sistem yang disengaja.`
    };

    const voScript = `[HOOK (0–3s)]
${cleanHook}

[CONTEXT (3–8s)]
Kasus ${transcriptData.title.slice(0, 40)} mengguncang publik. Taruhannya bukan sekadar reputasi, tapi uang rakyat.

[BRIDGE (8–11s)]
Tapi siapa yang sebenarnya paling diuntungkan?

[CLIMAX (11–21s)]
Data audit mengungkap anomali bernilai miliaran rupiah. Ada regulasi khusus yang sengaja meloloskan transaksi ini tanpa pengawasan terbuka.

[DISCLAIMER (21–25s)]
Ini bukan teori konspirasi, melainkan fakta dokumen resmi terbuka.

[CTA (25–30s)]
Menurut kalian, ini murni kelalaian atau skenario terencana? Tulis di komentar.`;

    const wordCount = voScript.split(/\s+/).filter(Boolean).length;

    return {
      title,
      format: 'shorts',
      coreAngle,
      hook: cleanHook,
      hooks,
      script: voScript,
      wordCount,
      productionNotes: `Visual b-roll cepat, glitch merah-hitam, teks on-screen tebal per poin, tempo VO 130 kata/menit, SFX riset & data beep. Total waktu ≤ 30 detik (Formula H-C-B-C-D-C).`,
      estimatedDurationMin: 0.5
    };
  }

  return {
    title,
    format: 'long',
    hook,
    script: `[SCENE 1: PROLOGUE & HOOK PEMBUKA] (Menit 00:00 - 01:15)
VISUAL: Cinematic drone footage kota metropolitan gelap. Grafik kontras hitam, putih, dan aksen merah REFRAME.
AUDIO/VO: "${hook} Selama beberapa pekan terakhir, jagat publik dihebohkan oleh satu isu besar. Namun di balik riuhnya perdebatan media sosial, ada satu pertanyaan krusial yang luput dari radar publik: mengapa pola ini terus berulang tanpa ada yang berani menyentuh akar masalahnya?"
TEKS LAYAR: REFRAME INVESTIGASI | BEDAH KASUS

[SCENE 2: REKONSTRUKSI KRONOLOGI & DOKUMEN] (Menit 01:15 - 04:30)
VISUAL: Animasi timeline interaktif, potongan arsip koran tempo doeloe dan rilis resmi kementerian.
AUDIO/VO: "Untuk memahami apa yang terjadi hari ini, kita harus menarik garis waktu mundur ke belakang. Mari kita bedah transkrip dan fakta-fakta lapangan yang berhasil dihimpun tim redaksi..."
TEKS LAYAR: JEJAK ANOMALI & PERISTIWA

[SCENE 3: THE SYSTEM & CAPITAL - SIAPA MENDAPAT APA?] (Menit 04:30 - 09:00)
VISUAL: Skema bagan kepemilikan modal, aliran transaksi keuangan, dan tabel izin konsesi/regulasi.
AUDIO/VO: "Di titik inilah kita menemukan pertemuan antara kekuasaan dan akumulasi modal. Aturan yang tampak dibuat demi kepentingan umum, ternyata memiliki klausul pengecualian yang sangat menguntungkan segelintir konglomerasi."
TEKS LAYAR: STRUKTUR KEPENTINGAN

[SCENE 4: THE HUMAN MIRROR - KORBAN NYATA DI BALIK ANGKA] (Menit 09:00 - 13:00)
VISUAL: Footage human interest, wawancara warga terdampak, sunyi tanpa latar musik berlebihan.
AUDIO/VO: "Bagi para pengambil kebijakan di gedung berpendingin udara, dampak ini mungkin hanya sekadar angka persentase. Namun bagi jutaan keluarga di lapangan, ini adalah soal kelangsungan hidup sehari-hari."
TEKS LAYAR: REALITAS LAPANGAN

[SCENE 5: EPILOG & REFLEKSI AKHIR] (Menit 13:00 - 15:30)
VISUAL: Host statement / motion graphic kesimpulan investigasi. Logo REFRAME INVESTIGASI.
AUDIO/VO: "Pertanyaannya kini bukan lagi siapa yang salah, melainkan apakah kita sebagai publik akan terus membiarkan siklus ini berputar tanpa pernah meminta pertanggungjawaban nyata? Saya tim Reframe Investigasi, terima kasih telah berpikir kritis bersama kami."
TEKS LAYAR: SIMAK DOKUMEN SELENGKAPNYA DI DESKRIPSI`,
    productionNotes: `Daftar Aset Produksi:
1. Rekaman arsip pemberitaan awal.
2. Data laporan BPS & regulasi terkait.
3. Footage B-roll masyarakat dan gedung pemerintahan.
4. Voiceover tone: tenang, tajam, objektif, tanpa teriakan sensasional.`,
    estimatedDurationMin: 15
  };
}

async function generateAiJson(prompt, { fetcher = fetch, timeoutMs = 25000, temperature = 0.4 } = {}) {
  const preferred = (process.env.AI_PROVIDER || 'groq').toLowerCase();
  const groqKey = process.env.GROQ_API_KEY;
  const groqModel = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
  const geminiKey = process.env.GEMINI_API_KEY;
  const geminiModel = process.env.GEMINI_MODEL || 'gemini-3.5-flash';

  const providers = preferred === 'gemini'
    ? [{ name: 'gemini', key: geminiKey, model: geminiModel }, { name: 'groq', key: groqKey, model: groqModel }]
    : [{ name: 'groq', key: groqKey, model: groqModel }, { name: 'gemini', key: geminiKey, model: geminiModel }];

  for (const p of providers) {
    if (!p.key) continue;
    try {
      if (p.name === 'groq') {
        const res = await fetcher('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${p.key}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: p.model,
            messages: [{ role: 'user', content: prompt }],
            response_format: { type: 'json_object' }
          }),
          signal: AbortSignal.timeout(timeoutMs)
        });
        if (res.ok) {
          const d = await res.json();
          const raw = d.choices?.[0]?.message?.content || '';
          const clean = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
          const parsed = JSON.parse(clean);
          if (parsed && typeof parsed === 'object') {
            return { ok: true, source: 'groq', model: p.model, data: parsed };
          }
        }
      } else if (p.name === 'gemini') {
        const res = await fetcher(`https://generativelanguage.googleapis.com/v1beta/models/${p.model}:generateContent`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': p.key
          },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
              temperature,
              responseMimeType: 'application/json'
            }
          }),
          signal: AbortSignal.timeout(timeoutMs)
        });
        if (res.ok) {
          const d = await res.json();
          const raw = d.candidates?.[0]?.content?.parts?.[0]?.text || '';
          const clean = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
          const parsed = JSON.parse(clean);
          if (parsed && typeof parsed === 'object') {
            return { ok: true, source: 'gemini', model: p.model, data: parsed };
          }
        }
      }
    } catch {}
  }
  return null;
}

export async function synthesizeIdeaFromTranscript(transcriptData, { format = 'long', fetcher = fetch } = {}) {
  if (!process.env.GEMINI_API_KEY && !process.env.GROQ_API_KEY) {
    return {
      ok: true,
      source: 'heuristic',
      idea: generateHeuristicIdea(transcriptData, { format })
    };
  }

  // Sample relevant portion of transcript to prevent token overflow (first 10,000 chars)
  const transcriptSnippet = (transcriptData.fullText || '').slice(0, 12000);

  const prompt = `Anda adalah Produser Eksekutif Redaksi Investigasi senior di channel YouTube "REFRAME INVESTIGASI" (@Reframe404).
Channel Anda dikenal menyajikan video investigasi mendalam bertema politik, ekonomi, hukum, dan kekuasaan dengan standar jurnalisme tinggi, kritis, dan berbobot (gaya mirip Vox, Johnny Harris, atau investigasi Tempo).

Tugas Anda:
Pelajari transkrip video dari channel YouTube pemantauan berikut ini:
- Judul Video Asli: "${transcriptData.title}"
- Nama Channel: "${transcriptData.channelName}"
- Durasi: ${transcriptData.durationFormatted} (${transcriptData.wordCount} kata)

Transkrip Cuplikan:
"""
${transcriptSnippet}
"""

Berdasarkan transkrip di atas, rancang 1 IDE KONTEN INVESTIGASI ORISINAL untuk REFRAME INVESTIGASI.
PENTING:
- JANGAN sekadar menjiplak atau merangkum ulang isi video kompetitor!
- Temukan sudut pandang (counter-angle / unexplored dimension) yang belum dibahas atau sengaja dilewatkan oleh video tersebut.
- Gunakan 3 Lensa Editorial REFRAME: (1) The System & Capital (struktur kekuasaan & uang), (2) The Hidden History (konteks sejarah & data bukti), (3) The Human Mirror (dampak nyata pada rakyat/manusia).
- Buat judul yang sangat memancing rasa penasaran intelektual, provokatif, namun tetap faktual dan elegan.

Berikan jawaban HANYA dalam format JSON valid (tanpa markdown pembuka/penutup):
{
  "title": "Judul Investigasi Orisinal yang Menggugah Rasa Ingin Tahu",
  "format": "${format === 'shorts' ? 'shorts' : 'long'}",
  "pillar": "Pilih salah satu: Investigasi / Politik / Ekonomi / Geopolitik / Sisi Gelap / Hukum / Kebijakan",
  "recommendedAngle": "Penjelasan sudut pandang counter-investigasi unik yang membedakan video kita dari kompetitor",
  "suggestedHook": "Hook pembuka 15-30 detik pertama yang tajam, mempertanyakan premis umum yang beredar",
  "keyFindings": [
    "Fakta penting 1 yang terungkap dari data/transkrip",
    "Fakta penting 2 tentang pihak yang memiliki kepentingan",
    "Fakta penting 3 mengenai dampak struktural yang diabaikan"
  ],
  "counterPerspective": "Analisis tajam menghubungkan kasus ini ke masalah sistemik yang lebih besar",
  "editorialNotes": "Catatan kritis untuk reporter & editor naskah mengenai dokumen/arsip yang wajib dicari"
}`;

  const aiRes = await generateAiJson(prompt, { fetcher, timeoutMs: 25000, temperature: 0.4 });
  if (!aiRes || !aiRes.data) {
    return {
      ok: true,
      source: 'heuristic-fallback',
      idea: generateHeuristicIdea(transcriptData, { format })
    };
  }

  const parsed = aiRes.data;
  return {
    ok: true,
    source: aiRes.source,
    model: aiRes.model,
    idea: {
      title: parsed.title || generateHeuristicIdea(transcriptData, { format }).title,
      format: parsed.format || format,
      pillar: parsed.pillar || 'Investigasi',
      recommendedAngle: parsed.recommendedAngle || '',
      suggestedHook: parsed.suggestedHook || '',
      keyFindings: Array.isArray(parsed.keyFindings) ? parsed.keyFindings : [],
      counterPerspective: parsed.counterPerspective || '',
      editorialNotes: parsed.editorialNotes || ''
    }
  };
}

export async function synthesizeScriptFromTranscript(transcriptData, ideaData, { format = 'long', customPrompt = '', fetcher = fetch } = {}) {
  if (!process.env.GEMINI_API_KEY && !process.env.GROQ_API_KEY) {
    return {
      ok: true,
      source: 'heuristic',
      scriptData: generateHeuristicScript(transcriptData, ideaData, { format })
    };
  }

  const transcriptSnippet = (transcriptData.fullText || '').slice(0, 12000);
  const ideaContext = ideaData ? `
Angle yang dipilih: ${ideaData.recommendedAngle || ''}
Hook pembuka yang disiapkan: ${ideaData.suggestedHook || ''}
Temuan kunci: ${(ideaData.keyFindings || []).join('; ')}
` : '';

  let prompt = '';
  if (format === 'shorts') {
    const shortsInstructions = (customPrompt && typeof customPrompt === 'string' && customPrompt.trim())
      ? customPrompt.trim()
      : DEFAULT_SHORTS_PROMPT;

    prompt = `${shortsInstructions}

TOPIK / BAHAN TRANSKRIP:
- Judul Video Asli: "${transcriptData.title}" (${transcriptData.channelName})
${ideaContext}
Cuplikan Transkrip Referensi:
"""
${transcriptSnippet}
"""

Keluarkan HANYA JSON valid:
{
  "title": "Judul Naskah Shorts Menarik",
  "format": "shorts",
  "coreAngle": "1 kalimat perspektif utama yang membuat cerita ini menarik",
  "hook": "Teks hook utama terpilih",
  "hooks": {
    "main": "Hook Utama (Terpilih)",
    "controversial": "Alternatif A (Kontroversial)",
    "mystery": "Alternatif B (Misteri)",
    "contrarian": "Alternatif C (Contrarian)"
  },
  "script": "[HOOK (0-3s)]\\n...\\n\\n[CONTEXT (3-8s)]\\n...\\n\\n[BRIDGE (8-11s)]\\n...\\n\\n[CLIMAX (11-21s)]\\n...\\n\\n[DISCLAIMER (21-25s)]\\n...\\n\\n[CTA (25-30s)]\\n...",
  "wordCount": 75,
  "productionNotes": "Rekomendasi visual b-roll dan teks layar"
}`;
  } else {
    const longInstructions = (customPrompt && typeof customPrompt === 'string' && customPrompt.trim())
      ? `\nInstruksi Khusus Editor:\n${customPrompt.trim()}\n`
      : '';

    prompt = `Anda adalah Lead Scriptwriter & Peneliti Narasi di kanal YouTube "REFRAME INVESTIGASI" (@Reframe404).
Channel Anda memproduksi video investigasi dokumenter berkualitas tinggi dengan gaya bercerita mendalam, sinematik, padat data, dan menyentuh emosi pemirsa.

Tugas Anda:
Tuliskan NASKAH LENGKAP PRODUKSI untuk video investigasi orisinal berdasarkan transkrip video referensi berikut:
- Video Asli: "${transcriptData.title}" (${transcriptData.channelName})
${ideaContext}
Format: Long Video Investigasi (12–16 menit, narasi terstruktur dan kaya visual)
${longInstructions}
Cuplikan Transkrip Referensi:
"""
${transcriptSnippet}
"""

Instruksi Format Naskah:
- Struktur naskah harus jelas terbagi per Scene (Visual, Audio/Voiceover, Teks Layar).
- Bahasa Indonesia yang cerdas, lugas, elegan, tidak bertele-tele, namun menciptakan ketegangan dan rasa penasaran kuat.
- Hook 30 detik pertama harus luar biasa memikat penonton agar tidak skip.

Berikan jawaban HANYA dalam format JSON valid (tanpa markdown pembuka/penutup):
{
  "title": "Judul Naskah Siap Produksi",
  "format": "long",
  "hook": "Teks hook 15-30 detik pertama",
  "script": "Naskah lengkap format Scene 1, Scene 2, dst dengan rincian VISUAL, AUDIO/VO, dan TEKS LAYAR",
  "productionNotes": "Rekomendasi aset grafis, arsip berita, dan dokumen primer yang perlu disiapkan editor",
  "estimatedDurationMin": 14
}`;
  }

  const aiRes = await generateAiJson(prompt, { fetcher, timeoutMs: 35000, temperature: 0.5 });
  if (!aiRes || !aiRes.data) {
    return {
      ok: true,
      source: 'heuristic-fallback',
      scriptData: generateHeuristicScript(transcriptData, ideaData, { format })
    };
  }

  const parsed = aiRes.data;
  const scriptText = parsed.script || '';
  const calculatedWords = scriptText.split(/\s+/).filter(Boolean).length;

  return {
    ok: true,
    source: aiRes.source,
    model: aiRes.model,
    scriptData: {
      title: parsed.title || ideaData?.title || transcriptData.title,
      format: parsed.format || format,
      coreAngle: parsed.coreAngle || ideaData?.recommendedAngle || '',
      hook: parsed.hook || ideaData?.suggestedHook || '',
      hooks: parsed.hooks || {
        main: parsed.hook || ideaData?.suggestedHook || '',
        controversial: '',
        mystery: '',
        contrarian: ''
      },
      script: scriptText,
      wordCount: parsed.wordCount || calculatedWords,
      productionNotes: parsed.productionNotes || '',
      estimatedDurationMin: parsed.estimatedDurationMin || (format === 'shorts' ? 0.5 : 14)
    }
  };
}

export async function saveTranscriptIdeaToKanban(contentStore, idea, sourceVideo) {
  if (!contentStore) throw new Error('ContentStore wajib disediakan.');
  if (!idea || !idea.title) throw new Error('Data ide tidak valid.');

  const db = await contentStore.read();
  const pillars = db.pillars || [];
  const matchedPillar = pillars.find(p => p.name?.toLowerCase().includes((idea.pillar || '').toLowerCase())) || pillars[0];

  const brief = `[RADAR PANTAUAN TRANSKRIP - ${idea.pillar || 'Investigasi'}]
Sumber Video Pantauan: ${sourceVideo.title || ''} (${sourceVideo.channelName || 'YouTube'})
URL Sumber: ${sourceVideo.url || ''}

SUDUT PANDANG INVESTIGASI:
${idea.recommendedAngle || ''}

TEMUAN KUNCI:
${(idea.keyFindings || []).map((f, i) => `${i + 1}. ${f}`).join('\n')}

ANALISIS SISTEMIK (3 LENSA):
${idea.counterPerspective || ''}

PANDUAN REDAKSI:
${idea.editorialNotes || ''}`;

  const payload = {
    title: idea.title,
    format: idea.format === 'shorts' ? 'shorts' : 'long',
    pillarId: matchedPillar ? matchedPillar.id : '',
    stage: 'idea',
    priority: 'high',
    brief,
    hook: idea.suggestedHook || '',
    tags: `radar, pantauan, transkrip, ${idea.pillar?.toLowerCase() || 'investigasi'}`,
    sources: sourceVideo.url ? [{
      id: crypto.randomUUID(),
      label: `${sourceVideo.channelName || 'YouTube'}: ${sourceVideo.title}`,
      url: sourceVideo.url,
      notes: `Transkrip diekstrak dari channel pantauan Radar.\nTemuan kunci:\n${(idea.keyFindings || []).join('\n')}`
    }] : []
  };

  const newContent = await contentStore.create(payload, { fillEngine: true });
  return {
    ok: true,
    content: newContent
  };
}

export async function saveTranscriptScriptToKanban(contentStore, scriptData, sourceVideo) {
  if (!contentStore) throw new Error('ContentStore wajib disediakan.');
  if (!scriptData || !scriptData.title) throw new Error('Data naskah tidak valid.');

  const db = await contentStore.read();
  const pillars = db.pillars || [];
  const matchedPillar = pillars.find(p => p.name?.toLowerCase().includes('investigasi')) || pillars[0];

  const hooksSummary = scriptData.hooks && typeof scriptData.hooks === 'object'
    ? `\n\nALTERNATIF HOOK PEMBUKA:\n- Terpilih: ${scriptData.hooks.main || scriptData.hook || ''}\n- Kontroversial: ${scriptData.hooks.controversial || '-'}\n- Misteri: ${scriptData.hooks.mystery || '-'}\n- Contrarian: ${scriptData.hooks.contrarian || '-'}`
    : '';

  const coreAngleSummary = scriptData.coreAngle ? `\nCORE ANGLE: ${scriptData.coreAngle}` : '';
  const wordCountSummary = scriptData.wordCount ? ` (${scriptData.wordCount} Kata)` : '';

  const brief = `[NASKAH INVESTIGASI DARI PANTAUAN TRANSKRIP - ${scriptData.format === 'shorts' ? 'SHORTS 30s' : 'LONG VIDEO'}]
Inspirasi: ${sourceVideo.title || ''} (${sourceVideo.channelName || 'YouTube'})
URL: ${sourceVideo.url || ''}
Estimasi Durasi: ${scriptData.estimatedDurationMin || (scriptData.format === 'shorts' ? 0.5 : 14)} Menit${wordCountSummary}${coreAngleSummary}${hooksSummary}`;

  const payload = {
    title: scriptData.title,
    format: scriptData.format === 'shorts' ? 'shorts' : 'long',
    pillarId: matchedPillar ? matchedPillar.id : '',
    stage: 'script',
    priority: 'high',
    brief,
    hook: scriptData.hook || '',
    script: scriptData.script || '',
    productionNotes: scriptData.productionNotes || '',
    tags: `radar, pantauan, transkrip, naskah, ${scriptData.format === 'shorts' ? 'shorts' : 'long'}`,
    sources: sourceVideo.url ? [{
      id: crypto.randomUUID(),
      label: `${sourceVideo.channelName || 'YouTube'}: ${sourceVideo.title}`,
      url: sourceVideo.url,
      notes: 'Transkrip diekstrak dari video pantauan Radar.'
    }] : []
  };

  const newContent = await contentStore.create(payload, { fillEngine: true });
  return {
    ok: true,
    content: newContent
  };
}

export function formatTranscriptFilename(title, ext = 'txt') {
  const clean = (title || 'transkrip-video')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 50) || 'transkrip-video';
  return `transkrip-${clean}.${(ext || 'txt').replace(/^\./, '')}`;
}

export function generateTranscriptTxtFile(transcript, { mode = 'timed' } = {}) {
  if (!transcript || typeof transcript !== 'object') {
    throw Object.assign(new Error('Data transkrip tidak valid.'), { status: 400 });
  }

  const title = (transcript.title || 'Transkrip Video').trim();
  const channel = (transcript.channelName || 'Kreator').trim();
  const platform = (transcript.platform || 'Sosmed').toUpperCase();
  const duration = transcript.durationFormatted || '-';
  const words = transcript.wordCount || (transcript.fullText ? transcript.fullText.split(/\s+/).filter(Boolean).length : 0);
  const url = transcript.url || '-';
  const now = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });

  const divider = '='.repeat(70);
  const subDivider = '-'.repeat(70);

  const paragraphs = Array.isArray(transcript.paragraphs) && transcript.paragraphs.length
    ? transcript.paragraphs
    : (Array.isArray(transcript.segments) && transcript.segments.length
      ? transcript.segments
      : [{ timestamp: '00:00', text: transcript.fullText || '' }]);

  const timedBody = paragraphs.map(p => `[${p.timestamp || '00:00'}] ${p.text || ''}`).join('\r\n\r\n');
  const cleanBody = paragraphs.map(p => p.text || '').join('\r\n\r\n');

  const lines = [
    divider,
    `TRANSKRIP VIDEO: ${title}`,
    divider,
    `Kreator / Channel : ${channel}`,
    `Platform          : ${platform}`,
    `Durasi            : ${duration}`,
    `Total Kata        : ${words} kata`,
    `URL Sumber        : ${url}`,
    `Waktu Unduh       : ${now} WIB`,
    `Format File       : ${mode === 'clean' ? 'Paragraf Bersih (Tanpa Timestamp)' : 'Dengan Penanda Waktu [MM:SS] & Naskah Bersih'}`,
    divider,
    ''
  ];

  if (mode === 'clean') {
    lines.push(cleanBody);
  } else {
    lines.push(
      '--- [BAGIAN 1] TRANSKRIP DENGAN TIMESTAMPS ---',
      '',
      timedBody,
      '',
      subDivider,
      '--- [BAGIAN 2] NASKAH BERSIH (PARAGRAF LENGKAP) ---',
      '',
      cleanBody
    );
  }

  lines.push(
    '',
    divider,
    'YouTube Content Hub — Editorial Radar Reframe',
    divider
  );

  return lines.join('\r\n');
}
