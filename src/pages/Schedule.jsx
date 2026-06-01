import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Users, ChevronLeft, ChevronRight, Check, Clock, X, Pencil, PoundSterling, Plus, MapPin } from 'lucide-react'

// --- Date helpers ---
function getMonday(date) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function addDays(date, n) {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
}

function formatDate(date) {
  // Use local date to avoid UTC offset shifting the day
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']

// --- Status config ---
const STATUS = {
  scheduled:        { label: 'Scheduled',        bg: 'bg-blue-50',   border: 'border-blue-200',   dot: 'bg-blue-400',   text: 'text-blue-700' },
  done_paid:        { label: 'Done & paid',       bg: 'bg-green-50',  border: 'border-green-200',  dot: 'bg-green-500',  text: 'text-green-700' },
  awaiting_payment: { label: 'Awaiting payment',  bg: 'bg-amber-50',  border: 'border-amber-200',  dot: 'bg-amber-400',  text: 'text-amber-700' },
  cancelled:        { label: 'Cancelled',         bg: 'bg-gray-50',   border: 'border-gray-200',   dot: 'bg-gray-300',   text: 'text-gray-400' },
}

// --- Undo toast ---
function UndoToast({ message, onUndo, onDismiss }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 5000)
    return () => clearTimeout(t)
  }, [])
  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 bg-gray-900 text-white rounded-xl px-4 py-3 flex items-center justify-between shadow-lg">
      <span className="text-sm">{message}</span>
      <button onClick={onUndo} className="text-green-400 font-semibold text-sm ml-4">Undo</button>
    </div>
  )
}

export default function Schedule() {
  const navigate = useNavigate()
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [weekStart, setWeekStart] = useState(getMonday(today))
  const [selectedDay, setSelectedDay] = useState(today)
  const [visits, setVisits] = useState([])
  const [clients, setClients] = useState({})
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState(null)
  const [toast, setToast] = useState(null)

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  useEffect(() => {
    fetchData()
  }, [weekStart])

  async function fetchData() {
    setLoading(true)
    const from = formatDate(weekStart)
    const to = formatDate(addDays(weekStart, 6))

    const [{ data: visitData }, { data: clientData }] = await Promise.all([
      supabase.from('visits').select('*').gte('scheduled_date', from).lte('scheduled_date', to).order('scheduled_time'),
      supabase.from('clients').select('id, name, colour, payment_method, address'),
    ])

    setVisits(visitData || [])
    const clientMap = {}
    ;(clientData || []).forEach(c => { clientMap[c.id] = c })
    setClients(clientMap)
    setLoading(false)
  }

  const visitsForDay = (date) =>
    visits.filter(v => v.scheduled_date === formatDate(date))

  const dotsForDay = (date) =>
    visitsForDay(date).map(v => STATUS[v.status]?.dot || 'bg-gray-300')

  async function updateStatus(visitId, newStatus, previousStatus) {
    setVisits(vs => vs.map(v => v.id === visitId ? { ...v, status: newStatus } : v))
    setExpandedId(null)

    await supabase.from('visits').update({ status: newStatus }).eq('id', visitId)

    // If marking as done_paid, log income automatically
    if (newStatus === 'done_paid') {
      const visit = visits.find(v => v.id === visitId)
      if (visit?.amount) {
        await supabase.from('income').insert({
          user_id: visit.user_id,
          client_id: visit.client_id,
          visit_id: visit.id,
          amount: visit.amount,
          payment_method: visit.payment_method || clients[visit.client_id]?.payment_method || 'cash',
          received_date: visit.scheduled_date,
          description: `Visit — ${clients[visit.client_id]?.name || 'Client'}`,
        })
      }
    }

    setToast({
      message: `Marked as ${STATUS[newStatus].label.toLowerCase()}`,
      visitId,
      previousStatus,
    })
  }

  async function undoStatus() {
    if (!toast) return
    setVisits(vs => vs.map(v => v.id === toast.visitId ? { ...v, status: toast.previousStatus } : v))
    await supabase.from('visits').update({ status: toast.previousStatus }).eq('id', toast.visitId)
    // Remove auto-logged income if undoing done_paid
    if (toast.previousStatus !== 'done_paid') {
      await supabase.from('income').delete().eq('visit_id', toast.visitId)
    }
    setToast(null)
  }

  const monthLabel = () => {
    const end = addDays(weekStart, 6)
    if (weekStart.getMonth() === end.getMonth()) {
      return `${MONTH_NAMES[weekStart.getMonth()]} ${weekStart.getFullYear()}`
    }
    return `${MONTH_NAMES[weekStart.getMonth()]} — ${MONTH_NAMES[end.getMonth()]} ${end.getFullYear()}`
  }

  const dayVisits = visitsForDay(selectedDay)

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 pt-6 pb-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Schedule</h1>
            <p className="text-gray-500 text-sm">{monthLabel()}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate(`/schedule/add?date=${formatDate(selectedDay)}`)}
              className="flex items-center gap-1.5 bg-green-600 text-white font-semibold px-4 py-2.5 rounded-xl text-sm active:bg-green-700 transition-colors shadow-sm"
            >
              <Plus size={15} />
              Add job
            </button>
            <button
              onClick={() => navigate('/clients')}
              className="flex items-center gap-1.5 bg-white border border-gray-200 text-gray-700 font-semibold px-4 py-2.5 rounded-xl text-sm active:bg-gray-50 transition-colors"
            >
              <Users size={15} />
              Clients
            </button>
          </div>
        </div>

        {/* Week navigation */}
        <div className="flex items-center gap-2 mb-3">
          <button
            onClick={() => { setWeekStart(addDays(weekStart, -7)); setSelectedDay(addDays(weekStart, -7)) }}
            className="p-1.5 rounded-lg text-gray-400 active:bg-gray-100"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="flex-1 grid grid-cols-7 gap-1">
            {weekDays.map((day, i) => {
              const isSelected = isSameDay(day, selectedDay)
              const isToday = isSameDay(day, today)
              const dots = dotsForDay(day)
              return (
                <button
                  key={i}
                  onClick={() => setSelectedDay(day)}
                  className={`flex flex-col items-center py-2 px-1 rounded-xl transition-colors ${
                    isSelected ? 'bg-green-600' : isToday ? 'bg-green-50' : 'bg-transparent'
                  }`}
                >
                  <span className={`text-xs font-medium mb-1 ${isSelected ? 'text-green-100' : 'text-gray-400'}`}>
                    {DAY_LABELS[i]}
                  </span>
                  <span className={`text-sm font-bold ${
                    isSelected ? 'text-white' : isToday ? 'text-green-600' : 'text-gray-800'
                  }`}>
                    {day.getDate()}
                  </span>
                  {/* Dots */}
                  <div className="flex gap-0.5 mt-1 h-1.5">
                    {dots.slice(0, 3).map((dot, j) => (
                      <div key={j} className={`w-1.5 h-1.5 rounded-full ${dot} ${isSelected ? 'opacity-80' : ''}`} />
                    ))}
                  </div>
                </button>
              )
            })}
          </div>
          <button
            onClick={() => { setWeekStart(addDays(weekStart, 7)); setSelectedDay(addDays(weekStart, 7)) }}
            className="p-1.5 rounded-lg text-gray-400 active:bg-gray-100"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Selected day label */}
        <p className="text-sm font-semibold text-gray-700 mb-3">
          {isSameDay(selectedDay, today) ? 'Today' : selectedDay.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
          <span className="text-gray-400 font-normal ml-2">
            {dayVisits.length === 0 ? 'No jobs' : `${dayVisits.length} job${dayVisits.length > 1 ? 's' : ''}`}
          </span>
        </p>
      </div>

      {/* Job cards */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
        {loading && (
          <div className="space-y-2">
            {[1,2].map(i => <div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse" />)}
          </div>
        )}

        {!loading && dayVisits.length === 0 && (
          <div className="bg-white rounded-2xl p-6 border border-gray-100 text-center mt-2">
            <p className="text-gray-400 text-sm">No jobs scheduled</p>
            <button
              onClick={() => navigate(`/schedule/add?date=${formatDate(selectedDay)}`)}
              className="mt-3 text-green-600 font-semibold text-sm"
            >
              + Add a job
            </button>
          </div>
        )}

        {!loading && dayVisits.map(visit => {
          const client = clients[visit.client_id]
          const s = STATUS[visit.status] || STATUS.scheduled
          const isExpanded = expandedId === visit.id

          return (
            <div key={visit.id} className={`bg-white rounded-2xl border-2 ${s.border} shadow-sm overflow-hidden transition-all`}>
              {/* Card header — always visible */}
              <button
                className="w-full p-4 text-left flex items-center gap-3"
                onClick={() => setExpandedId(isExpanded ? null : visit.id)}
              >
                {/* Initials avatar */}
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                  style={{ backgroundColor: client?.colour || '#16a34a' }}
                >
                  {client?.name ? client.name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase() : '?'}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-gray-900">{client?.name || 'Unknown client'}</p>
                    {visit.amount && (
                      <p className="font-bold text-green-600 text-sm">£{parseFloat(visit.amount).toFixed(2)}</p>
                    )}
                  </div>

                  {/* Time and duration */}
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {visit.scheduled_time && (
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <Clock size={11} />
                        {visit.scheduled_time.slice(0, 5)}
                      </span>
                    )}
                    {visit.duration_minutes && (
                      <span className="text-xs text-gray-400">
                        · {visit.duration_minutes >= 60
                          ? `${Math.floor(visit.duration_minutes/60)}${visit.duration_minutes%60 ? `.${visit.duration_minutes%60}` : ''} hrs`
                          : `${visit.duration_minutes} mins`}
                      </span>
                    )}
                  </div>

                  {/* Address with map button */}
                  {(client?.address || client?.postcode) && (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-gray-400 flex-1">
                        {[client.address, client.postcode].filter(Boolean).join(', ')}
                      </span>
                      <a
                        href={`https://maps.google.com/?q=${encodeURIComponent([client.address, client.postcode].filter(Boolean).join(', '))}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="flex items-center gap-1 text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded-lg active:bg-blue-100 flex-shrink-0"
                      >
                        <MapPin size={11} />
                        Map
                      </a>
                    </div>
                  )}

                  {/* Tags row */}
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${s.bg} ${s.text}`}>
                      {s.label}
                    </span>
                    {visit.recurrence_rule && visit.recurrence_rule !== 'none' && (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 flex items-center gap-1">
                        🔄 {visit.recurrence_rule === 'weekly' ? 'Weekly' : visit.recurrence_rule === 'biweekly' ? 'Bi-weekly' : 'Monthly'}
                      </span>
                    )}
                    {visit.payment_method === 'cash' && (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-50 text-green-600">
                        💵 Cash
                      </span>
                    )}
                    {visit.payment_method === 'bank_transfer' && (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">
                        🏦 Bank transfer
                      </span>
                    )}
                    {visit.notes && (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                        📝 {visit.notes.length > 20 ? visit.notes.slice(0, 20) + '…' : visit.notes}
                      </span>
                    )}
                  </div>
                </div>
              </button>

              {/* Expanded actions */}
              {isExpanded && (
                <div className={`px-4 pb-4 pt-0 border-t ${s.border} ${s.bg}`}>
                  <div className="grid grid-cols-2 gap-2 mt-3">
                    {visit.status !== 'done_paid' && (
                      <button
                        onClick={() => updateStatus(visit.id, 'done_paid', visit.status)}
                        className="flex items-center justify-center gap-1.5 bg-green-600 text-white font-semibold py-2.5 rounded-xl text-xs active:bg-green-700 transition-colors"
                      >
                        <Check size={14} />
                        Done & paid
                      </button>
                    )}
                    {visit.status !== 'awaiting_payment' && (
                      <button
                        onClick={() => updateStatus(visit.id, 'awaiting_payment', visit.status)}
                        className="flex items-center justify-center gap-1.5 bg-amber-500 text-white font-semibold py-2.5 rounded-xl text-xs active:bg-amber-600 transition-colors"
                      >
                        <Clock size={14} />
                        Awaiting payment
                      </button>
                    )}
                    {visit.status !== 'cancelled' && (
                      <button
                        onClick={() => updateStatus(visit.id, 'cancelled', visit.status)}
                        className="flex items-center justify-center gap-1.5 bg-red-50 border border-red-200 text-red-600 font-semibold py-2.5 rounded-xl text-xs active:bg-red-100 transition-colors"
                      >
                        <X size={14} />
                        Cancel job
                      </button>
                    )}
                    {visit.status !== 'scheduled' && (
                      <button
                        onClick={() => updateStatus(visit.id, 'scheduled', visit.status)}
                        className="flex items-center justify-center gap-1.5 bg-white border border-gray-200 text-gray-500 font-semibold py-2.5 rounded-xl text-xs active:bg-gray-50 transition-colors"
                      >
                        <Clock size={14} />
                        Reschedule
                      </button>
                    )}
                    <button onClick={() => navigate(`/schedule/${visit.id}/edit`)} className="flex items-center justify-center gap-1.5 bg-white border border-gray-200 text-gray-500 font-semibold py-2.5 rounded-xl text-xs col-span-2 active:bg-gray-50 transition-colors">
                      <Pencil size={14} />
                      Edit visit
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Undo toast */}
      {toast && (
        <UndoToast
          message={toast.message}
          onUndo={undoStatus}
          onDismiss={() => setToast(null)}
        />
      )}
    </div>
  )
}
