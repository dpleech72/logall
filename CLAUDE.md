# LogAll — Project Context for Claude

## What is LogAll?
A PWA (Progressive Web App) for sole traders in the UK to track income, expenses, mileage, and clients for Self Assessment tax returns.

## Tech Stack
- **Frontend:** React 19, Vite, Tailwind CSS v4
- **Backend/DB:** Supabase (Postgres) — project ID `xwvohiefikozspcyxthe`, region `eu-central-1`
- **Hosting:** Cloudflare Pages — live at `https://logall.pages.dev`
- **Repo:** GitHub — `https://github.com/dpleech72/logall.git`, branch `main`
- **Icons:** lucide-react
- **Routing:** react-router-dom v7

## Environment Variables
Stored in `.env.local` (local) and Cloudflare Pages environment variables (production).
- `VITE_SUPABASE_URL` — Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — Supabase anon key
- `VITE_ORS_API_KEY` — OpenRouteService API key (mileage distance calculation)
- `VITE_GOOGLE_CLIENT_ID` — Google OAuth client ID (`466505280366-8td0csn7dvcekiktrl74jpgcboajnl4d.apps.googleusercontent.com`)

## Deployment
- Pushing to `main` automatically triggers a Cloudflare Pages build
- To force a redeploy without code changes: `git commit --allow-empty -m "..." && git push`
- After adding/changing Cloudflare env vars, always push to trigger a rebuild

## Key Features & Files
- `src/pages/Expenses.jsx` — expense tracking with receipt photo upload; shows 🧾 badge on items with a receipt
- `src/pages/Mileage.jsx` — mileage tracking with automatic distance calculation (ORS API + Nominatim geocoding); each stop has its own Home button and client dropdown
- `src/pages/Profile.jsx` — user profile, Google Drive connect/disconnect, holidays, dark mode
- `src/pages/Clients.jsx` / `ClientDetail.jsx` / `ClientForm.jsx` — client management
- `src/pages/Income.jsx` — income tracking
- `src/pages/Schedule.jsx` — work schedule
- `src/pages/TaxSummary.jsx` / `TaxReport.jsx` — tax year summaries
- `src/lib/supabase.js` — Supabase client
- `src/lib/cloudStorage.js` — Google Drive OAuth + upload/delete (receipt photos)
- `src/lib/imageCompress.js` — Canvas-based image compression before upload
- `src/components/ui/ReceiptUpload.jsx` — receipt photo capture/upload/delete component
- `public/oauth-callback.html` — OAuth redirect callback handler

## Google Drive Integration
- Uses OAuth 2.0 implicit grant — **always redirect flow** (no popups; popups are blocked on mobile/PWA)
- Token stored in `localStorage` as `logall_google_token` with 55-min TTL
- Root folder cached in `localStorage` as `logall_gdrive_folder_id`
- Tax-year subfolders cached as `logall_gdrive_subfolder_YYYY-YY`
- Receipts saved to `LogAll Receipts / {tax-year}` in the user's Google Drive (e.g. `LogAll Receipts / 2025-26`)
- Filenames: `receipt_YYYYMMDD_HHMMSS.jpg`
- Images compressed to max 1200px / 72% JPEG quality before upload
- Connected account email stored in `profiles.google_drive_email`
- Google Cloud Console project: authorised origins include `http://localhost:5173` and `https://logall.pages.dev`
- App is published (not in Testing mode) so any Google account can connect

### Token expiry & silent re-auth
- When the token has expired and the user taps "Take photo" or "Choose file", the app silently redirects to Google with `prompt=none` (no login UI shown if still signed in)
- `logall_reauth_return_path` + `logall_reauth_pending` stored in localStorage before redirect; `oauth-callback.html` returns to the saved path
- On return, `ReceiptUpload` shows a green "Google Drive reconnected — tap … to take your photo" notice
- `silentReauth(intent)` and `hasValidToken()` exported from `cloudStorage.js`

### Receipt deletion
- When user taps ✕ on a saved receipt, an inline confirmation appears: "Yes, delete" (removes from Drive + form), "Remove only" (just the form), "Cancel"
- `deleteFromGoogleDrive(url)` in `cloudStorage.js` extracts the file ID from the Drive URL and calls `DELETE /drive/v3/files/{id}`

### Key cloudStorage.js exports
- `connectGoogleDrive()` — redirects to Google OAuth (select_account prompt)
- `completeMobileConnect()` — call on Profile mount to finalise a redirect connect
- `uploadToGoogleDrive(blob, filename)` — uploads to correct tax-year subfolder
- `deleteFromGoogleDrive(url)` — deletes a file by its Drive view URL
- `hasValidToken()` — returns true if a non-expired token is cached
- `silentReauth(intent)` — triggers silent re-auth redirect, stores return path
- `clearProviderToken()` — clears token + all folder ID cache keys from localStorage
- `fetchGoogleEmail(token)` — fetches the signed-in Google account email

## Supabase Tables (key ones)
- `profiles` — user profile, HMRC details, `receipt_provider` (TEXT, 'google' or null), `google_drive_email`
- `clients` — client list
- `expenses` — expenses with `receipt_url` (TEXT, nullable) for Google Drive links
- `mileage` — journey log
- `holidays` — user-defined holidays (shown on schedule)

## Mileage
- Rate: 55p/mile (HMRC approved)
- Distance auto-calculated using OpenRouteService + Nominatim geocoding
- Supports multi-stop journeys; each stop has its own Home button (fills postcode only) and client dropdown
- Home button uses postcode from user profile

## Tax
- UK tax year: 6 April — 5 April
- Basic rate assumed: 20%
- Mileage threshold: 10,000 miles (drops to 25p/mile after)

## Users
- Developer/owner: `dpleech@msn.com`
- Test user: Rachel
