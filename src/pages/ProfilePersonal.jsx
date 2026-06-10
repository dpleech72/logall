import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { ArrowLeft, Check, AlertCircle, Info } from 'lucide-react'

const Field = ({ label, hint, children }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">{label}</label>
    {hint && <p className="text-xs text-gray-400 dark:text-gray-500 mb-1.5">{hint}</p>}
    {children}
  </div>
)

const Input = (props) => (
  <input
    className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
    {...props}
  />
)

const TRADES = [
  'Cleaner', 'Carer', 'Gardener', 'Dog walker', 'Mobile hairdresser',
  'Childminder', 'Mobile beautician', 'Ironing service', 'Window cleaner', 'Other'
]

export default function ProfilePersonal() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    full_name: '', trade: '', phone: '', address: '', postcode: '',
    national_insurance: '', utr: '', vat_number: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { fetchProfile() }, [])

  async function fetchProfile() {
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
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
    }
    setLoading(false)
  }

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }))

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSaving(true)
    const { error } = await supabase.from('profiles').update({
      full_name: form.full_name,
      trade: form.trade,
      phone: form.phone,
      address: form.address,
      postcode: form.postcode,
      national_insurance: form.national_insurance,
      utr: form.utr,
      vat_number: form.vat_number,
      updated_at: new Date().toISOString(),
    }).eq('id', user.id)
    setSaving(false)
    if (error) { setError(error.message) } else { setSaved(true); setTimeout(() => setSaved(false), 3000) }
  }

  if (loading) return <div className="p-4 pt-6 text-gray-400 dark:text-gray-500 text-sm">Loading...</div>

  return (
    <div className="p-4 pb-8 md:max-w-3xl md:mx-auto">
      <div className="pt-2 flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/profile')} className="p-2 -ml-2 text-gray-400 dark:text-gray-500">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Personal &amp; HMRC</h1>
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
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-4 space-y-4">
          <h2 className="font-semibold text-gray-900 dark:text-white">Personal details</h2>
          <Field label="Full name">
            <Input type="text" placeholder="e.g. Sarah Clarke" value={form.full_name} onChange={set('full_name')} />
          </Field>
          <Field label="What do you do?">
            <select value={form.trade} onChange={set('trade')}
              className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white">
              <option value="">Select your trade</option>
              {TRADES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Phone number">
            <Input type="tel" placeholder="e.g. 07700 900123" value={form.phone} onChange={set('phone')} />
          </Field>
          <Field label="Address">
            <Input type="text" placeholder="e.g. 12 Oak Street" value={form.address} onChange={set('address')} />
          </Field>
          <Field label="Postcode">
            <Input type="text" placeholder="e.g. CV11 4AB" value={form.postcode} onChange={set('postcode')} />
          </Field>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 dark:text-white">HMRC details</h2>
            <span className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded-full font-medium">For tax submission</span>
          </div>
          <Field label="National Insurance number" hint="Format: 2 letters, 6 numbers, 1 letter — e.g. QQ123456C">
            <Input type="text" placeholder="e.g. QQ123456C" value={form.national_insurance} onChange={set('national_insurance')} maxLength={9} style={{ textTransform: 'uppercase' }} />
          </Field>
          <Field label="Unique Taxpayer Reference (UTR)" hint="Your 10-digit UTR number from HMRC — found on Self Assessment letters">
            <Input type="text" placeholder="e.g. 1234567890" value={form.utr} onChange={set('utr')} maxLength={10} />
          </Field>
          <Field label="VAT number (optional)" hint="Only needed if you're VAT registered — most sole traders won't have this">
            <Input type="text" placeholder="e.g. GB123456789" value={form.vat_number} onChange={set('vat_number')} />
          </Field>
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-700 flex items-start gap-2">
            <Info size={14} className="flex-shrink-0 mt-0.5" />
            <span>Your HMRC details are stored securely and only used for tax submissions. LogAll never shares them with third parties.</span>
          </div>
        </div>

        <button type="submit" disabled={saving}
          className="w-full bg-green-600 text-white font-semibold py-3.5 rounded-xl text-sm active:bg-green-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2">
          <Check size={16} />
          {saving ? 'Saving...' : 'Save'}
        </button>
      </form>
    </div>
  )
}
