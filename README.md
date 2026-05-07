# 📋 Laporan Harian Programmer — GitHub Pages Edition

Aplikasi web PWA untuk laporan harian programmer.
Setelah di-deploy ke GitHub Pages bisa diakses dari HP manapun, offline, dan bisa di-install ke home screen.

## 🚀 Cara Deploy (step-by-step)

### 1. Buat akun GitHub
Buka https://github.com → Sign Up (gratis)

### 2. Buat repository baru
- Klik **"+"** → **"New repository"**  
- Name: `laporan-harian`  
- Pilih **Public**  
- Centang "Add a README file"  
- Klik **"Create repository"**

### 3. Upload file-file ini ke GitHub
Klik **"Add file"** → **"Upload files"**, lalu upload:
- `index.html`
- `app.js`  
- `sw.js`
- `manifest.json`
- `_config.yml`
- `.nojekyll`

Untuk folder `lib/`:
1. Klik "Add file" → "Create new file"
2. Ketik: `lib/xlsx-mini.js` → paste isi file → Commit
3. Ulangi untuk `lib/pdf-print.js`

### 4. Aktifkan GitHub Pages
- Buka tab **Settings** → **Pages** (sidebar kiri)
- Source: **Deploy from a branch**
- Branch: **main**, folder: **/ (root)**
- Klik **Save**

### 5. Buka aplikasi
Tunggu 1-2 menit, lalu akses:
```
https://[username-kamu].github.io/laporan-harian/
```

## 📱 Install ke Home Screen HP
- **Android Chrome**: Menu ⋮ → "Add to Home screen"
- **iPhone Safari**: Share → "Add to Home Screen"

## 🔒 Privasi
Data tersimpan di browser HP Anda (localStorage). GitHub hanya menyimpan kode, bukan data laporan.
Selalu export TXT sebagai backup sebelum ganti HP atau clear browser.
