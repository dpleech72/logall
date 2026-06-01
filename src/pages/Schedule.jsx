import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Users, ChevronLeft, ChevronRight, Check, Clock, X, Pencil, PoundSterling } from 'lucide-react'

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
  return date.toISOString().split('T')[0]
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
      supabase.from('clients').select('id, name, colour, payment_method'),
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
          <button
            onClick={() => navigate('/clients')}
            className="flex items-center gap-1.5 bg-green-600 text-white font-semibold px-4 py-2.5 rounded-xl text-sm active:bg-green-700 transition-colors shadow-sm"
          >
            <Users size={15} />
            Clients
          </button>
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
            <button className="mt-3 text-green-600 font-semibold text-sm">
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
                {/* Client colour bar */}
                <div
                  className="w-1 self-stretch rounded-full flex-shrink-0"
                  style={{ backgroundColor: client?.colour || '#16a34a' }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-gray-900">{client?.name || 'Unknown client'}</p>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${s.bg} ${s.text}`}>
                      {s.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    {visit.scheduled_time && (
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <Clock size={11} />
                        {visit.scheduled_time.slice(0, 5)}
                      </span>
                    )}
                    {visit.amount && (
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <PoundSterling size={11} />
                        {parseFloat(visit.amount).toFixed(2)}
                      </span>
                    )}
                    {visit.duration_minutes && (
                      <span className="text-xs text-gray-400">{visit.duration_minutes} mins</span>
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
                        className="flex items-center justify-center gap-1.5 bg-white border border-gray-200 text-gray-500 font-semibold py-2.5 rounded-xl text-xs active:bg-gray-50 transition-colors"
                      >
                        <X size={14} />
                        Cancel
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
                    <button className="flex items-center justify-center gap-1.5 bg-white border border-gray-200 text-gray-500 font-semibold py-2.5 rounded-xl text-xs col-span-2 active:bg-gray-50 transition-colors">
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
