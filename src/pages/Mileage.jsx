import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Plus, Car, X, Check, AlertCircle, Trash2, Navigation, Loader, ArrowLeftRight, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, ArrowLeft } from 'lucide-react'
import { mileageClaim, MILEAGE_RATE_HIGH as RATE, MILEAGE_THRESHOLD as THRESHOLD } from '../lib/mileage'

const ORS_KEY = import.meta.env.VITE_ORS_API_KEY
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']

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

function LogJourneySheet({ clients, journey, homeAddress, prefillClientId, initialForm, onClose, onSaved, onDelete }) {
  const todayStr = (() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}` })()
  const [form, setForm] = useState({
    client_id:    initialForm?.client_id    ?? journey?.client_id    ?? prefillClientId ?? '',
    journey_date: initialForm?.journey_date ?? journey?.journey_date ?? todayStr,
    from_location: initialForm?.from_location ?? journey?.from_location ?? '',
    to_locations: initialForm?.to_locations ?? (journey?.to_location ? journey.to_location.split(' → ').filter(Boolean) : ['']),
    miles: initialForm?.miles ?? (journey?.miles ? String(journey.miles) : ''),
    notes: initialForm?.notes ?? journey?.notes ?? '',
  })
  const [coordsCache, setCoordsCache] = useState({})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [calculating, setCalculating] = useState(false)

  const updateStop = (i, val) => setForm(f => {
    const locs = [...f.to_locations]; locs[i] = val; return { ...f, to_locations: locs }
  })
  const removeStop = (i) => setForm(f => ({
    ...f, to_locations: f.to_locations.filter((_, idx) => idx !== i)
  }))
  const addStop = () => setForm(f => ({ ...f, to_locations: [...f.to_locations, ''] }))
  const moveStop = (i, dir) => setForm(f => {
    const locs = [...f.to_locations]
    const j = i + dir
    if (j < 0 || j >= locs.length) return f
    ;[locs[i], locs[j]] = [locs[j], locs[i]]
    return { ...f, to_locations: locs }
  })

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
      <div className="bg-white dark:bg-gray-800 rounded-t-3xl p-5 pb-24 max-h-[90vh] overflow-y-auto">
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />

        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">{journey ? 'Edit journey' : 'Log a journey'}</h2>
          <button onClick={onClose} className="p-2 text-gray-400 dark:text-gray-500"><X size={20} /></button>
        </div>

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
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">Client (optional)</label>
            <select
              value={form.client_id}
              onChange={handleClientChange}
              className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            >
              <option value="">No specific client</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">Date</label>
            <input
              type="date"
              value={form.journey_date}
              onChange={set('journey_date')}
              className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">From</label>
            <input
              type="text"
              placeholder="e.g. Home, or leave blank for current location"
              value={form.from_location}
              onChange={set('from_location')}
              className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 mb-2"
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
                value={(() => {
                  const match = clients.find(c => (c.postcode || c.address) === form.from_location)
                  return match ? (match.postcode || match.address) : ''
                })()}
                onChange={e => {
                  if (e.target.value) setForm(f => ({ ...f, from_location: e.target.value }))
                }}
                className="flex-1 px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-600 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-700"
              >
                <option value="">Select a client…</option>
                {clients.filter(c => c.address || c.postcode).map(c => (
                  <option key={c.id} value={c.postcode || c.address}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-center -my-1">
            <button
              type="button"
              onClick={() => setForm(f => {
                const firstTo = f.to_locations[0] || ''
                return { ...f, from_location: firstTo, to_locations: [f.from_location, ...f.to_locations.slice(1)] }
              })}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-gray-100 text-gray-500 dark:text-gray-400 text-xs font-medium active:bg-gray-200 transition-colors"
            >
              <ArrowLeftRight size={13} />
              Swap
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">To</label>
            <div className="mb-2">
              {form.to_locations.map((loc, i) => (
                <div key={i} className={`space-y-1.5 ${i > 0 ? 'border-t border-gray-100 dark:border-gray-700 pt-3 mt-3' : ''}`}>
                  <div className="flex gap-2 items-center">
                    {form.to_locations.length > 1 && (
                      <span className="text-xs text-gray-400 dark:text-gray-500 w-4 flex-shrink-0 text-center">{i + 1}</span>
                    )}
                    <input
                      type="text"
                      placeholder="e.g. postcode or address"
                      value={loc}
                      onChange={e => updateStop(i, e.target.value)}
                      className="flex-1 px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    />
                    {form.to_locations.length > 1 && (
                      <div className="flex flex-col gap-0.5 flex-shrink-0">
                        <button type="button" onClick={() => moveStop(i, -1)} disabled={i === 0}
                          className="p-1 text-gray-400 active:text-gray-600 disabled:opacity-20">
                          <ChevronUp size={14} />
                        </button>
                        <button type="button" onClick={() => moveStop(i, 1)} disabled={i === form.to_locations.length - 1}
                          className="p-1 text-gray-400 active:text-gray-600 disabled:opacity-20">
                          <ChevronDown size={14} />
                        </button>
                      </div>
                    )}
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
                  {/* Per-stop quick-fill row */}
                  <div className={`flex items-center gap-2 ${form.to_locations.length > 1 ? 'ml-6' : ''}`}>
                    <button
                      type="button"
                      onClick={() => updateStop(i, homeAddress || 'Home')}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border-2 border-green-200 bg-green-50 text-green-700 active:bg-green-100 transition-colors flex-shrink-0"
                    >
                      🏠 Home
                    </button>
                    <select
                      value={(() => {
                        const match = clients.find(c => (c.postcode || c.address) === loc)
                        return match ? (match.postcode || match.address) : ''
                      })()}
                      onChange={e => {
                        if (!e.target.value) return
                        const client = clients.find(c => (c.postcode || c.address) === e.target.value)
                        updateStop(i, e.target.value)
                        if (client) setForm(f => ({ ...f, client_id: f.client_id || client.id }))
                      }}
                      className="flex-1 px-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg text-xs text-gray-600 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-700"
                    >
                      <option value="">Select a client…</option>
                      {clients.filter(c => c.address || c.postcode).map(c => (
                        <option key={c.id} value={c.postcode || c.address}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={addStop}
              className="text-xs font-medium text-blue-600 active:opacity-70"
            >
              + Add another stop
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">
              Miles
              {form.to_locations.length > 1 && (
                <span className="ml-2 text-xs font-normal text-gray-400 dark:text-gray-500">total for all stops</span>
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
                className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 pr-16"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 text-sm">miles</span>
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
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5 text-center">
              {form.to_locations.length > 1
                ? 'Adds up each leg of the journey'
                : 'Uses your current location if "From" is empty'}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">Notes (optional)</label>
            <input
              type="text"
              placeholder="e.g. Return journey"
              value={form.notes}
              onChange={set('notes')}
              className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
          </div>

          <button type="button" onClick={onClose} className="w-full bg-gray-100 text-gray-600 dark:text-gray-300 font-semibold py-3.5 rounded-xl text-sm active:bg-gray-200 transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={loading} className="w-full bg-green-600 text-white font-semibold py-3.5 rounded-xl text-sm active:bg-green-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2">
            <Check size={16} />
            {loading ? 'Saving...' : journey ? 'Save changes' : 'Log journey'}
          </button>

          {journey && onDelete && (
            <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
              <button type="button" onClick={() => onDelete(journey.id)}
                className="flex items-center gap-2 text-red-500 text-sm font-medium mx-auto">
                <Trash2 size={15} />
                Delete this journey
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  )
}

export default function Mileage() {
  const [searchParams] = useSearchParams()
  const prefillClientId = searchParams.get('client_id') || ''
  const now = new Date()
  const [selectedYear, setSelectedYear] = useState(now.getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(null)
  const [monthSummaries, setMonthSummaries] = useState([])
  const [journeys, setJourneys] = useState([])
  const [clients, setClients] = useState([])
  const [clientMap, setClientMap] = useState({})
  const [homeAddress, setHomeAddress] = useState('')
  const [loading, setLoading] = useState(true)
  const [recent7, setRecent7] = useState([])
  const [taxYearMiles, setTaxYearMiles] = useState(0)
  const [taxYearClaimable, setTaxYearClaimable] = useState(0)
  const [showForm, setShowForm] = useState(!!prefillClientId)
  const [deleteId, setDeleteId] = useState(null)
  const [editJourney, setEditJourney] = useState(null)
  const [todayForm, setTodayForm] = useState(null)
  const [todayLoading, setTodayLoading] = useState(false)

  useEffect(() => { fetchClients() }, [])
  useEffect(() => { fetchTaxYearTotals() }, [])
  useEffect(() => { fetchYearSummary() }, [selectedYear])
  useEffect(() => { if (selectedMonth !== null) fetchMonthJourneys() }, [selectedMonth, selectedYear])

  async function fetchTaxYearTotals() {
    const taxYearStartYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1
    const taxYearStartDate = `${taxYearStartYear}-04-06`
    const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`
    const { data } = await supabase.from('mileage').select('miles, claimable_amount')
      .gte('journey_date', taxYearStartDate)
      .lte('journey_date', todayStr)
    const ytdMiles = (data || []).reduce((s, j) => s + parseFloat(j.miles), 0)
    setTaxYearMiles(ytdMiles)
    setTaxYearClaimable(mileageClaim(ytdMiles))
  }

  async function fetchClients() {
    const [{ data: clientData }, { data: profileData }] = await Promise.all([
      supabase.from('clients').select('id, name, colour, address, postcode').eq('is_active', true).order('name'),
      supabase.from('profiles').select('address, postcode').single(),
    ])
    setClients(clientData || [])
    const map = {}
    ;(clientData || []).forEach(c => { map[c.id] = c })
    setClientMap(map)
    if (profileData) {
      const parts = [profileData.address, profileData.postcode].filter(Boolean)
      setHomeAddress(profileData.postcode || parts.join(', '))
    }
  }

  async function fetchYearSummary() {
    setLoading(true)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)
    const sevenDaysAgoStr = `${sevenDaysAgo.getFullYear()}-${String(sevenDaysAgo.getMonth()+1).padStart(2,'0')}-${String(sevenDaysAgo.getDate()).padStart(2,'0')}`
    const todayStr = (() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}` })()

    const [{ data }, { data: recent }] = await Promise.all([
      supabase.from('mileage').select('journey_date, miles, claimable_amount')
        .gte('journey_date', `${selectedYear}-01-01`)
        .lte('journey_date', `${selectedYear}-12-31`),
      supabase.from('mileage').select('*')
        .gte('journey_date', sevenDaysAgoStr)
        .lte('journey_date', todayStr)
        .order('journey_date', { ascending: false }),
    ])
    setRecent7(recent || [])

    const summaries = Array.from({ length: 12 }, (_, i) => ({ month: i, miles: 0, claimable: 0 }))
    ;(data || []).forEach(j => {
      const month = parseInt(j.journey_date.split('-')[1]) - 1
      summaries[month].miles += parseFloat(j.miles)
      summaries[month].claimable += parseFloat(j.claimable_amount)
    })
    setMonthSummaries(summaries)
    setLoading(false)
  }

  async function fetchMonthJourneys() {
    setLoading(true)
    const monthStr = String(selectedMonth + 1).padStart(2, '0')
    const lastDay = new Date(selectedYear, selectedMonth + 1, 0).getDate()
    const { data } = await supabase
      .from('mileage')
      .select('*')
      .gte('journey_date', `${selectedYear}-${monthStr}-01`)
      .lte('journey_date', `${selectedYear}-${monthStr}-${String(lastDay).padStart(2,'0')}`)
      .order('journey_date', { ascending: false })
    setJourneys(data || [])
    setLoading(false)
  }

  async function buildTodaysMileage() {
    setTodayLoading(true)
    const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`
    const { data: todayVisits } = await supabase
      .from('visits')
      .select('client_id, scheduled_time')
      .eq('scheduled_date', todayStr)
      .neq('status', 'cancelled')
      .order('scheduled_time')

    const stops = (todayVisits || [])
      .map(v => clients.find(c => c.id === v.client_id))
      .filter(Boolean)
      .map(c => c.postcode || c.address || '')
      .filter(Boolean)

    if (homeAddress) stops.push(homeAddress)

    setTodayForm({
      client_id: '',
      journey_date: todayStr,
      from_location: homeAddress || '',
      to_locations: stops.length > 0 ? stops : [''],
      miles: '',
      notes: '',
    })
    setTodayLoading(false)
  }

  async function handleDelete(id) {
    await supabase.from('mileage').delete().eq('id', id)
    setJourneys(prev => prev.filter(j => j.id !== id))
    setRecent7(prev => prev.filter(j => j.id !== id))
    fetchYearSummary()
    fetchTaxYearTotals()
    setDeleteId(null)
  }

  // Month detail view
  if (selectedMonth !== null) {
    return (
      <div className="p-4">
        <div className="pt-2 flex items-center gap-3 mb-4">
          <button onClick={() => setSelectedMonth(null)} className="p-2 -ml-2 text-gray-400">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">{MONTH_NAMES[selectedMonth]} {selectedYear}</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm">{journeys.length} journey{journeys.length !== 1 ? 's' : ''}</p>
          </div>
          <button onClick={() => setShowForm(true)}
            className="ml-auto flex items-center gap-1.5 bg-green-600 text-white font-semibold px-4 py-2.5 rounded-xl text-sm active:bg-green-700">
            <Plus size={16} />
            Log
          </button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[1,2,3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
          </div>
        ) : journeys.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 border border-gray-100 dark:border-gray-700 text-center">
            <p className="text-gray-400 dark:text-gray-500 text-sm">No journeys in {MONTH_NAMES[selectedMonth]}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {journeys.map(journey => {
              const client = clientMap[journey.client_id]
              return (
                <button key={journey.id} onClick={() => setEditJourney(journey)}
                  className="w-full bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-3.5 flex items-center gap-3 text-left active:bg-gray-50 transition-colors">
                  <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                    <Car size={16} className="text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-white text-sm truncate">
                      {journey.from_location} → {journey.to_location}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        {new Date(journey.journey_date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </span>
                      <span className="text-xs text-gray-400 dark:text-gray-500">{parseFloat(journey.miles).toFixed(1)} miles</span>
                      {client && <span className="text-xs text-gray-400 dark:text-gray-500">{client.name}</span>}
                    </div>
                  </div>
                  <p className="font-bold text-blue-600 flex-shrink-0">£{parseFloat(journey.claimable_amount).toFixed(2)}</p>
                </button>
              )
            })}
          </div>
        )}

        {deleteId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6">
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 w-full max-w-sm">
              <p className="font-semibold text-gray-900 dark:text-white mb-1">Delete this journey?</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">This can't be undone.</p>
              <div className="flex gap-2">
                <button onClick={() => setDeleteId(null)} className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-600 dark:text-gray-300">Cancel</button>
                <button onClick={() => handleDelete(deleteId)} className="flex-1 py-3 rounded-xl bg-red-600 text-white text-sm font-medium">Delete</button>
              </div>
            </div>
          </div>
        )}

        {(showForm || editJourney) && (
          <LogJourneySheet
            clients={clients}
            journey={editJourney}
            homeAddress={homeAddress}
            prefillClientId={prefillClientId}
            onClose={() => { setShowForm(false); setEditJourney(null) }}
            onSaved={() => { setShowForm(false); setEditJourney(null); fetchMonthJourneys(); fetchYearSummary(); fetchTaxYearTotals() }}
            onDelete={(id) => { setEditJourney(null); setDeleteId(id) }}
          />
        )}
      </div>
    )
  }

  // Year overview
  return (
    <div className="p-4 md:max-w-3xl md:mx-auto lg:max-w-4xl lg:p-8">
      <div className="pt-2 flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Mileage</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">55p/mile — HMRC approved</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={buildTodaysMileage}
            disabled={todayLoading}
            className="flex items-center gap-1.5 bg-blue-50 border border-blue-200 text-blue-600 font-semibold px-3 py-2 rounded-xl text-xs active:bg-blue-100 disabled:opacity-60 transition-colors"
          >
            {todayLoading ? <Loader size={13} className="animate-spin" /> : <Car size={13} />}
            Today's jobs
          </button>
          <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 bg-green-600 text-white font-semibold px-3 py-2 rounded-xl text-xs active:bg-green-700 transition-colors">
            <Plus size={14} />
            Log journey
          </button>
        </div>
      </div>

      {(() => {
        const tyStartYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1
        const tyLabel = `${tyStartYear}/${String(tyStartYear + 1).slice(2)}`
        const tyProgress = Math.min((taxYearMiles / THRESHOLD) * 100, 100)
        return (
          <div className="bg-blue-600 rounded-2xl p-4 mb-4 text-white">
            <p className="text-blue-100 text-xs font-medium mb-1">Tax year {tyLabel}</p>
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
                <span>{tyProgress.toFixed(0)}%</span>
              </div>
              <div className="h-2 bg-blue-400/40 rounded-full overflow-hidden">
                <div className="h-full bg-white rounded-full transition-all" style={{ width: `${tyProgress}%` }} />
              </div>
              <p className="text-blue-100 text-xs mt-1">
                {taxYearMiles >= THRESHOLD ? 'Over 10,000 miles — rate drops to 25p/mile' : `${(THRESHOLD - taxYearMiles).toFixed(0)} miles until rate drops to 25p/mile`}
              </p>
            </div>
          </div>
        )
      })()}

      <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 mb-4 text-xs text-amber-700">
        ⚡ Electric vehicle? You still claim 55p/mile — but you cannot also claim charging costs. One or the other.
      </div>

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
            const hasMileage = summary.miles > 0
            const isFuture = selectedYear > now.getFullYear() || (selectedYear === now.getFullYear() && i > now.getMonth())
            return (
              <button
                key={i}
                onClick={() => !isFuture && setSelectedMonth(i)}
                disabled={isFuture}
                className={`rounded-xl p-2 text-left transition-colors border-2 ${
                  isCurrentMonth ? 'border-green-500 bg-green-50'
                  : hasMileage ? 'border-blue-200 bg-blue-50 active:bg-blue-100'
                  : isFuture ? 'border-gray-100 bg-gray-50 opacity-40'
                  : 'border-gray-200 bg-white dark:bg-gray-800 dark:border-gray-700 active:bg-gray-50'
                }`}
              >
                <p className={`text-xs font-bold mb-1 ${isCurrentMonth ? 'text-green-700' : hasMileage ? 'text-blue-700' : 'text-gray-400'}`}>
                  {MONTH_NAMES[i].slice(0, 3)}
                </p>
                {hasMileage ? (
                  <>
                    <p className={`text-sm font-bold ${isCurrentMonth ? 'text-green-700' : 'text-blue-700'}`}>
                      £{summary.claimable.toFixed(2)}
                    </p>
                    <p className={`text-xs mt-0.5 ${isCurrentMonth ? 'text-green-600' : 'text-blue-500'}`}>
                      {summary.miles.toFixed(1)} mi
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-bold text-transparent">£0</p>
                    <p className="text-xs mt-0.5 text-transparent">-</p>
                  </>
                )}
              </button>
            )
          })}
        </div>
      )}

      {recent7.length > 0 && (
        <div className="mt-5">
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Last 7 days</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {recent7.map(journey => {
              const client = clientMap[journey.client_id]
              return (
                <button key={journey.id} onClick={() => setEditJourney(journey)}
                  className="w-full bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-3.5 flex items-center gap-3 text-left active:bg-gray-50 transition-colors">
                  <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                    <Car size={16} className="text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-white text-sm truncate">
                      {journey.from_location} → {journey.to_location}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        {new Date(journey.journey_date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                      </span>
                      <span className="text-xs text-gray-400 dark:text-gray-500">{parseFloat(journey.miles).toFixed(1)} miles</span>
                      {client && <span className="text-xs text-gray-400 dark:text-gray-500">{client.name}</span>}
                    </div>
                  </div>
                  <p className="font-bold text-blue-600 flex-shrink-0">£{parseFloat(journey.claimable_amount).toFixed(2)}</p>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 pb-24">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 w-full max-w-sm">
            <p className="font-semibold text-gray-900 dark:text-white mb-1">Delete this journey?</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">This can't be undone.</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteId(null)} className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-600 dark:text-gray-300">Cancel</button>
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
          onSaved={() => { setShowForm(false); fetchYearSummary(); fetchTaxYearTotals() }}
          onDelete={(id) => { setShowForm(false); setDeleteId(id) }}
        />
      )}
      {todayForm && (
        <LogJourneySheet
          clients={clients}
          homeAddress={homeAddress}
          initialForm={todayForm}
          onClose={() => setTodayForm(null)}
          onSaved={() => { setTodayForm(null); fetchYearSummary(); fetchTaxYearTotals() }}
          onDelete={(id) => { setTodayForm(null); setDeleteId(id) }}
        />
      )}
      {editJourney && (
        <LogJourneySheet
          clients={clients}
          homeAddress={homeAddress}
          journey={editJourney}
          onClose={() => setEditJourney(null)}
          onSaved={() => { setEditJourney(null); fetchYearSummary(); fetchTaxYearTotals() }}
          onDelete={(id) => { setEditJourney(null); setDeleteId(id) }}
        />
      )}
    </div>
  )
}
