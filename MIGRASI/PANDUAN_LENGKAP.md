# Panduan pindah GitHub dan Railway

Versi aplikasi: **4.37.0**. Paket ini berisi kode, konfigurasi, pengujian dan panduan. Database produksi serta kredensial tidak disertakan. Rujukan kode asli ada di `MIGRASI/ISI_PAKET.json`.

## 1. Ambil data sebelum beralih

Di aplikasi lama, buka **Data & Backup**, buat backup manual terbaru, lalu klik **Unduh backup**. Simpan berkas `.json.gz` pada komputer. Tunggu jika pembuatan backup masih dalam jeda satu menit. Hindari menyunting data lama sesudah backup terakhir sampai pemindahan selesai.

Backup aplikasi memuat dokumen produksi/naskah/storyboard, Note/kategori, pilar/kolom/riwayat, Radar, Analytics serta data channel/antrean yang tersimpan. Backup tidak memuat file video, token Google/YouTube/Drive, password atau API key. Jika ingin memindahkan video yang masih berada di antrean, salin berkas volume secara terpisah atau unggah ulang file tersebut pada aplikasi baru. Token/koneksi layanan dihubungkan ulang.

## 2. Unggah kode ke GitHub baru

1. Ekstrak ZIP ini ke satu folder.
2. Masuk ke akun GitHub baru dan buat repository baru. Pilih repository private jika ingin membatasi akses kode.
3. Unggah isi folder hasil ekstrak. Jangan mengunggah ZIP sebagai satu berkas kode.
4. Pastikan `Dockerfile`, `package.json`, `package-lock.json`, `server.mjs` dan `railway.json` terlihat di root repository; `public/` harus tetap berupa folder. Sertakan file `.env.example`, `.gitignore` dan folder `.github/`.
5. Jangan unggah backup data, folder `data/`, `.env` berisi nilai asli, maupun file video. Paket ini sudah memakai placeholder untuk konfigurasi.

## 3. Buat aplikasi di Railway baru

1. Masuk ke akun Railway baru. Pilih New Project, lalu deploy dari GitHub repository baru. Jika repository belum terlihat, berikan integrasi Railway akses ke repository tersebut.
2. Tambahkan service **PostgreSQL** ke project yang sama. Pastikan service tersebut benar-benar database PostgreSQL.
3. Pada service aplikasi, buat volume dan mount pada `/data`. Gunakan satu replica aplikasi, sesuai arsitektur worker upload saat ini.
4. Atur variabel berdasarkan `MIGRASI/VARIABEL_RAILWAY.txt`.
5. Isi `DATABASE_URL` memakai referensi ke `DATABASE_URL` milik service PostgreSQL baru. Contoh `${{Postgres.DATABASE_URL}}` hanya tepat jika nama service database benar-benar `Postgres`; nama harus sama persis.
6. Buat domain publik untuk service aplikasi. Isi `APP_URL` dengan `https://DOMAIN-BARU` dan tanpa garis miring di akhir. Tidak ada domain lama yang perlu digunakan dalam variabel baru.
7. Railway membaca Dockerfile dan railway.json dari paket. Start command: `node server.mjs`. Health check: `/api/health`. Railway menyediakan PORT; tidak perlu menyalin port dari akun lama.
8. Isi `APP_SECRET` acak minimal 32 karakter dan `ADMIN_PASSWORD` pilihan Anda. Untuk membuat secret di komputer dengan Node.js: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Simpan hasil hanya pada Variables Railway.
9. Biarkan `WORKER_ENABLED=false` dan `RADAR_AUTO_SYNC=false` selama migrasi. Deploy dan periksa `/api/health`: `ok: true`, versi `4.37.0`, storage `postgresql`. Login menggunakan password baru.

## 4. Pulihkan backup ke PostgreSQL baru

Lakukan bagian ini jika ingin membawa data dari aplikasi lama. Kode tersedia tanpa pemulihan, tetapi database baru akan memakai data awalnya sendiri.

1. Pasang Node.js 22 atau lebih baru di komputer. Buka terminal pada folder paket yang telah diekstrak dan jalankan `npm ci`.
2. Letakkan backup di luar folder repository; contoh perintah di bawah menganggap salinan backup sementara bernama `backup.json.gz` di direktori kerja. Jangan commit file ini.
3. Validasi tanpa menulis database: `npm run restore -- backup.json.gz`. Lanjutkan hanya jika hasilnya menunjukkan `valid: true`.
4. Aplikasi baru harus pernah dijalankan satu kali dengan PostgreSQL agar tabel awal dibuat. Kemudian hentikan instance aplikasi baru beserta semua worker selama pemulihan. Database PostgreSQL baru tetap menyala. `WORKER_ENABLED=false` saja tidak menghentikan semua penulisan aplikasi.
5. Dari service PostgreSQL BARU, ambil URL koneksi publik/TCP proxy untuk terminal komputer. Host privat Railway tidak dapat digunakan langsung dari komputer. Jangan memakai URL database lama.
6. Contoh PowerShell pada Windows, dari folder aplikasi:

```powershell
$env:DATABASE_URL = [pscredential]::new('db', (Read-Host 'Tempel URL PostgreSQL publik dari akun BARU' -AsSecureString)).GetNetworkCredential().Password
$env:STORAGE_RESTORE_OFFLINE = 'true'
npm run restore -- backup.json.gz --apply
Remove-Item Env:DATABASE_URL
Remove-Item Env:STORAGE_RESTORE_OFFLINE
```

Perintah restore mengganti empat dokumen pada database tujuan dengan isi backup dalam satu transaksi. Arahkan hanya ke database baru yang memang disiapkan sebagai tujuan migrasi. Jika validasi gagal, jangan jalankan `--apply`. Jalankan lagi aplikasi baru setelah pemulihan selesai. Petunjuk teknis bawaan juga tersedia di `DATA-RECOVERY.md`.

## 5. Hubungkan layanan

- **YouTube/Google:** gunakan OAuth client Web application yang Anda kelola. Pada Google Cloud, daftarkan redirect URI persis `https://DOMAIN-BARU/auth/google/callback`. Aktifkan API Google yang dipakai, termasuk YouTube Data API v3, YouTube Analytics API dan Google Drive API untuk fitur terkait. Masukkan `GOOGLE_CLIENT_ID` serta `GOOGLE_CLIENT_SECRET` di Railway baru, kemudian hubungkan YouTube, Analytics dan Drive dari Pengaturan aplikasi. Tidak perlu membawa token terenkripsi dari volume lama untuk alur ini.
- **AI:** isi key provider yang ingin digunakan pada Variables Railway baru. Provider dapat dipasang sesudah konten berhasil dipulihkan; naskah tersimpan tidak memerlukan key AI agar dapat dibaca.
- **Google Drive:** hubungkan akun Drive tujuan dan uji backup manual setelah pemindahan. File backup lama di Drive tidak otomatis berpindah pemilik ketika akun Railway berganti.

## 6. Selesaikan pemindahan

Periksa konten/naskah, storyboard dan warnanya, Note, pilar/kolom, kalender, Radar serta link publikasi Facebook/TikTok/Instagram. Periksa antrean lama dan file video sebelum mengaktifkan worker, agar pemulihan job tidak memicu pekerjaan yang tidak diinginkan.

Jika semua sesuai, set `WORKER_ENABLED=true` dan `RADAR_AUTO_SYNC=true` sesuai kebutuhan, lalu redeploy. Pastikan hanya satu aplikasi yang menjalankan antrean upload aktif pada satu waktu. Buat backup baru di akun tujuan. Simpan akun lama sampai hasil migrasi telah diperiksa.

Dokumentasi: https://docs.railway.com/guides/github-autodeploys • https://docs.railway.com/guides/postgresql • https://docs.railway.com/guides/volumes
