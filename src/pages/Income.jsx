import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Plus, PoundSterling, Trash2, AlertCircle, X, Check, Pencil } from 'lucide-react'

const paymentLabel = { cash: 'Cash', bank_transfer: 'Bank transfer', cheque: 'Cheque' }
const paymentColour = {
  cash: 'bg-green-50 text-green-700',
  bank_transfer: 'bg-blue-50 text-blue-700',
  cheque: 'bg-purple-50 text-purple-700',
}

function groupByMonth(income) {
  const groups = {}
  income.forEach(item => {
    const date = new Date(item.received_date)
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    const label = date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
    if (!groups[key]) groups[key] = { label, items: [], total: 0 }
    groups[key].items.push(item)
    groups[key].total += parseFloat(item.amount)
  })
  return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0])).map(([, v]) => v)
}

function LogPaymentSheet({ clients, income, onClose, onSaved }) {
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
        {/* Handle */}
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
          {/* Amount — big and prominent */}
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

          {/* Client */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">Client (optional)</label>
            <select
              value={form.client_id}
              onChange={async (e) => {
                const client = clients.find(c => c.id === e.target.value)
                let amount = client?.hourly_rate ? String(client.hourly_rate) : ''

                // Try to find today's visit and calculate hours x rate
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
                  amount,
                }))
              }}
              className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            >
              <option value="">No specific client</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {/* Payment method */}
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

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">Date received</label>
            <input
              type="date"
              value={form.received_date}
              onChange={set('received_date')}
              className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
          </div>

          {/* Description */}
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

          <button
            type="button"
            onClick={onClose}
            className="w-full bg-gray-100 text-gray-600 dark:text-gray-300 font-semibold py-3.5 rounded-xl text-sm active:bg-gray-200 transition-colors"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 text-white font-semibold py-3.5 rounded-xl text-sm active:bg-green-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
          >
            <Check size={16} />
{loading ? 'Saving...' : income ? 'Save changes' : 'Log payment'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function Income() {
  const [income, setIncome] = useState([])
  const [clients, setClients] = useState([])
  const [clientMap, setClientMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [deleteId, setDeleteId] = useState(null)
  const [editIncome, setEditIncome] = useState(null)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    const [{ data: incomeData }, { data: clientData }] = await Promise.all([
      supabase.from('income').select('*').order('received_date', { ascending: false }),
      supabase.from('clients').select('id, name, colour, hourly_rate, payment_method').eq('is_active', true).order('name'),
    ])
    setIncome(incomeData || [])
    setClients(clientData || [])
    const map = {}
    ;(clientData || []).forEach(c => { map[c.id] = c })
    setClientMap(map)
    setLoading(false)
  }

  async function handleDelete(id) {
    await supabase.from('income').delete().eq('id', id)
    setIncome(prev => prev.filter(i => i.id !== id))
    setDeleteId(null)
  }

  const thisMonth = new Date()
  const monthTotal = income
    .filter(i => {
      const d = new Date(i.received_date)
      return d.getMonth() === thisMonth.getMonth() && d.getFullYear() === thisMonth.getFullYear()
    })
    .reduce((sum, i) => sum + parseFloat(i.amount), 0)

  const groups = groupByMonth(income)

  return (
    <div className="p-4">
      {/* Header */}
      <div className="pt-2 flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Income</h1>
          <p className="text-gray-500 dark:text-gray-400 dark:text-gray-500 text-sm mt-0.5">Payments received</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 bg-green-600 text-white font-semibold px-4 py-2.5 rounded-xl text-sm active:bg-green-700 transition-colors"
        >
          <Plus size={16} />
          Log payment
        </button>
      </div>

      {/* This month summary */}
      <div className="bg-green-600 rounded-2xl p-4 mb-5 text-white">
        <p className="text-green-100 text-xs font-medium mb-1">
          {thisMonth.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
        </p>
        <p className="text-3xl font-bold">£{monthTotal.toFixed(2)}</p>
        <p className="text-green-100 text-xs mt-1">total income this month</p>
      </div>

      {/* Empty state */}
      {!loading && income.length === 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col items-center text-center gap-3">
          <div className="text-4xl">💷</div>
          <p className="font-semibold text-gray-700 dark:text-gray-200">No payments logged yet</p>
          <p className="text-gray-400 dark:text-gray-500 text-sm">Tap "Log payment" to record your first payment</p>
        </div>
      )}

      {/* Income groups */}
      {groups.map(group => (
        <div key={group.label} className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-gray-500 dark:text-gray-400 dark:text-gray-500">{group.label}</p>
            <p className="text-sm font-bold text-gray-700 dark:text-gray-200">£{group.total.toFixed(2)}</p>
          </div>
          <div className="space-y-2">
            {group.items.map(item => {
              const client = clientMap[item.client_id]
              return (
                <div key={item.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-3.5 flex items-center gap-3">
                  {/* Client avatar or money icon */}
                  {client ? (
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                      style={{ backgroundColor: client.colour || '#16a34a' }}
                    >
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
                        {new Date(item.received_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${paymentColour[item.payment_method]}`}>
                        {paymentLabel[item.payment_method]}
                      </span>
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0 mr-1">
                    <p className="font-bold text-green-600">£{parseFloat(item.amount).toFixed(2)}</p>
                  </div>
                  <div className="flex flex-row gap-1 flex-shrink-0">
                    <button onClick={() => setEditIncome(item)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-blue-50 text-blue-400 active:bg-blue-100">
                      <Pencil size={20} />
                    </button>
                    <button onClick={() => setDeleteId(item.id)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-red-50 text-red-400 active:bg-red-100">
                      <Trash2 size={20} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {/* Delete confirmation */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 w-full max-w-sm">
            <p className="font-semibold text-gray-900 dark:text-white mb-1">Delete this payment?</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 mb-4">This can't be undone.</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteId(null)} className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-600 dark:text-gray-300">Cancel</button>
              <button onClick={() => handleDelete(deleteId)} className="flex-1 py-3 rounded-xl bg-red-600 text-white text-sm font-medium">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Log payment sheet */}
      {showForm && (
        <LogPaymentSheet
          clients={clients}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); fetchData() }}
        />
      )}
      {editIncome && (
        <LogPaymentSheet
          clients={clients}
          income={editIncome}
          onClose={() => setEditIncome(null)}
          onSaved={() => { setEditIncome(null); fetchData() }}
        />
      )}
    </div>
  )
}
