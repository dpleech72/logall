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
- `VITE_GOOGLE_CLIENT_ID` — Google OAuth client ID for Google Drive receipt storage

## Deployment
- Pushing to `main` automatically triggers a Cloudflare Pages build
- To force a redeploy without code changes: `git commit --allow-empty -m "..." && git push`
- After adding/changing Cloudflare env vars, always push to trigger a rebuild

## Key Features & Files
- `src/pages/Expenses.jsx` — expense tracking with receipt photo upload
- `src/pages/Mileage.jsx` — mileage tracking with automatic distance calculation (ORS API + Nominatim geocoding)
- `src/pages/Profile.jsx` — user profile, Google Drive connect/disconnect, holidays, dark mode
- `src/pages/Clients.jsx` / `ClientDetail.jsx` / `ClientForm.jsx` — client management
- `src/pages/Income.jsx` — income tracking
- `src/pages/Schedule.jsx` — work schedule
- `src/pages/TaxSummary.jsx` / `TaxReport.jsx` — tax year summaries
- `src/lib/supabase.js` — Supabase client
- `src/lib/cloudStorage.js` — Google Drive OAuth + upload (receipt photos)
- `src/lib/imageCompress.js` — Canvas-based image compression before upload
- `src/components/ui/ReceiptUpload.jsx` — receipt photo capture/upload component
- `public/oauth-callback.html` — OAuth popup callback handler

## Google Drive Integration
- Uses OAuth 2.0 implicit grant via popup (`/oauth-callback.html`)
- Tokens cached in `sessionStorage` (55 min TTL)
- Receipts saved to a "LogAll Receipts" folder in the user's Google Drive
- Images compressed to max 1200px / 72% JPEG quality before upload
- Connected account email stored in `profiles.google_drive_email`
- Google Cloud Console project: authorised origins include `http://localhost:5173` and `https://logall.pages.dev`

## Supabase Tables (key ones)
- `profiles` — user profile, HMRC details, `receipt_provider`, `google_drive_email`
- `clients` — client list
- `expenses` — expenses with `receipt_url` column for Google Drive links
- `mileage` — journey log
- `holidays` — user-defined holidays (shown on schedule)

## Mileage
- Rate: 55p/mile (HMRC approved)
- Distance auto-calculated using OpenRouteService + Nominatim geocoding
- Supports multi-stop journeys
- Home button uses postcode from user profile

## Tax
- UK tax year: 6 April — 5 April
- Basic rate assumed: 20%
- Mileage threshold: 10,000 miles (drops to 25p/mile after)

## Users
- Developer/owner: `dpleech@msn.com`
- Test user: Rachel
