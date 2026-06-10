import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { User, Clock, Bell, Settings, ChevronRight } from 'lucide-react'

const MENU = [
  {
    path: '/profile/personal',
    icon: User,
    label: 'Personal & HMRC',
    desc: 'Name, trade, address, NI & UTR',
    colour: 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
  },
  {
    path: '/profile/working-hours',
    icon: Clock,
    label: 'Working hours',
    desc: 'Capacity, recurring time off, holidays',
    colour: 'bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400',
  },
  {
    path: '/profile/notifications',
    icon: Bell,
    label: 'Notifications',
    desc: 'Push alerts and reminders',
    colour: 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
  },
  {
    path: '/profile/account',
    icon: Settings,
    label: 'Account',
    desc: 'Email, Google Drive, 2FA, dark mode',
    colour: 'bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300',
  },
]

export default function Profile() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')

  useEffect(() => {
    supabase.from('profiles').select('full_name').eq('id', user.id).single()
      .then(({ data }) => { if (data?.full_name) setName(data.full_name) })
  }, [])

  return (
    <div className="p-4 pb-8 md:max-w-3xl md:mx-auto">
      <div className="pt-2 mb-6">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">My profile</h1>
        <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
          {name ? name : user?.email}
        </p>
      </div>

      <div className="space-y-2">
        {MENU.map(({ path, icon: Icon, label, desc, colour }) => (
          <button key={path} onClick={() => navigate(path)}
            className="w-full flex items-center gap-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-4 text-left active:bg-gray-50 dark:active:bg-gray-700/80 transition-colors">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${colour}`}>
              <Icon size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-white">{label}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{desc}</p>
            </div>
            <ChevronRight size={16} className="text-gray-300 dark:text-gray-600 flex-shrink-0" />
          </button>
        ))}
      </div>
    </div>
  )
}
