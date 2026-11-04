// Universal Social Media Downloader Client Module

(function() {
  let state = {
    url: '',
    loading: false,
    downloadingId: null,
    downloadStreamUrl: null,
    downloadLabel: null,
    error: null,
    info: null,
    cookies: null,
    cookiesLoaded: false,
    showCookiesModal: false,
    cookiesSaving: false,
    cookiesText: ''
  };

  async function loadCookiesStatus() {
    try {
      const res = await fetch('/api/download/cookies');
      const data = await res.json();
      state.cookies = data;
      state.cookiesLoaded = true;
    } catch {
      state.cookiesLoaded = true;
    }
  }

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
    if (!state.cookiesLoaded) {
      loadCookiesStatus().then(() => {
        window.renderDownloader(body);
      });
    }

    const detected = detectPlatformClient(state.url);
    const cookiesActive = state.cookies?.exists;
    const cookiesDomains = state.cookies?.domains || [];

    body.innerHTML = `
      <div class="downloader-shell">
        <div class="downloader-hero">
          <div class="downloader-hero-top">
            <div class="downloader-header">
              <div class="downloader-icon-badge">
                ${window.hubIcon ? window.hubIcon('download') : '⬇'}
              </div>
              <div class="downloader-title-wrap">
                <h2>Universal Social Media Downloader</h2>
                <p>Download video & audio kualitas terbaik dari YouTube, TikTok (No Watermark), Instagram, Facebook, X, & Threads.</p>
              </div>
            </div>

            <button type="button" id="downloaderCookiesToggleBtn" class="downloader-cookies-badge-btn ${cookiesActive ? 'active' : ''}">
              <span class="cookie-icon">🍪</span>
              <div class="cookie-text-col">
                <strong>${cookiesActive ? 'Cookies Aktif' : 'Kelola Cookies'}</strong>
                <small>${cookiesActive ? (cookiesDomains.length ? cookiesDomains.join(', ') : 'Tersimpan') : 'Bypass Login / Bot'}</small>
              </div>
            </button>
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
                placeholder="Tempel tautan video YouTube, TikTok, Instagram, Twitter, Threads, atau Facebook..." 
                value="${state.url ? state.url.replace(/"/g, '&quot;') : ''}"
                autocomplete="off" 
                required
              />
              <button type="submit" id="downloaderSubmitBtn" class="downloader-submit-btn" ${state.loading ? 'disabled' : ''}>
                ${state.loading ? 'Memproses…' : '⚡ Proses'}
              </button>
            </form>
            <div class="downloader-input-hint">
              <span>Mendukung YouTube HD/Shorts, TikTok No Watermark, Reels, Twitter, Threads & Facebook.</span>
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
              ${state.error.toLowerCase().includes('cookies') || state.error.toLowerCase().includes('instagram') ? `
                <div style="margin-top:10px">
                  <button type="button" id="downloaderOpenCookiesFromError" class="downloader-btn-secondary" style="font-size:12px;padding:6px 14px">
                    🍪 Buka Pengaturan Cookies Server
                  </button>
                </div>
              ` : ''}
            </div>
          </div>
        ` : ''}

        ${!state.loading && state.info ? renderPreviewCard(state.info) : ''}

        ${state.showCookiesModal ? renderCookiesModal() : ''}
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
            ${info.thumbnail ? `<img src="${info.thumbnail}" alt="${info.title.replace(/"/g, '&quot;')}" loading="lazy" />` : '<div style="background:#1e293b;height:100%;min-height:160px;display:flex;align-items:center;justify-content:center;color:#64748b;font-size:12px">Preview Tidak Tersedia</div>'}
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
            ${info.engine === 'tikwm' ? `
              <div class="preview-engine-badge">
                ⚡ Mode High-Speed TikTok (Bebas Watermark & Audio Original)
              </div>
            ` : ''}
            ${info.cookiesActive ? `
              <div style="font-size:11px;color:#059669;margin-top:6px;display:flex;align-items:center;gap:4px">
                ✓ Sesi otentikasi cookies.txt aktif
              </div>
            ` : ''}
          </div>
        </div>

        <div class="download-formats-section">
          <div class="formats-heading">
            <span>Pilih Format & Kualitas Unduhan:</span>
            <small>Klik salah satu format untuk mengunduh ke perangkat</small>
          </div>

          <div class="formats-grid">
            ${info.formats.map(f => {
              const isAudio = f.type === 'audio';
              const isDownloading = state.downloadingId === f.id;

              return `
                <button 
                  type="button" 
                  class="format-btn ${isAudio ? 'audio-btn' : ''} ${isDownloading ? 'active-downloading' : ''}" 
                  data-download-format="${f.id}"
                  ${isDownloading ? 'disabled' : ''}
                >
                  <div class="format-btn-top">
                    <span class="format-res">${f.label}</span>
                    <span class="format-type-pill">${f.ext.toUpperCase()}</span>
                  </div>
                  <span class="format-note">${f.qualityNote || f.resolution}</span>
                  <div class="format-action">
                    ${isDownloading ? '⏳ Menyiapkan file…' : (window.hubIcon ? window.hubIcon('download') : '⬇') + ' Unduh ' + f.ext.toUpperCase()}
                  </div>
                </button>
              `;
            }).join('')}
          </div>

          ${state.downloadStreamUrl ? `
            <div class="downloader-stream-active-box">
              <div class="stream-box-icon">📥</div>
              <div class="stream-box-content">
                <strong>Sedang Menyiapkan: ${state.downloadLabel || 'Media File'}</strong>
                <p>Browser Anda seharusnya sudah memulai pengunduhan secara otomatis.</p>
                <div class="stream-box-actions">
                  <a href="${state.downloadStreamUrl}" class="downloader-direct-link" download target="_blank">
                    ⬇ Klik Di Sini Jika Unduhan Tidak Mulai Otomatis
                  </a>
                </div>
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  function renderCookiesModal() {
    const c = state.cookies || {};
    const hasCookies = !!c.exists;

    return `
      <div class="downloader-modal-backdrop" id="downloaderCookiesBackdrop">
        <div class="downloader-modal-card">
          <div class="downloader-modal-header">
            <div class="modal-title-wrap">
              <h3>🍪 Pengaturan Cookies Server</h3>
              <p>Gunakan cookies.txt untuk bypass batas bot, unduh video privat, usia 18+, atau Instagram Reels.</p>
            </div>
            <button type="button" class="downloader-modal-close" id="downloaderCookiesCloseBtn">✕</button>
          </div>

          <div class="downloader-modal-body">
            <div class="cookies-status-panel ${hasCookies ? 'status-ok' : 'status-empty'}">
              <div class="status-indicator-dot"></div>
              <div class="status-indicator-text">
                <strong>${hasCookies ? 'File cookies.txt Terpasang pada Server' : 'Belum Ada File cookies.txt'}</strong>
                <small>
                  ${hasCookies 
                    ? `Ukuran: ${Math.round(c.size / 1024)} KB · Domain terdeteksi: ${(c.domains || []).join(', ') || 'Umum'}`
                    : 'Tanpa cookies, video YouTube publik dan TikTok tetap berfungsi. Namun Instagram dan video 18+ memerlukan cookies.'}
                </small>
              </div>
            </div>

            <div class="cookies-instructions">
              <strong>Cara Mendapatkan cookies.txt:</strong>
              <ol>
                <li>Pasang ekstensi browser Chrome/Edge/Firefox: <code>Get cookies.txt LOCALLY</code>.</li>
                <li>Buka situs YouTube atau Instagram saat sedang login ke akun Anda.</li>
                <li>Klik ikon ekstensi lalu pilih <strong>Export</strong> untuk mengunduh atau menyalin teks cookies.</li>
                <li>Tempel isi file tersebut ke dalam kotak di bawah ini, lalu klik <strong>Simpan Cookies</strong>.</li>
              </ol>
            </div>

            <div class="cookies-input-section">
              <label for="downloaderCookiesTextarea">
                <span>Tempel Isi File Cookies (Format Netscape / Standar):</span>
                <input type="file" id="downloaderCookiesFileInput" accept=".txt" style="display:none" />
                <button type="button" id="downloaderCookiesBrowseBtn" class="downloader-btn-browse">📂 Unggah File .txt</button>
              </label>
              <textarea 
                id="downloaderCookiesTextarea" 
                rows="7" 
                placeholder="# Netscape HTTP Cookie File&#10;.youtube.com&#9;TRUE&#9;/&#9;TRUE&#9;...&#10;.instagram.com&#9;TRUE&#9;/&#9;TRUE&#9;..."
              >${state.cookiesText || ''}</textarea>
            </div>
          </div>

          <div class="downloader-modal-footer">
            ${hasCookies ? `
              <button type="button" id="downloaderCookiesDeleteBtn" class="downloader-btn-danger">
                🗑️ Hapus Cookies
              </button>
            ` : ''}
            <div style="flex:1"></div>
            <button type="button" id="downloaderCookiesCancelBtn" class="downloader-btn-secondary">
              Tutup
            </button>
            <button type="button" id="downloaderCookiesSaveBtn" class="downloader-btn-primary" ${state.cookiesSaving ? 'disabled' : ''}>
              ${state.cookiesSaving ? 'Menyimpan…' : '💾 Simpan Cookies'}
            </button>
          </div>
        </div>
      </div>
    `;
  }

  function bindEvents(container) {
    const form = container.querySelector('#downloaderForm');
    const input = container.querySelector('#downloaderUrlInput');
    const pasteBtn = container.querySelector('#downloaderPasteBtn');
    const cookiesBtn = container.querySelector('#downloaderCookiesToggleBtn');
    const cookiesFromError = container.querySelector('#downloaderOpenCookiesFromError');

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
            window.toast('Izin clipboard browser tidak aktif. Silakan tempel secara manual (Ctrl+V).');
          }
        }
      });
    }

    const openCookiesModal = () => {
      state.showCookiesModal = true;
      window.renderDownloader(container);
    };

    if (cookiesBtn) cookiesBtn.addEventListener('click', openCookiesModal);
    if (cookiesFromError) cookiesFromError.addEventListener('click', openCookiesModal);

    if (form) {
      form.addEventListener('submit', async e => {
        e.preventDefault();
        const url = (input?.value || state.url || '').trim();
        if (!url) return;

        state.url = url;
        state.loading = true;
        state.error = null;
        state.info = null;
        state.downloadStreamUrl = null;
        state.downloadLabel = null;
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

    // Cookies modal events
    const modalBackdrop = container.querySelector('#downloaderCookiesBackdrop');
    const closeBtn = container.querySelector('#downloaderCookiesCloseBtn');
    const cancelBtn = container.querySelector('#downloaderCookiesCancelBtn');
    const saveBtn = container.querySelector('#downloaderCookiesSaveBtn');
    const deleteBtn = container.querySelector('#downloaderCookiesDeleteBtn');
    const browseBtn = container.querySelector('#downloaderCookiesBrowseBtn');
    const fileInput = container.querySelector('#downloaderCookiesFileInput');
    const textarea = container.querySelector('#downloaderCookiesTextarea');

    const closeModal = () => {
      state.showCookiesModal = false;
      window.renderDownloader(container);
    };

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
    if (modalBackdrop) {
      modalBackdrop.addEventListener('click', e => {
        if (e.target === modalBackdrop) closeModal();
      });
    }

    if (browseBtn && fileInput) {
      browseBtn.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', () => {
        const file = fileInput.files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = ev => {
            if (textarea) textarea.value = ev.target?.result || '';
          };
          reader.readAsText(file);
        }
      });
    }

    if (saveBtn && textarea) {
      saveBtn.addEventListener('click', async () => {
        const content = textarea.value.trim();
        if (!content) {
          if (typeof window.toast === 'function') window.toast('Isi teks cookies tidak boleh kosong.');
          return;
        }

        state.cookiesSaving = true;
        saveBtn.disabled = true;

        try {
          const res = await fetch('/api/download/cookies', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content })
          });
          const data = await res.json();
          if (!res.ok || !data.ok) throw new Error(data.error || 'Gagal menyimpan cookies.');

          state.cookies = data;
          state.cookiesSaving = false;
          state.showCookiesModal = false;
          if (typeof window.toast === 'function') window.toast('✓ File cookies.txt berhasil disimpan!');
          window.renderDownloader(container);
        } catch (err) {
          state.cookiesSaving = false;
          saveBtn.disabled = false;
          if (typeof window.toast === 'function') window.toast('Error: ' + err.message);
        }
      });
    }

    if (deleteBtn) {
      deleteBtn.addEventListener('click', async () => {
        if (!confirm('Hapus file cookies.txt dari server?')) return;
        try {
          const res = await fetch('/api/download/cookies', { method: 'DELETE' });
          const data = await res.json();
          state.cookies = { exists: false, domains: [], size: 0 };
          state.showCookiesModal = false;
          if (typeof window.toast === 'function') window.toast('✓ Cookies berhasil dihapus.');
          window.renderDownloader(container);
        } catch (err) {
          if (typeof window.toast === 'function') window.toast('Gagal menghapus cookies: ' + err.message);
        }
      });
    }
  }

  function triggerDownload(formatId, info, container) {
    const format = (info.formats || []).find(f => f.id === formatId) || { label: formatId, ext: 'mp4' };

    state.downloadingId = formatId;
    state.downloadLabel = `${format.label} (${format.ext.toUpperCase()})`;

    const params = new URLSearchParams({
      url: info.url,
      quality: formatId,
      title: info.title || 'video'
    });

    const streamUrl = `/api/download/stream?${params.toString()}`;
    state.downloadStreamUrl = streamUrl;
    window.renderDownloader(container);

    // 1. Direct browser anchor click (reliable across Chrome, Safari, Firefox, Edge)
    const safeTitle = (info.title || 'media').replace(/[^\w\s.-]/g, '').slice(0, 60).trim();
    const downloadLink = document.createElement('a');
    downloadLink.href = streamUrl;
    downloadLink.download = `${safeTitle || 'media'}.${format.ext}`;
    downloadLink.target = '_blank';
    downloadLink.rel = 'noopener noreferrer';
    document.body.appendChild(downloadLink);
    downloadLink.click();

    setTimeout(() => {
      try {
        if (downloadLink.parentNode) {
          downloadLink.parentNode.removeChild(downloadLink);
        }
      } catch {}
    }, 1500);

    if (typeof window.toast === 'function') {
      window.toast(`Memulai pengunduhan ${format.label}...`);
    }

    setTimeout(() => {
      state.downloadingId = null;
      const curBtn = container.querySelector(`[data-download-format="${formatId}"]`);
      if (curBtn) {
        curBtn.removeAttribute('disabled');
        const act = curBtn.querySelector('.format-action');
        if (act) act.textContent = '✓ Unduhan Dimulai';
      }
    }, 3500);
  }
})();
