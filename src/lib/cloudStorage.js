/**
 * Cloud storage helpers for receipt uploads.
 *
 * The app's OAuth client IDs are set once by the developer in .env:
 *   VITE_GOOGLE_CLIENT_ID   – from Google Cloud Console
 *   VITE_ONEDRIVE_CLIENT_ID – from Azure App Registration
 *
 * End users never deal with credentials — they just click "Connect" and
 * sign in to their Google / Microsoft account via a standard popup.
 */

const REDIRECT_URI = `${window.location.origin}/oauth-callback.html`

// ─────────────────────────────────────────────
// Token storage (localStorage so it persists across PWA sessions)
// ─────────────────────────────────────────────

const TOKEN_KEY = 'logall_google_token'

function saveToken(token) {
  localStorage.setItem(TOKEN_KEY, JSON.stringify({
    token,
    expiresAt: Date.now() + 55 * 60 * 1000,
  }))
}

function getCachedToken() {
  try {
    const cached = localStorage.getItem(TOKEN_KEY)
    if (!cached) return null
    const { token, expiresAt } = JSON.parse(cached)
    if (Date.now() < expiresAt) return token
    localStorage.removeItem(TOKEN_KEY)
    return null
  } catch {
    return null
  }
}

// ─────────────────────────────────────────────
// Google Drive
// ─────────────────────────────────────────────

function googleAuthUrl(extras = {}) {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
  if (!clientId) throw new Error('Google Drive is not set up for this app yet.')
  return 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    response_type: 'token',
    scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email',
    ...extras,
  })
}

/**
 * Connect Google Drive — always uses redirect flow (works on all devices/browsers).
 * Navigates to Google sign-in; Profile page picks up the result on return
 * via completeMobileConnect().
 */
export function connectGoogleDrive() {
  window.location.href = googleAuthUrl({ prompt: 'select_account' })
}

/** Fetch the Google account email for a given access token */
export async function fetchGoogleEmail(token) {
  const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('Could not fetch Google account info.')
  const { email } = await res.json()
  return email
}

/**
 * Call this on the Profile page on mount to complete a mobile OAuth redirect.
 * Returns { email } if we just came back from Google, null otherwise.
 */
export async function completeMobileConnect() {
  const provider = sessionStorage.getItem('logall_oauth_return')
  if (!provider) return null

  sessionStorage.removeItem('logall_oauth_return')

  const error = sessionStorage.getItem('logall_oauth_error')
  if (error) {
    sessionStorage.removeItem('logall_oauth_error')
    throw new Error(`Sign-in failed: ${error}`)
  }

  // Token was already stored by oauth-callback.html in the correct format
  const cached = sessionStorage.getItem('logall_google_token')
  if (!cached) throw new Error('No token found after sign-in.')

  const { token } = JSON.parse(cached)
  const email = await fetchGoogleEmail(token)
  return { provider, email }
}

const GOOGLE_FOLDER_KEY = 'logall_gdrive_folder_id'
const GOOGLE_FOLDER_NAME = 'LogAll Receipts'

async function getOrCreateGoogleFolder(token) {
  const cached = localStorage.getItem(GOOGLE_FOLDER_KEY)

  // Verify the cached ID still exists in Drive before trusting it
  if (cached) {
    const check = await fetch(
      `https://www.googleapis.com/drive/v3/files/${cached}?fields=id,trashed`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    if (check.ok) {
      const file = await check.json()
      if (!file.trashed) return cached
    }
    // Stale — clear and recreate
    localStorage.removeItem(GOOGLE_FOLDER_KEY)
  }

  const q = encodeURIComponent(`name='${GOOGLE_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`)
  const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!searchRes.ok) throw new Error('Could not search Google Drive.')
  const { files } = await searchRes.json()

  if (files?.length) {
    localStorage.setItem(GOOGLE_FOLDER_KEY, files[0].id)
    return files[0].id
  }

  const createRes = await fetch('https://www.googleapis.com/drive/v3/files?fields=id', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: GOOGLE_FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' }),
  })
  if (!createRes.ok) throw new Error('Could not create Google Drive folder.')
  const folder = await createRes.json()
  localStorage.setItem(GOOGLE_FOLDER_KEY, folder.id)
  return folder.id
}

/** Upload a compressed receipt blob to Google Drive. Returns a viewable URL. */
export async function uploadToGoogleDrive(blob, filename) {
  const token = getCachedToken()
  if (!token) throw new Error('Google Drive session expired — please reconnect in Profile → Receipt storage.')
  const folderId = await getOrCreateGoogleFolder(token)

  const metadata = { name: filename, parents: [folderId] }
  const boundary = 'logall_multipart_boundary'

  // Correct multipart/related format:
  // --boundary\r\n
  // Content-Type: application/json\r\n\r\n
  // {json}\r\n
  // --boundary\r\n
  // Content-Type: image/jpeg\r\n\r\n
  // [binary]\r\n
  // --boundary--
  const preamble = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
    JSON.stringify(metadata) +
    `\r\n--${boundary}\r\nContent-Type: image/jpeg\r\n\r\n`
  const epilogue = `\r\n--${boundary}--`

  const bodyStart = new TextEncoder().encode(preamble)
  const bodyEnd   = new TextEncoder().encode(epilogue)
  const body = new Uint8Array(bodyStart.length + blob.size + bodyEnd.length)
  body.set(bodyStart, 0)
  body.set(new Uint8Array(await blob.arrayBuffer()), bodyStart.length)
  body.set(bodyEnd, bodyStart.length + blob.size)

  const uploadRes = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary="${boundary}"`,
      },
      body,
    }
  )
  if (!uploadRes.ok) {
    const err = await uploadRes.text()
    throw new Error(`Google Drive upload failed: ${err}`)
  }
  const { id } = await uploadRes.json()

  await fetch(`https://www.googleapis.com/drive/v3/files/${id}/permissions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'reader', type: 'anyone' }),
  })

  return `https://drive.google.com/file/d/${id}/view`
}

/** Clear the cached Google token and folder ID (e.g. on disconnect) */
export function clearProviderToken() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(GOOGLE_FOLDER_KEY)
}
