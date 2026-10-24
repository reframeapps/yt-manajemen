import fs from 'node:fs';
import path from 'node:path';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const APP_URL = process.env.APP_URL || 'http://localhost:3000';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const LOCAL_API = 'http://127.0.0.1:3000';
const AUTH_FILE = './data/telegram_auth.json';
const ENV_FILE = './.env';

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
const chatHistories = new Map(); // chatId -> Array of { role: 'user'|'model', text: string }

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

async function sendTyping(chatId) {
  try {
    await tgFetch('sendChatAction', { chat_id: chatId, action: 'typing' });
  } catch {}
}

function markdownToTelegramHtml(text) {
  if (!text) return '';
  let s = String(text);
  // Escape raw HTML entities first
  s = s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  // Code blocks: ```code```
  s = s.replace(/```(?:[a-zA-Z0-9_-]*\n)?([\s\S]*?)```/g, '<pre>$1</pre>');
  // Inline code: `code`
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  // Bold: **text** or __text__
  s = s.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
  s = s.replace(/__(.*?)__/g, '<b>$1</b>');
  // Italic: *text* or _text_
  s = s.replace(/(^|[^\*])\*([^\*]+)\*([^\*]|$)/g, '$1<i>$2</i>$3');
  s = s.replace(/(^|[^_])_([^_]+)_([^_]|$)/g, '$1<i>$2</i>$3');
  // Headers: ### Header -> <b>Header</b>
  s = s.replace(/^#{1,6}\s*(.*)$/gm, '<b>$1</b>');
  return s;
}

async function sendMessage(chatId, text, extra = {}) {
  const payload = {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    ...extra
  };
  try {
    const res = await tgFetch('sendMessage', payload);
    if (!res.ok) {
      // Fallback without parse_mode if HTML entity error occurs
      return tgFetch('sendMessage', {
        chat_id: chatId,
        text: text.replace(/<[^>]+>/g, ''),
        ...extra
      });
    }
    return res;
  } catch (err) {
    return tgFetch('sendMessage', {
      chat_id: chatId,
      text: text.replace(/<[^>]+>/g, ''),
      ...extra
    });
  }
}

async function sendSmartMessage(chatId, rawText, extra = {}) {
  const formatted = markdownToTelegramHtml(rawText);
  if (formatted.length <= 4000) {
    return sendMessage(chatId, formatted, extra);
  }
  const paragraphs = formatted.split('\n\n');
  let current = '';
  for (const p of paragraphs) {
    if ((current + '\n\n' + p).length > 3900) {
      if (current) await sendMessage(chatId, current, extra);
      current = p;
    } else {
      current = current ? (current + '\n\n' + p) : p;
    }
  }
  if (current) {
    await sendMessage(chatId, current, extra);
  }
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

// AI Configuration Helpers
function getActiveAiConfig() {
  const provider = (process.env.AI_PROVIDER || 'gemini').toLowerCase();
  const geminiKey = process.env.GEMINI_API_KEY || '';
  const groqKey = process.env.GROQ_API_KEY || '';
  const openAiKey = process.env.OPENAI_API_KEY || '';
  
  if (provider === 'gemini' && geminiKey) return { provider: 'gemini', key: geminiKey, model: 'gemini-2.5-flash' };
  if (provider === 'groq' && groqKey) return { provider: 'groq', key: groqKey, model: 'llama-3.3-70b-versatile' };
  if (provider === 'openai' && openAiKey) return { provider: 'openai', key: openAiKey, model: 'gpt-4o-mini' };
  
  // Auto-fallback if another key is present
  if (geminiKey) return { provider: 'gemini', key: geminiKey, model: 'gemini-2.5-flash' };
  if (groqKey) return { provider: 'groq', key: groqKey, model: 'llama-3.3-70b-versatile' };
  if (openAiKey) return { provider: 'openai', key: openAiKey, model: 'gpt-4o-mini' };
  
  return null;
}

function updateEnvAiKey(provider, key) {
  try {
    let content = fs.existsSync(ENV_FILE) ? fs.readFileSync(ENV_FILE, 'utf8') : '';
    const keyVar = provider === 'gemini' ? 'GEMINI_API_KEY' : provider === 'groq' ? 'GROQ_API_KEY' : 'OPENAI_API_KEY';
    
    // Update AI_PROVIDER
    if (/^AI_PROVIDER=.*$/m.test(content)) {
      content = content.replace(/^AI_PROVIDER=.*$/m, `AI_PROVIDER=${provider}`);
    } else {
      content += `\nAI_PROVIDER=${provider}`;
    }
    
    // Update Key
    const keyRegex = new RegExp(`^${keyVar}=.*$`, 'm');
    if (keyRegex.test(content)) {
      content = content.replace(keyRegex, `${keyVar}=${key}`);
    } else {
      content += `\n${keyVar}=${key}`;
    }
    
    fs.writeFileSync(ENV_FILE, content.trim() + '\n', 'utf8');
    process.env.AI_PROVIDER = provider;
    process.env[keyVar] = key;
    return true;
  } catch (err) {
    console.error('Failed to update env key:', err);
    return false;
  }
}

async function queryLLM({ provider, key, model, messages, systemPrompt }) {
  if (provider === 'gemini') {
    const geminiMsgs = messages.map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.text }]
    }));
    
    // Primary model: gemini-2.5-flash, fallback: gemini-1.5-flash
    const modelsToTry = [model || 'gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-2.0-flash'];
    let lastErr = null;
    
    for (const m of modelsToTry) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${key}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: geminiMsgs,
            generationConfig: { temperature: 0.7, maxOutputTokens: 2048 }
          })
        });
        if (res.ok) {
          const data = await res.json();
          const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (reply) return reply;
        } else {
          const errData = await res.json().catch(() => ({}));
          lastErr = errData.error?.message || `HTTP ${res.status}`;
        }
      } catch (err) {
        lastErr = err.message;
      }
    }
    throw new Error(`Gemini gagal: ${lastErr || 'Koneksi terputus'}`);
  }

  if (provider === 'groq') {
    const groqMsgs = [{ role: 'system', content: systemPrompt }];
    for (const m of messages) {
      groqMsgs.push({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text });
    }
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`
      },
      body: JSON.stringify({
        model: model || 'llama-3.3-70b-versatile',
        messages: groqMsgs,
        temperature: 0.7,
        max_tokens: 2048
      })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `Groq error (HTTP ${res.status})`);
    }
    const data = await res.json();
    return data.choices?.[0]?.message?.content || '';
  }

  if (provider === 'openai') {
    const oaiMsgs = [{ role: 'system', content: systemPrompt }];
    for (const m of messages) {
      oaiMsgs.push({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text });
    }
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`
      },
      body: JSON.stringify({
        model: model || 'gpt-4o-mini',
        messages: oaiMsgs,
        temperature: 0.7,
        max_tokens: 2048
      })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `OpenAI error (HTTP ${res.status})`);
    }
    const data = await res.json();
    return data.choices?.[0]?.message?.content || '';
  }

  throw new Error(`Provider ${provider} tidak didukung.`);
}

function heuristicConsultation(query, contentsSummary) {
  const q = query.toLowerCase();
  
  if (/^(halo|hai|pagi|siang|malam|bot|assalamu(?:['`]?|al)aikum)/i.test(q)) {
    return `Halo! Saya Asisten & Konsultan Eksekutif Konten untuk <b>REFRAME INVESTIGASI</b>.\n\n` +
      `Saya siap menemani Anda berdiskusi dan mengawal produksi kapan saja:\n` +
      `• 🔍 <b>Brainstorming Kasus & Ide</b>: cari sudut pandang investigasi yang tak terduga\n` +
      `• 🎣 <b>Hook 15 Detik Pertama</b>: formula pembuka yang memaku atensi penonton\n` +
      `• 📝 <b>Bedah Naskah & Pacing</b>: struktur 3-babak investigasi agar retensi tinggi\n` +
      `• 📊 <b>Manajemen Kanban</b>: pantau dan kelola kartu produksi konten\n\n` +
      `Topik atau kasus investigasi apa yang ingin kita bahas sekarang?`;
  }

  if (q.includes('ide') || q.includes('topik') || q.includes('kasus') || q.includes('bahas') || q.includes('konsep')) {
    return `💡 <b>Konsultasi Sudut Pandang Investigasi:</b>\n\n` +
      `Untuk topik <i>"${query}"</i>, berikut 3 sudut pandang (Angle) tajam untuk REFRAME INVESTIGASI:\n\n` +
      `<b>1. Angle Aliran Dana (Follow The Money)</b>\nFokus: Mengapa kasus ini bisa terjadi dan siapa pemetik keuntungan terbesarnya? Penonton sangat tertarik melihat visualisasi skema uang dan jejak transaksi.\n\n` +
      `<b>2. Angle Korban & Dampak Nyata (Human Interest)</b>\nFokus: Menghadirkan penderitaan atau kesaksian nyata di menit awal agar penonton merasa kasus ini mendesak dan dekat dengan mereka.\n\n` +
      `<b>3. Angle Celah Regulasi & Pembiaran Sistemik</b>\nFokus: Membongkar bagaimana aturan sengaja dibuat longgar atau ada pembiaran oleh pihak berwenang.\n\n` +
      `<i>💡 Ketik <code>Simpan ide: [Judul]</code> jika Anda ingin ide ini langsung dicatat ke Kanban!</i>\n\n` +
      `<i>💡 Ingin berdiskusi bebas tanpa batas layaknya ChatGPT? Cukup aktifkan AI penuh dengan ketik: <code>/setkey gemini [API_KEY]</code> (gratis di aistudio.google.com).</i>`;
  }

  if (q.includes('hook') || q.includes('judul') || q.includes('opening') || q.includes('pembuka') || q.includes('ctr')) {
    return `🎣 <b>Rekomendasi Formula Hook & Packaging CTR:</b>\n\n` +
      `Untuk topik investigasi, gunakan 3 formula pembuka 15 detik pertama:\n\n` +
      `<b>Formula 1: The Inverted Truth (Membalik Fakta Umum)</b>\n<i>"Kalian mengira kasus ini selesai saat pelakunya ditangkap. Tapi data transaksi ini membuktikan... permainan sesungguhnya baru saja dimulai."</i>\n\n` +
      `<b>Formula 2: The Direct Stakes (Ancaman Langsung)</b>\n<i>"Dalam 10 menit ke depan, saya akan tunjukkan bagaimana sindikat ini bisa menguras tabungan Anda tanpa disadari—bahkan dengan bantuan orang dalam."</i>\n\n` +
      `<b>Formula 3: The Classified Evidence (Bukti Rahasia)</b>\n<i>"Dokumen setebal 40 halaman yang baru saja bocor ini membongkar nama-nama besar yang selama ini aman dari jerat hukum."</i>`;
  }

  if (q.includes('naskah') || q.includes('script') || q.includes('alur') || q.includes('struktur')) {
    return `📝 <b>Panduan Struktur Naskah Investigasi 3-Babak:</b>\n\n` +
      `<b>Babak 1: The Inciting Mystery (Menit 00:00 - 02:00)</b>\n• Hook 15 detik: lontarkan kejanggalan terbesar.\n• Tarik rasa penasaran: tunjukkan bukti potongan dokumen atau headline berita.\n\n` +
      `<b>Babak 2: The Escalation & Deep Dive (Menit 02:00 - 08:00)</b>\n• Telusuri kronologi dan motif.\n• Sajikan visualisasi data dan keterlibatan pihak-pihak terkait.\n• Sisipkan cliffhanger di pertengahan video agar retensi penonton tidak jatuh.\n\n` +
      `<b>Babak 3: The Verdict & Reflection (Menit 08:00 - Selesai)</b>\n• Puncak pengungkapan fakta.\n• Refleksi: apa artinya bagi masyarakat dan bahaya laten yang harus diwaspadai.\n• Call to Action: ajak penonton berdiskusi di kolom komentar.`;
  }

  return `🤝 <b>Asisten REFRAME INVESTIGASI:</b>\n\n` +
    `Saya menerima pesan Anda: <i>"${query}"</i>.\n\n` +
    `Sebagai partner produksi, saya bisa membantu merumuskan konsep, membedah hook, atau menyusun naskah investigasi secara mendalam.\n\n` +
    `💡 <b>Tips Mengaktifkan Mode AI Penuh (Gemini / Groq):</b>\n` +
    `Ketik perintah berikut untuk mengaktifkan kecerdasan percakapan bebas:\n` +
    `<code>/setkey gemini [API_KEY_ANDA]</code>\n` +
    `<i>(API key Gemini bisa didapatkan gratis di aistudio.google.com).</i>`;
}

function helpMessage() {
  return `🤖 <b>Reframe Content Hub - AI Assistant & Consultant</b>

Selamat datang! Saya adalah Asisten & Konsultan Eksekutif Konten Anda untuk <b>REFRAME INVESTIGASI</b>.

💬 <b>Konsultasi & Diskusi Bebas:</b>
Anda bisa chat langsung apa saja tanpa format kaku:
• Diskusi ide kasus ("Bantu cari angle kasus mafia tanah")
• Minta dibuatkan hook ("Buatkan 3 hook 15 detik tentang judi online")
• Konsultasi naskah ("Gimana cara bikin cliffhanger di menit ke-5?")
• Simpan ide otomatis (Ketik: <code>Simpan ide: [Judul Ide]</code>)

📋 <b>Perintah Cepat Kanban:</b>
• <code>/konten</code> - Lihat 10 konten aktif di Kanban
• <code>/ide [judul]</code> - Tambah kartu ide baru ke Kanban
• <code>/alert</code> - Cek konten yang lewat tenggat atau deadline hari ini
• <code>/pindah [no] [tahap]</code> - Pindahkan tahap (contoh: <code>/pindah 1 produksi</code>)
• <code>/naskah [no]</code> - Baca naskah tersimpan untuk konten tertentu
• <code>/tulis [no] [naskah]</code> - Simpan atau perbarui naskah

🤖 <b>Kecerdasan AI (LLM):</b>
• <code>/ai</code> - Cek status koneksi AI provider aktif
• <code>/setkey gemini [KEY]</code> - Pasang API Key Gemini (gratis di Google AI Studio)
• <code>/setkey groq [KEY]</code> - Pasang API Key Groq
• <code>/clear</code> - Bersihkan riwayat obrolan konsultasi untuk mulai topik baru

⚡ <b>Sistem & DevOps:</b>
• <code>/status</code> - Cek RAM, CPU, disk, dan uptime server VPS
• <code>/update</code> - Tarik pembaruan kode terbaru dari GitHub
• <code>/restart</code> - Restart server web app

<i>Pilihan tahap: ide, naskah, produksi, editing, review, siap</i>`;
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

  if (text === '/clear' || text === '/reset') {
    chatHistories.delete(chatId);
    await sendMessage(chatId, '🧹 <b>Riwayat Obrolan Dibersihkan!</b>\n\nMemori percakapan telah direset. Kita siap memulai topik diskusi baru.');
    return;
  }

  if (text === '/ai') {
    const aiConfig = getActiveAiConfig();
    if (!aiConfig) {
      await sendMessage(chatId, `🤖 <b>Status AI: Belum Terkonfigurasi</b>\n\nMode konsultasi saat ini menggunakan modul panduan internal.\n\nUntuk mengaktifkan model LLM penuh (diskusi bebas tak terbatas), pasang API Key dengan perintah:\n<code>/setkey gemini [API_KEY_ANDA]</code>\n<i>(Kunci gratis dari aistudio.google.com)</i>`);
      return;
    }
    await sendMessage(chatId, `🤖 <b>Status AI Aktif:</b>\n\n• <b>Provider:</b> ${aiConfig.provider.toUpperCase()}\n• <b>Model:</b> ${aiConfig.model}\n• <b>Status:</b> ✅ Terhubung & Siap Konsultasi\n\nAnda bisa langsung chat santai tentang topik apa saja.`);
    return;
  }

  if (text.startsWith('/setkey ')) {
    const parts = text.split(/\s+/);
    if (parts.length < 3) {
      await sendMessage(chatId, `⚠️ <b>Format Salah</b>\nContoh: <code>/setkey gemini AIzaSy...</code>\nPilihan provider: <code>gemini</code>, <code>groq</code>, <code>openai</code>`);
      return;
    }
    const provider = parts[1].toLowerCase();
    const key = parts[2].trim();
    if (!['gemini', 'groq', 'openai'].includes(provider)) {
      await sendMessage(chatId, `⚠️ Provider tidak dikenal. Gunakan: <code>gemini</code>, <code>groq</code>, atau <code>openai</code>`);
      return;
    }
    await sendTyping(chatId);
    const ok = updateEnvAiKey(provider, key);
    if (!ok) {
      await sendMessage(chatId, `❌ Gagal menyimpan kunci ke .env.`);
      return;
    }
    // Test key
    try {
      await queryLLM({
        provider,
        key,
        model: provider === 'gemini' ? 'gemini-2.5-flash' : provider === 'groq' ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini',
        messages: [{ role: 'user', text: 'Halo! Balas dengan 5 kata bahwa kamu siap bertugas.' }],
        systemPrompt: 'Kamu asisten YouTube.'
      });
      await sendMessage(chatId, `✅ <b>Kunci AI Berhasil Diaktifkan!</b>\n\n• <b>Provider:</b> ${provider.toUpperCase()}\n• <b>Status:</b> Terverifikasi & Aktif 100%\n\nSekarang Anda bisa berdiskusi bebas, meminta analisis naskah, atau mencari ide kapan saja via chat ini!`);
    } catch (err) {
      await sendMessage(chatId, `⚠️ <b>Kunci Tersimpan Namun Uji Koneksi Gagal:</b>\n${err.message}\n\nPastikan API Key benar dan masih memiliki kuota.`);
    }
    return;
  }

  if (text === '/status') {
    try {
      const { stdout: uptime } = await execAsync('uptime -p || uptime');
      const { stdout: freeMem } = await execAsync('free -h | awk \'/Mem:/ {print $3 "/" $2}\'');
      const { stdout: disk } = await execAsync('df -h / | awk \'NR==2 {print $3 "/" $2 " (" $5 ")"}\'');
      const contents = await fetchContents();
      const aiConfig = getActiveAiConfig();
      
      const res = `🖥️ <b>Status Server & Ekosistem:</b>\n` +
        `• <b>Uptime VPS:</b> ${uptime.trim()}\n` +
        `• <b>RAM Terpakai:</b> ${freeMem.trim()}\n` +
        `• <b>Disk:</b> ${disk.trim()}\n` +
        `• <b>Total Konten Kanban:</b> ${contents.length} kartu\n` +
        `• <b>AI Consultant:</b> ${aiConfig ? `✅ ${aiConfig.provider.toUpperCase()} (${aiConfig.model})` : '🟡 Panduan Internal'}\n` +
        `• <b>Status Web:</b> ✅ Online (PM2 Active)\n` +
        `• <b>Domain:</b> ${APP_URL}`;
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
      let res = `📋 <b>10 Konten Aktif di Kanban:</b>\n\n`;
      active.forEach((c, i) => {
        const stageLabel = STAGE_LABELS[c.stage] || c.stage;
        res += `<b>#${i + 1}</b> ${c.title}\nTahap: ${stageLabel}\n\n`;
      });
      res += `<i>Gunakan <code>/pindah [no] [tahap]</code> untuk mengubah status.</i>`;
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
      await sendSmartMessage(chatId, `📝 <b>Naskah: ${target.title}</b>\n\n${script}`);
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

  // --- SMART NATURAL LANGUAGE HANDLING ---

  // 1. Natural action: Simpan/Tambah ide
  const ideaMatch = text.match(/^(?:simpan|tambah(?:kan)?|masukkan)\s+ide(?:\s*:\s*|\s+)(.+)$/i);
  if (ideaMatch) {
    const title = ideaMatch[1].trim();
    if (title) {
      try {
        const cookie = await getCookie();
        const res = await fetch(`${LOCAL_API}/api/contents`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Cookie: cookie },
          body: JSON.stringify({ title, stage: 'idea', format: 'shorts' })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Gagal menyimpan');
        await sendMessage(chatId, `💡 <b>Ide Berhasil Dicatat ke Kanban!</b>\n\n📌 <b>Judul:</b> ${data.content.title}\n📍 <b>Tahap:</b> 💡 Ide\n\n<i>Ada sudut pandang atau referensi yang ingin kita diskusikan untuk ide ini?</i>`);
        await fetchContents();
        return;
      } catch (err) {
        await sendMessage(chatId, `❌ Gagal mencatat ide: ${err.message}`);
        return;
      }
    }
  }

  // 2. Natural query: Tanya daftar konten aktif
  if (/^(?:ada\s+konten\s+apa|daftar\s+konten|list\s+konten|status\s+konten|lagi\s+garap\s+apa)/i.test(text)) {
    try {
      const contents = await fetchContents();
      const active = contents.filter(c => !c.archived);
      if (!active.length) {
        await sendMessage(chatId, '📭 Saat ini belum ada kartu konten aktif di Kanban. Mau brainstorming ide baru?');
        return;
      }
      let report = `📋 <b>Status Produksi Saat Ini (${active.length} Konten):</b>\n\n`;
      active.slice(0, 8).forEach((c, i) => {
        const stageLabel = STAGE_LABELS[c.stage] || c.stage;
        report += `<b>#${i + 1}</b> ${c.title}\nTahap: ${stageLabel}\n\n`;
      });
      report += `<i>Mau bedah naskah atau diskusikan salah satu konten di atas? Cukup sebutkan nomornya.</i>`;
      await sendMessage(chatId, report);
      return;
    } catch {}
  }

  // --- AI ASSISTANT & CONSULTANT PIPELINE ---
  await sendTyping(chatId);

  // Fetch active contents context
  let contents = [];
  try { contents = await fetchContents(); } catch {}
  const activeContents = contents.filter(c => !c.archived).slice(0, 10);
  const activeSummary = activeContents.length
    ? activeContents.map((c, i) => `#${i + 1} [${STAGE_LABELS[c.stage] || c.stage}] ${c.title}`).join('\n')
    : '(Belum ada konten aktif di Kanban)';

  const aiConfig = getActiveAiConfig();

  // If no AI Key configured, use Heuristic Consultant Engine
  if (!aiConfig) {
    const heuristicReply = heuristicConsultation(text, activeSummary);
    await sendSmartMessage(chatId, heuristicReply);
    return;
  }

  // LLM Conversation Engine
  try {
    const systemPrompt = `Kamu adalah Asisten Eksekutif & Konsultan Konten Senior untuk channel YouTube "REFRAME INVESTIGASI".
Fokus Channel: Jurnalisme investigasi, penelusuran fakta mendalam, pembongkaran skandal, misteri nyata/sosial, analisis data, dan video dokumenter naratif berkecepatan tinggi dengan retensi tinggi.

Konteks Dapur Produksi REFRAME INVESTIGASI Saat Ini:
- Nama Channel: REFRAME INVESTIGASI
- Konten Aktif di Kanban:
${activeSummary}

Tugas Utama Anda:
1. Brainstorming Kasus & Ide: Berikan sudut pandang unik (angle) investigasi, potensi plot twist, dan risiko faktual/hukum.
2. Hook & Retention: Rancang hook 15-30 detik pertama yang memicu dopamin & rasa penasaran penonton. Berikan pacing dan cliffhanger di pertengahan video.
3. Packaging & CTR: Buat opsi judul berdaya klik tinggi (tanpa clickbait murahan) dan konsep visual thumbnail yang memikat.
4. Bedah Naskah: Evaluasi naskah dengan struktur 3-babak investigasi (The Mystery -> The Deep Dive/Escalation -> The Revelation/Verdict).

Karakter & Gaya Bicara:
- Bertindaklah sebagai rekan kerja kreatif (creative producer / showrunner) yang cerdas, tajam, analitis, taktis, namun suportif dan bersahabat.
- Gunakan Bahasa Indonesia yang luwes, natural, dan enak dibaca di smartphone (hindari bahasa kaku robotik).
- Format jawaban rapi dengan bullet points tebal.
- Jika pengguna meminta menyimpan ide ke sistem, ingatkan bahwa mereka bisa mengetik "Simpan ide: [Judul]" agar langsung otomatis tercatat di Kanban.`;

    let history = chatHistories.get(chatId) || [];
    // Keep last 10 messages for multi-turn context
    if (history.length > 10) history = history.slice(history.length - 10);

    history.push({ role: 'user', text });

    const reply = await queryLLM({
      provider: aiConfig.provider,
      key: aiConfig.key,
      model: aiConfig.model,
      messages: history,
      systemPrompt
    });

    history.push({ role: 'model', text: reply });
    chatHistories.set(chatId, history);

    await sendSmartMessage(chatId, reply);
  } catch (err) {
    console.error('LLM Error:', err);
    // Graceful fallback to heuristic consultation
    const fallbackReply = heuristicConsultation(text, activeSummary);
    await sendSmartMessage(chatId, fallbackReply);
  }
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
