import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import { LogIn, Mail, Lock, AlertCircle, ShieldCheck, Fingerprint } from 'lucide-react'

const passkeysSupported = typeof window !== 'undefined' && !!window.PublicKeyCredential

export default function SignIn() {
  const { signIn, getMfaLevel } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [passkeyLoading, setPasskeyLoading] = useState(false)

  const handlePasskeySignIn = async () => {
    setError('')
    setPasskeyLoading(true)
    try {
      const { error } = await supabase.auth.signInWithPasskey()
      if (error) {
        const msg = (error.message || '').toLowerCase()
        // User dismissed the system prompt — not a real error, stay quiet
        if (error.name === 'NotAllowedError' || msg.includes('cancel') || msg.includes('not allowed') || msg.includes('abort')) return
        setError('Could not sign in with a fingerprint or Face ID. Use your email and password, or try again.')
        return
      }
      // A passkey satisfies sign-in; check whether a 2FA step is still required
      const aal = await getMfaLevel()
      if (aal?.nextLevel === 'aal2' && aal?.currentLevel !== 'aal2') {
        setMfaRequired(true)
      } else {
        navigate('/dashboard')
      }
    } catch (err) {
      const msg = (err?.message || '').toLowerCase()
      if (err?.name === 'NotAllowedError' || msg.includes('cancel') || msg.includes('not allowed') || msg.includes('abort')) return
      setError('Could not sign in with a fingerprint or Face ID. Use your email and password, or try again.')
    } finally {
      setPasskeyLoading(false)
    }
  }

  // MFA step
  const [mfaRequired, setMfaRequired] = useState(false)
  const [mfaCode, setMfaCode] = useState('')
  const [mfaError, setMfaError] = useState('')
  const [mfaLoading, setMfaLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error } = await signIn(email, password)

    if (error) {
      setError('Email or password is incorrect. Please try again.')
      setLoading(false)
      return
    }

    // Check if MFA elevation is needed
    const aal = await getMfaLevel()
    if (aal?.nextLevel === 'aal2' && aal?.currentLevel !== 'aal2') {
      setMfaRequired(true)
      setLoading(false)
    } else {
      navigate('/dashboard')
    }
  }

  const handleMfaVerify = async (e) => {
    e.preventDefault()
    setMfaError('')
    setMfaLoading(true)

    // Get the verified TOTP factor
    const { data: factorsData, error: factorsError } = await supabase.auth.mfa.listFactors()
    if (factorsError || !factorsData?.totp?.length) {
      setMfaError('Could not find 2FA factor. Please try signing in again.')
      setMfaLoading(false)
      return
    }

    const factorId = factorsData.totp[0].id

    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId,
      code: mfaCode.replace(/\s/g, ''),
    })

    setMfaLoading(false)

    if (error) {
      setMfaError('Invalid code — please check your authenticator app and try again.')
      setMfaCode('')
    } else {
      navigate('/dashboard')
    }
  }

  // ── MFA code screen ──
  if (mfaRequired) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col justify-center px-6 py-12">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-green-600 rounded-2xl mb-4">
            <ShieldCheck size={28} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Log<span className="text-green-600">All</span></h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">Log all. Worry none.</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 max-w-sm mx-auto w-full">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Two-factor authentication</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            Open your authenticator app and enter the 6-digit code for LogAll.
          </p>

          {mfaError && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl p-3 mb-4 text-sm text-red-700">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
              {mfaError}
            </div>
          )}

          <form onSubmit={handleMfaVerify} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">
                Verification code
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9 ]*"
                maxLength={7}
                value={mfaCode}
                onChange={e => setMfaCode(e.target.value)}
                placeholder="000 000"
                autoFocus
                required
                className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-center tracking-widest text-lg font-mono focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent dark:bg-gray-700 dark:text-white dark:placeholder-gray-500"
              />
            </div>

            <button
              type="submit"
              disabled={mfaLoading || mfaCode.replace(/\s/g, '').length < 6}
              className="w-full bg-green-600 text-white font-semibold py-3 rounded-xl text-sm active:bg-green-700 disabled:opacity-60 transition-colors"
            >
              {mfaLoading ? 'Verifying...' : 'Verify'}
            </button>

            <button
              type="button"
              onClick={() => { setMfaRequired(false); setMfaCode(''); setMfaError('') }}
              className="w-full text-sm text-gray-400 dark:text-gray-500 py-1"
            >
              ← Back to sign in
            </button>
          </form>
        </div>
      </div>
    )
  }

  // ── Normal sign in screen ──
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center px-6 py-12">
      {/* Logo */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 bg-green-600 rounded-2xl mb-4">
          <LogIn size={28} className="text-white" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Log<span className="text-green-600">All</span>
        </h1>
        <p className="text-gray-500 dark:text-gray-400 dark:text-gray-500 mt-1 text-sm">Log all. Worry none.</p>
      </div>

      {/* Card */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 max-w-sm mx-auto w-full">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Welcome back</h2>

        {error && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl p-3 mb-4 text-sm text-red-700">
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">
              Email address
            </label>
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full pl-9 pr-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">Password</label>
              <Link to="/forgot-password" className="text-xs text-green-600 font-medium">
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Your password"
                required
                className="w-full pl-9 pr-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 text-white font-semibold py-3 rounded-xl text-sm active:bg-green-700 disabled:opacity-60 transition-colors mt-2"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        {passkeysSupported && (
          <>
            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-gray-100 dark:bg-gray-700" />
              <span className="text-xs text-gray-400 dark:text-gray-500">or</span>
              <div className="flex-1 h-px bg-gray-100 dark:bg-gray-700" />
            </div>
            <button
              type="button"
              onClick={handlePasskeySignIn}
              disabled={passkeyLoading}
              className="w-full flex items-center justify-center gap-2 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 font-semibold py-3 rounded-xl text-sm active:bg-gray-50 dark:active:bg-gray-700 disabled:opacity-60 transition-colors"
            >
              <Fingerprint size={18} className="text-green-600" />
              {passkeyLoading ? 'Waiting for fingerprint…' : 'Sign in with fingerprint or Face ID'}
            </button>
          </>
        )}

        <p className="text-center text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 mt-6">
          Don't have an account?{' '}
          <Link to="/sign-up" className="text-green-600 font-semibold">
            Sign up free
          </Link>
        </p>
      </div>
    </div>
  )
}
