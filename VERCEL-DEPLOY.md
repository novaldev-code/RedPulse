# RedPulse Vercel Deploy

RedPulse paling aman dideploy sebagai 2 project Vercel dari monorepo yang sama:

- `apps/api` untuk Express API
- `apps/web` untuk Vite web app

## 1. Deploy API

- Import repo ke Vercel
- Buat project baru dengan **Root Directory** `apps/api`
- Framework preset: `Other`
- Project ini sudah punya [vercel.json](apps/api/vercel.json) untuk me-rewrite semua request ke function Express

Set environment variables di project API:

```env
DATABASE_URL=postgresql://...
JWT_SECRET=isi-random-panjang
JWT_EXPIRES_IN=7d
AUTH_COOKIE_NAME=redpulse_token
AUTH_COOKIE_SAME_SITE=none
APP_ORIGIN=https://your-web-project.vercel.app
API_ORIGIN=https://your-api-project.vercel.app
ALLOWED_ORIGINS=https://your-web-project.vercel.app
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

Kalau Anda ingin preview web deployment tetap bisa memanggil API, `ALLOWED_ORIGINS` bisa dibuat comma-separated dan mendukung wildcard seperti:

```env
ALLOWED_ORIGINS=https://your-web-project.vercel.app,https://*.vercel.app
```

## 2. Deploy Web

- Buat project kedua dengan **Root Directory** `apps/web`
- Framework preset: `Vite`

Set environment variable di project Web:

```env
VITE_API_BASE_URL=https://your-api-project.vercel.app
```

Frontend sekarang otomatis memakai `VITE_API_BASE_URL` saat production, dan fallback ke path relatif saat development lokal.

## 3. Google OAuth

Di Google Cloud Console, update OAuth client Anda:

- **Authorized JavaScript origins**

```text
https://your-web-project.vercel.app
http://localhost:5173
http://localhost:3001
```

- **Authorized redirect URIs**

```text
https://your-api-project.vercel.app/auth/google/callback
http://localhost:3001/auth/google/callback
```

Kalau Anda nanti memakai domain custom, ganti origin dan redirect URI ke domain final itu juga.

## 4. Cookie Auth

Deploy production ini memakai cookie HttpOnly lintas origin:

- `AUTH_COOKIE_SAME_SITE=none`
- `secure=true` otomatis saat production
- API mengizinkan credential request hanya dari origin yang ada di `APP_ORIGIN` / `ALLOWED_ORIGINS`

## 5. Setelah Deploy

Verifikasi cepat:

1. buka web production
2. coba register/login
3. coba login Google
4. buat post teks
5. upload image/video
6. like, comment, follow

## Referensi Resmi

- Vite on Vercel: https://vercel.com/docs/frameworks/frontend/vite
- Express on Vercel: https://vercel.com/kb/guide/using-express-with-vercel
- Rewrites on Vercel: https://vercel.com/docs/edge-network/rewrites
