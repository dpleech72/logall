import { NavLink } from 'react-router-dom'
import { House, CalendarDays, Banknote, Car, PoundSterling, FileText } from 'lucide-react'

const tabs = [
  { to: '/dashboard', icon: House,         label: 'Home' },
  { to: '/schedule',  icon: CalendarDays,  label: 'Schedule' },
  { to: '/income',    icon: Banknote,      label: 'Income' },
  { to: '/mileage',   icon: Car,           label: 'Mileage' },
  { to: '/expenses',  icon: PoundSterling, label: 'Expenses' },
  { to: '/tax',       icon: FileText,      label: 'Tax' },
]

export default function Sidebar() {
  return (
    <aside className="hidden md:flex flex-col w-56 shrink-0 bg-white border-r border-gray-100 h-full">
      {/* Logo */}
      <div className="px-4 pt-6 pb-5 border-b border-gray-100 flex items-center gap-3">
        <div className="w-9 h-9 bg-white border-2 border-green-600 rounded-xl flex items-center justify-center text-green-600 font-bold text-sm flex-shrink-0">
          LA
        </div>
        <div>
          <p className="text-lg font-bold text-gray-900">LogAll</p>
          <p className="text-xs text-gray-400 mt-0.5">Log all. Worry none.</p>
        </div>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {tabs.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-green-50 text-green-700'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={18} strokeWidth={isActive ? 2.5 : 1.8} />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-gray-100">
        <p className="text-xs text-gray-300">logall.co.uk</p>
      </div>
    </aside>
  )
}
