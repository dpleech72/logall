import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ArrowLeft, Check, AlertCircle, Calendar } from 'lucide-react'

const localDate = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
const today = localDate(new Date())

function generateDates(startDate, endDate, frequency) {
  const dates = []
  const start = new Date(startDate)
  const end = new Date(endDate)
  let current = new Date(start)

  while (current <= end) {
    dates.push(localDate(new Date(current)))
    if (frequency === 'weekly') current.setDate(current.getDate() + 7)
    else if (frequency === 'biweekly') current.setDate(current.getDate() + 14)
    else if (frequency === 'monthly') current.setMonth(current.getMonth() + 1)
    else break
  }
  return dates
}

const FREQUENCIES = [
  { value: 'weekly',   label: 'Every week' },
  { value: 'biweekly', label: 'Every 2 weeks' },
  { value: 'monthly',  label: 'Every month' },
]

export default function BulkVisits() {
  const navigate = useNavigate()
  const [clients, setClients] = useState([])
  const [form, setForm] = useState({
    client_id: '',
    start_date: '2026-04-06', // Start of current tax year
    end_date: today,
    frequency: 'weekly',
    scheduled_time: '',
    duration_minutes: '',
    amount: '',
    payment_method: '',
    status: 'done_paid',
  })
  const [selectedClientRate, setSelectedClientRate] = useState(null)
  const [preview, setPreview] = useState([])
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { fetchClients() }, [])

  useEffect(() => {
    if (form.client_id && form.start_date && form.end_date && form.frequency) {
      const dates = generateDates(form.start_date, form.end_date, form.frequency)
      setPreview(dates)
    } else {
      setPreview([])
    }
  }, [form.client_id, form.start_date, form.end_date, form.frequency])

  async function fetchClients() {
    const { data } = await supabase
      .from('clients')
      .select('id, name, colour, hourly_rate, payment_method')
      .eq('is_active', true)
      .order('name')
    setClients(data || [])
  }

  function calcAmount(rate, mins) {
    if (!rate || !mins) return ''
    return (parseFloat(rate) * (parseInt(mins) / 60)).toFixed(2)
  }

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }))

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!form.client_id) { setError('Please select a client.'); return }
    if (preview.length === 0) { setError('No dates generated — check your date range.'); return }

    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()

    const visits = preview.map(date => ({
      user_id: user.id,
      client_id: form.client_id,
      scheduled_date: date,
      scheduled_time: form.scheduled_time || null,
      duration_minutes: form.duration_minutes ? parseInt(form.duration_minutes) : null,
      amount: form.amount ? parseFloat(form.amount) : null,
      payment_method: form.payment_method || null,
      status: form.status,
      is_recurring: true,
      recurrence_rule: form.frequency,
    }))

    const { data: insertedVisits, error } = await supabase.from('visits').insert(visits).select()

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    // If marked as done & paid and an amount is set, log income for every visit
    if (form.status === 'done_paid' && form.amount && insertedVisits?.length) {
      const clientName = clients.find(c => c.id === form.client_id)?.name || 'Client'
      const incomeRecords = insertedVisits.map(v => ({
        user_id: user.id,
        client_id: form.client_id,
        visit_id: v.id,
        amount: parseFloat(form.amount),
        payment_method: form.payment_method || null,
        received_date: v.scheduled_date,
        description: `Visit — ${clientName}`,
      }))
      await supabase.from('income').insert(incomeRecords)
    }

    setSaved(true)
  }

  if (saved) {
    return (
      <div className="p-4">
        <div className="pt-6 flex flex-col items-center text-center gap-4">
          <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center">
            <Check size={32} className="text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {preview.length} visits added!
          </h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            All jobs have been added to the schedule.
          </p>
          <button
            onClick={() => navigate('/schedule')}
            className="w-full bg-green-600 text-white font-semibold py-3.5 rounded-xl text-sm active:bg-green-700"
          >
            Go to schedule
          </button>
          <button
            onClick={() => { setSaved(false); setPreview([]) }}
            className="w-full bg-gray-100 text-gray-600 dark:text-gray-300 font-semibold py-3.5 rounded-xl text-sm"
          >
            Add more
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4">
      {/* Header */}
      <div className="pt-2 flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/schedule')} className="p-2 -ml-2 text-gray-400 dark:text-gray-500">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Add past jobs</h1>
          <p className="text-gray-500 dark:text-gray-400 text-xs mt-0.5">Bulk add recurring visits</p>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl p-3 mb-4 text-sm text-red-700">
          <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />{error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">

        {/* Client */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">Client *</label>
          {clients.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500">No clients yet — add one first</p>
          ) : (
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
                      amount: calcAmount(client.hourly_rate, f.duration_minutes) || (client.hourly_rate ? String(client.hourly_rate) : f.amount),
                    }))
                  } else {
                    setSelectedClientRate(null)
                    setForm(f => ({ ...f, client_id: '' }))
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
          )}
        </div>

        {/* Frequency */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">How often?</label>
          <div className="grid grid-cols-3 gap-2">
            {FREQUENCIES.map(f => (
              <button
                key={f.value}
                type="button"
                onClick={() => setForm(ff => ({ ...ff, frequency: f.value }))}
                className={`py-2.5 rounded-xl text-xs font-semibold border-2 transition-colors ${
                  form.frequency === f.value
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Date range */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">From</label>
            <input
              type="date"
              value={form.start_date}
              onChange={set('start_date')}
              className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">To</label>
            <input
              type="date"
              value={form.end_date}
              onChange={set('end_date')}
              max={today}
              className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
          </div>
        </div>

        {/* Preview */}
        {preview.length > 0 && (
          <div className="bg-green-50 border border-green-100 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-2">
              <Calendar size={14} className="text-green-600" />
              <p className="text-sm font-semibold text-green-700">{preview.length} visits will be created</p>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
              {preview.map(date => (
                <span key={date} className="text-xs bg-white dark:bg-gray-800 border border-green-200 text-green-700 px-2 py-0.5 rounded-full">
                  {new Date(date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Time */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">Start time (optional)</label>
          <input
            type="time"
            value={form.scheduled_time}
            onChange={set('scheduled_time')}
            className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          />
        </div>

        {/* Duration */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">Duration (optional)</label>
          <div className="grid grid-cols-4 gap-2">
            {[{mins:60,label:'1hr'},{mins:90,label:'1.5hr'},{mins:120,label:'2hr'},{mins:180,label:'3hr'}].map(({ mins, label }) => (
              <button
                key={mins}
                type="button"
                onClick={() => setForm(f => ({
                  ...f,
                  duration_minutes: String(mins),
                  amount: calcAmount(selectedClientRate, mins) || f.amount,
                }))}
                className={`py-2.5 rounded-xl text-xs font-semibold border-2 transition-colors ${
                  form.duration_minutes === String(mins)
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Amount */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">Amount per visit (optional)</label>
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
          {form.amount && preview.length > 0 && (
            <p className="text-xs text-green-600 mt-1.5 font-medium">
              Total income: £{(parseFloat(form.amount) * preview.length).toFixed(2)}
            </p>
          )}
        </div>

        {/* Payment method */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">Payment method</label>
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
        </div>

        {/* Status */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">Mark all as</label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { value: 'done_paid', label: '✅ Done & paid' },
              { value: 'awaiting_payment', label: '⏳ Awaiting payment' },
            ].map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setForm(f => ({ ...f, status: opt.value }))}
                className={`py-2.5 px-3 rounded-xl text-xs font-semibold border-2 transition-colors ${
                  form.status === opt.value
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => navigate('/schedule')}
          className="w-full bg-gray-100 text-gray-600 dark:text-gray-300 font-semibold py-3.5 rounded-xl text-sm active:bg-gray-200 transition-colors"
        >
          Cancel
        </button>

        <button
          type="submit"
          disabled={loading || preview.length === 0}
          className="w-full bg-green-600 text-white font-semibold py-3.5 rounded-xl text-sm active:bg-green-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
        >
          <Check size={16} />
          {loading ? 'Adding visits...' : `Add ${preview.length} visits`}
        </button>

      </form>
    </div>
  )
}
