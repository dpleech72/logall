import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ArrowLeft, AlertCircle, Trash2 } from 'lucide-react'

const Field = ({ label, hint, children }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">{label}</label>
    {hint && <p className="text-xs text-gray-400 dark:text-gray-500 mb-1.5">{hint}</p>}
    {children}
  </div>
)

const QUICK_DURATIONS = [
  { mins: 60,  label: '1hr' },
  { mins: 90,  label: '1.5hr' },
  { mins: 120, label: '2hr' },
  { mins: 180, label: '3hr' },
]

const RECURRENCE = [
  { value: 'none',      label: 'One-off' },
  { value: 'weekly',    label: 'Every week' },
  { value: 'biweekly',  label: 'Every 2 weeks' },
  { value: 'monthly',   label: 'Every month' },
]

export default function VisitEditForm() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [clients, setClients] = useState([])
  const [form, setForm] = useState(null)
  const [selectedClientRate, setSelectedClientRate] = useState(null)

  function calcAmount(rate, mins) {
    if (!rate || !mins) return ''
    return (parseFloat(rate) * (parseInt(mins) / 60)).toFixed(2)
  }
  const [customDuration, setCustomDuration] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showDelete, setShowDelete] = useState(false)

  useEffect(() => {
    fetchData()
  }, [id])

  async function fetchData() {
    const [{ data: visit }, { data: clientData }] = await Promise.all([
      supabase.from('visits').select('*').eq('id', id).single(),
      supabase.from('clients').select('id, name, colour, hourly_rate, payment_method').eq('is_active', true).order('name'),
    ])

    if (visit) {
      const matchingClient = (clientData || []).find(c => c.id === visit.client_id)
      if (matchingClient?.hourly_rate) setSelectedClientRate(matchingClient.hourly_rate)
      setForm({
        client_id: visit.client_id || '',
        scheduled_date: visit.scheduled_date || '',
        scheduled_time: visit.scheduled_time || '',
        duration_minutes: visit.duration_minutes ? String(visit.duration_minutes) : '',
        amount: visit.amount ? String(visit.amount) : '',
        payment_method: visit.payment_method || '',
        notes: visit.notes || '',
        recurrence_rule: visit.recurrence_rule || 'none',
        status: visit.status || 'scheduled',
      })
      if (visit.duration_minutes && ![60,90,120,180].includes(visit.duration_minutes)) {
        setCustomDuration(true)
      }
    }
    setClients(clientData || [])
  }

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }))

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!form.client_id) { setError('Please select a client.'); return }
    if (!form.scheduled_date) { setError('Please choose a date.'); return }

    setLoading(true)
    const { error } = await supabase.from('visits').update({
      client_id: form.client_id,
      scheduled_date: form.scheduled_date,
      scheduled_time: form.scheduled_time || null,
      duration_minutes: form.duration_minutes ? parseInt(form.duration_minutes) : null,
      amount: form.amount ? parseFloat(form.amount) : null,
      payment_method: form.payment_method || null,
      notes: form.notes || null,
      is_recurring: form.recurrence_rule !== 'none',
      recurrence_rule: form.recurrence_rule !== 'none' ? form.recurrence_rule : null,
      status: form.status,
    }).eq('id', id)

    if (error) { setError(error.message); setLoading(false) }
    else { navigate('/schedule') }
  }

  async function handleDelete() {
    await supabase.from('visits').delete().eq('id', id)
    navigate('/schedule')
  }

  if (!form) {
    return <div className="p-4 pt-6 text-gray-400 dark:text-gray-500 text-sm">Loading...</div>
  }

  return (
    <div className="p-4">
      {/* Header */}
      <div className="pt-2 flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/schedule')} className="p-2 -ml-2 text-gray-400 dark:text-gray-500 active:text-gray-600 dark:text-gray-300">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Edit visit</h1>
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl p-3 mb-4 text-sm text-red-700">
          <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />{error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">

        {/* Client */}
        <Field label="Client *">
          <div className="relative">
            {form.client_id && (
              <div
                className="absolute left-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-md z-10 pointer-events-none"
                style={{ backgroundColor: clients.find(c => c.id === form.client_id)?.colour || '#16a34a' }}
              />
            )}
            <select
              value={form.client_id}
              onChange={(e) => {
                const client = clients.find(c => c.id === e.target.value)
                if (client) {
                  setSelectedClientRate(client.hourly_rate || null)
                  setForm(f => ({
                    ...f,
                    client_id: client.id,
                    payment_method: client.payment_method || f.payment_method,
                    amount: calcAmount(client.hourly_rate, f.duration_minutes) || f.amount,
                  }))
                }
              }}
              className={`w-full py-3 pr-4 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white ${form.client_id ? 'pl-11' : 'pl-4'}`}
            >
              <option value="">Select a client...</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </Field>

        {/* Status */}
        <Field label="Status">
          <div className="grid grid-cols-2 gap-2">
            {[
              { value: 'scheduled',        label: '📅 Scheduled',        colour: 'border-blue-500 bg-blue-50 text-blue-700' },
              { value: 'done_paid',        label: '✅ Done & paid',       colour: 'border-green-500 bg-green-50 text-green-700' },
              { value: 'awaiting_payment', label: '⏳ Awaiting payment',  colour: 'border-amber-500 bg-amber-50 text-amber-700' },
              { value: 'cancelled',        label: '❌ Cancelled',         colour: 'border-gray-300 bg-gray-50 text-gray-500 dark:text-gray-400 dark:text-gray-500' },
            ].map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setForm(f => ({ ...f, status: opt.value }))}
                className={`py-2.5 px-3 rounded-xl text-xs font-semibold border-2 transition-colors text-left ${
                  form.status === opt.value ? opt.colour : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </Field>

        {/* Date */}
        <Field label="Date *">
          <input
            type="date"
            value={form.scheduled_date}
            onChange={set('scheduled_date')}
            required
            className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          />
        </Field>

        {/* Time */}
        <Field label="Start time (optional)">
          <input
            type="time"
            value={form.scheduled_time}
            onChange={set('scheduled_time')}
            className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          />
        </Field>

        {/* Duration */}
        <Field label="Duration (optional)">
          <div className="grid grid-cols-4 gap-2 mb-2">
            {QUICK_DURATIONS.map(({ mins, label }) => (
              <button
                key={mins}
                type="button"
                onClick={() => {
                  setForm(f => ({
                    ...f,
                    duration_minutes: String(mins),
                    amount: calcAmount(selectedClientRate, mins) || f.amount,
                  }))
                  setCustomDuration(false)
                }}
                className={`py-2.5 rounded-xl text-xs font-semibold border-2 transition-colors ${
                  form.duration_minutes === String(mins) && !customDuration
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => { setCustomDuration(!customDuration); setForm(f => ({ ...f, duration_minutes: '' })) }}
            className={`w-full py-2.5 rounded-xl text-xs font-semibold border-2 transition-colors mb-2 ${
              customDuration ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'
            }`}
          >
            Custom duration (hours)
          </button>
          {customDuration && (
            <div className="relative">
              <input
                type="number"
                min="0.5"
                max="12"
                step="0.5"
                placeholder="e.g. 2.5"
                value={form.duration_minutes ? form.duration_minutes / 60 : ''}
                onChange={(e) => {
                  const mins = e.target.value ? Math.round(parseFloat(e.target.value) * 60) : ''
                  setForm(f => ({
                    ...f,
                    duration_minutes: mins,
                    amount: calcAmount(selectedClientRate, mins) || f.amount,
                  }))
                }}
                className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 pr-16"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 text-sm">hours</span>
            </div>
          )}
        </Field>

        {/* Amount */}
        <Field label="Amount (optional)">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 text-sm">£</span>
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={form.amount}
              onChange={set('amount')}
              className="w-full pl-7 pr-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
          </div>
        </Field>

        {/* Payment method */}
        <Field label="Payment method">
          <div className="grid grid-cols-3 gap-2">
            {[
              { value: 'cash', label: '💵 Cash' },
              { value: 'bank_transfer', label: '🏦 Bank transfer' },
              { value: 'cheque', label: '📝 Cheque' },
            ].map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setForm(f => ({ ...f, payment_method: opt.value }))}
                className={`py-2.5 px-2 rounded-xl text-xs font-semibold border-2 transition-colors text-center ${
                  form.payment_method === opt.value
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </Field>

        {/* Recurring */}
        <Field label="How often?">
          <div className="grid grid-cols-2 gap-2">
            {RECURRENCE.map(r => (
              <button
                key={r.value}
                type="button"
                onClick={() => setForm(f => ({ ...f, recurrence_rule: r.value }))}
                className={`py-2.5 rounded-xl text-xs font-semibold border-2 transition-colors ${
                  form.recurrence_rule === r.value
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </Field>

        {/* Notes */}
        <Field label="Notes (optional)">
          <textarea
            placeholder="e.g. Use back door, bring extra cloths"
            value={form.notes}
            onChange={set('notes')}
            rows={2}
            className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
          />
        </Field>

        <button
          type="button"
          onClick={() => navigate('/schedule')}
          className="w-full bg-gray-100 text-gray-600 dark:text-gray-300 font-semibold py-3.5 rounded-xl text-sm active:bg-gray-200 transition-colors"
        >
          ← Back to schedule
        </button>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-green-600 text-white font-semibold py-3.5 rounded-xl text-sm active:bg-green-700 disabled:opacity-60 transition-colors"
        >
          {loading ? 'Saving...' : 'Save changes'}
        </button>
      </form>

      {/* Delete */}
      <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-700">
        {!showDelete ? (
          <button
            onClick={() => setShowDelete(true)}
            className="flex items-center gap-2 text-red-500 text-sm font-medium mx-auto"
          >
            <Trash2 size={15} />
            Delete this visit
          </button>
        ) : (
          <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-center">
            <p className="text-sm text-red-700 font-medium mb-1">Delete this visit?</p>
            <p className="text-xs text-red-500 mb-4">This can't be undone.</p>
            <div className="flex gap-2">
              <button onClick={() => setShowDelete(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-600 dark:text-gray-300">Cancel</button>
              <button onClick={handleDelete} className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-medium">Delete</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
