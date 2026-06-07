import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { PoundSterling, TrendingUp, Car, Users, ChevronRight, X, UserCircle, HelpCircle } from 'lucide-react'

const paymentColour = {
  cash:         'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400',
  bank_transfer:'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  card:         'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
  cheque:       'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
}
const paymentLabel = {
  cash: 'Cash', bank_transfer: 'Bank transfer', card: 'Card', cheque: 'Cheque',
}

function getInitials(name) {
  if (!name) return '?'
  return name.split(' ').filter(Boolean).map(w => w[0].toUpperCase()).slice(0, 2).join('')
}

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [stats, setStats] = useState({
    incomeThisMonth: 0,
    incomeLastMonth: 0,
    expensesThisMonth: 0,
    outstanding: 0,
    taxSetAside: 0,
    jobsToday: 0,
    recentIncome: [],
    outstandingVisits: [],
  })
  const [firstName, setFirstName]   = useState('')
  const [fullName, setFullName]     = useState('')
  const [clientMap, setClientMap]   = useState({})
  const [hasClients, setHasClients] = useState(false)
  const [loading, setLoading]       = useState(true)
  const [backfillVisits, setBackfillVisits]       = useState([])
  const [backfillDismissed, setBackfillDismissed] = useState(false)
  const [backfilling, setBackfilling]             = useState(false)

  useEffect(() => {
    fetchStats()
    checkDailyReminder()
    checkBackfill()
  }, [])

  async function checkDailyReminder() {
    const now = new Date()
    const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`
    if (localStorage.getItem('logall_reminder_date') === todayStr) return

    const { data: overdue } = await supabase
      .from('visits').select('id')
      .eq('status', 'awaiting_payment').lt('scheduled_date', todayStr)

    if (!overdue || overdue.length === 0) return
    localStorage.setItem('logall_reminder_date', todayStr)
    if (!('Notification' in window)) return
    let permission = Notification.permission
    if (permission === 'default') permission = await Notification.requestPermission()
    if (permission !== 'granted') return
    const n = new Notification('LogAll — Payments overdue', {
      body: `${overdue.length} client${overdue.length > 1 ? 's' : ''} still owe${overdue.length === 1 ? 's' : ''} you money — tap to view`,
      icon: '/icon-192.png',
      tag: 'logall-overdue',
    })
    n.onclick = () => { window.focus(); navigate('/outstanding'); n.close() }
  }

  async function fetchStats() {
    const now = new Date()
    const localDate = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
    const monthStart      = localDate(new Date(now.getFullYear(), now.getMonth(), 1))
    const lastMonthStart  = localDate(new Date(now.getFullYear(), now.getMonth() - 1, 1))
    const lastMonthEnd    = localDate(new Date(now.getFullYear(), now.getMonth(), 0))
    const today           = localDate(now)
    const taxYearStart    = localDate(new Date(now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1, 3, 6))

    const [
      { data: incomeMonth },
      { data: incomeLastMonth },
      { data: expensesMonth },
      { data: outstanding },
      { data: incomeYear },
      { data: expensesYear },
      { data: mileageYear },
      { data: jobsToday },
      { data: recentIncome },
      { data: profile },
      { data: clients },
      { data: outstandingVisits },
    ] = await Promise.all([
      supabase.from('income').select('amount').gte('received_date', monthStart),
      supabase.from('income').select('amount').gte('received_date', lastMonthStart).lte('received_date', lastMonthEnd),
      supabase.from('expenses').select('amount').gte('expense_date', monthStart),
      supabase.from('visits').select('amount').eq('status', 'awaiting_payment'),
      supabase.from('income').select('amount').gte('received_date', taxYearStart),
      supabase.from('expenses').select('amount').gte('expense_date', taxYearStart),
      supabase.from('mileage').select('claimable_amount').gte('journey_date', taxYearStart),
      supabase.from('visits').select('id, scheduled_time, duration_minutes, status')
        .eq('scheduled_date', today).in('status', ['scheduled', 'awaiting_payment']),
      supabase.from('income')
        .select('amount, received_date, description, client_id, payment_method')
        .order('received_date', { ascending: false }).limit(3),
      supabase.from('profiles').select('full_name').single(),
      supabase.from('clients').select('id, name, colour'),
      supabase.from('visits')
        .select('id, client_id, amount, scheduled_date')
        .eq('status', 'awaiting_payment')
        .order('scheduled_date', { ascending: true }),
    ])

    const name = profile?.full_name || ''
    setFullName(name)
    setFirstName(name.split(' ')[0] || '')

    const map = {}
    ;(clients || []).forEach(c => { map[c.id] = c })
    setClientMap(map)
    setHasClients((clients || []).length > 0)

    const totalIncome   = (incomeYear   || []).reduce((s, i) => s + parseFloat(i.amount), 0)
    const totalExpenses = (expensesYear || []).reduce((s, i) => s + parseFloat(i.amount), 0)
    const totalMileage  = (mileageYear  || []).reduce((s, i) => s + parseFloat(i.claimable_amount), 0)
    const profit        = Math.max(0, totalIncome - totalExpenses - totalMileage)
    const taxableIncome = Math.max(0, profit - 12570)
    const estimatedTax  = (taxableIncome * 0.20) +
      (Math.min(Math.max(0, profit - 12570), 37700) * 0.09) +
      (profit > 12570 ? 3.45 * 52 : 0)

    setStats({
      incomeThisMonth:  (incomeMonth     || []).reduce((s, i) => s + parseFloat(i.amount), 0),
      incomeLastMonth:  (incomeLastMonth || []).reduce((s, i) => s + parseFloat(i.amount), 0),
      expensesThisMonth:(expensesMonth   || []).reduce((s, i) => s + parseFloat(i.amount), 0),
      outstanding:      (outstanding  || []).reduce((s, i) => s + parseFloat(i.amount || 0), 0),
      taxSetAside: Math.round(estimatedTax / 12),
      jobsToday: (() => {
        const nowMins = now.getHours() * 60 + now.getMinutes()
        return (jobsToday || []).filter(v => {
          if (v.scheduled_time && v.duration_minutes) {
            const [h, m] = v.scheduled_time.split(':').map(Number)
            if (h * 60 + m + v.duration_minutes < nowMins) return false
          }
          return true
        }).length
      })(),
      recentIncome: recentIncome || [],
      outstandingVisits: outstandingVisits || [],
    })
    setLoading(false)
  }

  async function checkBackfill() {
    if (sessionStorage.getItem('logall_backfill_dismissed')) return
    const [{ data: incomeLinks }, { data: paidVisits }] = await Promise.all([
      supabase.from('income').select('visit_id').not('visit_id', 'is', null),
      supabase.from('visits').select('id, client_id, amount, payment_method, scheduled_date')
        .eq('status', 'done_paid').not('amount', 'is', null).gt('amount', 0),
    ])
    const linked  = new Set((incomeLinks || []).map(i => i.visit_id))
    const missing = (paidVisits || []).filter(v => !linked.has(v.id))
    setBackfillVisits(missing)
  }

  async function doBackfill() {
    setBackfilling(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data: clientData } = await supabase.from('clients').select('id, name')
    const cMap = {}
    ;(clientData || []).forEach(c => { cMap[c.id] = c.name })
    const records = backfillVisits.map(v => ({
      user_id: user.id,
      client_id: v.client_id,
      visit_id: v.id,
      amount: parseFloat(v.amount),
      payment_method: v.payment_method || 'cash',
      received_date: v.scheduled_date,
      description: `Visit — ${cMap[v.client_id] || 'Client'}`,
    }))
    await supabase.from('income').insert(records)
    setBackfillVisits([])
    setBackfilling(false)
    fetchStats()
  }

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  }

  const todayLabel = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  const quickActions = [
    { icon: PoundSterling, label: 'Log payment',  colour: 'text-green-600',  to: '/income'   },
    { icon: Car,           label: 'Log journey',  colour: 'text-blue-600',   to: '/mileage'  },
    { icon: TrendingUp,    label: 'Log expense',  colour: 'text-purple-600', to: '/expenses' },
    { icon: Users,         label: 'Clients',      colour: 'text-teal-600',   to: '/clients'  },
    { icon: UserCircle,    label: 'My profile',   colour: 'text-gray-600 dark:text-gray-300',   to: '/profile'  },
    { icon: HelpCircle,    label: 'Help',         colour: 'text-amber-600',  to: '/help'     },
  ]

  return (
    <div className="p-4 md:max-w-3xl md:mx-auto lg:max-w-4xl lg:p-8 space-y-5">

      {/* ── Idea 3: Greeting + date + initials avatar ── */}
      <div className="pt-2 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white truncate">
            {greeting()}{firstName ? `, ${firstName}` : ''}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">{todayLabel}</p>
        </div>
        {fullName && (
          <div className="w-11 h-11 rounded-full flex-shrink-0 flex items-center justify-center"
            style={{ backgroundColor: '#E1F5EE' }}>
            <span className="text-sm font-bold" style={{ color: '#085041' }}>
              {getInitials(fullName)}
            </span>
          </div>
        )}
      </div>

      {/* ── Jobs today banner ── */}
      {!loading && stats.jobsToday > 0 && (
        <button
          onClick={() => navigate('/schedule')}
          className="w-full bg-green-600 text-white rounded-2xl p-3.5 flex items-center justify-between active:bg-green-700"
        >
          <p className="font-semibold text-sm">
            📅 You have {stats.jobsToday} job{stats.jobsToday > 1 ? 's' : ''} today
          </p>
          <ChevronRight size={16} className="text-green-200" />
        </button>
      )}

      {/* ── Income backfill banner ── */}
      {backfillVisits.length > 0 && !backfillDismissed && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                {backfillVisits.length} paid visit{backfillVisits.length > 1 ? 's' : ''} missing from income
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                Marked as paid but not recorded in income — tap to fix in one go.
              </p>
            </div>
            <button
              onClick={() => { setBackfillDismissed(true); sessionStorage.setItem('logall_backfill_dismissed', '1') }}
              className="text-amber-400 active:text-amber-600 flex-shrink-0 p-1"
            >
              <X size={15} />
            </button>
          </div>
          <button
            onClick={doBackfill}
            disabled={backfilling}
            className="w-full bg-amber-500 text-white font-semibold py-2.5 rounded-xl text-sm active:bg-amber-600 disabled:opacity-60"
          >
            {backfilling ? 'Adding records...' : `Add ${backfillVisits.length} missing income record${backfillVisits.length > 1 ? 's' : ''}`}
          </button>
        </div>
      )}

      {/* ── Idea 1: Hero income card + secondary stats ── */}
      <div className="space-y-3">
        {/* Hero */}
        <button
          onClick={() => navigate('/income')}
          className="w-full rounded-2xl p-5 text-left active:opacity-90 transition-opacity bg-green-600"
        >
          <p className="text-green-100 text-xs font-semibold uppercase tracking-wide mb-2">
            Income this month
          </p>
          <p className="text-4xl font-bold text-white leading-none">
            {loading ? '—' : `£${stats.incomeThisMonth.toFixed(2)}`}
          </p>

          {/* Progress bar vs last month */}
          {!loading && stats.incomeLastMonth > 0 && (() => {
            const pct = Math.min(100, Math.round((stats.incomeThisMonth / stats.incomeLastMonth) * 100))
            return (
              <div className="mt-4">
                <div className="w-full rounded-full overflow-hidden" style={{ height: 4, backgroundColor: 'rgba(255,255,255,0.25)' }}>
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${pct}%`, backgroundColor: 'rgba(255,255,255,0.85)' }}
                  />
                </div>
                <p className="text-green-100 text-xs mt-1.5">
                  {pct}% of last month · £{stats.incomeLastMonth.toFixed(2)} target
                </p>
              </div>
            )
          })()}
          {!loading && stats.incomeLastMonth === 0 && (
            <p className="text-green-300 text-xs mt-3">Tap to view all income →</p>
          )}
        </button>

        {/* Secondary stats */}
        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={() => navigate('/expenses')}
            className="rounded-2xl p-3.5 bg-gray-100 dark:bg-gray-800 text-left active:opacity-80"
          >
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Expenses</p>
            <p className="text-lg font-bold text-gray-800 dark:text-gray-100">
              {loading ? '—' : `£${stats.expensesThisMonth.toFixed(2)}`}
            </p>
          </button>
          <button
            onClick={() => navigate('/outstanding')}
            className={`rounded-2xl p-3.5 text-left active:opacity-80 ${
              stats.outstanding > 0
                ? 'bg-amber-50 dark:bg-amber-900/30'
                : 'bg-gray-100 dark:bg-gray-800'
            }`}
          >
            <p className={`text-xs font-medium mb-1 ${
              stats.outstanding > 0
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-gray-500 dark:text-gray-400'
            }`}>Outstanding</p>
            <p className={`text-lg font-bold ${
              stats.outstanding > 0
                ? 'text-amber-700 dark:text-amber-300'
                : 'text-gray-800 dark:text-gray-100'
            }`}>
              {loading ? '—' : `£${stats.outstanding.toFixed(2)}`}
            </p>
          </button>
          <button
            onClick={() => navigate('/tax')}
            className="rounded-2xl p-3.5 bg-gray-100 dark:bg-gray-800 text-left active:opacity-80"
          >
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Tax/mo</p>
            <p className="text-lg font-bold text-gray-800 dark:text-gray-100">
              {loading ? '—' : `£${stats.taxSetAside}`}
            </p>
          </button>
        </div>
      </div>

      {/* ── Idea 2: Pill quick actions ── */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
          Quick actions
        </h2>
        <div className="grid grid-cols-2 gap-2">
          {quickActions.map(({ icon: Icon, label, colour, to }) => (
            <button
              key={label}
              onClick={() => navigate(to)}
              className="flex items-center gap-3 px-4 py-3.5 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm active:opacity-80 transition-opacity"
            >
              <Icon size={18} className={colour} />
              <span className="font-medium text-gray-700 dark:text-gray-200 text-sm">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Outstanding payments ── */}
      {!loading && stats.outstandingVisits.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Awaiting payment
            </h2>
            <button onClick={() => navigate('/outstanding')} className="text-xs text-amber-600 font-medium">
              See all
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {stats.outstandingVisits.slice(0, 4).map((visit, i) => {
              const client = clientMap[visit.client_id]
              return (
                <button
                  key={visit.id || i}
                  onClick={() => navigate('/outstanding')}
                  className="w-full bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800/40 shadow-sm p-3.5 flex items-center gap-3 text-left active:bg-amber-100 transition-colors"
                >
                  {client ? (
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                      style={{ backgroundColor: client.colour || '#16a34a' }}
                    >
                      {client.name.charAt(0)}
                    </div>
                  ) : (
                    <div className="w-9 h-9 rounded-lg bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
                      <PoundSterling size={16} className="text-amber-600" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-white text-sm truncate">
                      {client?.name || 'Client'}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                      {visit.scheduled_date
                        ? new Date(visit.scheduled_date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
                        : 'Visit'}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-amber-600">£{parseFloat(visit.amount || 0).toFixed(2)}</p>
                    <p className="text-xs text-amber-400 mt-0.5">Unpaid</p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Idea 4: Richer recent payments ── */}
      {!loading && stats.recentIncome.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Recent payments
            </h2>
            <button onClick={() => navigate('/income')} className="text-xs text-green-600 font-medium">
              See all
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {stats.recentIncome.map((item, i) => {
              const client = clientMap[item.client_id]
              return (
                <button
                  key={i}
                  onClick={() => navigate('/income')}
                  className="w-full bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-3.5 flex items-center gap-3 text-left active:bg-gray-50 transition-colors"
                >
                  {/* Avatar — matches Income screen exactly */}
                  {client ? (
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                      style={{ backgroundColor: client.colour || '#16a34a' }}
                    >
                      {client.name.charAt(0)}
                    </div>
                  ) : (
                    <div className="w-9 h-9 rounded-lg bg-green-50 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                      <PoundSterling size={16} className="text-green-600" />
                    </div>
                  )}
                  {/* Text */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-white text-sm truncate">
                      {item.description || client?.name || 'Payment'}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        {new Date(item.received_date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </span>
                      {item.payment_method && (
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${paymentColour[item.payment_method] || paymentColour.cash}`}>
                          {paymentLabel[item.payment_method] || item.payment_method}
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Amount + status */}
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-green-600">£{parseFloat(item.amount).toFixed(2)}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Paid</p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Empty state — only shown to brand new users with no clients ── */}
      {!loading && !hasClients && stats.recentIncome.length === 0 && stats.outstandingVisits.length === 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm text-center">
          <p className="text-gray-400 dark:text-gray-500 text-sm">
            No activity yet — start by adding a client and logging your first job.
          </p>
          <button
            onClick={() => navigate('/clients/add')}
            className="mt-3 bg-green-600 text-white font-semibold px-5 py-2.5 rounded-xl text-sm active:bg-green-700"
          >
            Add a client
          </button>
        </div>
      )}
    </div>
  )
}
