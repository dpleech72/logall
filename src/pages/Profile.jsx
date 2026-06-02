import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, AlertCircle, Info, Plus, Trash2 } from 'lucide-react'

const Field = ({ label, hint, children }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
    {hint && <p className="text-xs text-gray-400 mb-1.5">{hint}</p>}
    {children}
  </div>
)

const Input = ({ ...props }) => (
  <input
    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
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
  const { user } = useAuth()
  const navigate = useNavigate()

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
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const [holidays, setHolidays] = useState([])
  const [newHolidayStart, setNewHolidayStart] = useState('')
  const [newHolidayEnd, setNewHolidayEnd] = useState('')
  const [newHolidayName, setNewHolidayName] = useState('')
  const [holidayAdding, setHolidayAdding] = useState(false)
  const [holidayError, setHolidayError] = useState('')

  useEffect(() => {
    fetchProfile()
    fetchHolidays()
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
    return <div className="p-4 pt-6 text-gray-400 text-sm">Loading...</div>
  }

  return (
    <div className="p-4 pb-8">
      {/* Header */}
      <div className="pt-2 flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-gray-400 active:text-gray-600">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">My profile</h1>
          <p className="text-gray-500 text-xs mt-0.5">{user?.email}</p>
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
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-4">
          <h2 className="font-semibold text-gray-900">Personal details</h2>

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
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
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
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">HMRC details</h2>
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

      {/* My holidays */}
      <div className="mt-5 bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-4">
        <div>
          <h2 className="font-semibold text-gray-900">My holidays</h2>
          <p className="text-xs text-gray-400 mt-1">
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
              <label className="block text-xs font-medium text-gray-500 mb-1 ml-1">From</label>
              <input
                type="date"
                value={newHolidayStart}
                onChange={e => { setNewHolidayStart(e.target.value); setHolidayError('') }}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1 ml-1">To <span className="text-gray-300 font-normal">(leave blank for one day)</span></label>
              <input
                type="date"
                value={newHolidayEnd}
                min={newHolidayStart || undefined}
                onChange={e => { setNewHolidayEnd(e.target.value); setHolidayError('') }}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="e.g. Summer holiday, Christmas Eve"
              value={newHolidayName}
              onChange={e => { setNewHolidayName(e.target.value); setHolidayError('') }}
              className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
            <button
              type="button"
              onClick={addHoliday}
              disabled={holidayAdding}
              className="bg-green-600 text-white font-semibold px-4 py-3 rounded-xl text-sm active:bg-green-700 disabled:opacity-60 flex items-center gap-1.5 flex-shrink-0"
            >
              <Plus size={16} />
              Add
            </button>
          </div>
        </div>

        {/* Holiday list */}
        {holidays.length > 0 ? (
          <div className="space-y-2">
            {holidays.map(h => (
              <div key={h.id} className="flex items-center justify-between bg-violet-50 border border-violet-100 rounded-xl px-3 py-2.5">
                <div>
                  <p className="text-sm font-medium text-gray-800">{h.name}</p>
                  <p className="text-xs text-gray-400">{formatHolidayDates(h.date, h.end_date)}</p>
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
          <p className="text-sm text-gray-400 text-center py-1">No personal holidays added yet</p>
        )}
      </div>
    </div>
  )
}
