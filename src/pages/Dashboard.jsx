import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { PoundSterling, TrendingUp, AlertCircle, Car, LogOut, Users, ChevronRight, UserCircle, Bell, X, HelpCircle } from 'lucide-react'

function StatCard({ label, value, sub, colour, onClick }) {
  const colours = {
    green: 'bg-green-50 text-green-700',
    amber: 'bg-amber-50 text-amber-700',
    red:   'bg-red-50 text-red-700',
    grey:  'bg-gray-50 text-gray-600',
  }
  return (
    <div
      className={`rounded-2xl p-4 ${colours[colour] || colours.grey} ${onClick ? 'active:opacity-80 cursor-pointer' : ''}`}
      onClick={onClick}
    >
      <p className="text-xs font-medium opacity-70 mb-1">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
      {sub && <p className="text-xs mt-1 opacity-60">{sub}</p>}
    </div>
  )
}

export default function Dashboard() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const [stats, setStats] = useState({
    incomeThisMonth: 0,
    expensesThisMonth: 0,
    outstanding: 0,
    taxSetAside: 0,
    jobsToday: 0,
    recentIncome: [],
  })
  const [firstName, setFirstName] = useState('')
  const [loading, setLoading] = useState(true)
  const [backfillVisits, setBackfillVisits] = useState([])
  const [backfillDismissed, setBackfillDismissed] = useState(false)
  const [backfilling, setBackfilling] = useState(false)

  useEffect(() => {
    fetchStats()
    checkDailyReminder()
    checkBackfill()
  }, [])

  async function checkDailyReminder() {
    const now = new Date()
    const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`

    // Only fire once per day
    if (localStorage.getItem('logall_reminder_date') === todayStr) return

    // Check for overdue visits
    const { data: overdue } = await supabase
      .from('visits')
      .select('id')
      .eq('status', 'awaiting_payment')
      .lt('scheduled_date', todayStr)

    if (!overdue || overdue.length === 0) return

    // Mark as shown for today so we don't repeat
    localStorage.setItem('logall_reminder_date', todayStr)

    if (!('Notification' in window)) return
    let permission = Notification.permission
    if (permission === 'default') permission = await Notification.requestPermission()
    if (permission !== 'granted') return

    const n = new Notification('LogAll — Payments overdue', {
      body: `${overdue.length} client${overdue.length > 1 ? 's' : ''} still owe${overdue.length === 1 ? 's' : ''} you money — tap to view`,
      icon: '/pwa-192x192.png',
      tag: 'logall-overdue',
    })
    n.onclick = () => { window.focus(); navigate('/outstanding'); n.close() }
  }

  async function fetchStats() {
    const now = new Date()
    const localDate = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
    const monthStart = localDate(new Date(now.getFullYear(), now.getMonth(), 1))
    const today = localDate(now)
    const taxYearStart = localDate(new Date(
      now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1, 3, 6
    ))

    const [
      { data: incomeMonth },
      { data: expensesMonth },
      { data: outstanding },
      { data: incomeYear },
      { data: expensesYear },
      { data: mileageYear },
      { data: jobsToday },
      { data: recentIncome },
      { data: profile },
    ] = await Promise.all([
      supabase.from('income').select('amount').gte('received_date', monthStart),
      supabase.from('expenses').select('amount').gte('expense_date', monthStart),
      supabase.from('visits').select('amount').eq('status', 'awaiting_payment'),
      supabase.from('income').select('amount').gte('received_date', taxYearStart),
      supabase.from('expenses').select('amount').gte('expense_date', taxYearStart),
      supabase.from('mileage').select('claimable_amount').gte('journey_date', taxYearStart),
      supabase.from('visits').select('id, scheduled_time, duration_minutes, status')
        .eq('scheduled_date', today)
        .in('status', ['scheduled', 'awaiting_payment']),
      supabase.from('income')
        .select('amount, received_date, description, client_id')
        .order('received_date', { ascending: false })
        .limit(3),
      supabase.from('profiles').select('full_name').single(),
    ])

    setFirstName(profile?.full_name?.split(' ')[0] || '')

    // Calculate estimated tax
    const totalIncome = (incomeYear || []).reduce((s, i) => s + parseFloat(i.amount), 0)
    const totalExpenses = (expensesYear || []).reduce((s, i) => s + parseFloat(i.amount), 0)
    const totalMileage = (mileageYear || []).reduce((s, i) => s + parseFloat(i.claimable_amount), 0)
    const profit = Math.max(0, totalIncome - totalExpenses - totalMileage)
    const taxableIncome = Math.max(0, profit - 12570)
    const estimatedTax = (taxableIncome * 0.20) + (Math.min(Math.max(0, profit - 12570), 37700) * 0.09) + (profit > 12570 ? 3.45 * 52 : 0)

    setStats({
      incomeThisMonth: (incomeMonth || []).reduce((s, i) => s + parseFloat(i.amount), 0),
      expensesThisMonth: (expensesMonth || []).reduce((s, i) => s + parseFloat(i.amount), 0),
      outstanding: (outstanding || []).reduce((s, i) => s + parseFloat(i.amount || 0), 0),
      taxSetAside: Math.round(estimatedTax / 12),
      jobsToday: (() => {
        const nowMins = now.getHours() * 60 + now.getMinutes()
        return (jobsToday || []).filter(v => {
          // If we know start time + duration and the job has already finished, exclude it
          if (v.scheduled_time && v.duration_minutes) {
            const [h, m] = v.scheduled_time.split(':').map(Number)
            const endMins = h * 60 + m + v.duration_minutes
            if (endMins < nowMins) return false
          }
          return true
        }).length
      })(),
      recentIncome: recentIncome || [],
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
    const linked = new Set((incomeLinks || []).map(i => i.visit_id))
    const missing = (paidVisits || []).filter(v => !linked.has(v.id))
    setBackfillVisits(missing)
  }

  async function doBackfill() {
    setBackfilling(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data: clientData } = await supabase.from('clients').select('id, name')
    const clientMap = {}
    ;(clientData || []).forEach(c => { clientMap[c.id] = c.name })
    const records = backfillVisits.map(v => ({
      user_id: user.id,
      client_id: v.client_id,
      visit_id: v.id,
      amount: parseFloat(v.amount),
      payment_method: v.payment_method || 'cash',
      received_date: v.scheduled_date,
      description: `Visit — ${clientMap[v.client_id] || 'Client'}`,
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

  const quickActions = [
    { icon: PoundSterling, label: 'Log a payment',  colour: 'text-green-600 bg-green-50',  to: '/income' },
    { icon: Car,           label: 'Log a journey',  colour: 'text-blue-600 bg-blue-50',    to: '/mileage' },
    { icon: TrendingUp,    label: 'Log an expense', colour: 'text-purple-600 bg-purple-50', to: '/expenses' },
    { icon: Users,         label: 'Manage clients', colour: 'text-teal-600 bg-teal-50',    to: '/clients' },
  ]

  return (
    <div className="p-4 md:p-8 md:max-w-4xl md:mx-auto space-y-5">
      {/* Header */}
      <div className="pt-2 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{greeting()}{firstName ? `, ${firstName}` : ''}</h1>
          {firstName && <p className="text-gray-500 text-sm mt-0.5">Welcome back!</p>}
        </div>
        <div className="flex items-center gap-3 mt-1">
          <button
            onClick={() => navigate('/help')}
            className="flex items-center gap-1.5 text-gray-400 text-sm active:text-green-500 transition-colors"
          >
            <HelpCircle size={16} />
          </button>
          <button
            onClick={() => navigate('/profile')}
            className="flex items-center gap-1.5 text-gray-400 text-sm active:text-green-500 transition-colors"
          >
            <UserCircle size={16} />
            Profile
          </button>
          <button
            onClick={signOut}
            className="flex items-center gap-1.5 text-gray-400 text-sm active:text-red-500 transition-colors"
          >
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </div>

      {/* Jobs today banner */}
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

      {/* Income backfill banner */}
      {backfillVisits.length > 0 && !backfillDismissed && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-800">
                {backfillVisits.length} paid visit{backfillVisits.length > 1 ? 's' : ''} missing from income
              </p>
              <p className="text-xs text-amber-600 mt-0.5">
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
            className="w-full bg-amber-500 text-white font-semibold py-2.5 rounded-xl text-sm active:bg-amber-600 disabled:opacity-60 transition-colors"
          >
            {backfilling ? 'Adding records...' : `Add ${backfillVisits.length} missing income record${backfillVisits.length > 1 ? 's' : ''}`}
          </button>
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Income this month"
          value={loading ? '...' : `£${stats.incomeThisMonth.toFixed(2)}`}
          colour="green"
          onClick={() => navigate('/income')}
        />
        <StatCard
          label="Expenses this month"
          value={loading ? '...' : `£${stats.expensesThisMonth.toFixed(2)}`}
          colour="grey"
          onClick={() => navigate('/expenses')}
        />
        <StatCard
          label="Outstanding"
          value={loading ? '...' : `£${stats.outstanding.toFixed(2)}`}
          sub="awaiting payment"
          colour={stats.outstanding > 0 ? 'amber' : 'grey'}
          onClick={() => navigate('/outstanding')}
        />
        <StatCard
          label="Set aside/month"
          value={loading ? '...' : `£${stats.taxSetAside}`}
          sub="estimated tax"
          colour="grey"
          onClick={() => navigate('/tax')}
        />
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Quick actions
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {quickActions.map(({ icon: Icon, label, colour, to }) => (
            <button
              key={label}
              onClick={() => navigate(to)}
              className="flex items-center gap-2.5 bg-white rounded-xl p-3.5 shadow-sm border border-gray-100 text-left active:bg-gray-50 transition-colors"
            >
              <span className={`p-2 rounded-lg ${colour} flex-shrink-0`}>
                <Icon size={16} />
              </span>
              <span className="font-medium text-gray-800 text-sm leading-tight">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Recent income */}
      {!loading && stats.recentIncome.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Recent payments</h2>
            <button onClick={() => navigate('/income')} className="text-xs text-green-600 font-medium">See all</button>
          </div>
          <div className="space-y-2">
            {stats.recentIncome.map((item, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{item.description || 'Payment'}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(item.received_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </p>
                </div>
                <p className="font-bold text-green-600">£{parseFloat(item.amount).toFixed(2)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && stats.incomeThisMonth === 0 && stats.recentIncome.length === 0 && (
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm text-center">
          <p className="text-gray-400 text-sm">No activity yet — start by adding a client and logging your first job.</p>
          <button
            onClick={() => navigate('/clients/add')}
            className="mt-3 bg-green-600 text-white font-semibold px-5 py-2.5 rounded-xl text-sm"
          >
            Add a client
          </button>
        </div>
      )}
    </div>
  )
}
