export const SYSTEM_PROMPT_THUMBNAIL_SEO = `Anda adalah AI analis konten & generator prompt thumbnail untuk brand "Magnets Media", channel dengan gaya investigatif/editorial: dominan hitam pekat bertekstur, judul putih+hijau neon, kotak "warning badge" berisi poin temuan, kumpulan figur/subjek di sisi kanan, objek simbolis di tengah, elemen dokumen/bukti di pojok, serius dan tegang seperti liputan investigasi/breaking news.

ATURAN JUDUL THUMBNAIL: judul thumbnail HANYA 3 KATA, singkat, brutal, dan emosional. Bangun dari emosi: takut ("ANCAMAN", "BAHAYA"), khawatir ("DAMPAKNYA KE KAMU"), penasaran ("YANG DISEMBUNYIKAN"), marah/terkejut. Tetap jujur terhadap isi script.

PRIORITAS UTAMA: setiap judul, sub headline, dan seo_title yang dihasilkan HARUS punya CTR (click-through rate) tinggi dan membuat penonton penasaran untuk klik. Gunakan teknik hook yang terbukti efektif, di antaranya:
- Curiosity gap: buka pertanyaan/misteri yang belum terjawab, jangan ungkap keseluruhan jawaban di judul
- Angka spesifik & konkret (nominal uang, jumlah korban/kasus, tahun, persentase) lebih kuat dari klaim umum
- Kontras/twist: benturkan ekspektasi vs kenyataan (misal "Terlihat X, Ternyata Y")
- Stake tinggi: tunjukkan konsekuensi besar, ancaman, atau sesuatu yang dirahasiakan/ditutupi
- Personalisasi/relevansi: kaitkan dengan sesuatu yang dekat/berdampak pada penonton bila relevan
- Pertanyaan retoris tajam atau pernyataan berani yang memancing rasa ingin tahu
- HINDARI judul yang sudah membocorkan seluruh kesimpulan/jawaban — sisakan alasan kuat untuk klik dan menonton sampai selesai
- Tetap JUJUR dan berbasis fakta dari script — curiosity gap dibangun dari framing, bukan dari klaim palsu atau menyesatkan (tidak clickbait bohong)

Terapkan prinsip di atas secara konsisten pada: "seo_title", setiap "title" di variants, dan setiap "sub_headline" di variants. Sub headline berfungsi memperkuat rasa penasaran dari judul utama (bukan sekadar mengulang informasi yang sama).

Baca SCRIPT video yang diberikan pengguna dan lakukan analisis:
1. Topik inti dan sudut pandang investigatif dari video
2. Emosi/mood dominan yang cocok (misalnya: urgent, mencekam, penuh tekanan, misterius, dsb)
3. Niche/kategori kontennya
4. Sosok/figur visual kunci yang paling representatif untuk dijadikan subjek foto di thumbnail — JIKA script menyebut nama tokoh publik/figur nyata (politisi, atlet, pejabat, dsb), catat nama-nama itu di "real_figures_note" sebagai peringatan bahwa foto asli mereka perlu digunakan (bukan wajah rekaan AI). Jika tidak ada figur publik nyata, isi "real_figures_note" dengan string kosong "".
5. Satu objek simbolis yang mewakili topik (misal: trofi, palu hakim, tumpukan uang, dokumen, gembok, dsb)
6. Elemen latar belakang yang relevan (misal: gedung, stadion, kantor, kota, dsb)
7. 2 poin temuan/fakta paling mengejutkan dari script untuk dijadikan isi "warning badge" (masing-masing sangat singkat, maksimal 4-5 kata, ditulis ALL CAPS atau Title Case pendek, pilih fakta yang paling bikin penasaran/mengejutkan)

Lalu buat:
A. "seo_title": satu judul YouTube yang SEO friendly SEKALIGUS high-CTR (mengandung kata kunci relevan secara natural, dibangun dengan curiosity gap/angka konkret/stake tinggi, maksimal sekitar 60-70 karakter)
B. "seo_caption": satu caption/deskripsi YouTube yang SEO friendly (2-4 kalimat, mengandung kata kunci relevan secara natural, cocok ditaruh di deskripsi video, sertakan ajakan menonton/subscribe di akhir)
C. "niche": kategori konten singkat
D. "mood": mood/suasana singkat dalam Bahasa Indonesia (2-4 kata)
E. "symbol_object": deskripsi singkat dalam Bahasa Inggris untuk objek simbolis utama
F. "background_element": deskripsi singkat dalam Bahasa Inggris untuk elemen latar belakang
G. "warning_points": array berisi TEPAT 2 string pendek, poin temuan/fakta paling kuat & bikin penasaran dari script
H. "real_figures_note": string peringatan bila ada figur publik nyata disebut (contoh: "Script menyebut tokoh publik: Lionel Messi, Cristiano Ronaldo, Gianni Infantino"), atau "" jika tidak ada
I. "variants": TEPAT 3 objek rekomendasi judul thumbnail, masing-masing berisi:
   - "title": judul thumbnail, ALL CAPS, WAJIB TEPAT 3 KATA (tidak boleh lebih, tidak boleh kurang; angka seperti "34T" atau "2026" dihitung 1 kata). KONTEKS TIDAK BOLEH HILANG: salah satu kata harus menyebut subjek/topik inti dari script (misal: koperasi, FIFA, dana desa, nama lembaga), sisanya kata pemicu emosi yang tajam — penonton harus langsung paham video ini tentang apa DAN merasa takut/khawatir/penasaran/marah. Pola yang bagus: [SUBJEK] + [AKSI/ANCAMAN] + [TANDA TANYA atau KATA BERDAMPAK], contoh gaya: "KOPERASI DESA BANGKRUT?", "UANG RAKYAT LENYAP", "FIFA MENYEMBUNYIKAN APA?" (hitung kata dengan teliti). HARUS beda pendekatan emosi antar variant (variant 1 = takut/ancaman, variant 2 = penasaran/misteri, variant 3 = khawatir/dampak pribadi atau marah/terkejut)
   - "sub_headline": satu sub headline pendukung (maksimal 8 kata) yang memperdalam emosi judul (rasa takut/khawatir/penasaran) dengan fakta atau konsekuensi konkret dari script, dalam Bahasa Indonesia
   - "main_element": deskripsi singkat dalam Bahasa Inggris tentang kumpulan figur/subjek visual yang akan ditempatkan di sisi kanan/tengah thumbnail (misal: "2-3 serious public figures related to the topic, overlapping composition, direct serious gaze at camera" — JANGAN sebut nama asli di sini, gunakan deskripsi peran/posisi saja)
   - "content_gist": satu-dua kalimat ringkas (parafrase, BUKAN kutipan langsung dari script) yang merangkum inti pesan video ini untuk memandu pemilihan visual
   - "ctr_hook": satu kalimat pendek dalam Bahasa Indonesia yang menjelaskan teknik hook/curiosity apa yang dipakai di judul+sub headline ini dan kenapa itu bikin orang penasaran untuk klik (misal: "Memicu rasa takut lewat kata ancaman + angka konkret yang bikin khawatir")
   Ketiga variasi harus punya sudut pengambilan judul, teknik hook, & elemen visual yang berbeda satu sama lain.

Balas HANYA dengan JSON valid, TANPA markdown, TANPA teks pembuka/penutup, dengan format PERSIS:
{"seo_title":"...","seo_caption":"...","niche":"...","mood":"...","symbol_object":"...","background_element":"...","warning_points":["...","..."],"real_figures_note":"...","variants":[{"title":"...","sub_headline":"...","main_element":"...","content_gist":"...","ctr_hook":"..."}]}
Array variants harus berisi tepat 3 objek, array warning_points harus berisi tepat 2 string.`;

export function buildMasterThumbnailPrompt(v, ctx, format = 'thumbnail') {
  const isShort = format === 'short' || format === 'shorts';

  const badgeLines = (ctx.warning_points || []).map(function(p, i){
    return '  ' + (i + 1) + '. Kotak border hijau neon + ikon segitiga peringatan, baris atas putih kecil, baris bawah hijau neon bold: "' + p + '"';
  }).join('\n');

  const realFigureBlock = ctx.real_figures_note
    ? `\n━━ CATATAN FIGUR NYATA ━━\n• ${ctx.real_figures_note}\n• JANGAN membuat AI generate wajah figur publik secara photoreal — gunakan foto asli/berlisensi tokoh tsb, lalu edit ke gaya duotone hitam-putih dengan aksen hijau neon (desaturate, kontras tinggi, rim light hijau tipis) agar konsisten dengan elemen lain\n`
    : '';

  const canvasLine = isShort
    ? 'Buat cover Short/Reels berukuran 1080x1920px (rasio 9:16, vertikal) dengan gaya investigatif/editorial ala MagnetsMedia.'
    : 'Buat thumbnail YouTube berukuran 1280x720px (rasio 16:9, horizontal) dengan gaya investigatif/editorial ala MagnetsMedia.';

  const layoutBlock = isShort
    ? `━━ STRUKTUR LAYOUT (VERTIKAL 9:16) ━━
• ATAS (10-30% frame, di luar area UI judul Shorts): blok judul 2-3 baris pendek, all caps, rata tengah, tekstur grunge/distressed. Baris pertama putih, baris kata paling kuat hijau neon dengan glow
• TENGAH (30-70% frame): ${v.main_element || 'serious public figures'}, 1-2 figur close-up/medium shot disusun dominan memenuhi lebar frame, foto editorial hitam-putih desaturate dengan rim light hijau neon tipis di kontur wajah/bahu, ekspresi serius/tegang
• Objek simbolis — ${ctx.symbol_object || 'symbolic icon'} — ditempatkan kecil di salah satu sisi tengah, overlap ringan dengan figur, glow hijau neon lembut
• BAWAH (70-85% frame): ${ctx.warning_points && ctx.warning_points.length ? (ctx.warning_points.length + ' kotak "warning badge" tersusun horizontal/stacked ringkas:\n' + badgeLines) : 'kotak "warning badge" berisi poin temuan kunci, disusun ringkas'}
• SUDUT KECIL (pojok atas, bukan dead-center): elemen dokumen/bukti (kertas memo/stempel), ukuran kecil, opacity rendah agar tidak menutupi wajah
• Sisakan ZONA AMAN kosong di 12% paling bawah frame dan 8% paling atas frame — area ini akan tertutup UI Shorts/Reels (judul, tombol like/share, caption), jangan taruh teks atau wajah penting di situ
• Latar belakang — ${ctx.background_element || 'dark architectural backdrop'} — redup di balik figur, outline hijau neon tipis`
    : `━━ STRUKTUR LAYOUT (HORIZONTAL 16:9) ━━
• KIRI ATAS: blok judul besar 2-3 baris, all caps, dengan tekstur grunge/distressed di tepi huruf. Baris pertama putih, baris berikutnya (kata paling kuat/inti topik) hijau neon dengan glow, baris angka/tahun (jika ada) putih dengan simbol tanya "?" outline hijau neon menyala
• KIRI BAWAH: ${ctx.warning_points && ctx.warning_points.length ? (ctx.warning_points.length + ' kotak "warning badge" tersusun vertikal, masing-masing:\n' + badgeLines) : 'kotak "warning badge" berisi poin temuan kunci'}
• KANAN: ${v.main_element || 'serious public figures'}, disusun overlap/bertumpuk 2-4 figur, foto editorial hitam-putih desaturate dengan rim light hijau neon tipis di kontur wajah/bahu, ekspresi serius/tegang, saling tumpang tindih dari besar (depan) ke kecil (belakang)
• TENGAH-BAWAH (antara blok teks kiri dan figur kanan): objek simbolis utama — ${ctx.symbol_object || 'symbolic icon'} — digambar realistis/metalik dengan glow hijau neon lembut di siluetnya
• POJOK KANAN ATAS: elemen dokumen/bukti (kertas memo/stempel/redaksi hitam), tekstur kertas usang, kontras rendah, diposisikan sebagai layer latar sekunder, sedikit miring
• LATAR BELAKANG BAWAH: siluet gelap terkait tema — ${ctx.background_element || 'dark architectural backdrop'} — redup, dengan outline hijau neon tipis, memberi kedalaman tanpa mengganggu fokus utama`;

  const technicalBlock = isShort
    ? `• Format output: PNG, 1080x1920px, RGB
• Pastikan safe zone: 8% dari atas dan 12% dari bawah frame bebas dari teks/wajah penting (area UI Shorts/Reels)
• Elemen penting terpusat secara vertikal agar tetap terbaca saat di-crop jadi preview kotak`
    : `• Format output: PNG, 1280x720px, RGB
• Pastikan safe zone 40px di semua sisi
• Elemen penting (judul, wajah figur, objek simbolis) tidak terpotong di mobile preview`;

  return `[MAGNETS MEDIA — MASTER THUMBNAIL PROMPT]

${canvasLine}

JUDUL: "${(v.title || '').toUpperCase()}"
SUB HEADLINE: "${v.sub_headline || ''}"
NICHE: ${ctx.niche || ''}
MOOD: ${ctx.mood || ''}
KENAPA CTR TINGGI: ${v.ctr_hook || ''}

━━ PALET WARNA ━━
• Dominan: Hitam pekat bertekstur (#050505), grunge/noise halus
• Sekunder: Putih (#FFFFFF) untuk sebagian baris judul
• Aksen utama: Neon Hijau (#00FF41 / #39FF14) untuk baris judul penting, outline, glow, dan border kotak
• Kontras ekstrem hitam-putih-hijau neon, tanpa warna lain

${layoutBlock}
${realFigureBlock}
━━ TIPOGRAFI ━━
• Font judul: ultra-bold condensed/extended, all caps, distressed/grunge texture pada tepi huruf
• Sub headline: lebih kecil, bobot medium, warna putih atau hijau neon, diletakkan tepat di bawah blok judul
• Teks pada warning badge: baris atas putih reguler kecil, baris bawah hijau neon bold — kontras jelas antar baris

━━ EFEK VISUAL ━━
• Efek aktif: Grain/Noise, Neon Glow, Hard Shadow, distressed texture pada teks
• Background hitam bertekstur gelap dengan vignette di tepi, bukan flat
• Kontras sangat tinggi antara elemen utama (teks, figur, objek) dan background

━━ GAYA KESELURUHAN ━━
• Estetika: investigative documentary / breaking-news editorial meets bold YouTube thumbnail
• Setiap elemen (judul, badge, figur, objek, dokumen, latar) punya fungsi jelas dan tidak saling menutupi bagian penting
• Judul hanya 3 kata, ukuran raksasa, terbaca di thumbnail kecil
• Visual harus "dapat dibaca" dalam 1.5 detik oleh viewer, hierarki: judul → figur/objek → badge
• Rasakan energi: ${ctx.mood || ''}

[ANALISIS KONTEN]
${v.content_gist || ''}

━━ INSTRUKSI TEKNIS ━━
${technicalBlock}`;
}

export function generateHeuristicThumbnailSeo(scriptText, format = 'thumbnail') {
  const cleanSnippet = (scriptText || '').slice(0, 100).replace(/[^\w\s]/g, ' ').trim();
  const firstWords = cleanSnippet.split(/\s+/).slice(0, 3).join(' ').toUpperCase() || 'SKANDAL UANG RAKYAT';

  return {
    seo_title: `${firstWords}: Terbongkar Fakta Mengejutkan yang Selama Ini Ditutupi!`,
    seo_caption: `Video investigasi mendalam membongkar fakta di balik ${firstWords.toLowerCase()}. Telusuri dokumen dan bukti lapangan yang belum pernah diungkap ke publik. Simak sampai tuntas dan subscribe untuk liputan independen berikutnya.`,
    niche: 'Investigasi / Ekonomi Politik',
    mood: 'Mencekam, tegang, penuh tekanan',
    symbol_object: 'A heavy metallic gavel resting on classified redacted documents with neon green rim light',
    background_element: 'Dark silhouette of high-rise government headquarters shrouded in dense fog',
    warning_points: [
      'KERUGIAN TRILIUNAN RUPIAH',
      'DOKUMEN RESMI DIRAHASIAKAN'
    ],
    real_figures_note: 'Gunakan foto berlisensi atau arsip asli tokoh terkait dalam format duotone kontras tinggi, jangan membuat wajah tokoh publik dengan AI.',
    variants: [
      {
        title: 'UANG RAKYAT LENYAP',
        sub_headline: 'Jejak aliran dana disamarkan lewat regulasi rahasia',
        main_element: '2 serious corporate and government figures in dark suits, overlapping composition, direct intense gaze',
        content_gist: 'Mengungkap alur transaksi tersembunyi yang merugikan publik secara sistematis.',
        ctr_hook: 'Memicu rasa takut dan marah lewat kata ancaman tegas dan subjek uang rakyat'
      },
      {
        title: 'SIAPA DALANG UTAMA?',
        sub_headline: 'Bukan kelalaian biasa, melainkan skenario terencana',
        main_element: 'Silhouette of key power broker surrounded by classified files and surveillance photos',
        content_gist: 'Menelusuri aktor intelektual di balik kebijakan kontroversial yang dipaksakan.',
        ctr_hook: 'Membuka curiosity gap yang kuat dengan pertanyaan retoris tajam dan provokatif'
      },
      {
        title: 'SKANDAL BESAR TERBONGKAR',
        sub_headline: 'Data audit internal bocor ke meja redaksi',
        main_element: '3 key investigative figures in dynamic stacked composition, high contrast rim lighting',
        content_gist: 'Membuktikan adanya konspirasi sistemik lewat verifikasi data audit.',
        ctr_hook: 'Menghadirkan bukti konkret dokumen bocor untuk memicu kepastian klik penonton'
      }
    ]
  };
}

export async function generateThumbnailAndSeo({ script, format = 'thumbnail', fetcher = fetch } = {}) {
  if (!script || typeof script !== 'string' || !script.trim()) {
    throw new Error('Naskah video wajib disertakan untuk analisis Thumbnail & SEO.');
  }

  const selectedFormat = format === 'short' || format === 'shorts' ? 'short' : 'thumbnail';
  const formatLabel = selectedFormat === 'short'
    ? 'Cover Short/Reels, vertikal 9:16 (1080x1920)'
    : 'Thumbnail YouTube, horizontal 16:9 (1280x720)';
  const userMessage = `FORMAT OUTPUT: ${formatLabel}\n\nSCRIPT VIDEO:\n${script.slice(0, 15000)}\n\nLakukan analisis dan buat output sesuai instruksi di atas.`;

  const groqKey = process.env.GROQ_API_KEY;
  const groqModel = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
  const geminiKey = process.env.GEMINI_API_KEY;
  const geminiModel = process.env.GEMINI_MODEL || 'gemini-3.5-flash';

  const providers = [
    { name: 'groq', key: groqKey, model: groqModel },
    { name: 'gemini', key: geminiKey, model: geminiModel }
  ].filter(p => Boolean(p.key));

  let parsed = null;

  for (const p of providers) {
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
            messages: [
              { role: 'system', content: SYSTEM_PROMPT_THUMBNAIL_SEO + '\n\nIMPORTANT: Respond with valid JSON only matching the schema exactly.' },
              { role: 'user', content: userMessage }
            ],
            response_format: { type: 'json_object' }
          }),
          signal: AbortSignal.timeout(35000)
        });
        if (res.ok) {
          const d = await res.json();
          const raw = d.choices?.[0]?.message?.content || '';
          parsed = JSON.parse(raw);
          if (parsed && Array.isArray(parsed.variants) && parsed.variants.length > 0) break;
        }
      } else if (p.name === 'gemini') {
        const res = await fetcher(`https://generativelanguage.googleapis.com/v1beta/models/${p.model}:generateContent`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': p.key
          },
          body: JSON.stringify({
            contents: [{
              role: 'user',
              parts: [{ text: `${SYSTEM_PROMPT_THUMBNAIL_SEO}\n\n${userMessage}` }]
            }],
            generationConfig: {
              temperature: 0.4,
              responseMimeType: 'application/json'
            }
          }),
          signal: AbortSignal.timeout(35000)
        });
        if (res.ok) {
          const d = await res.json();
          const raw = d.candidates?.[0]?.content?.parts?.[0]?.text || '';
          const clean = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
          parsed = JSON.parse(clean);
          if (parsed && Array.isArray(parsed.variants) && parsed.variants.length > 0) break;
        }
      }
    } catch (err) {
      // try next provider
    }
  }

  if (!parsed || !Array.isArray(parsed.variants) || parsed.variants.length === 0) {
    parsed = generateHeuristicThumbnailSeo(script, selectedFormat);
  }

  parsed.format = selectedFormat;
  parsed.variants = (parsed.variants || []).slice(0, 3).map((v, i) => {
    return {
      ...v,
      master_prompt: buildMasterThumbnailPrompt(v, parsed, selectedFormat)
    };
  });

  return {
    ok: true,
    data: parsed
  };
}
