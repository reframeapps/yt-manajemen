window.HubRadarSocial = (() => {
  let isScanning = false;
  let reportData = null;

  const date = value => {
    if (!value) return 'Belum pernah dipindai';
    return new Date(value).toLocaleString('id-ID', {
      timeZone: 'Asia/Jakarta',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }) + ' WIB';
  };

  const stars = score => {
    const s = Math.max(1, Math.min(5, Number(score) || 4));
    return '★'.repeat(s) + '☆'.repeat(5 - s) + ` (${s}/5)`;
  };

  const platformBadgeClass = p => {
    if (/x|twitter/i.test(p)) return 'badge-twitter';
    if (/tiktok/i.test(p)) return 'badge-tiktok';
    return 'badge-forum';
  };

  async function load(host) {
    const container = host.querySelector('[data-social-body]');
    if (!container) return;

    try {
      const data = await api('/api/radar/social-intelligence');
      reportData = data;
      renderBody(host, data);
    } catch (e) {
      container.innerHTML = `<div class="notice">Gagal memuat radar intelijen sosmed: ${esc(e.message)}</div><button type="button" class="btn" data-social-retry>Coba lagi</button>`;
    }
  }

  function renderBody(host, data) {
    const container = host.querySelector('[data-social-body]');
    const statusText = host.querySelector('[data-social-status]');
    const scanBtn = host.querySelector('#radarSocialScanBtn');
    if (!container) return;

    if (statusText) {
      statusText.textContent = data.lastScanAt ? `Terakhir: ${date(data.lastScanAt)}` : 'Belum pernah dipindai';
    }

    if (scanBtn) {
      scanBtn.disabled = data.isScanning || isScanning;
      scanBtn.textContent = (data.isScanning || isScanning) ? '⚡ Memindai Sosmed...' : '⚡ Pindai Sosmed Sekarang';
    }

    if (data.isScanning || isScanning) {
      container.innerHTML = `
        <div class="radar-social-loading">
          <p><strong>⚡ Sedang memantau sinyal viral sosmed & tren pencarian...</strong></p>
          <p class="hint">Gemini 3.5 Flash sedang mengkurasi Top 5 ide investigasi terbaik berdasarkan 7 Pilar (Politik, Ekonomi, Geopolitik, Sisi Gelap, Hukum, Investigasi, Kebijakan).</p>
        </div>
      `;
      return;
    }

    if (!data.items || !data.items.length) {
      container.innerHTML = `
        <div class="hub-panel empty radar-social-empty">
          <p>Belum ada data intelijen sosmed terbaru.</p>
          <p class="hint">Klik tombol <strong>⚡ Pindai Sosmed Sekarang</strong> di atas untuk memindai tren X/Twitter, TikTok, & Google Trends secara langsung.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="radar-social-grid">
        ${data.items.map((item, idx) => `
          <article class="radar-social-card" data-card-id="${esc(item.id)}">
            <div class="radar-social-card-head">
              <div class="radar-social-tags">
                <span class="radar-social-rank">#${idx + 1}</span>
                <span class="radar-social-badge ${platformBadgeClass(item.platform)}">${esc(item.platform)}</span>
                <span class="radar-social-pillar">${esc(item.pillar)}</span>
              </div>
              <div class="radar-social-score" title="Skor Potensi Investigasi & Viralitas">
                <span class="star-text">${stars(item.viralityScore)}</span>
              </div>
            </div>

            <h4 class="radar-social-title">${esc(item.title)}</h4>

            <div class="radar-social-section">
              <span class="radar-social-label">🔥 Konteks Netizen:</span>
              <p>${esc(item.netizenSummary)}</p>
            </div>

            <div class="radar-social-section angle-section">
              <span class="radar-social-label">🔍 Sudut Investigasi REFRAME:</span>
              <p>${esc(item.recommendedAngle)}</p>
            </div>

            ${item.suggestedHook ? `
              <div class="radar-social-section hook-section">
                <span class="radar-social-label">🎙️ Hook Pembuka (5 Detik):</span>
                <p><em>"${esc(item.suggestedHook)}"</em></p>
              </div>
            ` : ''}

            <div class="radar-social-card-footer">
              ${item.sourceUrl ? `
                <a href="${esc(item.sourceUrl)}" target="_blank" rel="noopener noreferrer" class="radar-social-source-link">
                  Lihat Sumber ↗
                </a>
              ` : '<span></span>'}
              <button type="button" class="btn primary mini radar-to-kanban-btn" data-to-kanban-id="${esc(item.id)}">
                + Jadikan Konten Kanban
              </button>
            </div>
          </article>
        `).join('')}
      </div>
    `;
  }

  async function triggerScan(host) {
    if (isScanning) return;
    isScanning = true;
    renderBody(host, { ...(reportData || {}), isScanning: true });

    try {
      const res = await api('/api/radar/social-intelligence/scan', { method: 'POST', body: '{}' });
      reportData = res;
      toast('Pemindaian radar sosmed selesai! Top 5 ide berhasil dirumuskan.');
      renderBody(host, res);
      if (typeof window.radarLoad === 'function') {
        window.radarLoad().catch(() => {});
      }
    } catch (e) {
      toast('Gagal memindai: ' + e.message);
      if (reportData) renderBody(host, reportData);
      else load(host);
    } finally {
      isScanning = false;
      const scanBtn = host.querySelector('#radarSocialScanBtn');
      if (scanBtn) {
        scanBtn.disabled = false;
        scanBtn.textContent = '⚡ Pindai Sosmed Sekarang';
      }
    }
  }

  async function convertToKanban(host, itemId, buttonEl) {
    if (!buttonEl || buttonEl.disabled) return;
    const oldText = buttonEl.textContent;
    buttonEl.disabled = true;
    buttonEl.textContent = 'Menambahkan...';

    try {
      const res = await api('/api/radar/social-intelligence/to-kanban', {
        method: 'POST',
        body: JSON.stringify({ id: itemId })
      });
      toast(`Ide "${res.content.title}" berhasil masuk ke Kanban (kolom Ide)!`);
      buttonEl.textContent = '✓ Tersimpan di Kanban';
      buttonEl.classList.remove('primary');
      buttonEl.classList.add('success-state');
    } catch (e) {
      buttonEl.disabled = false;
      buttonEl.textContent = oldText;
      toast('Gagal menambahkan ke Kanban: ' + e.message);
    }
  }

  function render(host) {
    if (!host) return;

    host.innerHTML = `
      <div class="radar-social-heading">
        <div>
          <span class="eyebrow">INTELIJEN SOSMED & 7 PILAR</span>
          <h3>Radar Intelijen Sosmed & Ide Potensial</h3>
          <p class="hint">Memantau tren percakapan X/Twitter, TikTok, & Forum Publik berdasarkan 7 Pilar Investigasi (Politik, Ekonomi, Geopolitik, Sisi Gelap, Hukum, Investigasi, Kebijakan). Otomatis 1x sehari + pemindaian mandiri.</p>
        </div>
        <div class="radar-social-controls">
          <span class="radar-social-status" data-social-status>Memuat...</span>
          <button type="button" class="btn primary" id="radarSocialScanBtn">⚡ Pindai Sosmed Sekarang</button>
        </div>
      </div>
      <div data-social-body aria-live="polite">
        <p class="hint">Memuat radar intelijen sosmed...</p>
      </div>
    `;

    host.onclick = e => {
      const scanBtn = e.target.closest('#radarSocialScanBtn');
      if (scanBtn) {
        triggerScan(host);
        return;
      }
      const retryBtn = e.target.closest('[data-social-retry]');
      if (retryBtn) {
        load(host);
        return;
      }
      const kanbanBtn = e.target.closest('[data-to-kanban-id]');
      if (kanbanBtn) {
        convertToKanban(host, kanbanBtn.dataset.toKanbanId, kanbanBtn);
        return;
      }
    };

    void load(host);
  }

  return { render };
})();
