import fs from 'node:fs';
import path from 'node:fs';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const APP_URL = process.env.APP_URL || 'http://localhost:3000';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const LOCAL_API = 'http://127.0.0.1:3000';
const AUTH_FILE = './data/telegram_auth.json';

const STAGE_MAP = {
  ide: 'idea',
  idea: 'idea',
  naskah: 'script',
  script: 'script',
  produksi: 'production',
  production: 'production',
  editing: 'editing',
  review: 'review',
  siap: 'ready',
  ready: 'ready'
};

const STAGE_LABELS = {
  idea: '💡 Ide',
  script: '📝 Naskah',
  production: '🎬 Produksi',
  editing: '✂️ Editing',
  review: '👀 Review',
  ready: '🚀 Siap Upload'
};

let cachedContents = [];

function loadAuthorizedUsers() {
  try {
    if (fs.existsSync(AUTH_FILE)) {
      return JSON.parse(fs.readFileSync(AUTH_FILE, 'utf8'));
    }
  } catch {}
  return [];
}

function saveAuthorizedUser(userId) {
  try {
    const list = loadAuthorizedUsers();
    if (!list.includes(userId)) {
      list.push(userId);
      fs.mkdirSync('./data', { recursive: true });
      fs.writeFileSync(AUTH_FILE, JSON.stringify(list, null, 2));
    }
  } catch (err) {
    console.error('Error saving auth user:', err.message);
  }
}

async function tgFetch(method, payload = {}) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/${method}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return res.json();
}

async function sendMessage(chatId, text, extra = {}) {
  return tgFetch('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    ...extra
  });
}

// Login to local API
let sessionCookie = '';
async function getCookie() {
  if (sessionCookie) return sessionCookie;
  try {
    const res = await fetch(`${LOCAL_API}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: ADMIN_PASSWORD })
    });
    const cookie = res.headers.get('set-cookie');
    if (cookie) {
      sessionCookie = cookie.split(';')[0];
    }
  } catch (err) {
    console.error('Login to local API failed:', err.message);
  }
  return sessionCookie;
}

async function fetchContents() {
  const cookie = await getCookie();
  const res = await fetch(`${LOCAL_API}/api/contents`, {
    headers: { Cookie: cookie }
  });
  if (res.status === 401) {
    sessionCookie = '';
    const newCookie = await getCookie();
    const retry = await fetch(`${LOCAL_API}/api/contents`, { headers: { Cookie: newCookie } });
    const data = await retry.json();
    cachedContents = data.contents || [];
    return cachedContents;
  }
  const data = await res.json();
  cachedContents = data.contents || [];
  return cachedContents;
}

function helpMessage() {
  return `🤖 <b>Reframe Content Hub Bot</b>

Selamat datang! Berikut daftar perintah yang bisa Anda gunakan:

📋 <b>Manajemen Konten:</b>
• <code>/konten</code> - Lihat 10 konten terbaru di kanban
• <code>/ide [judul]</code> - Tambah ide baru langsung ke Kanban
• <code>/alert</code> - Cek konten yang lewat tenggat atau deadline hari ini
• <code>/pindah [no] [tahap]</code> - Pindahkan tahap (contoh: <code>/pindah 1 produksi</code>)
• <code>/naskah [no]</code> - Baca naskah tersimpan untuk konten tertentu
• <code>/tulis [no] [naskah]</code> - Simpan naskah ke konten

⚡ <b>Sistem & DevOps:</b>
• <code>/status</code> - Cek status kesehatan server VPS (RAM, CPU, Versi)
• <code>/update</code> - Tarik kode terbaru dari GitHub & restart aplikasi
• <code>/restart</code> - Restart server web app

<i>Pilihan tahap untuk /pindah: ide, naskah, produksi, editing, review, siap</i>`;
}

async function handleMessage(msg) {
  const chatId = msg.chat?.id;
  const userId = msg.from?.id;
  const text = (msg.text || '').trim();

  if (!chatId || !text) return;

  const authUsers = loadAuthorizedUsers();
  const isAuth = authUsers.includes(userId);

  // Authentication check
  if (!isAuth) {
    if (text === ADMIN_PASSWORD) {
      saveAuthorizedUser(userId);
      await sendMessage(chatId, `✅ <b>Otorisasi Berhasil!</b>\n\nAkun Telegram Anda telah terhubung ke Reframe Content Hub.\n\n${helpMessage()}`);
      return;
    }
    await sendMessage(chatId, `🔒 <b>Akses Terkunci</b>\n\nSilakan kirimkan <b>Password Admin</b> aplikasi Anda untuk menghubungkan akun Telegram ini:`);
    return;
  }

  // Commands
  if (text === '/start' || text === '/help' || text === '/bantuan') {
    await sendMessage(chatId, helpMessage());
    return;
  }

  if (text === '/status') {
    try {
      const { stdout: uptime } = await execAsync('uptime -p || uptime');
      const { stdout: freeMem } = await execAsync('free -h | awk \'/Mem:/ {print $3 "/" $2}\'');
      const { stdout: disk } = await execAsync('df -h / | awk \'NR==2 {print $3 "/" $2 " (" $5 ")"}\'');
      const contents = await fetchContents();
      
      const res = `🖥️ <b>Status Server VPS:</b>\n` +
        `• <b>Uptime:</b> ${uptime.trim()}\n` +
        `• <b>RAM Terpakai:</b> ${freeMem.trim()}\n` +
        `• <b>Disk Terpakai:</b> ${disk.trim()}\n` +
        `• <b>Total Konten:</b> ${contents.length} konten\n` +
        `• <b>URL Web:</b> ${APP_URL}\n` +
        `• <b>Status Web:</b> ✅ Online (PM2 Active)`;
      await sendMessage(chatId, res);
    } catch (err) {
      await sendMessage(chatId, `❌ Gagal mengambil status: ${err.message}`);
    }
    return;
  }

  if (text === '/konten' || text === '/list') {
    try {
      const contents = await fetchContents();
      if (!contents.length) {
        await sendMessage(chatId, '📭 Belum ada konten di database.');
        return;
      }
      const active = contents.filter(c => !c.archived).slice(0, 10);
      let res = `📋 <b>10 Konten Terbaru di Hub:</b>\n\n`;
      active.forEach((c, i) => {
        const stageLabel = STAGE_LABELS[c.stage] || c.stage;
        res += `<b>#${i + 1}</b> ${c.title}\nTahap: ${stageLabel}\n\n`;
      });
      res += `<i>Gunakan <code>/pindah [no] [tahap]</code> untuk memindahkan status.</i>`;
      await sendMessage(chatId, res);
    } catch (err) {
      await sendMessage(chatId, `❌ Gagal memuat konten: ${err.message}`);
    }
    return;
  }

  if (text.startsWith('/ide ')) {
    const title = text.slice(5).trim();
    if (!title) {
      await sendMessage(chatId, '⚠️ Masukkan judul ide. Contoh: <code>/ide 5 Cara Edit Video Cepat</code>');
      return;
    }
    try {
      const cookie = await getCookie();
      const res = await fetch(`${LOCAL_API}/api/contents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify({ title, stage: 'idea', format: 'shorts' })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan ide');
      await sendMessage(chatId, `💡 <b>Ide Berhasil Disimpan ke Web App!</b>\n\n📌 <b>Judul:</b> ${data.content.title}\n📍 <b>Tahap:</b> 💡 Ide\n🔗 Buka web: ${APP_URL}`);
      await fetchContents();
    } catch (err) {
      await sendMessage(chatId, `❌ Gagal menyimpan ide: ${err.message}`);
    }
    return;
  }

  if (text.startsWith('/pindah ')) {
    const parts = text.split(/\s+/);
    const index = parseInt(parts[1], 10) - 1;
    const stageInput = (parts[2] || '').toLowerCase();
    const targetStage = STAGE_MAP[stageInput];

    if (isNaN(index) || !targetStage) {
      await sendMessage(chatId, '⚠️ Format salah.\nContoh: <code>/pindah 1 produksi</code>\nPilihan tahap: ide, naskah, produksi, editing, review, siap');
      return;
    }

    try {
      const contents = cachedContents.length ? cachedContents : await fetchContents();
      const active = contents.filter(c => !c.archived);
      const target = active[index];
      if (!target) {
        await sendMessage(chatId, `❌ Konten #${parts[1]} tidak ditemukan. Ketik <code>/konten</code> untuk melihat nomor.`);
        return;
      }

      const cookie = await getCookie();
      const res = await fetch(`${LOCAL_API}/api/contents/${target.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify({ revision: target.revision, stage: targetStage })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Gagal mengubah status');
      }
      await sendMessage(chatId, `✅ <b>Berhasil Dipindahkan!</b>\n\n📌 <b>Konten:</b> ${target.title}\n📍 <b>Tahap Baru:</b> ${STAGE_LABELS[targetStage] || targetStage}`);
      await fetchContents();
    } catch (err) {
      await sendMessage(chatId, `❌ Gagal memindahkan: ${err.message}`);
    }
    return;
  }

  if (text === '/alert') {
    try {
      const contents = await fetchContents();
      const today = new Date().toISOString().slice(0, 10);
      const alerts = contents.filter(c => {
        if (c.archived || c.stage === 'ready') return false;
        const targetDate = c.deadline || c.plannedPublishAt;
        if (!targetDate) return false;
        const targetTime = Date.parse(targetDate);
        return targetTime < Date.now() || targetDate.startsWith(today);
      });

      if (!alerts.length) {
        await sendMessage(chatId, '🎉 <b>Semua Beres!</b>\nTidak ada konten yang terlambat atau jatuh tempo hari ini.');
        return;
      }

      let res = `🚨 <b>${alerts.length} Konten Memerlukan Perhatian:</b>\n\n`;
      alerts.forEach((c, i) => {
        const isOverdue = Date.parse(c.deadline || c.plannedPublishAt) < Date.now();
        const tag = isOverdue ? '⚠️ LEWAT TENGGAT' : '🔔 HARI INI';
        res += `<b>[${tag}]</b> ${c.title}\nTahap: ${STAGE_LABELS[c.stage] || c.stage}\n\n`;
      });
      await sendMessage(chatId, res);
    } catch (err) {
      await sendMessage(chatId, `❌ Gagal memeriksa alert: ${err.message}`);
    }
    return;
  }

  if (text.startsWith('/naskah ')) {
    const num = parseInt(text.slice(8).trim(), 10);
    if (isNaN(num)) {
      await sendMessage(chatId, '⚠️ Masukkan nomor konten. Contoh: <code>/naskah 1</code>');
      return;
    }
    try {
      const contents = cachedContents.length ? cachedContents : await fetchContents();
      const target = contents.filter(c => !c.archived)[num - 1];
      if (!target) {
        await sendMessage(chatId, '❌ Konten tidak ditemukan. Ketik <code>/konten</code> untuk melihat nomor.');
        return;
      }
      const cookie = await getCookie();
      const res = await fetch(`${LOCAL_API}/api/contents/${target.id}`, { headers: { Cookie: cookie } });
      const data = await res.json();
      const script = data.content?.script || '';
      if (!script.trim()) {
        await sendMessage(chatId, `📝 Konten <b>"${target.title}"</b> belum memiliki naskah.\nGunakan <code>/tulis ${num} [teks naskah]</code> untuk mengisi.`);
        return;
      }
      await sendMessage(chatId, `📝 <b>Naskah: ${target.title}</b>\n\n${script.slice(0, 3800)}`);
    } catch (err) {
      await sendMessage(chatId, `❌ Gagal mengambil naskah: ${err.message}`);
    }
    return;
  }

  if (text.startsWith('/tulis ')) {
    const parts = text.slice(7).trim().split('\n');
    const firstLine = parts[0].trim();
    const spaceIdx = firstLine.indexOf(' ');
    let numStr = firstLine;
    let inlineScript = '';
    if (spaceIdx !== -1) {
      numStr = firstLine.slice(0, spaceIdx);
      inlineScript = firstLine.slice(spaceIdx + 1);
    }
    const num = parseInt(numStr, 10);
    const bodyScript = [inlineScript, ...parts.slice(1)].join('\n').trim();

    if (isNaN(num) || !bodyScript) {
      await sendMessage(chatId, '⚠️ Format salah.\nContoh: <code>/tulis 1 Naskah cerita pembuka disini...</code>');
      return;
    }

    try {
      const contents = cachedContents.length ? cachedContents : await fetchContents();
      const target = contents.filter(c => !c.archived)[num - 1];
      if (!target) {
        await sendMessage(chatId, '❌ Konten tidak ditemukan. Ketik <code>/konten</code> untuk melihat nomor.');
        return;
      }
      const cookie = await getCookie();
      const res = await fetch(`${LOCAL_API}/api/contents/${target.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify({ revision: target.revision, script: bodyScript })
      });
      if (!res.ok) throw new Error('Gagal menyimpan naskah');
      await sendMessage(chatId, `✍️ <b>Naskah Berhasil Disimpan!</b>\n\n📌 <b>Konten:</b> ${target.title}\n📊 Panjang: ${bodyScript.length} karakter`);
      await fetchContents();
    } catch (err) {
      await sendMessage(chatId, `❌ Gagal menyimpan naskah: ${err.message}`);
    }
    return;
  }

  if (text === '/update') {
    await sendMessage(chatId, '🔄 Memperbarui aplikasi dari GitHub...');
    try {
      const { stdout: pullOut } = await execAsync('git pull origin main');
      const { stdout: checkOut } = await execAsync('npm run check');
      await execAsync('pm2 reload yt-hub');
      await sendMessage(chatId, `✅ <b>Update Berhasil!</b>\n\n<code>${pullOut.slice(0, 1000)}</code>\n\nAplikasi telah direload.`);
    } catch (err) {
      await sendMessage(chatId, `❌ Gagal update: ${err.message}`);
    }
    return;
  }

  if (text === '/restart') {
    await sendMessage(chatId, '🔄 Merestart aplikasi...');
    try {
      await execAsync('pm2 restart yt-hub');
      await sendMessage(chatId, '✅ Aplikasi web berhasil direstart dan berjalan normal.');
    } catch (err) {
      await sendMessage(chatId, `❌ Gagal restart: ${err.message}`);
    }
    return;
  }

  // Fallback for unknown messages
  await sendMessage(chatId, `❓ Perintah tidak dikenali.\nKetik <code>/bantuan</code> untuk melihat daftar perintah.`);
}

let offset = 0;
let isPolling = false;

async function pollUpdates() {
  if (isPolling) return;
  isPolling = true;
  try {
    const res = await tgFetch('getUpdates', { offset, timeout: 25 });
    if (res.ok && Array.isArray(res.result)) {
      for (const update of res.result) {
        offset = update.update_id + 1;
        if (update.message) {
          try {
            await handleMessage(update.message);
          } catch (err) {
            console.error('Error handling message:', err);
          }
        }
      }
    }
  } catch (err) {
    console.error('Polling error:', err.message);
    await new Promise(r => setTimeout(r, 3000));
  } finally {
    isPolling = false;
  }
}

async function start() {
  if (!BOT_TOKEN) {
    console.error('TELEGRAM_BOT_TOKEN not provided in environment!');
    process.exit(1);
  }
  console.log('🤖 Telegram Bot starting...');
  const me = await tgFetch('getMe');
  if (!me.ok) {
    console.error('Failed to connect to Telegram:', me.description);
    process.exit(1);
  }
  console.log(`Telegram Bot connected as @${me.result.username} (${me.result.first_name})`);

  // Start polling loop
  while (true) {
    await pollUpdates();
  }
}

start().catch(err => {
  console.error('Bot crashed:', err);
  process.exit(1);
});
