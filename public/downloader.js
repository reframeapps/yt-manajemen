// Universal Social Media Downloader Client Module

(function() {
  let state = {
    url: '',
    loading: false,
    downloadingId: null,
    error: null,
    info: null
  };

  function detectPlatformClient(url) {
    const clean = (url || '').trim();
    if (!clean) return 'unknown';
    if (/youtube\.com|youtu\.be/i.test(clean)) return 'youtube';
    if (/tiktok\.com/i.test(clean)) return 'tiktok';
    if (/instagram\.com|instagr\.am/i.test(clean)) return 'instagram';
    if (/facebook\.com|fb\.com|fb\.watch/i.test(clean)) return 'facebook';
    if (/twitter\.com|x\.com/i.test(clean)) return 'twitter';
    if (/threads\.(?:net|com)/i.test(clean)) return 'threads';
    return 'web';
  }

  function getPlatformSvg(platform) {
    if (typeof window.hubIcon === 'function') {
      const mapped = platform === 'x' ? 'twitter' : platform;
      return window.hubIcon(mapped, 'platform-icon-svg');
    }
    return '';
  }

  window.renderDownloader = function(body) {
    const detected = detectPlatformClient(state.url);

    body.innerHTML = `
      <div class="downloader-shell">
        <div class="downloader-hero">
          <div class="downloader-header">
            <div class="downloader-icon-badge">
              ${window.hubIcon ? window.hubIcon('download') : '⬇'}
            </div>
            <div class="downloader-title-wrap">
              <h2>Universal Social Media Downloader</h2>
              <p>Download video dan audio kualitas terbaik dari berbagai platform sosial media tanpa watermark.</p>
            </div>
          </div>

          <div class="downloader-platforms-bar">
            <span class="downloader-platforms-label">Platform Didukung:</span>
            <span class="platform-chip ${detected === 'youtube' ? 'highlight' : ''}">
              ${getPlatformSvg('youtube')} YouTube (1080p, 720p, MP3)
            </span>
            <span class="platform-chip ${detected === 'tiktok' ? 'highlight' : ''}">
              ${getPlatformSvg('tiktok')} TikTok (No Watermark)
            </span>
            <span class="platform-chip ${detected === 'instagram' ? 'highlight' : ''}">
              ${getPlatformSvg('instagram')} Instagram Reels & Post
            </span>
            <span class="platform-chip ${detected === 'facebook' ? 'highlight' : ''}">
              ${getPlatformSvg('facebook')} Facebook Video
            </span>
            <span class="platform-chip ${detected === 'twitter' ? 'highlight' : ''}">
              ${getPlatformSvg('twitter')} X / Twitter
            </span>
            <span class="platform-chip ${detected === 'threads' ? 'highlight' : ''}">
              ${getPlatformSvg('threads')} Threads
            </span>
          </div>

          <div class="downloader-input-card">
            <form id="downloaderForm" class="downloader-input-group">
              <input 
                id="downloaderUrlInput" 
                type="url" 
                placeholder="Tempel tautan video YouTube, TikTok, Instagram, Twitter, atau Facebook..." 
                value="${state.url ? state.url.replace(/"/g, '&quot;') : ''}"
                autocomplete="off" 
                required
              />
              <button type="submit" id="downloaderSubmitBtn" class="downloader-submit-btn" ${state.loading ? 'disabled' : ''}>
                ${state.loading ? 'Memproses…' : '⚡ Proses'}
              </button>
            </form>
            <div class="downloader-input-hint">
              <span>Mendukung YouTube, TikTok, Reels, Twitter, Threads & Facebook.</span>
              <button type="button" id="downloaderPasteBtn" class="downloader-btn-paste">📋 Tempel dari Clipboard</button>
            </div>
          </div>
        </div>

        ${state.loading ? `
          <div class="downloader-loading-card">
            <div class="downloader-spinner"></div>
            <h4>Sedang Mengekstrak Informasi Video</h4>
            <p>Menganalisis resolusi terbaik, format audio, dan metadata media dari platform…</p>
          </div>
        ` : ''}

        ${state.error ? `
          <div class="downloader-error-card">
            <div class="downloader-error-icon">⚠️</div>
            <div class="downloader-error-body">
              <strong>Tidak Dapat Memproses Video</strong>
              <span>${state.error}</span>
            </div>
          </div>
        ` : ''}

        ${!state.loading && state.info ? renderPreviewCard(state.info) : ''}
      </div>
    `;

    bindEvents(body);
  };

  function renderPreviewCard(info) {
    const platformSvg = getPlatformSvg(info.platform);

    return `
      <div class="downloader-preview-card">
        <div class="preview-media-grid">
          <div class="preview-thumbnail-wrap">
            ${info.thumbnail ? `<img src="${info.thumbnail}" alt="${info.title.replace(/"/g, '&quot;')}" loading="lazy" />` : '<div style="background:#1e293b;height:100%"></div>'}
            ${info.durationFormatted ? `<span class="preview-duration-badge">${info.durationFormatted}</span>` : ''}
            <span class="preview-platform-badge">${platformSvg} ${info.platformLabel || info.platform}</span>
          </div>
          <div class="preview-details">
            <h3 class="preview-title">${info.title || 'Video'}</h3>
            <div class="preview-meta-row">
              ${info.author ? `
                <div class="preview-meta-item">
                  <strong>Kreator:</strong> <span>${info.author}</span>
                </div>
              ` : ''}
              ${info.durationFormatted ? `
                <div class="preview-meta-item">
                  <strong>Durasi:</strong> <span>${info.durationFormatted}</span>
                </div>
              ` : ''}
              <div class="preview-meta-item">
                <strong>Platform:</strong> <span>${info.platformLabel || info.platform}</span>
              </div>
            </div>
            ${info.cookiesActive ? `
              <div style="font-size:11px;color:#059669;margin-top:4px">
                ✓ Sesi otentikasi cookies.txt aktif
              </div>
            ` : ''}
          </div>
        </div>

        <div class="download-formats-section">
          <div class="formats-heading">
            <span>Pilih Format & Kualitas Unduhan:</span>
            <small>Klik tombol untuk langsung mengunduh ke perangkat</small>
          </div>

          <div class="formats-grid">
            ${info.formats.map(f => {
              const isAudio = f.type === 'audio';
              const isDownloading = state.downloadingId === f.id;

              return `
                <button 
                  type="button" 
                  class="format-btn ${isAudio ? 'audio-btn' : ''}" 
                  data-download-format="${f.id}"
                  ${isDownloading ? 'disabled' : ''}
                >
                  <div class="format-btn-top">
                    <span class="format-res">${f.label}</span>
                    <span class="format-type-pill">${f.ext.toUpperCase()}</span>
                  </div>
                  <span class="format-note">${f.qualityNote || f.resolution}</span>
                  <div class="format-action">
                    ${isDownloading ? 'Menyiapkan stream…' : (window.hubIcon ? window.hubIcon('download') : '⬇') + ' Download ' + f.ext.toUpperCase()}
                  </div>
                </button>
              `;
            }).join('')}
          </div>

          <div id="downloaderStatusMsg" class="download-status-toast" style="display:none">
            <span>⏱️ Pengunduhan sedang disalurkan langsung oleh browser. File tersimpan otomatis.</span>
          </div>
        </div>
      </div>
    `;
  }

  function bindEvents(container) {
    const form = container.querySelector('#downloaderForm');
    const input = container.querySelector('#downloaderUrlInput');
    const pasteBtn = container.querySelector('#downloaderPasteBtn');

    if (input) {
      input.addEventListener('input', e => {
        state.url = e.target.value;
        const chips = container.querySelectorAll('.platform-chip');
        const p = detectPlatformClient(state.url);
        chips.forEach(chip => {
          chip.classList.toggle('highlight', chip.textContent.toLowerCase().includes(p));
        });
      });
    }

    if (pasteBtn && input) {
      pasteBtn.addEventListener('click', async () => {
        try {
          const text = await navigator.clipboard.readText();
          if (text) {
            input.value = text.trim();
            state.url = text.trim();
            input.dispatchEvent(new Event('input'));
            form.dispatchEvent(new Event('submit'));
          }
        } catch {
          if (typeof window.toast === 'function') {
            window.toast('Izin clipboard tidak tersedia. Silakan tempel secara manual (Ctrl+V).');
          }
        }
      });
    }

    if (form) {
      form.addEventListener('submit', async e => {
        e.preventDefault();
        const url = (input?.value || state.url || '').trim();
        if (!url) return;

        state.url = url;
        state.loading = true;
        state.error = null;
        state.info = null;
        window.renderDownloader(container);

        try {
          const res = await fetch('/api/download/info', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
          });

          const data = await res.json();
          if (!res.ok || !data.ok) {
            throw new Error(data.error || 'Gagal mengekstrak data video dari link tersebut.');
          }

          state.info = data;
          state.loading = false;
          window.renderDownloader(container);
        } catch (err) {
          state.loading = false;
          state.error = err.message || 'Terjadi kesalahan saat memproses tautan video.';
          window.renderDownloader(container);
        }
      });
    }

    // Download format buttons
    container.querySelectorAll('[data-download-format]').forEach(btn => {
      btn.addEventListener('click', e => {
        const formatId = btn.dataset.downloadFormat;
        if (!formatId || !state.info) return;

        triggerDownload(formatId, state.info, container);
      });
    });
  }

  function triggerDownload(formatId, info, container) {
    state.downloadingId = formatId;
    window.renderDownloader(container);

    const toastEl = container.querySelector('#downloaderStatusMsg');
    if (toastEl) toastEl.style.display = 'flex';

    const params = new URLSearchParams({
      url: info.url,
      quality: formatId,
      title: info.title || 'video'
    });

    const streamUrl = `/api/download/stream?${params.toString()}`;

    // Invisible iframe to trigger browser download without navigating away
    let iframe = document.getElementById('downloaderSilentFrame');
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'downloaderSilentFrame';
      iframe.style.display = 'none';
      document.body.appendChild(iframe);
    }
    iframe.src = streamUrl;

    if (typeof window.toast === 'function') {
      window.toast(`Memulai pengunduhan ${formatId.toUpperCase()}...`);
    }

    setTimeout(() => {
      state.downloadingId = null;
      const curBtn = container.querySelector(`[data-download-format="${formatId}"]`);
      if (curBtn) {
        curBtn.removeAttribute('disabled');
        const act = curBtn.querySelector('.format-action');
        if (act) act.textContent = '✓ Download Dimulai';
      }
    }, 3000);
  }
})();
