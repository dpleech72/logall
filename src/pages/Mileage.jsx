import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Plus, Car, X, Check, AlertCircle, Trash2, Navigation, Loader, ArrowLeftRight, Pencil } from 'lucide-react'

const RATE = 0.55
const THRESHOLD = 10000
const ORS_KEY = import.meta.env.VITE_ORS_API_KEY

async function getCoords(address) {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address + ', UK')}&format=json&limit=1&countrycodes=gb`,
    { headers: { 'User-Agent': 'LogAll/1.0' } }
  )
  const data = await res.json()
  if (!data?.[0]) throw new Error(`Could not find location: ${address}`)
  return [parseFloat(data[0].lon), parseFloat(data[0].lat)]
}

async function calcDistance(fromCoords, toCoords) {
  const res = await fetch(
    `https://api.openrouteservice.org/v2/directions/driving-car?api_key=${ORS_KEY}&start=${fromCoords[0]},${fromCoords[1]}&end=${toCoords[0]},${toCoords[1]}`
  )
  const data = await res.json()
  const metres = data.features?.[0]?.properties?.segments?.[0]?.distance
  if (!metres) throw new Error('Could not calculate distance')
  return (metres / 1609.344).toFixed(1)
}

async function getCurrentCoords() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) reject(new Error('Geolocation not supported'))
    navigator.geolocation.getCurrentPosition(
      pos => resolve([pos.coords.longitude, pos.coords.latitude]),
      () => reject(new Error('Could not get your location'))
    )
  })
}

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

function LogJourneySheet({ clients, journey, homeAddress, prefillClientId, onClose, onSaved }) {
  const [form, setForm] = useState({
    client_id: journey?.client_id || prefillClientId || '',
    journey_date: journey?.journey_date || (() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}` })(),
    from_location: journey?.from_location || '',
    to_locations: journey?.to_location
      ? journey.to_location.split(' → ').filter(Boolean)
      : [''],
    miles: journey?.miles ? String(journey.miles) : '',
    notes: journey?.notes || '',
  })
  const [coordsCache, setCoordsCache] = useState({})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [calculating, setCalculating] = useState(false)

  // Helpers for managing stops
  const updateStop = (i, val) => setForm(f => {
    const locs = [...f.to_locations]; locs[i] = val; return { ...f, to_locations: locs }
  })
  const removeStop = (i) => setForm(f => ({
    ...f, to_locations: f.to_locations.filter((_, idx) => idx !== i)
  }))
  const addStop = () => setForm(f => ({ ...f, to_locations: [...f.to_locations, ''] }))

  const quickFillStop = (val) => setForm(f => {
    const locs = [...f.to_locations]
    const emptyIdx = locs.findIndex(l => !l.trim())
    if (emptyIdx !== -1) locs[emptyIdx] = val
    else locs[locs.length - 1] = val
    return { ...f, to_locations: locs }
  })

  const handleClientChange = (e) => {
    const client = clients.find(c => c.id === e.target.value)
    const dest = client?.postcode || client?.address || ''
    setForm(f => {
      const locs = [...f.to_locations]
      const emptyIdx = locs.findIndex(l => !l.trim())
      if (emptyIdx !== -1) locs[emptyIdx] = dest
      else locs[locs.length - 1] = dest
      return { ...f, client_id: e.target.value, to_locations: locs }
    })
  }

  async function handleCalculateDistance() {
    const stops = form.to_locations.filter(l => l.trim())
    if (stops.length === 0) { setError('Please enter at least one destination.'); return }
    setError('')
    setCalculating(true)
    try {
      // Resolve FROM
      let fromCoords
      if (!form.from_location.trim()) {
        fromCoords = await getCurrentCoords()
        try {
          const res = await fetch(
            `https://api.openrouteservice.org/geocode/reverse?api_key=${ORS_KEY}&point.lon=${fromCoords[0]}&point.lat=${fromCoords[1]}&size=1`
          )
          const data = await res.json()
          const props = data.features?.[0]?.properties
          if (props) {
            const parts = [
              props.housenumber && props.street ? `${props.housenumber} ${props.street}` : props.street,
              props.locality || props.county,
              props.postalcode,
            ].filter(Boolean)
            const name = parts.join(', ')
            if (name) setForm(f => ({ ...f, from_location: name }))
          }
        } catch (_) {}
      } else if (coordsCache[form.from_location.trim()]) {
        fromCoords = coordsCache[form.from_location.trim()]
      } else {
        fromCoords = await getCoords(form.from_location)
        setCoordsCache(c => ({ ...c, [form.from_location]: fromCoords }))
      }

      // Resolve each stop
      const allCoords = [fromCoords]
      for (const stop of stops) {
        let coords
        if (coordsCache[stop.trim()]) {
          coords = coordsCache[stop.trim()]
        } else {
          coords = await getCoords(stop)
          setCoordsCache(c => ({ ...c, [stop]: coords }))
        }
        allCoords.push(coords)
      }

      // Sum each leg
      let totalMiles = 0
      for (let i = 0; i < allCoords.length - 1; i++) {
        const miles = await calcDistance(allCoords[i], allCoords[i + 1])
        totalMiles += parseFloat(miles)
      }
      setForm(f => ({ ...f, miles: totalMiles.toFixed(1) }))
    } catch (err) {
      setError(err.message)
    }
    setCalculating(false)
  }

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }))

  const claimable = form.miles ? (parseFloat(form.miles) * RATE).toFixed(2) : '0.00'

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!form.from_location.trim()) { setError('Please enter a starting location.'); return }
    if (!form.to_locations.some(l => l.trim())) { setError('Please enter at least one destination.'); return }
    if (!form.miles || parseFloat(form.miles) <= 0) { setError('Please enter the number of miles.'); return }

    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const payload = {
      client_id: form.client_id || null,
      journey_date: form.journey_date,
      from_location: form.from_location,
      to_location: form.to_locations.filter(Boolean).join(' → '),
      miles: parseFloat(form.miles),
      rate_per_mile: RATE,
      notes: form.notes || null,
    }
    const { error } = journey
      ? await supabase.from('mileage').update(payload).eq('id', journey.id)
      : await supabase.from('mileage').insert({ ...payload, user_id: user.id })

    if (error) { setError(error.message); setLoading(false) }
    else { onSaved() }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40">
      <div className="bg-white rounded-t-3xl p-5 pb-24 max-h-[90vh] overflow-y-auto">
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />

        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900">{journey ? 'Edit journey' : 'Log a journey'}</h2>
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
              placeholder="e.g. Home, or leave blank for current location"
              value={form.from_location}
              onChange={set('from_location')}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 mb-2"
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, from_location: homeAddress || 'Home' }))}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border-2 border-green-200 bg-green-50 text-green-700 active:bg-green-100 transition-colors flex-shrink-0"
              >
                🏠 Home
              </button>
              <select
                defaultValue=""
                onChange={e => {
                  if (e.target.value) setForm(f => ({ ...f, from_location: e.target.value }))
                  e.target.value = ''
                }}
                className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-xs text-gray-600 focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
              >
                <option value="">Select a client...</option>
                {clients.filter(c => c.address || c.postcode).map(c => (
                  <option key={c.id} value={c.postcode || c.address}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Swap */}
          <div className="flex justify-center -my-1">
            <button
              type="button"
              onClick={() => setForm(f => {
                const firstTo = f.to_locations[0] || ''
                return { ...f, from_location: firstTo, to_locations: [f.from_location, ...f.to_locations.slice(1)] }
              })}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-gray-100 text-gray-500 text-xs font-medium active:bg-gray-200 transition-colors"
            >
              <ArrowLeftRight size={13} />
              Swap
            </button>
          </div>

          {/* To — multiple stops */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">To</label>
            <div className="space-y-2 mb-2">
              {form.to_locations.map((loc, i) => (
                <div key={i} className="flex gap-2 items-center">
                  {form.to_locations.length > 1 && (
                    <span className="text-xs text-gray-400 w-4 flex-shrink-0 text-center">{i + 1}</span>
                  )}
                  <input
                    type="text"
                    placeholder="e.g. postcode or address"
                    value={loc}
                    onChange={e => updateStop(i, e.target.value)}
                    className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                  {form.to_locations.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeStop(i)}
                      className="p-2 text-red-400 active:text-red-600 flex-shrink-0"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Add another stop */}
            <button
              type="button"
              onClick={addStop}
              className="text-xs font-medium text-blue-600 active:opacity-70 mb-3"
            >
              + Add another stop
            </button>

            {/* Quick fill for To */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => quickFillStop(homeAddress || 'Home')}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border-2 border-green-200 bg-green-50 text-green-700 active:bg-green-100 transition-colors flex-shrink-0"
              >
                🏠 Home
              </button>
              <select
                defaultValue=""
                onChange={e => {
                  if (!e.target.value) return
                  const client = clients.find(c => (c.postcode || c.address) === e.target.value)
                  quickFillStop(e.target.value)
                  if (client) setForm(f => ({ ...f, client_id: f.client_id || client.id }))
                  e.target.value = ''
                }}
                className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-xs text-gray-600 focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
              >
                <option value="">Select a client...</option>
                {clients.filter(c => c.address || c.postcode).map(c => (
                  <option key={c.id} value={c.postcode || c.address}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Miles */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Miles
              {form.to_locations.length > 1 && (
                <span className="ml-2 text-xs font-normal text-gray-400">total for all stops</span>
              )}
            </label>
            <div className="relative mb-2">
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
            <button
              type="button"
              onClick={handleCalculateDistance}
              disabled={calculating}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-blue-200 bg-blue-50 text-blue-600 text-xs font-semibold active:bg-blue-100 disabled:opacity-60 transition-colors"
            >
              {calculating
                ? <><Loader size={14} className="animate-spin" /> Calculating...</>
                : <><Navigation size={14} /> Calculate distance automatically</>}
            </button>
            <p className="text-xs text-gray-400 mt-1.5 text-center">
              {form.to_locations.length > 1
                ? 'Adds up each leg of the journey'
                : 'Uses your current location if "From" is empty'}
            </p>
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

          <button type="button" onClick={onClose} className="w-full bg-gray-100 text-gray-600 font-semibold py-3.5 rounded-xl text-sm active:bg-gray-200 transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={loading} className="w-full bg-green-600 text-white font-semibold py-3.5 rounded-xl text-sm active:bg-green-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2">
            <Check size={16} />
            {loading ? 'Saving...' : journey ? 'Save changes' : 'Log journey'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function Mileage() {
  const [searchParams] = useSearchParams()
  const prefillClientId = searchParams.get('client_id') || ''
  const [journeys, setJourneys] = useState([])
  const [clients, setClients] = useState([])
  const [clientMap, setClientMap] = useState({})
  const [homeAddress, setHomeAddress] = useState('')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(!!prefillClientId)
  const [deleteId, setDeleteId] = useState(null)
  const [editJourney, setEditJourney] = useState(null)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    const [{ data: mileageData }, { data: clientData }, { data: profileData }] = await Promise.all([
      supabase.from('mileage').select('*').order('journey_date', { ascending: false }),
      supabase.from('clients').select('id, name, colour, address, postcode').eq('is_active', true).order('name'),
      supabase.from('profiles').select('address, postcode').single(),
    ])
    if (profileData) {
      const parts = [profileData.address, profileData.postcode].filter(Boolean)
      setHomeAddress(parts.join(', '))
    }
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

  const now = new Date()
  const taxYearStart = new Date(now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1, 3, 6)
  const taxYearMiles = journeys.filter(j => new Date(j.journey_date) >= taxYearStart).reduce((sum, j) => sum + parseFloat(j.miles), 0)
  const taxYearClaimable = journeys.filter(j => new Date(j.journey_date) >= taxYearStart).reduce((sum, j) => sum + parseFloat(j.claimable_amount), 0)
  const progressPct = Math.min((taxYearMiles / THRESHOLD) * 100, 100)
  const groups = groupByMonth(journeys)

  return (
    <div className="p-4">
      <div className="pt-2 flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mileage</h1>
          <p className="text-gray-500 text-sm mt-0.5">55p/mile — HMRC approved</p>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 bg-green-600 text-white font-semibold px-4 py-2.5 rounded-xl text-sm active:bg-green-700 transition-colors">
          <Plus size={16} />
          Log journey
        </button>
      </div>

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
        <div>
          <div className="flex justify-between text-xs text-blue-100 mb-1">
            <span>{taxYearMiles.toFixed(0)} of 10,000 miles</span>
            <span>{progressPct.toFixed(0)}%</span>
          </div>
          <div className="h-2 bg-blue-400/40 rounded-full overflow-hidden">
            <div className="h-full bg-white rounded-full transition-all" style={{ width: `${progressPct}%` }} />
          </div>
          <p className="text-blue-100 text-xs mt-1">
            {taxYearMiles >= THRESHOLD ? 'Over 10,000 miles — rate drops to 25p/mile' : `${(THRESHOLD - taxYearMiles).toFixed(0)} miles until rate drops to 25p/mile`}
          </p>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 mb-4 text-xs text-amber-700">
        ⚡ Electric vehicle? You still claim 55p/mile — but you cannot also claim charging costs. One or the other.
      </div>

      {!loading && journeys.length === 0 && (
        <div className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm flex flex-col items-center text-center gap-3">
          <div className="text-4xl">🚗</div>
          <p className="font-semibold text-gray-700">No journeys logged yet</p>
          <p className="text-gray-400 text-sm">Every mile you drive for work saves you tax</p>
        </div>
      )}

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
                      {client && <span className="text-xs text-gray-400">{client.name}</span>}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 mr-1">
                    <p className="font-bold text-blue-600">£{parseFloat(journey.claimable_amount).toFixed(2)}</p>
                  </div>
                  <div className="flex flex-row gap-1 flex-shrink-0">
                    <button onClick={() => setEditJourney(journey)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-blue-50 text-blue-400 active:bg-blue-100">
                      <Pencil size={20} />
                    </button>
                    <button onClick={() => setDeleteId(journey.id)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-red-50 text-red-400 active:bg-red-100">
                      <Trash2 size={20} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 pb-24">
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

      {showForm && (
        <LogJourneySheet
          clients={clients}
          homeAddress={homeAddress}
          prefillClientId={prefillClientId}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); fetchData() }}
        />
      )}
      {editJourney && (
        <LogJourneySheet
          clients={clients}
          homeAddress={homeAddress}
          journey={editJourney}
          onClose={() => setEditJourney(null)}
          onSaved={() => { setEditJourney(null); fetchData() }}
        />
      )}
    </div>
  )
}
