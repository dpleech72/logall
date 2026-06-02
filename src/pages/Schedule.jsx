import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { BANK_HOLIDAYS } from '../lib/bankHolidays'
import { Users, ChevronLeft, ChevronRight, Check, Clock, X, Pencil, Plus, MapPin, CheckSquare, Square, Trash2 } from 'lucide-react'

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

// Module-level guard — persists across StrictMode's unmount/remount cycle,
// preventing two concurrent calls from both inserting the same recurring visits.
let _generatingRecurring = false

export default function Schedule() {
  const navigate = useNavigate()
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [viewMode, setViewMode] = useState('month')
  const [weekStart, setWeekStart] = useState(getMonday(today))
  const [selectedDay, setSelectedDay] = useState(today)
  const [monthDate, setMonthDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [visits, setVisits] = useState([])
  const [clients, setClients] = useState({})
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState(null)
  const [toast, setToast] = useState(null)
  const [selecting, setSelecting] = useState(false)
  const [selectedVisits, setSelectedVisits] = useState(new Set())
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(null)
  const [userHolidays, setUserHolidays] = useState([])
  const [dailyIncome, setDailyIncome] = useState({})
  const [showIncome, setShowIncome] = useState(() => localStorage.getItem('logall_show_income') === 'true')

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  useEffect(() => {
    fetchData()
  }, [weekStart, monthDate, viewMode])

  useEffect(() => {
    generateRecurringVisits()
    fetchUserHolidays()
  }, [])

  async function fetchData() {
    setLoading(true)
    let from, to
    if (viewMode === 'month') {
      from = formatDate(monthDate)
      const lastDay = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0)
      to = formatDate(lastDay)
    } else {
      from = formatDate(weekStart)
      to = formatDate(addDays(weekStart, 6))
    }

    const [{ data: visitData }, { data: clientData }, { data: incomeData }] = await Promise.all([
      supabase.from('visits').select('*').gte('scheduled_date', from).lte('scheduled_date', to).order('scheduled_time'),
      supabase.from('clients').select('id, name, colour, payment_method, address'),
      viewMode === 'month'
        ? supabase.from('income').select('received_date, amount').gte('received_date', from).lte('received_date', to)
        : Promise.resolve({ data: [] }),
    ])

    setVisits(visitData || [])
    const clientMap = {}
    ;(clientData || []).forEach(c => { clientMap[c.id] = c })
    setClients(clientMap)

    // Build daily income map for the month
    const incomeMap = {}
    ;(incomeData || []).forEach(i => {
      incomeMap[i.received_date] = (incomeMap[i.received_date] || 0) + parseFloat(i.amount)
    })
    setDailyIncome(incomeMap)

    setLoading(false)
  }

  async function fetchUserHolidays() {
    const { data } = await supabase.from('holidays').select('date, end_date, name')
    setUserHolidays(data || [])
  }

  async function generateRecurringVisits() {
    if (_generatingRecurring) return
    _generatingRecurring = true
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const now = new Date()
      now.setHours(0, 0, 0, 0)
      const lookahead = new Date(now)
      lookahead.setDate(lookahead.getDate() + 56)

      const localStr = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`

      const { data: recurring } = await supabase
        .from('visits')
        .select('*')
        .eq('user_id', user.id)
        .not('recurrence_rule', 'is', null)
        .neq('recurrence_rule', 'none')
        .neq('status', 'cancelled')
        .order('scheduled_date', { ascending: false })

      if (!recurring || recurring.length === 0) return

      const existingDates = new Set(
        recurring.map(v => `${v.client_id}_${v.scheduled_date}`)
      )

      const seriesMap = {}
      recurring.forEach(v => {
        const key = `${v.client_id}_${v.recurrence_rule}`
        if (!seriesMap[key]) seriesMap[key] = v
      })

      const toInsert = []
      const insertedDates = new Set()

      for (const [, latestVisit] of Object.entries(seriesMap)) {
        const intervalDays = latestVisit.recurrence_rule === 'weekly' ? 7
          : latestVisit.recurrence_rule === 'biweekly' ? 14
          : null
        const isMonthly = latestVisit.recurrence_rule === 'monthly'
        if (!intervalDays && !isMonthly) continue

        let nextDate = new Date(latestVisit.scheduled_date + 'T12:00:00')

        if (isMonthly) {
          nextDate.setMonth(nextDate.getMonth() + 1)
        } else {
          nextDate.setDate(nextDate.getDate() + intervalDays)
        }

        while (nextDate <= lookahead) {
          const dateStr = localStr(nextDate)
          const key = `${latestVisit.client_id}_${dateStr}`

          if (!existingDates.has(key) && !insertedDates.has(key)) {
            insertedDates.add(key)
            toInsert.push({
              user_id: user.id,
              client_id: latestVisit.client_id,
              scheduled_date: dateStr,
              scheduled_time: latestVisit.scheduled_time,
              duration_minutes: latestVisit.duration_minutes,
              amount: latestVisit.amount,
              payment_method: latestVisit.payment_method,
              notes: latestVisit.notes,
              status: 'scheduled',
              is_recurring: true,
              recurrence_rule: latestVisit.recurrence_rule,
            })
          }

          if (isMonthly) {
            nextDate.setMonth(nextDate.getMonth() + 1)
          } else {
            nextDate.setDate(nextDate.getDate() + intervalDays)
          }
        }
      }

      if (toInsert.length > 0) {
        const { data: freshCheck } = await supabase
          .from('visits')
          .select('client_id, scheduled_date')
          .eq('user_id', user.id)
          .neq('status', 'cancelled')
          .in('scheduled_date', [...new Set(toInsert.map(v => v.scheduled_date))])

        const freshDates = new Set(
          (freshCheck || []).map(v => `${v.client_id}_${v.scheduled_date}`)
        )

        const safeInsert = toInsert.filter(v =>
          !freshDates.has(`${v.client_id}_${v.scheduled_date}`)
        )

        if (safeInsert.length > 0) {
          await supabase.from('visits').insert(safeInsert)
          fetchData()
        }
      }
    } finally {
      _generatingRecurring = false
    }
  }

  const visitsForDay = (date) =>
    visits.filter(v => v.scheduled_date === formatDate(date))

  const dotsForDay = (date) =>
    visitsForDay(date).map(v => STATUS[v.status]?.dot || 'bg-gray-300')

  const getHolidayInfo = (dateStr) => {
    const match = userHolidays.find(h => dateStr >= h.date && dateStr <= (h.end_date || h.date))
    if (match) return { type: 'personal', name: match.name }
    if (BANK_HOLIDAYS[dateStr]) return { type: 'bank', name: BANK_HOLIDAYS[dateStr] }
    return null
  }

  const holidayBg = (holiday, isSelected, isToday) => {
    if (isSelected) return 'bg-green-600'
    if (holiday?.type === 'bank') return 'bg-red-100'
    if (holiday?.type === 'personal') return 'bg-violet-100'
    if (isToday) return 'bg-green-50'
    return 'bg-transparent'
  }

  async function updateStatus(visitId, newStatus, previousStatus) {
    setVisits(vs => vs.map(v => v.id === visitId ? { ...v, status: newStatus } : v))
    setExpandedId(null)

    await supabase.from('visits').update({ status: newStatus }).eq('id', visitId)

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
    } else if (previousStatus === 'done_paid') {
      // Moving away from done & paid — remove the auto-logged income entry
      await supabase.from('income').delete().eq('visit_id', visitId)
    }

    setToast({
      message: `Marked as ${STATUS[newStatus].label.toLowerCase()}`,
      visitId,
      previousStatus,
    })
  }

  async function undoStatus() {
    if (!toast) return
    const visit = visits.find(v => v.id === toast.visitId)
    setVisits(vs => vs.map(v => v.id === toast.visitId ? { ...v, status: toast.previousStatus } : v))
    await supabase.from('visits').update({ status: toast.previousStatus }).eq('id', toast.visitId)
    if (toast.previousStatus === 'done_paid') {
      // Undoing a change away from done_paid — re-log the income
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
    } else {
      // Undoing a done_paid marking — remove the auto-logged income
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

  async function bulkCancelVisits() {
    for (const id of selectedVisits) {
      await supabase.from('visits').update({ status: 'cancelled' }).eq('id', id)
    }
    setSelectedVisits(new Set())
    setSelecting(false)
    setConfirmBulkDelete(null)
    fetchData()
  }

  async function bulkDeleteVisits() {
    for (const id of selectedVisits) {
      await supabase.from('visits').delete().eq('id', id)
    }
    setSelectedVisits(new Set())
    setSelecting(false)
    setConfirmBulkDelete(null)
    fetchData()
  }

  const dayVisits = visitsForDay(selectedDay)
  const selectedDayHoliday = getHolidayInfo(formatDate(selectedDay))

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
            {selecting ? (
              <>
                {selectedVisits.size > 0 && (
                  <>
                    <button
                      onClick={() => setConfirmBulkDelete('cancel')}
                      className="flex items-center gap-1.5 bg-amber-500 text-white font-semibold px-3 py-2.5 rounded-xl text-sm active:bg-amber-600 transition-colors"
                    >
                      <X size={15} />
                      Cancel {selectedVisits.size}
                    </button>
                    <button
                      onClick={() => setConfirmBulkDelete('delete')}
                      className="flex items-center gap-1.5 bg-red-600 text-white font-semibold px-3 py-2.5 rounded-xl text-sm active:bg-red-700 transition-colors"
                    >
                      <Trash2 size={15} />
                      Delete {selectedVisits.size}
                    </button>
                  </>
                )}
                <button
                  onClick={() => { setSelecting(false); setSelectedVisits(new Set()) }}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 bg-white text-gray-600 active:bg-gray-50"
                >
                  Done
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => navigate(`/schedule/add?date=${formatDate(selectedDay)}`)}
                  className="flex items-center gap-1.5 bg-green-600 text-white font-semibold px-4 py-2.5 rounded-xl text-sm active:bg-green-700 transition-colors shadow-sm"
                >
                  <Plus size={15} />
                  Add job
                </button>
                <button
                  onClick={() => setSelecting(true)}
                  className="flex items-center gap-1.5 bg-white border border-gray-200 text-gray-600 font-semibold px-3 py-2.5 rounded-xl text-sm active:bg-gray-50 transition-colors"
                >
                  <CheckSquare size={15} />
                </button>
                <button
                  onClick={() => navigate('/clients')}
                  className="flex items-center gap-1.5 bg-white border border-gray-200 text-gray-700 font-semibold px-4 py-2.5 rounded-xl text-sm active:bg-gray-50 transition-colors"
                >
                  <Users size={15} />
                  Clients
                </button>
              </>
            )}
          </div>
        </div>

        {/* View toggle + Today button */}
        <div className="flex items-center gap-2 mb-3">
          <div className="flex bg-gray-100 rounded-xl p-1 flex-1">
            <button
              onClick={() => setViewMode('week')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                viewMode === 'week' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
              }`}
            >
              Week
            </button>
            <button
              onClick={() => setViewMode('month')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                viewMode === 'month' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
              }`}
            >
              Month
            </button>
          </div>
          <button
            onClick={() => {
              setSelectedDay(today)
              setWeekStart(getMonday(today))
              setMonthDate(new Date(today.getFullYear(), today.getMonth(), 1))
            }}
            className="px-3 py-2 rounded-xl bg-green-600 text-white text-xs font-semibold active:bg-green-700 transition-colors flex-shrink-0"
          >
            Today
          </button>
        </div>

        {/* Week view */}
        {viewMode === 'week' && (
          <>
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
                  const holiday = getHolidayInfo(formatDate(day))
                  return (
                    <button
                      key={i}
                      onClick={() => setSelectedDay(day)}
                      className={`flex flex-col items-center py-2 px-1 rounded-xl transition-colors ${holidayBg(holiday, isSelected, isToday)}`}
                    >
                      <span className={`text-xs font-medium mb-1 ${isSelected ? 'text-green-100' : 'text-gray-400'}`}>
                        {DAY_LABELS[i]}
                      </span>
                      <span className={`text-sm font-bold ${
                        isSelected ? 'text-white' : isToday ? 'text-green-600' : 'text-gray-800'
                      }`}>
                        {day.getDate()}
                      </span>
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
            <div className="flex items-center gap-1.5 flex-wrap mb-3">
              <p className="text-sm font-semibold text-gray-700">
                {isSameDay(selectedDay, today) ? 'Today' : selectedDay.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
              {selectedDayHoliday && (
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  selectedDayHoliday.type === 'bank' ? 'bg-red-50 text-red-600' : 'bg-violet-50 text-violet-600'
                }`}>
                  {selectedDayHoliday.name}
                </span>
              )}
              <span className="text-gray-400 text-sm font-normal">
                {dayVisits.length === 0 ? 'No jobs' : `${dayVisits.length} job${dayVisits.length > 1 ? 's' : ''}`}
              </span>
            </div>
          </>
        )}

        {/* Month view */}
        {viewMode === 'month' && (
          <>
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={() => setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 1))}
                className="p-1.5 rounded-lg text-gray-400 active:bg-gray-100"
              >
                <ChevronLeft size={18} />
              </button>

              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-gray-700">
                  {MONTH_NAMES[monthDate.getMonth()]} {monthDate.getFullYear()}
                </p>
                {/* Income toggle */}
                <button
                  onClick={() => setShowIncome(v => { const next = !v; localStorage.setItem('logall_show_income', next); return next })}
                  className={`text-xs font-bold px-2 py-0.5 rounded-full border transition-colors ${
                    showIncome
                      ? 'bg-green-600 text-white border-green-600'
                      : 'bg-white text-gray-400 border-gray-200 active:bg-gray-50'
                  }`}
                >
                  £
                </button>
              </div>

              <button
                onClick={() => setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1))}
                className="p-1.5 rounded-lg text-gray-400 active:bg-gray-100"
              >
                <ChevronRight size={18} />
              </button>
            </div>

            {/* Day of week headers */}
            <div className="grid grid-cols-7 gap-1 mb-1">
              {DAY_LABELS.map(d => (
                <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">{d}</div>
              ))}
            </div>

            {/* Month grid */}
            <div className="grid grid-cols-7 gap-1 mb-3">
              {(() => {
                const firstDay = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1)
                const lastDay = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0)
                const startPad = (firstDay.getDay() + 6) % 7
                const cells = []
                for (let i = 0; i < startPad; i++) cells.push(null)
                for (let d = 1; d <= lastDay.getDate(); d++) {
                  cells.push(new Date(monthDate.getFullYear(), monthDate.getMonth(), d))
                }
                return cells.map((day, i) => {
                  if (!day) return <div key={i} />
                  const isSelected = isSameDay(day, selectedDay)
                  const isToday = isSameDay(day, today)
                  const dots = dotsForDay(day)
                  const holiday = getHolidayInfo(formatDate(day))
                  const dayIncome = dailyIncome[formatDate(day)]
                  return (
                    <button
                      key={i}
                      onClick={() => { setSelectedDay(day) }}
                      className={`flex flex-col items-center py-1.5 rounded-xl transition-colors ${holidayBg(holiday, isSelected, isToday)}`}
                    >
                      <span className={`text-xs font-bold ${
                        isSelected ? 'text-white' : isToday ? 'text-green-600' : 'text-gray-800'
                      }`}>
                        {day.getDate()}
                      </span>
                      <div className="flex gap-0.5 mt-0.5 h-1.5">
                        {dots.slice(0, 3).map((dot, j) => (
                          <div key={j} className={`w-1 h-1 rounded-full ${dot}`} />
                        ))}
                      </div>
                      {/* Income amount — space always reserved when toggle is on */}
                      {showIncome && (
                        <span className={`text-xs font-semibold leading-none mt-1 h-3 ${
                          dayIncome
                            ? isSelected ? 'text-green-100' : 'text-green-600'
                            : 'text-transparent'
                        }`}>
                          {dayIncome ? `£${Math.round(dayIncome)}` : '£0'}
                        </span>
                      )}
                    </button>
                  )
                })
              })()}
            </div>

            <div className="flex items-center gap-1.5 flex-wrap mb-3">
              <p className="text-sm font-semibold text-gray-700">
                {isSameDay(selectedDay, today) ? 'Today' : selectedDay.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
              {selectedDayHoliday && (
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  selectedDayHoliday.type === 'bank' ? 'bg-red-50 text-red-600' : 'bg-violet-50 text-violet-600'
                }`}>
                  {selectedDayHoliday.name}
                </span>
              )}
              <span className="text-gray-400 text-sm font-normal">
                {dayVisits.length === 0 ? 'No jobs' : `${dayVisits.length} job${dayVisits.length > 1 ? 's' : ''}`}
              </span>
              {showIncome && dailyIncome[formatDate(selectedDay)] && (
                <span className="text-green-600 text-sm font-semibold">
                  · £{dailyIncome[formatDate(selectedDay)].toFixed(2)} received
                </span>
              )}
            </div>
          </>
        )}
      </div>

      {/* Job cards */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
        {loading && (
          <div className="space-y-2">
            {[1,2].map(i => <div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse" />)}
          </div>
        )}

        {!loading && dayVisits.length === 0 && (
          <div className="bg-white rounded-2xl p-4 border border-gray-100 text-center mt-2">
            <p className="text-gray-400 text-sm">No jobs scheduled</p>
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
                onClick={() => {
                  if (selecting) {
                    const next = new Set(selectedVisits)
                    next.has(visit.id) ? next.delete(visit.id) : next.add(visit.id)
                    setSelectedVisits(next)
                  } else {
                    setExpandedId(isExpanded ? null : visit.id)
                  }
                }}
              >
                {selecting && (
                  <div className="flex-shrink-0">
                    {selectedVisits.has(visit.id)
                      ? <CheckSquare size={22} className="text-red-500" />
                      : <Square size={22} className="text-gray-300" />
                    }
                  </div>
                )}
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
                    {(() => {
                      const h = getHolidayInfo(visit.scheduled_date)
                      if (!h) return null
                      return (
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          h.type === 'bank' ? 'bg-red-50 text-red-600' : 'bg-violet-50 text-violet-600'
                        }`}>
                          🏖️ {h.name}
                        </span>
                      )
                    })()}
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
                        {new Date(visit.scheduled_date) > today ? 'Paid in advance' : 'Done & paid'}
                      </button>
                    )}
                    {visit.status === 'done_paid' && new Date(visit.scheduled_date) > today && (
                      <div className="col-span-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs text-amber-700 text-center font-medium">
                        ⏰ Paid in advance — remember to do this job!
                      </div>
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
        {/* Action buttons */}
        {!loading && (
          <div className="space-y-2 pt-2">
            <button
              onClick={() => navigate(`/schedule/add?date=${formatDate(selectedDay)}`)}
              className="w-full bg-green-600 text-white font-semibold py-3 rounded-xl text-sm active:bg-green-700 transition-colors"
            >
              + Add a job
            </button>
            <button
              onClick={() => navigate('/schedule/bulk')}
              className="w-full bg-blue-50 text-blue-600 border border-blue-200 font-semibold py-3 rounded-xl text-sm active:bg-blue-100 transition-colors"
            >
              Add past jobs in bulk
            </button>
          </div>
        )}
      </div>

      {/* Bulk delete confirm */}
      {confirmBulkDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6">
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm">
            <p className="font-semibold text-gray-900 mb-1">
              {confirmBulkDelete === 'delete' ? 'Delete' : 'Cancel'} {selectedVisits.size} job{selectedVisits.size > 1 ? 's' : ''}?
            </p>
            <p className="text-sm text-gray-500 mb-4">
              {confirmBulkDelete === 'delete'
                ? 'This cannot be undone — the jobs will be permanently removed.'
                : 'They will be marked as cancelled. You can still see them in the schedule.'}
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmBulkDelete(null)} className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-600">Keep them</button>
              <button
                onClick={confirmBulkDelete === 'delete' ? bulkDeleteVisits : bulkCancelVisits}
                className="flex-1 py-3 rounded-xl bg-red-600 text-white text-sm font-medium"
              >
                {confirmBulkDelete === 'delete' ? 'Delete' : 'Cancel'} jobs
              </button>
            </div>
          </div>
        </div>
      )}

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
