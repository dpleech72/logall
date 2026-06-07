import { NavLink } from 'react-router-dom'
import { House, CalendarDays, Banknote, Car, PoundSterling, FileText, HelpCircle, Sun, Moon } from 'lucide-react'
import { useDarkMode } from '../../hooks/useDarkMode'

const tabs = [
  { to: '/dashboard', icon: House,         label: 'Home' },
  { to: '/schedule',  icon: CalendarDays,  label: 'Schedule' },
  { to: '/income',    icon: Banknote,      label: 'Income' },
  { to: '/mileage',   icon: Car,           label: 'Mileage' },
  { to: '/expenses',  icon: PoundSterling, label: 'Expenses' },
  { to: '/tax',       icon: FileText,      label: 'Tax' },
]

export default function Sidebar() {
  const [dark, setDark] = useDarkMode()

  return (
    <aside className="hidden md:flex flex-col w-56 shrink-0 bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 h-full">
      {/* Logo */}
      <div className="px-4 pt-6 pb-5 border-b border-gray-100 dark:border-gray-800 flex items-center gap-3">
        <img src="/icon-192.png" alt="LogAll" className="w-11 h-11 rounded-xl flex-shrink-0" />
        <div>
          <p className="text-lg font-bold text-green-600">LogAll</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Log all. Worry none.</p>
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
                  ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-200'
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
      <div className="px-3 py-4 border-t border-gray-100 dark:border-gray-800 space-y-0.5">
        <NavLink
          to="/help"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
              isActive ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-200'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <HelpCircle size={18} strokeWidth={isActive ? 2.5 : 1.8} />
              Help
            </>
          )}
        </NavLink>

        {/* Dark mode toggle */}
        <button
          onClick={() => setDark(d => !d)}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
        >
          {dark ? <Sun size={18} strokeWidth={1.8} /> : <Moon size={18} strokeWidth={1.8} />}
          {dark ? 'Light mode' : 'Dark mode'}
        </button>

        <p className="text-xs text-gray-300 dark:text-gray-600 px-3 pt-1">logall.co.uk</p>
      </div>
    </aside>
  )
}
