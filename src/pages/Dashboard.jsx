import { PoundSterling, TrendingUp, AlertCircle, Car, LogOut, Users } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useNavigate } from 'react-router-dom'

const StatCard = ({ label, value, sub, colour }) => {
  const colours = {
    green: 'bg-green-50 text-green-700',
    amber: 'bg-amber-50 text-amber-700',
    red:   'bg-red-50 text-red-700',
    grey:  'bg-gray-50 text-gray-600',
  }
  return (
    <div className={`rounded-2xl p-4 ${colours[colour] || colours.grey}`}>
      <p className="text-xs font-medium opacity-70 mb-1">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
      {sub && <p className="text-xs mt-1 opacity-60">{sub}</p>}
    </div>
  )
}

export default function Dashboard() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const quickActions = [
    { icon: PoundSterling, label: 'Log a payment',    colour: 'text-green-600 bg-green-50',  to: '/income' },
    { icon: Car,           label: 'Log a journey',    colour: 'text-blue-600 bg-blue-50',    to: '/mileage' },
    { icon: TrendingUp,    label: 'Log an expense',   colour: 'text-purple-600 bg-purple-50', to: '/expenses' },
    { icon: Users,         label: 'Manage clients',   colour: 'text-teal-600 bg-teal-50',    to: '/clients' },
    { icon: AlertCircle,   label: 'View outstanding', colour: 'text-amber-600 bg-amber-50',  to: '/schedule' },
  ]

  return (
    <div className="p-4 space-y-5">
      {/* Header */}
      <div className="pt-2 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Good morning 👋</h1>
          <p className="text-gray-500 text-sm mt-0.5">{user?.email}</p>
        </div>
        <button
          onClick={signOut}
          className="flex items-center gap-1.5 text-gray-400 text-sm active:text-red-500 transition-colors mt-1"
        >
          <LogOut size={16} />
          Sign out
        </button>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Income this month" value="£0.00" colour="green" />
        <StatCard label="Expenses this month" value="£0.00" colour="grey" />
        <StatCard label="Outstanding" value="£0.00" sub="awaiting payment" colour="amber" />
        <StatCard label="Tax set aside" value="£0.00" sub="estimated" colour="grey" />
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Quick actions
        </h2>
        <div className="space-y-2">
          {quickActions.map(({ icon: Icon, label, colour, to }) => (
            <button
              key={label}
              onClick={() => navigate(to)}
              className="w-full flex items-center gap-3 bg-white rounded-xl p-3.5 shadow-sm border border-gray-100 text-left active:bg-gray-50 transition-colors"
            >
              <span className={`p-2 rounded-lg ${colour}`}>
                <Icon size={18} />
              </span>
              <span className="font-medium text-gray-800">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Placeholder for chart */}
      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Income vs Expenses</h2>
        <div className="h-32 flex items-center justify-center text-gray-300 text-sm">
          Chart will appear here once you start logging
        </div>
      </div>
    </div>
  )
}
