# Spesifikasi & Perintah Implementasi Auth Gateway untuk Muse.ai
## Target Domain: `auth-osa.rvmeur.com` (Subdomain dari `rvmeur.com`)
### Layanan: Canva Connect API OAuth 2.0 Relay & Deep-Link Gateway untuk OpenSmartAlbum macOS

Dokumen ini dirancang sebagai instruksi siap-eksekusi (*prompt-ready*) untuk **Muse.ai / AI coding assistant** agar dapat secara otomatis membangun, mengonfigurasi, dan men-deploy **Production OAuth Gateway** yang aman, ringan, dan andal di `auth-osa.rvmeur.com`.

---

## 1. Konteks & Tujuan Arsitektur

OpenSmartAlbum adalah aplikasi desktop Tauri v2 (macOS). Saat pengguna melakukan otorisasi akun Canva melalui Canva Connect API:
1. Canva Developer Portal memerlukan URL redirect HTTPS publik yang valid pada status produksi:
   `https://auth-osa.rvmeur.com/canva/callback`
2. Gateway di `auth-osa.rvmeur.com` menerima parameter otorisasi dari Canva (`code`, `state`, `error`).
3. Gateway menampilkan halaman UI konfirmasi sukses yang elegan dan modern (*studio dark theme*).
4. Gateway melakukan relay kode otorisasi kembali ke aplikasi desktop OpenSmartAlbum menggunakan **dua saluran simultan**:
   - **Saluran Utama (Deep-Link OS)**: `opensmartalbum://oauth/canva?code={code}&state={state}`
   - **Saluran Fallback (Localhost Loopback)**: `http://127.0.0.1:3001/oauth/redirect?code={code}&state={state}`

---

## 2. Pilihan Stack Rekomendasi (Pilih Salah Satu)

### Opsi A: Cloudflare Worker (Paling Direkomendasikan — Gratis, Cepat, Serverless Edge)
* **Runtime**: Cloudflare Workers (TypeScript / JavaScript murni)
* **Latency**: < 15ms global edge
* **Biaya**: 100% Free Tier (100.000 req/hari)

### Opsi B: Next.js / Vercel Edge Function
* **Runtime**: Next.js App Router (`app/canva/callback/route.ts` atau `page.tsx`)
* **Host**: Vercel terhubung ke domain `rvmeur.com`

---

## 3. Implementasi Lengkap: Cloudflare Worker (`worker.ts`)

Salin dan gunakan kode berikut untuk implementasi instan:

```typescript
export interface Env {}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // 1. Health check & Root
    if (url.pathname === '/' || url.pathname === '/health') {
      return new Response(JSON.stringify({ status: 'ok', service: 'OpenSmartAlbum Canva Auth Gateway' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 2. Canva OAuth Callback Route: /canva/callback atau /oauth/canva/callback
    if (url.pathname === '/canva/callback' || url.pathname === '/oauth/canva/callback') {
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      const error = url.searchParams.get('error');
      const errorDescription = url.searchParams.get('error_description');

      // Handle OAuth Error dari Canva
      if (error) {
        return new Response(renderErrorHtml(error, errorDescription || 'Akses ditolak oleh pengguna atau sesi telah kadaluwarsa.'), {
          status: 400,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
      }

      if (!code) {
        return new Response(renderErrorHtml('Missing Code', 'Tidak ada authorization code yang diterima dari Canva.'), {
          status: 400,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
      }

      // Render Halaman Sukses dengan Dual Relay (Deep Link + Localhost Beacon)
      return new Response(renderSuccessHtml(code, state || ''), {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store, max-age=0',
        },
      });
    }

    return new Response('Not Found', { status: 404 });
  },
};

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderSuccessHtml(code: string, state: string): string {
  const safeCode = escapeHtml(code);
  const safeState = escapeHtml(state);
  const deepLink = `opensmartalbum://oauth/canva?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`;
  const localLoopback = `http://127.0.0.1:3001/oauth/redirect?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`;

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Otorisasi Canva Berhasil — OpenSmartAlbum</title>
  <style>
    :root {
      --bg: #121214;
      --card-bg: #1c1c1f;
      --border: rgba(255, 255, 255, 0.08);
      --purple: #a855f7;
      --cyan: #06b6d4;
      --green: #10b981;
      --text: #f4f4f5;
      --text-muted: #a1a1aa;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 24px;
    }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 20px;
      padding: 40px 32px;
      max-width: 480px;
      width: 100%;
      text-align: center;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
    }
    .logo-badge {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--purple), var(--cyan));
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      font-size: 28px;
      font-weight: 800;
      margin-bottom: 20px;
      box-shadow: 0 8px 24px rgba(168, 85, 247, 0.4);
    }
    h1 {
      font-size: 22px;
      font-weight: 700;
      margin-bottom: 10px;
      background: linear-gradient(135deg, #fff, #d4d4d8);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    p {
      color: var(--text-muted);
      font-size: 14px;
      line-height: 1.6;
      margin-bottom: 24px;
    }
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px;
      background: rgba(16, 185, 129, 0.12);
      border: 1px solid rgba(16, 185, 129, 0.25);
      border-radius: 30px;
      color: var(--green);
      font-size: 12.5px;
      font-weight: 600;
      margin-bottom: 24px;
    }
    .btn-group {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-bottom: 20px;
    }
    .btn-primary {
      display: block;
      width: 100%;
      padding: 12px 20px;
      background: linear-gradient(135deg, var(--purple), var(--cyan));
      color: #fff;
      text-decoration: none;
      font-size: 14px;
      font-weight: 600;
      border-radius: 10px;
      border: none;
      cursor: pointer;
      box-shadow: 0 4px 14px rgba(124, 58, 237, 0.35);
      transition: all 0.15s ease;
    }
    .btn-primary:hover {
      opacity: 0.95;
      transform: translateY(-1px);
    }
    .btn-secondary {
      display: block;
      width: 100%;
      padding: 11px 20px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--border);
      color: var(--text-muted);
      text-decoration: none;
      font-size: 13px;
      font-weight: 500;
      border-radius: 10px;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .btn-secondary:hover {
      background: rgba(255, 255, 255, 0.08);
      color: #fff;
    }
    .close-hint {
      display: none;
      font-size: 12px;
      color: #34d399;
      margin-top: -6px;
      margin-bottom: 14px;
    }
    .code-box-container {
      margin-top: 14px;
      text-align: left;
      background: rgba(0, 0, 0, 0.35);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 10px;
      padding: 12px;
    }
    .code-box-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }
    .code-box-label {
      font-size: 11px;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .btn-copy {
      padding: 4px 10px;
      background: rgba(168, 85, 247, 0.2);
      border: 1px solid rgba(168, 85, 247, 0.4);
      border-radius: 6px;
      color: #d8b4fe;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .btn-copy:hover {
      background: rgba(168, 85, 247, 0.35);
      color: #fff;
    }
    .code-box {
      font-family: ui-monospace, Menlo, Consolas, monospace;
      font-size: 11px;
      color: #cbd5e1;
      word-break: break-all;
      user-select: all;
      background: rgba(0, 0, 0, 0.3);
      padding: 8px 10px;
      border-radius: 6px;
      border: 1px solid rgba(255, 255, 255, 0.04);
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo-badge">C</div>
    <div class="status-badge">
      <span>●</span> Terhubung dengan Canva
    </div>
    <h1>Otorisasi Berhasil!</h1>
    <p>Akun Canva Anda telah terhubung secara resmi ke <strong>OpenSmartAlbum</strong>. Anda dapat kembali berkreasi merancang album foto.</p>

    <div class="btn-group">
      <button class="btn-primary" id="openAppBtn" onclick="openDesktopApp()">Buka OpenSmartAlbum</button>
      <button class="btn-secondary" id="closeBtn" onclick="closeWindow()">Tutup Jendela Ini</button>
    </div>
    <div class="close-hint" id="closeHint">✓ Tab aman ditutup (tekan ⌘+W) — Anda sudah dapat beralih ke jendela OpenSmartAlbum.</div>

    <div class="code-box-container">
      <div class="code-box-header">
        <span class="code-box-label">Kode Otorisasi (Fail-Safe)</span>
        <button class="btn-copy" id="copyBtn" onclick="copyCode()">Salin Kode</button>
      </div>
      <div class="code-box" id="codeText">${safeCode}</div>
    </div>
  </div>

  <iframe id="loopbackFrame" style="display:none;" src="${localLoopback}"></iframe>

  <script>
    var rawCode = "${safeCode}";
    var deepLink = "${deepLink}";
    var loopback = "${localLoopback}";

    function openDesktopApp() {
      // Coba deep-link native
      window.location.href = deepLink;
      // Coba trigger loopback via hidden frame
      setTimeout(function() {
        var frame = document.getElementById('loopbackFrame');
        if (frame) frame.src = loopback;
      }, 300);
    }

    function closeWindow() {
      window.close();
      setTimeout(function() {
        var hint = document.getElementById('closeHint');
        if (hint) hint.style.display = 'block';
        var btn = document.getElementById('closeBtn');
        if (btn) btn.innerText = 'Tab dapat ditutup manual (⌘+W)';
      }, 300);
    }

    function copyCode() {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(rawCode).then(function() {
          var b = document.getElementById('copyBtn');
          if (b) {
            b.innerText = '✓ Tersalin!';
            setTimeout(function() { b.innerText = 'Salin Kode'; }, 2500);
          }
        });
      } else {
        var range = document.createRange();
        range.selectNodeContents(document.getElementById('codeText'));
        var sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        document.execCommand('copy');
        var b = document.getElementById('copyBtn');
        if (b) {
          b.innerText = '✓ Tersalin!';
          setTimeout(function() { b.innerText = 'Salin Kode'; }, 2500);
        }
      }
    }

    // 1. Silent Loopback Beacon via Image / Fetch
    try {
      var img = new Image();
      img.src = loopback;
    } catch(e) {}

    // 2. Auto trigger deep link ke OpenSmartAlbum
    setTimeout(function() {
      try {
        window.location.href = deepLink;
      } catch (e) {}
    }, 400);
  </script>
</body>
</html>`;
}

function renderErrorHtml(title: string, desc: string): string {
  const safeTitle = escapeHtml(title);
  const safeDesc = escapeHtml(desc);

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <title>Otorisasi Gagal — OpenSmartAlbum</title>
  <style>
    body { background: #121214; color: #f4f4f5; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
    .card { background: #1c1c1f; border: 1px solid rgba(239,68,68,0.3); border-radius: 16px; padding: 36px; max-width: 420px; text-align: center; }
    h1 { color: #f87171; font-size: 20px; margin-bottom: 12px; }
    p { color: #a1a1aa; font-size: 14px; line-height: 1.5; margin-bottom: 20px; }
    a { display: inline-block; padding: 10px 20px; background: #27272a; color: #fff; text-decoration: none; border-radius: 8px; font-size: 13px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>❌ ${safeTitle}</h1>
    <p>${safeDesc}</p>
    <a href="javascript:window.close()">Tutup Jendela</a>
  </div>
</body>
</html>`;
}
```

---

## 4. Konfigurasi Deployment `wrangler.toml` (Cloudflare Workers)

```toml
name = "auth-osa"
main = "src/worker.ts"
compatibility_date = "2026-10-01"

# DNS Binding untuk subdomain rvmeur.com
routes = [
  { pattern = "auth-osa.rvmeur.com/*", custom_domain = true }
]
```

---

## 5. Konfigurasi DNS di Cloudflare (`rvmeur.com`)

| Tipe | Nama (*Record*) | Target / Konten | Proxy Status |
|---|---|---|---|
| **CNAME** | `auth-osa` | `auth-osa.<account-id>.workers.dev` (atau Cloudflare Custom Domain) | **Proxied (Orange Cloud)** |

---

## 6. Konfigurasi Akhir di Canva Developer Portal

Pada dashboard **Canva Developer Portal** milik tim Anda:
1. Navigasi ke menu **Build** ➔ **Outside Canva** ➔ **Redirect URLs**.
2. Tambahkan URL production resmi:
   ```text
   https://auth-osa.rvmeur.com/canva/callback
   ```
3. *(Opsional untuk testing lokal tetap izinkan)*:
   ```text
   http://127.0.0.1:3001/oauth/redirect
   ```
4. Klik **Save changes**.
