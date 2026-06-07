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

export default function BottomNav() {
  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 z-50"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex h-16">
        {tabs.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center gap-0.5 text-xs transition-colors ${
                isActive ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={20} strokeWidth={isActive ? 2.5 : 1.8} />
                <span className={`${isActive ? 'font-semibold' : 'font-normal'} text-xs`}>
                  {label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
