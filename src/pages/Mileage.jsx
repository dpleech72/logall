import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Plus, Car, X, Check, AlertCircle, Trash2 } from 'lucide-react'

const RATE = 0.55
const THRESHOLD = 10000

function groupByMonth(journeys) {
  const groups = {}
  journeys.forEach(item => {
    const date = new Date(item.journey_date)
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    const label = date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
    if (!groups[key]) groups[key] = { label, items: [], miles: 0, claimable: 0 }
    groups[key].items.push(item)
    groups[key].miles += parseFloat(item.miles)
    groups[key].claimable += parseFloat(item.claimable_amount)
  })
  return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0])).map(([, v]) => v)
}

function LogJourneySheet({ clients, onClose, onSaved }) {
  const [form, setForm] = useState({
    client_id: '',
    journey_date: new Date().toISOString().split('T')[0],
    from_location: '',
    to_location: '',
    miles: '',
    notes: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }))

  // Auto-fill to_location from client address
  const handleClientChange = (e) => {
    const client = clients.find(c => c.id === e.target.value)
    setForm(f => ({
      ...f,
      client_id: e.target.value,
      to_location: client?.address
        ? `${client.address}${client.postcode ? ', ' + client.postcode : ''}`
        : f.to_location,
    }))
  }

  const claimable = form.miles ? (parseFloat(form.miles) * RATE).toFixed(2) : '0.00'

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!form.from_location.trim()) { setError('Please enter a starting location.'); return }
    if (!form.to_location.trim()) { setError('Please enter a destination.'); return }
    if (!form.miles || parseFloat(form.miles) <= 0) { setError('Please enter the number of miles.'); return }

    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()

    const { error } = await supabase.from('mileage').insert({
      user_id: user.id,
      client_id: form.client_id || null,
      journey_date: form.journey_date,
      from_location: form.from_location,
      to_location: form.to_location,
      miles: parseFloat(form.miles),
      rate_per_mile: RATE,
      notes: form.notes || null,
    })

    if (error) { setError(error.message); setLoading(false) }
    else { onSaved() }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40">
      <div className="bg-white rounded-t-3xl p-5 pb-24 max-h-[90vh] overflow-y-auto">
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />

        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900">Log a journey</h2>
          <button onClick={onClose} className="p-2 text-gray-400"><X size={20} /></button>
        </div>

        {/* Live claimable preview */}
        <div className="bg-blue-50 rounded-2xl p-4 text-center mb-4">
          <p className="text-xs font-medium text-blue-600 mb-1">You can claim</p>
          <p className="text-3xl font-bold text-blue-700">£{claimable}</p>
          <p className="text-xs text-blue-400 mt-1">{form.miles || 0} miles × 55p/mile</p>
        </div>

        {error && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl p-3 mb-4 text-sm text-red-700">
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />{error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Client */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Client (optional)</label>
            <select
              value={form.client_id}
              onChange={handleClientChange}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="">No specific client</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Date</label>
            <input
              type="date"
              value={form.journey_date}
              onChange={set('journey_date')}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          {/* From */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">From</label>
            <input
              type="text"
              placeholder="e.g. Home, CV11 4AB"
              value={form.from_location}
              onChange={set('from_location')}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          {/* To */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">To</label>
            <input
              type="text"
              placeholder="e.g. Mrs Johnson, 12 Oak Street"
              value={form.to_location}
              onChange={set('to_location')}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          {/* Miles */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Miles</label>
            <div className="relative">
              <input
                type="number"
                step="0.1"
                min="0"
                placeholder="e.g. 3.5"
                value={form.miles}
                onChange={set('miles')}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 pr-16"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">miles</span>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes (optional)</label>
            <input
              type="text"
              placeholder="e.g. Return journey"
              value={form.notes}
              onChange={set('notes')}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 text-white font-semibold py-3.5 rounded-xl text-sm active:bg-green-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
          >
            <Check size={16} />
            {loading ? 'Saving...' : 'Log journey'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function Mileage() {
  const [journeys, setJourneys] = useState([])
  const [clients, setClients] = useState([])
  const [clientMap, setClientMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [deleteId, setDeleteId] = useState(null)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    const [{ data: mileageData }, { data: clientData }] = await Promise.all([
      supabase.from('mileage').select('*').order('journey_date', { ascending: false }),
      supabase.from('clients').select('id, name, colour, address, postcode').eq('is_active', true).order('name'),
    ])
    setJourneys(mileageData || [])
    setClients(clientData || [])
    const map = {}
    ;(clientData || []).forEach(c => { map[c.id] = c })
    setClientMap(map)
    setLoading(false)
  }

  async function handleDelete(id) {
    await supabase.from('mileage').delete().eq('id', id)
    setJourneys(prev => prev.filter(j => j.id !== id))
    setDeleteId(null)
  }

  // Tax year totals (April to April)
  const now = new Date()
  const taxYearStart = new Date(now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1, 3, 6)
  const taxYearMiles = journeys
    .filter(j => new Date(j.journey_date) >= taxYearStart)
    .reduce((sum, j) => sum + parseFloat(j.miles), 0)
  const taxYearClaimable = journeys
    .filter(j => new Date(j.journey_date) >= taxYearStart)
    .reduce((sum, j) => sum + parseFloat(j.claimable_amount), 0)
  const progressPct = Math.min((taxYearMiles / THRESHOLD) * 100, 100)

  const groups = groupByMonth(journeys)

  return (
    <div className="p-4">
      {/* Header */}
      <div className="pt-2 flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mileage</h1>
          <p className="text-gray-500 text-sm mt-0.5">55p/mile — HMRC approved</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 bg-green-600 text-white font-semibold px-4 py-2.5 rounded-xl text-sm active:bg-green-700 transition-colors"
        >
          <Plus size={16} />
          Log journey
        </button>
      </div>

      {/* Tax year summary card */}
      <div className="bg-blue-600 rounded-2xl p-4 mb-4 text-white">
        <p className="text-blue-100 text-xs font-medium mb-1">This tax year</p>
        <div className="flex items-end justify-between mb-3">
          <div>
            <p className="text-3xl font-bold">£{taxYearClaimable.toFixed(2)}</p>
            <p className="text-blue-100 text-xs mt-0.5">claimable so far</p>
          </div>
          <div className="text-right">
            <p className="text-xl font-bold">{taxYearMiles.toFixed(1)}</p>
            <p className="text-blue-100 text-xs">miles</p>
          </div>
        </div>

        {/* 10,000 mile progress bar */}
        <div>
          <div className="flex justify-between text-xs text-blue-100 mb-1">
            <span>{taxYearMiles.toFixed(0)} of 10,000 miles</span>
            <span>{progressPct.toFixed(0)}%</span>
          </div>
          <div className="h-2 bg-blue-400/40 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <p className="text-blue-100 text-xs mt-1">
            {taxYearMiles >= THRESHOLD
              ? 'Over 10,000 miles — rate drops to 25p/mile'
              : `${(THRESHOLD - taxYearMiles).toFixed(0)} miles until rate drops to 25p/mile`}
          </p>
        </div>
      </div>

      {/* EV warning */}
      <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 mb-4 text-xs text-amber-700">
        ⚡ Electric vehicle? You still claim 55p/mile — but you cannot also claim charging costs. One or the other.
      </div>

      {/* Empty state */}
      {!loading && journeys.length === 0 && (
        <div className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm flex flex-col items-center text-center gap-3">
          <div className="text-4xl">🚗</div>
          <p className="font-semibold text-gray-700">No journeys logged yet</p>
          <p className="text-gray-400 text-sm">Every mile you drive for work saves you tax</p>
        </div>
      )}

      {/* Journey groups */}
      {groups.map(group => (
        <div key={group.label} className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-gray-500">{group.label}</p>
            <div className="text-right">
              <p className="text-sm font-bold text-gray-700">£{group.claimable.toFixed(2)}</p>
              <p className="text-xs text-gray-400">{group.miles.toFixed(1)} miles</p>
            </div>
          </div>
          <div className="space-y-2">
            {group.items.map(journey => {
              const client = clientMap[journey.client_id]
              return (
                <div key={journey.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-3.5 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                    <Car size={16} className="text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm truncate">
                      {journey.from_location} → {journey.to_location}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-gray-400">
                        {new Date(journey.journey_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </span>
                      <span className="text-xs text-gray-400">{parseFloat(journey.miles).toFixed(1)} miles</span>
                      {client && (
                        <span className="text-xs text-gray-400">{client.name}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-blue-600">£{parseFloat(journey.claimable_amount).toFixed(2)}</p>
                    <button onClick={() => setDeleteId(journey.id)} className="text-gray-300 active:text-red-400 mt-1">
                      <Trash2 size={13} />
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
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm">
            <p className="font-semibold text-gray-900 mb-1">Delete this journey?</p>
            <p className="text-sm text-gray-500 mb-4">This can't be undone.</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteId(null)} className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-600">Cancel</button>
              <button onClick={() => handleDelete(deleteId)} className="flex-1 py-3 rounded-xl bg-red-600 text-white text-sm font-medium">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Log journey sheet */}
      {showForm && (
        <LogJourneySheet
          clients={clients}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); fetchData() }}
        />
      )}
    </div>
  )
}
