import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Plus, PoundSterling, Trash2, AlertCircle, X, Check, ChevronLeft, ChevronRight, ArrowLeft } from 'lucide-react'

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']

const paymentLabel = { cash: 'Cash', bank_transfer: 'Bank transfer', cheque: 'Cheque' }
const paymentColour = {
  cash: 'bg-green-50 text-green-700',
  bank_transfer: 'bg-blue-50 text-blue-700',
  cheque: 'bg-purple-50 text-purple-700',
}

function LogPaymentSheet({ clients, income, onClose, onSaved, onDelete }) {
  const [form, setForm] = useState({
    client_id: income?.client_id || '',
    amount: income?.amount ? String(income.amount) : '',
    payment_method: income?.payment_method || 'cash',
    received_date: income?.received_date || (() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}` })(),
    description: income?.description || '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }))

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!form.amount || parseFloat(form.amount) <= 0) { setError('Please enter an amount.'); return }

    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()

    const selectedClient = clients.find(c => c.id === form.client_id)
    const payload = {
      client_id: form.client_id || null,
      amount: parseFloat(form.amount),
      payment_method: form.payment_method,
      received_date: form.received_date,
      description: form.description || (selectedClient ? `Payment — ${selectedClient.name}` : 'Payment'),
    }
    const { error } = income
      ? await supabase.from('income').update(payload).eq('id', income.id)
      : await supabase.from('income').insert({ ...payload, user_id: user.id })

    if (error) { setError(error.message); setLoading(false) }
    else { onSaved() }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40">
      <div className="bg-white dark:bg-gray-800 rounded-t-3xl p-5 pb-24 max-h-[90vh] overflow-y-auto">
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />

        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">{income ? 'Edit payment' : 'Log a payment'}</h2>
          <button onClick={onClose} className="p-2 text-gray-400 dark:text-gray-500"><X size={20} /></button>
        </div>

        {error && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl p-3 mb-4 text-sm text-red-700">
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />{error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-green-50 rounded-2xl p-4 text-center">
            <p className="text-xs font-medium text-green-600 mb-2">Amount received</p>
            <div className="flex items-center justify-center gap-1">
              <span className="text-3xl font-bold text-green-700">£</span>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={form.amount}
                onChange={set('amount')}
                className="text-3xl font-bold text-green-700 bg-transparent border-none outline-none w-36 text-center"
                autoFocus
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">Client (optional)</label>
            <select
              value={form.client_id}
              onChange={async (e) => {
                const client = clients.find(c => c.id === e.target.value)
                let amount = client?.hourly_rate ? String(client.hourly_rate) : ''

                if (client?.hourly_rate && e.target.value) {
                  const today = (() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}` })()
                  const { data: visits } = await supabase
                    .from('visits')
                    .select('duration_minutes')
                    .eq('client_id', e.target.value)
                    .eq('scheduled_date', today)
                    .neq('status', 'cancelled')
                    .order('scheduled_time')
                    .limit(1)

                  if (visits?.[0]?.duration_minutes) {
                    const hours = visits[0].duration_minutes / 60
                    amount = (hours * client.hourly_rate).toFixed(2)
                  }
                }

                setForm(f => ({
                  ...f,
                  client_id: e.target.value,
                  payment_method: client?.payment_method || f.payment_method,
                  amount: amount || f.amount,
                }))
              }}
              className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            >
              <option value="">No specific client</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">How did they pay?</label>
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

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">Date received</label>
            <input
              type="date"
              value={form.received_date}
              onChange={set('received_date')}
              className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">Note (optional)</label>
            <input
              type="text"
              placeholder="e.g. Weekly clean, extra rooms"
              value={form.description}
              onChange={set('description')}
              className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
          </div>

          <button type="button" onClick={onClose} className="w-full bg-gray-100 text-gray-600 dark:text-gray-300 font-semibold py-3.5 rounded-xl text-sm active:bg-gray-200 transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={loading} className="w-full bg-green-600 text-white font-semibold py-3.5 rounded-xl text-sm active:bg-green-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2">
            <Check size={16} />
            {loading ? 'Saving...' : income ? 'Save changes' : 'Log payment'}
          </button>

          {income && onDelete && (
            <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
              <button type="button" onClick={() => onDelete(income.id)}
                className="flex items-center gap-2 text-red-500 text-sm font-medium mx-auto">
                <Trash2 size={15} />
                Delete this payment
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  )
}

export default function Income() {
  const now = new Date()
  const [selectedYear, setSelectedYear] = useState(now.getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(null)
  const [monthSummaries, setMonthSummaries] = useState([])
  const [payments, setPayments] = useState([])
  const [clients, setClients] = useState([])
  const [clientMap, setClientMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [recent7, setRecent7] = useState([])
  const [taxYearTotal, setTaxYearTotal] = useState(0)
  const [showForm, setShowForm] = useState(false)
  const [editIncome, setEditIncome] = useState(null)
  const [deleteId, setDeleteId] = useState(null)

  useEffect(() => { fetchClients() }, [])
  useEffect(() => { fetchTaxYearTotal() }, [])
  useEffect(() => { fetchYearSummary() }, [selectedYear])
  useEffect(() => { if (selectedMonth !== null) fetchMonthPayments() }, [selectedMonth, selectedYear])

  async function fetchTaxYearTotal() {
    const taxYearStartYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1
    const taxYearStartDate = `${taxYearStartYear}-04-06`
    const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`
    const { data } = await supabase.from('income').select('amount')
      .gte('received_date', taxYearStartDate)
      .lte('received_date', todayStr)
    setTaxYearTotal((data || []).reduce((s, i) => s + parseFloat(i.amount), 0))
  }

  async function fetchClients() {
    const { data } = await supabase.from('clients').select('id, name, colour, hourly_rate, payment_method').eq('is_active', true).order('name')
    setClients(data || [])
    const map = {}
    ;(data || []).forEach(c => { map[c.id] = c })
    setClientMap(map)
  }

  async function fetchYearSummary() {
    setLoading(true)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)
    const sevenDaysAgoStr = `${sevenDaysAgo.getFullYear()}-${String(sevenDaysAgo.getMonth()+1).padStart(2,'0')}-${String(sevenDaysAgo.getDate()).padStart(2,'0')}`
    const todayStr = (() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}` })()

    const [{ data }, { data: recent }] = await Promise.all([
      supabase.from('income').select('received_date, amount')
        .gte('received_date', `${selectedYear}-01-01`)
        .lte('received_date', `${selectedYear}-12-31`),
      supabase.from('income').select('*')
        .gte('received_date', sevenDaysAgoStr)
        .lte('received_date', todayStr)
        .order('received_date', { ascending: false }),
    ])
    setRecent7(recent || [])

    const summaries = Array.from({ length: 12 }, (_, i) => ({ month: i, total: 0, count: 0 }))
    ;(data || []).forEach(item => {
      const month = parseInt(item.received_date.split('-')[1]) - 1
      summaries[month].total += parseFloat(item.amount)
      summaries[month].count++
    })
    setMonthSummaries(summaries)
    setLoading(false)
  }

  async function fetchMonthPayments() {
    setLoading(true)
    const monthStr = String(selectedMonth + 1).padStart(2, '0')
    const lastDay = new Date(selectedYear, selectedMonth + 1, 0).getDate()
    const { data } = await supabase.from('income').select('*')
      .gte('received_date', `${selectedYear}-${monthStr}-01`)
      .lte('received_date', `${selectedYear}-${monthStr}-${String(lastDay).padStart(2,'0')}`)
      .order('received_date', { ascending: false })
    setPayments(data || [])
    setLoading(false)
  }

  async function handleDelete(id) {
    await supabase.from('income').delete().eq('id', id)
    setPayments(prev => prev.filter(p => p.id !== id))
    setRecent7(prev => prev.filter(p => p.id !== id))
    fetchYearSummary()
    fetchTaxYearTotal()
    setDeleteId(null)
    setEditIncome(null)
  }

  const yearTotal = monthSummaries.reduce((s, m) => s + m.total, 0)

  // Month detail view
  if (selectedMonth !== null) {
    const monthTotal = payments.reduce((s, p) => s + parseFloat(p.amount), 0)
    return (
      <div className="p-4">
        <div className="pt-2 flex items-center gap-3 mb-4">
          <button onClick={() => setSelectedMonth(null)} className="p-2 -ml-2 text-gray-400">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">{MONTH_NAMES[selectedMonth]} {selectedYear}</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm">{payments.length} payment{payments.length !== 1 ? 's' : ''}</p>
          </div>
          <button onClick={() => setShowForm(true)}
            className="ml-auto flex items-center gap-1.5 bg-green-600 text-white font-semibold px-4 py-2.5 rounded-xl text-sm active:bg-green-700">
            <Plus size={16} />
            Log
          </button>
        </div>

        <div className="bg-green-600 rounded-2xl p-4 mb-4 text-white">
          <p className="text-green-100 text-xs font-medium mb-1">{MONTH_NAMES[selectedMonth]} {selectedYear}</p>
          <p className="text-3xl font-bold">£{monthTotal.toFixed(2)}</p>
          <p className="text-green-100 text-xs mt-1">total income</p>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1,2,3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
          </div>
        ) : payments.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 border border-gray-100 dark:border-gray-700 text-center">
            <p className="text-gray-400 dark:text-gray-500 text-sm">No payments in {MONTH_NAMES[selectedMonth]}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {payments.map(item => {
              const client = clientMap[item.client_id]
              return (
                <button key={item.id} onClick={() => setEditIncome(item)}
                  className="w-full bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-3.5 flex items-center gap-3 text-left active:bg-gray-50 transition-colors">
                  {client ? (
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                      style={{ backgroundColor: client.colour || '#16a34a' }}>
                      {client.name.charAt(0)}
                    </div>
                  ) : (
                    <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
                      <PoundSterling size={16} className="text-green-600" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-white text-sm truncate">
                      {item.description || client?.name || 'Payment'}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        {new Date(item.received_date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${paymentColour[item.payment_method]}`}>
                        {paymentLabel[item.payment_method]}
                      </span>
                    </div>
                  </div>
                  <p className="font-bold text-green-600 flex-shrink-0">£{parseFloat(item.amount).toFixed(2)}</p>
                </button>
              )
            })}
          </div>
        )}

        {deleteId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6">
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 w-full max-w-sm">
              <p className="font-semibold text-gray-900 dark:text-white mb-1">Delete this payment?</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">This can't be undone.</p>
              <div className="flex gap-2">
                <button onClick={() => setDeleteId(null)} className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-600 dark:text-gray-300">Cancel</button>
                <button onClick={() => handleDelete(deleteId)} className="flex-1 py-3 rounded-xl bg-red-600 text-white text-sm font-medium">Delete</button>
              </div>
            </div>
          </div>
        )}

        {(showForm || editIncome) && (
          <LogPaymentSheet
            clients={clients}
            income={editIncome}
            onClose={() => { setShowForm(false); setEditIncome(null) }}
            onSaved={() => { setShowForm(false); setEditIncome(null); fetchMonthPayments(); fetchYearSummary(); fetchTaxYearTotal() }}
            onDelete={(id) => { setEditIncome(null); setDeleteId(id) }}
          />
        )}
      </div>
    )
  }

  // Year overview
  return (
    <div className="p-4">
      <div className="pt-2 flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Income</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">Payments received</p>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 bg-green-600 text-white font-semibold px-4 py-2.5 rounded-xl text-sm active:bg-green-700 transition-colors">
          <Plus size={16} />
          Log payment
        </button>
      </div>

      {(() => {
        const tyStartYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1
        const tyLabel = `${tyStartYear}/${String(tyStartYear + 1).slice(2)}`
        return (
          <div className="bg-green-600 rounded-2xl p-4 mb-4 text-white">
            <p className="text-green-100 text-xs font-medium mb-1">Tax year {tyLabel}</p>
            <p className="text-3xl font-bold">£{taxYearTotal.toFixed(2)}</p>
            <p className="text-green-100 text-xs mt-1">total income</p>
          </div>
        )
      })()}

      <div className="flex items-center justify-between mb-3">
        <button onClick={() => setSelectedYear(y => y - 1)} className="p-2 text-gray-400 active:text-gray-600">
          <ChevronLeft size={20} />
        </button>
        <p className="text-lg font-bold text-gray-900 dark:text-white">{selectedYear}</p>
        <button onClick={() => setSelectedYear(y => y + 1)} disabled={selectedYear >= now.getFullYear()} className="p-2 text-gray-400 active:text-gray-600 disabled:opacity-30">
          <ChevronRight size={20} />
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-4 gap-1.5">
          {Array.from({length:12}).map((_,i) => <div key={i} className="h-20 bg-gray-100 dark:bg-gray-700 rounded-2xl animate-pulse" />)}
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-1.5">
          {monthSummaries.map((summary, i) => {
            const isCurrentMonth = i === now.getMonth() && selectedYear === now.getFullYear()
            const hasIncome = summary.total > 0
            const isFuture = selectedYear > now.getFullYear() || (selectedYear === now.getFullYear() && i > now.getMonth())
            return (
              <button
                key={i}
                onClick={() => !isFuture && setSelectedMonth(i)}
                disabled={isFuture}
                className={`rounded-xl p-2 text-left transition-colors border-2 ${
                  isCurrentMonth ? 'border-green-500 bg-green-50'
                  : hasIncome ? 'border-green-200 bg-green-50 active:bg-green-100'
                  : isFuture ? 'border-gray-100 bg-gray-50 opacity-40'
                  : 'border-gray-200 bg-white dark:bg-gray-800 dark:border-gray-700 active:bg-gray-50'
                }`}
              >
                <p className={`text-xs font-bold mb-1 ${isCurrentMonth || hasIncome ? 'text-green-700' : 'text-gray-400'}`}>
                  {MONTH_NAMES[i].slice(0, 3)}
                </p>
                {hasIncome ? (
                  <>
                    <p className="text-sm font-bold text-green-700">£{summary.total.toFixed(2)}</p>
                    <p className="text-xs text-green-600">{summary.count} {summary.count === 1 ? 'pmt' : 'pmts'}</p>
                  </>
                ) : (
                  <p className="text-sm font-bold text-transparent">£0</p>
                )}
              </button>
            )
          })}
        </div>
      )}

      {recent7.length > 0 && (
        <div className="mt-5">
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Last 7 days</h2>
          <div className="space-y-2">
            {recent7.map(item => {
              const client = clientMap[item.client_id]
              return (
                <button key={item.id} onClick={() => setEditIncome(item)}
                  className="w-full bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-3.5 flex items-center gap-3 text-left active:bg-gray-50 transition-colors">
                  {client ? (
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                      style={{ backgroundColor: client.colour || '#16a34a' }}>
                      {client.name.charAt(0)}
                    </div>
                  ) : (
                    <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
                      <PoundSterling size={16} className="text-green-600" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-white text-sm truncate">{item.description || client?.name || 'Payment'}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        {new Date(item.received_date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                      </span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${paymentColour[item.payment_method]}`}>
                        {paymentLabel[item.payment_method]}
                      </span>
                    </div>
                  </div>
                  <p className="font-bold text-green-600 flex-shrink-0">£{parseFloat(item.amount).toFixed(2)}</p>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 pb-24">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 w-full max-w-sm">
            <p className="font-semibold text-gray-900 dark:text-white mb-1">Delete this payment?</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">This can't be undone.</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteId(null)} className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-600 dark:text-gray-300">Cancel</button>
              <button onClick={() => handleDelete(deleteId)} className="flex-1 py-3 rounded-xl bg-red-600 text-white text-sm font-medium">Delete</button>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <LogPaymentSheet
          clients={clients}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); fetchYearSummary(); fetchTaxYearTotal() }}
          onDelete={(id) => { setShowForm(false); setDeleteId(id) }}
        />
      )}
      {editIncome && (
        <LogPaymentSheet
          clients={clients}
          income={editIncome}
          onClose={() => setEditIncome(null)}
          onSaved={() => { setEditIncome(null); fetchYearSummary(); fetchTaxYearTotal() }}
          onDelete={(id) => { setEditIncome(null); setDeleteId(id) }}
        />
      )}
    </div>
  )
}
