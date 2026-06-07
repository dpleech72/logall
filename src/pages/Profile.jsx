import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, AlertCircle, Info, Plus, Trash2, LogOut, Sun, Moon, Loader2, Link, Unlink, Mail } from 'lucide-react'
import { useDarkMode } from '../hooks/useDarkMode'
import { connectGoogleDrive, completeMobileConnect, clearProviderToken } from '../lib/cloudStorage'

const Field = ({ label, hint, children }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">{label}</label>
    {hint && <p className="text-xs text-gray-400 dark:text-gray-500 mb-1.5">{hint}</p>}
    {children}
  </div>
)

const Input = ({ ...props }) => (
  <input
    className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
    {...props}
  />
)

const TRADES = [
  'Cleaner', 'Carer', 'Gardener', 'Dog walker', 'Mobile hairdresser',
  'Childminder', 'Mobile beautician', 'Ironing service', 'Window cleaner', 'Other'
]

function formatHolidayDates(startDate, endDate) {
  const start = new Date(startDate + 'T12:00:00')
  const end = new Date(endDate + 'T12:00:00')
  const opts = { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }
  if (startDate === endDate) {
    return start.toLocaleDateString('en-GB', opts)
  }
  const startStr = start.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
  const endStr = end.toLocaleDateString('en-GB', opts)
  return `${startStr} – ${endStr}`
}

export default function Profile() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [dark, setDark] = useDarkMode()

  const [form, setForm] = useState({
    full_name: '',
    trade: '',
    phone: '',
    address: '',
    postcode: '',
    national_insurance: '',
    utr: '',
    vat_number: '',
  })
  const [googleEmail, setGoogleEmail]     = useState(null)
  const [providerConnecting, setProviderConnecting] = useState(false)
  const [providerError, setProviderError] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const [newEmail, setNewEmail]           = useState('')
  const [emailSaving, setEmailSaving]     = useState(false)
  const [emailSent, setEmailSent]         = useState(false)
  const [emailError, setEmailError]       = useState('')

  const [holidays, setHolidays] = useState([])
  const [newHolidayStart, setNewHolidayStart] = useState('')
  const [newHolidayEnd, setNewHolidayEnd] = useState('')
  const [newHolidayName, setNewHolidayName] = useState('')
  const [holidayAdding, setHolidayAdding] = useState(false)
  const [holidayError, setHolidayError] = useState('')

  useEffect(() => {
    fetchProfile()
    fetchHolidays()
    // Complete a mobile OAuth redirect if we just came back from Google
    completeMobileConnect()
      .then(async result => {
        if (!result) return
        await supabase.from('profiles').update({
          receipt_provider: 'google',
          google_drive_email: result.email,
        }).eq('id', user.id)
        setGoogleEmail(result.email)
      })
      .catch(err => setProviderError(err.message))
  }, [])

  async function fetchProfile() {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (data) {
      setForm({
        full_name: data.full_name || '',
        trade: data.trade || '',
        phone: data.phone || '',
        address: data.address || '',
        postcode: data.postcode || '',
        national_insurance: data.national_insurance || '',
        utr: data.utr || '',
        vat_number: data.vat_number || '',
      })
      setGoogleEmail(data.google_drive_email || null)
    }
    setLoading(false)
  }

  async function fetchHolidays() {
    const { data } = await supabase
      .from('holidays')
      .select('*')
      .order('date', { ascending: true })
    setHolidays(data || [])
  }

  async function addHoliday() {
    if (!newHolidayStart || !newHolidayName.trim()) {
      setHolidayError('Please enter a start date and a name.')
      return
    }
    const endDate = newHolidayEnd || newHolidayStart
    if (endDate < newHolidayStart) {
      setHolidayError('End date must be on or after the start date.')
      return
    }
    setHolidayAdding(true)
    setHolidayError('')
    const { error } = await supabase.from('holidays').insert({
      user_id: user.id,
      date: newHolidayStart,
      end_date: endDate,
      name: newHolidayName.trim(),
    })
    setHolidayAdding(false)
    if (error) {
      if (error.code === '23505') {
        setHolidayError('You already have a holiday starting on that date.')
      } else {
        setHolidayError(error.message)
      }
      return
    }
    setNewHolidayStart('')
    setNewHolidayEnd('')
    setNewHolidayName('')
    fetchHolidays()
  }

  async function deleteHoliday(id) {
    await supabase.from('holidays').delete().eq('id', id)
    setHolidays(h => h.filter(x => x.id !== id))
  }

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }))

  function handleConnect() {
    setProviderError('')
    setProviderConnecting(true)
    connectGoogleDrive() // navigates away — page will reload on return
  }

  async function handleDisconnect() {
    setProviderError('')
    const { error } = await supabase
      .from('profiles')
      .update({ receipt_provider: null, google_drive_email: null })
      .eq('id', user.id)
    if (error) {
      setProviderError('Could not disconnect: ' + error.message)
      return
    }
    clearProviderToken()
    setGoogleEmail(null)
  }

  async function handleEmailChange() {
    setEmailError('')
    if (!newEmail.trim() || !newEmail.includes('@')) {
      setEmailError('Please enter a valid email address.')
      return
    }
    if (newEmail.trim().toLowerCase() === user?.email?.toLowerCase()) {
      setEmailError('That is already your current email address.')
      return
    }
    setEmailSaving(true)
    const { error } = await supabase.auth.updateUser({ email: newEmail.trim() })
    setEmailSaving(false)
    if (error) {
      setEmailError(error.message)
    } else {
      setEmailSent(true)
      setNewEmail('')
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSaving(true)

    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: form.full_name,
        trade: form.trade,
        phone: form.phone,
        address: form.address,
        postcode: form.postcode,
        national_insurance: form.national_insurance,
        utr: form.utr,
        vat_number: form.vat_number,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)

    if (error) {
      setError(error.message)
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    }
    setSaving(false)
  }

  if (loading) {
    return <div className="p-4 pt-6 text-gray-400 dark:text-gray-500 text-sm">Loading...</div>
  }

  return (
    <div className="p-4 pb-8 md:max-w-3xl md:mx-auto lg:max-w-4xl lg:p-8">
      {/* Header */}
      <div className="pt-2 flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-gray-400 dark:text-gray-500 active:text-gray-600 dark:text-gray-300">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">My profile</h1>
          <p className="text-gray-500 dark:text-gray-400 dark:text-gray-500 text-xs mt-0.5">{user?.email}</p>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl p-3 mb-4 text-sm text-red-700">
          <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />{error}
        </div>
      )}

      {saved && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-100 rounded-xl p-3 mb-4 text-sm text-green-700">
          <Check size={16} />Profile saved!
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* Personal details */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-4 space-y-4">
          <h2 className="font-semibold text-gray-900 dark:text-white">Personal details</h2>

          <Field label="Full name">
            <Input
              type="text"
              placeholder="e.g. Sarah Clarke"
              value={form.full_name}
              onChange={set('full_name')}
            />
          </Field>

          <Field label="What do you do?">
            <select
              value={form.trade}
              onChange={set('trade')}
              className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            >
              <option value="">Select your trade</option>
              {TRADES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>

          <Field label="Phone number">
            <Input
              type="tel"
              placeholder="e.g. 07700 900123"
              value={form.phone}
              onChange={set('phone')}
            />
          </Field>

          <Field label="Address">
            <Input
              type="text"
              placeholder="e.g. 12 Oak Street"
              value={form.address}
              onChange={set('address')}
            />
          </Field>

          <Field label="Postcode">
            <Input
              type="text"
              placeholder="e.g. CV11 4AB"
              value={form.postcode}
              onChange={set('postcode')}
            />
          </Field>
        </div>

        {/* HMRC details */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 dark:text-white">HMRC details</h2>
            <span className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded-full font-medium">For tax submission</span>
          </div>

          <Field
            label="National Insurance number"
            hint="Format: 2 letters, 6 numbers, 1 letter — e.g. QQ123456C"
          >
            <Input
              type="text"
              placeholder="e.g. QQ123456C"
              value={form.national_insurance}
              onChange={set('national_insurance')}
              maxLength={9}
              style={{ textTransform: 'uppercase' }}
            />
          </Field>

          <Field
            label="Unique Taxpayer Reference (UTR)"
            hint="Your 10-digit UTR number from HMRC — found on Self Assessment letters"
          >
            <Input
              type="text"
              placeholder="e.g. 1234567890"
              value={form.utr}
              onChange={set('utr')}
              maxLength={10}
            />
          </Field>

          <Field
            label="VAT number (optional)"
            hint="Only needed if you're VAT registered — most sole traders won't have this"
          >
            <Input
              type="text"
              placeholder="e.g. GB123456789"
              value={form.vat_number}
              onChange={set('vat_number')}
            />
          </Field>

          <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-700 flex items-start gap-2">
            <Info size={14} className="flex-shrink-0 mt-0.5" />
            <span>Your HMRC details are stored securely and only used for tax submissions. LogAll never shares them with third parties.</span>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-green-600 text-white font-semibold py-3.5 rounded-xl text-sm active:bg-green-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
        >
          <Check size={16} />
          {saving ? 'Saving...' : 'Save profile'}
        </button>
      </form>

      {/* Change email */}
      <div className="mt-5 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-4 space-y-3">
        <div>
          <h2 className="font-semibold text-gray-900 dark:text-white">Change email address</h2>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            Current: <span className="font-medium text-gray-600 dark:text-gray-300">{user?.email}</span>
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
            You'll receive <span className="font-medium text-gray-600 dark:text-gray-300">two confirmation emails</span> — one to your current address and one to the new one. You must click the link in both to complete the change. <span className="font-medium text-gray-600 dark:text-gray-300">Check your junk/spam folder</span> if they don't arrive within a few minutes.
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
            <input
              type="email"
              placeholder="New email address"
              value={newEmail}
              onChange={e => { setNewEmail(e.target.value); setEmailError('') }}
              className="flex-1 px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
            />
            <button
              type="button"
              onClick={handleEmailChange}
              disabled={emailSaving || !newEmail.trim()}
              className="bg-green-600 text-white font-semibold px-4 py-3 rounded-xl text-sm active:bg-green-700 disabled:opacity-60 flex items-center gap-1.5 flex-shrink-0"
            >
              {emailSaving ? <Loader2 size={15} className="animate-spin" /> : <Mail size={15} />}
              {emailSaving ? '' : 'Send'}
            </button>
          </div>
        )}
      </div>

      {/* My holidays */}
      <div className="mt-5 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-4 space-y-4">
        <div>
          <h2 className="font-semibold text-gray-900 dark:text-white">My holidays</h2>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            Add your own days off — highlighted in purple on your schedule.
            UK bank holidays are highlighted automatically in red.
          </p>
        </div>

        {holidayError && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl p-3 text-sm text-red-700">
            <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />{holidayError}
          </div>
        )}

        {/* Add form */}
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 mb-1 ml-1">From</label>
              <input
                type="date"
                value={newHolidayStart}
                onChange={e => { setNewHolidayStart(e.target.value); setHolidayError('') }}
                className="w-full px-3 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 mb-1 ml-1">To</label>
              <input
                type="date"
                value={newHolidayEnd}
                min={newHolidayStart || undefined}
                onChange={e => { setNewHolidayEnd(e.target.value); setHolidayError('') }}
                className="w-full px-3 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
              />
            </div>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 ml-1">Leave "To" blank for a single day.</p>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Holiday name"
              value={newHolidayName}
              onChange={e => { setNewHolidayName(e.target.value); setHolidayError('') }}
              className="flex-1 px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
            />
            <button
              type="button"
              onClick={addHoliday}
              disabled={holidayAdding}
              className="bg-green-600 text-white font-semibold px-3 py-3 rounded-xl text-sm active:bg-green-700 disabled:opacity-60 flex items-center gap-1 flex-shrink-0 whitespace-nowrap"
            >
              <Plus size={14} />
              Add
            </button>
          </div>
        </div>

        {/* Holiday list */}
        {holidays.length > 0 ? (
          <div className="space-y-2">
            {holidays.map(h => (
              <div key={h.id} className="flex items-center justify-between bg-violet-50 dark:bg-violet-900/30 border border-violet-100 dark:border-violet-800 rounded-xl px-3 py-2.5">
                <div>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{h.name}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">{formatHolidayDates(h.date, h.end_date)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => deleteHoliday(h.id)}
                  className="p-2 text-red-400 active:text-red-600 -mr-1 flex-shrink-0"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-1">No personal holidays added yet</p>
        )}
      </div>

      {/* Receipt storage */}
      <div className="mt-5 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-4 space-y-3">
        <div>
          <h2 className="font-semibold text-gray-900 dark:text-white">Receipt storage</h2>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            Link a cloud account to store your receipt photos. Receipts are compressed before uploading.
          </p>
        </div>

        {providerError && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-100 dark:bg-red-900/20 dark:border-red-800 rounded-xl p-3 text-sm text-red-700 dark:text-red-300">
            <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
            <span>{providerError}</span>
          </div>
        )}

        {/* Google Drive */}
        {googleEmail ? (
          <div className="flex items-center gap-3 px-3 py-3 rounded-xl border-2 border-green-500 bg-green-50 dark:bg-green-900/20 dark:border-green-600">
            <span className="text-xl">🔵</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-green-700 dark:text-green-300">Google Drive</p>
              <p className="text-xs text-green-600 dark:text-green-400 truncate">{googleEmail}</p>
            </div>
            <button
              type="button"
              onClick={handleDisconnect}
              className="text-xs text-red-400 font-medium flex items-center gap-1 flex-shrink-0 active:opacity-70"
            >
              <Unlink size={13} />
              Disconnect
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={providerConnecting}
            onClick={handleConnect}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 active:bg-gray-100 text-left transition-colors disabled:opacity-60"
          >
            <span className="text-xl">🔵</span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">Connect Google Drive</p>
              <p className="text-xs text-gray-400 dark:text-gray-500">Sign in to link your Google account</p>
            </div>
            {providerConnecting
              ? <Loader2 size={16} className="animate-spin text-gray-400 flex-shrink-0" />
              : <Link size={15} className="text-gray-400 flex-shrink-0" />}
          </button>
        )}
      </div>

      {/* Dark mode toggle */}
      <div className="mt-5 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-4">
        <button
          onClick={() => setDark(d => !d)}
          className="w-full flex items-center justify-between text-sm font-medium text-gray-700 dark:text-gray-200 py-1"
        >
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
      <div className="mt-3 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-4">
        <button
          onClick={signOut}
          className="w-full flex items-center justify-center gap-2 text-red-500 font-semibold py-2 text-sm active:opacity-70 transition-colors"
        >
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    </div>
  )
}
