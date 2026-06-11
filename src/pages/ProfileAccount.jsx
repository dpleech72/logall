import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useDarkMode } from '../hooks/useDarkMode'
import { connectGoogleDrive, completeMobileConnect, clearProviderToken } from '../lib/cloudStorage'
import { ArrowLeft, Check, AlertCircle, Loader2, Mail, Link, Unlink, ShieldCheck, ShieldOff, QrCode, Sun, Moon, LogOut, Fingerprint, Trash2 } from 'lucide-react'

const passkeysSupported = typeof window !== 'undefined' && !!window.PublicKeyCredential

export default function ProfileAccount() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [dark, setDark] = useDarkMode()

  const [googleEmail, setGoogleEmail]         = useState(null)
  const [providerConnecting, setProviderConnecting] = useState(false)
  const [providerError, setProviderError]     = useState('')

  const [newEmail, setNewEmail]               = useState('')
  const [emailSaving, setEmailSaving]         = useState(false)
  const [emailSent, setEmailSent]             = useState(false)
  const [emailError, setEmailError]           = useState('')

  const [mfaFactor, setMfaFactor]             = useState(null)
  const [mfaEnrolling, setMfaEnrolling]       = useState(false)
  const [mfaQR, setMfaQR]                     = useState('')
  const [mfaSecret, setMfaSecret]             = useState('')
  const [mfaFactorId, setMfaFactorId]         = useState('')
  const [mfaCode, setMfaCode]                 = useState('')
  const [mfaVerifying, setMfaVerifying]       = useState(false)
  const [mfaError, setMfaError]               = useState('')
  const [mfaSuccess, setMfaSuccess]           = useState(false)
  const [mfaDisabling, setMfaDisabling]       = useState(false)
  const [mfaConfirm, setMfaConfirm]           = useState(false)

  const [passkeys, setPasskeys]               = useState([])
  const [pkBusy, setPkBusy]                   = useState(false)
  const [pkError, setPkError]                 = useState('')
  const [pkJustAdded, setPkJustAdded]         = useState(false)
  const [pkConfirmDelete, setPkConfirmDelete] = useState(null)

  useEffect(() => {
    fetchGoogleEmail()
    checkMfa()
    if (passkeysSupported) loadPasskeys()
    completeMobileConnect()
      .then(async result => {
        if (!result) return
        await supabase.from('profiles').update({ receipt_provider: 'google', google_drive_email: result.email }).eq('id', user.id)
        setGoogleEmail(result.email)
      })
      .catch(err => setProviderError(err.message))
  }, [])

  async function fetchGoogleEmail() {
    const { data } = await supabase.from('profiles').select('google_drive_email').eq('id', user.id).single()
    setGoogleEmail(data?.google_drive_email || null)
  }

  async function checkMfa() {
    const { data } = await supabase.auth.mfa.listFactors()
    const verified = (data?.totp || []).find(f => f.status === 'verified')
    setMfaFactor(verified || null)
  }

  function isCancellation(err) {
    const msg = (err?.message || '').toLowerCase()
    return err?.name === 'NotAllowedError' || msg.includes('cancel') || msg.includes('not allowed') || msg.includes('abort')
  }

  async function loadPasskeys() {
    try {
      const { data } = await supabase.auth.passkey.list()
      setPasskeys(data || [])
    } catch (_) { /* passkeys unavailable — leave list empty */ }
  }

  async function enrollPasskey() {
    setPkError(''); setPkBusy(true)
    try {
      const { error } = await supabase.auth.registerPasskey()
      if (error) {
        if (!isCancellation(error)) setPkError(error.message || 'Could not set up a passkey. Please try again.')
        return
      }
      setPkJustAdded(true); setTimeout(() => setPkJustAdded(false), 5000)
      loadPasskeys()
    } catch (err) {
      if (!isCancellation(err)) setPkError(err?.message || 'Could not set up a passkey on this device.')
    } finally {
      setPkBusy(false)
    }
  }

  async function removePasskey(id) {
    setPkError('')
    try {
      const { error } = await supabase.auth.passkey.delete({ passkeyId: id })
      if (error) { setPkError(error.message || 'Could not remove that passkey.'); return }
      loadPasskeys()
    } catch (err) {
      setPkError(err?.message || 'Could not remove that passkey.')
    } finally {
      setPkConfirmDelete(null)
    }
  }

  async function startMfaEnroll() {
    setMfaError('')
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', issuer: 'LogAll', friendlyName: 'LogAll' })
    if (error) { setMfaError(error.message); return }
    setMfaFactorId(data.id); setMfaQR(data.totp.qr_code); setMfaSecret(data.totp.secret); setMfaEnrolling(true)
  }

  async function cancelMfaEnroll() {
    if (mfaFactorId) await supabase.auth.mfa.unenroll({ factorId: mfaFactorId })
    setMfaEnrolling(false); setMfaQR(''); setMfaSecret(''); setMfaFactorId(''); setMfaCode(''); setMfaError('')
  }

  async function verifyMfaEnroll() {
    setMfaError(''); setMfaVerifying(true)
    const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId: mfaFactorId })
    if (chErr) { setMfaError(chErr.message); setMfaVerifying(false); return }
    const { error } = await supabase.auth.mfa.verify({ factorId: mfaFactorId, challengeId: ch.id, code: mfaCode.replace(/\s/g, '') })
    setMfaVerifying(false)
    if (error) { setMfaError('Invalid code — please try again.'); setMfaCode(''); return }
    setMfaEnrolling(false); setMfaQR(''); setMfaSecret(''); setMfaCode('')
    setMfaSuccess(true); setTimeout(() => setMfaSuccess(false), 5000); checkMfa()
  }

  async function disableMfa() {
    setMfaDisabling(true); setMfaError('')
    const { error } = await supabase.auth.mfa.unenroll({ factorId: mfaFactor.id })
    setMfaDisabling(false)
    if (error) { setMfaError(error.message); return }
    setMfaFactor(null); setMfaConfirm(false)
  }

  async function handleEmailChange() {
    setEmailError('')
    if (!newEmail.trim() || !newEmail.includes('@')) { setEmailError('Please enter a valid email address.'); return }
    if (newEmail.trim().toLowerCase() === user?.email?.toLowerCase()) { setEmailError('That is already your current email address.'); return }
    setEmailSaving(true)
    const { error } = await supabase.auth.updateUser({ email: newEmail.trim() })
    setEmailSaving(false)
    if (error) { setEmailError(error.message) } else { setEmailSent(true); setNewEmail('') }
  }

  return (
    <div className="p-4 pb-8 md:max-w-3xl md:mx-auto space-y-5">
      <div className="pt-2 flex items-center gap-3">
        <button onClick={() => navigate('/profile')} className="p-2 -ml-2 text-gray-400 dark:text-gray-500">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Account</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{user?.email}</p>
        </div>
      </div>

      {/* Change email */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-4 space-y-3">
        <div>
          <h2 className="font-semibold text-gray-900 dark:text-white">Change email address</h2>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            Current: <span className="font-medium text-gray-600 dark:text-gray-300">{user?.email}</span>
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
            You'll receive <span className="font-medium text-gray-600 dark:text-gray-300">two confirmation emails</span> — one to your current address and one to the new one. <span className="font-medium text-gray-600 dark:text-gray-300">Check your junk/spam folder</span> if they don't arrive.
          </p>
        </div>
        {emailError && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl p-3 text-sm text-red-700">
            <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />{emailError}
          </div>
        )}
        {emailSent ? (
          <div className="flex items-start gap-2 bg-green-50 border border-green-100 rounded-xl p-3 text-sm text-green-700">
            <Check size={15} className="flex-shrink-0 mt-0.5" />
            <span>Confirmation email sent! Check your new inbox and click the link to complete the change.</span>
          </div>
        ) : (
          <div className="flex gap-2">
            <input type="email" placeholder="New email address" value={newEmail}
              onChange={e => { setNewEmail(e.target.value); setEmailError('') }}
              className="flex-1 min-w-0 px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400" />
            <button type="button" onClick={handleEmailChange} disabled={emailSaving || !newEmail.trim()}
              className="bg-green-600 text-white font-semibold px-4 py-3 rounded-xl text-sm active:bg-green-700 disabled:opacity-60 flex items-center gap-1.5 flex-shrink-0">
              {emailSaving ? <Loader2 size={15} className="animate-spin" /> : <Mail size={15} />}
              {emailSaving ? '' : 'Send'}
            </button>
          </div>
        )}
      </div>

      {/* Receipt storage */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-4 space-y-3">
        <div>
          <h2 className="font-semibold text-gray-900 dark:text-white">Receipt storage</h2>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Link Google Drive to store receipt photos. Receipts are compressed before uploading.</p>
        </div>
        {providerError && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl p-3 text-sm text-red-700">
            <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />{providerError}
          </div>
        )}
        {googleEmail ? (
          <div className="flex items-center gap-3 px-3 py-3 rounded-xl border-2 border-green-500 bg-green-50 dark:bg-green-900/20 dark:border-green-600">
            <span className="text-xl">🔵</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-green-700 dark:text-green-300">Google Drive</p>
              <p className="text-xs text-green-600 dark:text-green-400 truncate">{googleEmail}</p>
            </div>
            <button type="button" onClick={async () => {
              const { error } = await supabase.from('profiles').update({ receipt_provider: null, google_drive_email: null }).eq('id', user.id)
              if (!error) { clearProviderToken(); setGoogleEmail(null) }
            }} className="text-xs text-red-400 font-medium flex items-center gap-1 flex-shrink-0 active:opacity-70">
              <Unlink size={13} />Disconnect
            </button>
          </div>
        ) : (
          <button type="button" disabled={providerConnecting} onClick={() => { setProviderError(''); setProviderConnecting(true); connectGoogleDrive() }}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 active:bg-gray-100 text-left transition-colors disabled:opacity-60">
            <span className="text-xl">🔵</span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">Connect Google Drive</p>
              <p className="text-xs text-gray-400 dark:text-gray-500">Sign in to link your Google account</p>
            </div>
            {providerConnecting ? <Loader2 size={16} className="animate-spin text-gray-400 flex-shrink-0" /> : <Link size={15} className="text-gray-400 flex-shrink-0" />}
          </button>
        )}
      </div>

      {/* Two-factor authentication */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-white">Two-factor authentication</h2>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Add an extra layer of security. You'll be asked for a code from your authenticator app each time you sign in.</p>
          </div>
          {mfaFactor && (
            <span className="flex-shrink-0 flex items-center gap-1 text-xs bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-1 rounded-full font-medium">
              <ShieldCheck size={12} /> On
            </span>
          )}
        </div>
        {mfaError && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl p-3 text-sm text-red-700">
            <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />{mfaError}
          </div>
        )}
        {mfaSuccess && (
          <div className="flex items-center gap-2 bg-green-50 border border-green-100 rounded-xl p-3 text-sm text-green-700">
            <ShieldCheck size={15} />Two-factor authentication is now enabled!
          </div>
        )}
        {mfaFactor && !mfaSuccess && (
          mfaConfirm ? (
            <div className="space-y-2">
              <p className="text-sm text-gray-600 dark:text-gray-300">Are you sure? This will remove 2FA from your account.</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => setMfaConfirm(false)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-600 dark:text-gray-300">Cancel</button>
                <button type="button" onClick={disableMfa} disabled={mfaDisabling}
                  className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-medium disabled:opacity-60">
                  {mfaDisabling ? 'Disabling...' : 'Yes, disable'}
                </button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setMfaConfirm(true)} className="flex items-center gap-2 text-sm text-red-500 font-medium">
              <ShieldOff size={15} />Disable two-factor authentication
            </button>
          )
        )}
        {!mfaFactor && !mfaSuccess && (
          mfaEnrolling ? (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-300">Scan this QR code with your authenticator app, then enter the 6-digit code to confirm.</p>
              <div className="flex justify-center">
                <div className="bg-white p-3 rounded-xl border border-gray-200">
                  <img src={mfaQR} alt="2FA QR code" width={160} height={160} />
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-3">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
                  <QrCode size={12} /> Can't scan? Enter this code manually:
                </p>
                <p className="text-sm font-mono font-semibold text-gray-800 dark:text-gray-100 break-all">{mfaSecret}</p>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">Enter the 6-digit code from the app</label>
                <input type="text" inputMode="numeric" pattern="[0-9 ]*" maxLength={7} value={mfaCode}
                  onChange={e => { setMfaCode(e.target.value); setMfaError('') }} placeholder="000 000"
                  className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-center tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:text-white" />
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={cancelMfaEnroll}
                  className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-600 dark:text-gray-300">Cancel</button>
                <button type="button" onClick={verifyMfaEnroll} disabled={mfaVerifying || mfaCode.replace(/\s/g,'').length < 6}
                  className="flex-1 py-3 rounded-xl bg-green-600 text-white text-sm font-semibold disabled:opacity-60">
                  {mfaVerifying ? 'Verifying...' : 'Activate 2FA'}
                </button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={startMfaEnroll}
              className="flex items-center gap-2 bg-green-600 text-white font-semibold px-4 py-3 rounded-xl text-sm active:bg-green-700 w-full justify-center">
              <ShieldCheck size={16} />Enable two-factor authentication
            </button>
          )
        )}
      </div>

      {/* Fingerprint / Face ID (passkeys) */}
      {passkeysSupported && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-white">Fingerprint &amp; Face ID login</h2>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Sign in with your fingerprint, face, or device PIN instead of typing your password. Set one up on each device you use.</p>
            </div>
            {passkeys.length > 0 && (
              <span className="flex-shrink-0 flex items-center gap-1 text-xs bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-1 rounded-full font-medium">
                <Fingerprint size={12} /> On
              </span>
            )}
          </div>

          {pkError && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl p-3 text-sm text-red-700">
              <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />{pkError}
            </div>
          )}
          {pkJustAdded && (
            <div className="flex items-center gap-2 bg-green-50 border border-green-100 rounded-xl p-3 text-sm text-green-700">
              <Check size={15} />Fingerprint login is set up on this device!
            </div>
          )}

          {passkeys.length > 0 && (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {passkeys.map(pk => (
                <div key={pk.id} className="flex items-center gap-3 py-2.5">
                  <Fingerprint size={16} className="text-gray-400 dark:text-gray-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700 dark:text-gray-200 truncate">{pk.friendly_name || 'Passkey'}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      Added {new Date(pk.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {pk.last_used_at && ` · last used ${new Date(pk.last_used_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`}
                    </p>
                  </div>
                  {pkConfirmDelete === pk.id ? (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button onClick={() => removePasskey(pk.id)} className="text-xs text-red-500 font-medium">Remove</button>
                      <button onClick={() => setPkConfirmDelete(null)} className="text-xs text-gray-400 font-medium">Cancel</button>
                    </div>
                  ) : (
                    <button onClick={() => setPkConfirmDelete(pk.id)} className="p-1.5 text-gray-400 active:text-red-500 flex-shrink-0">
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          <button type="button" onClick={enrollPasskey} disabled={pkBusy}
            className="flex items-center gap-2 bg-green-600 text-white font-semibold px-4 py-3 rounded-xl text-sm active:bg-green-700 w-full justify-center disabled:opacity-60">
            {pkBusy ? <Loader2 size={16} className="animate-spin" /> : <Fingerprint size={16} />}
            {pkBusy ? 'Waiting for fingerprint…' : passkeys.length > 0 ? 'Add another device' : 'Set up fingerprint login'}
          </button>
        </div>
      )}

      {/* Dark mode */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-4">
        <button onClick={() => setDark(d => !d)}
          className="w-full flex items-center justify-between text-sm font-medium text-gray-700 dark:text-gray-200 py-1">
          <span className="flex items-center gap-2">
            {dark ? <Sun size={16} className="text-amber-400" /> : <Moon size={16} className="text-gray-400" />}
            {dark ? 'Switch to light mode' : 'Switch to dark mode'}
          </span>
          <span className={`w-10 h-6 rounded-full flex items-center px-1 transition-colors ${dark ? 'bg-green-600' : 'bg-gray-200'}`}>
            <span className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${dark ? 'translate-x-4' : 'translate-x-0'}`} />
          </span>
        </button>
      </div>

      {/* Sign out */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-4">
        <button onClick={signOut}
          className="w-full flex items-center justify-center gap-2 text-red-500 font-semibold py-2 text-sm active:opacity-70">
          <LogOut size={16} />Sign out
        </button>
      </div>
    </div>
  )
}
