import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Bell } from 'lucide-react'
import { getPrefs, setPrefs, requestPermission, canNotify } from '../lib/notifications'

export default function ProfileNotifications() {
  const navigate = useNavigate()
  const [notifPermission, setNotifPermission] = useState(() =>
    'Notification' in window ? Notification.permission : 'unsupported'
  )
  const [notifPrefs, setNotifPrefsState] = useState(getPrefs)

  function updateNotifPref(key, value) {
    const updated = { ...notifPrefs, [key]: value }
    setNotifPrefsState(updated)
    setPrefs(updated)
  }

  async function handleEnableNotifications() {
    const result = await requestPermission()
    setNotifPermission(result)
  }

  return (
    <div className="p-4 pb-8 md:max-w-3xl md:mx-auto">
      <div className="pt-2 flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/profile')} className="p-2 -ml-2 text-gray-400 dark:text-gray-500">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Notifications</h1>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-4 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <Bell size={16} className="text-gray-500 dark:text-gray-400" />
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">Push notifications</p>
        </div>

        {notifPermission === 'unsupported' && (
          <p className="text-xs text-gray-400 dark:text-gray-500">Your browser doesn't support notifications.</p>
        )}

        {notifPermission === 'denied' && (
          <div className="space-y-2">
            <button onClick={handleEnableNotifications}
              className="w-full flex items-center justify-center gap-2 bg-green-600 text-white font-semibold py-2.5 rounded-xl text-sm active:bg-green-700">
              <Bell size={15} />Enable notifications
            </button>
            <p className="text-xs text-gray-400 dark:text-gray-500 text-center leading-relaxed">
              If the button doesn't work, open Chrome Settings → Privacy and security → Site settings → Notifications → add <strong>logall.co.uk</strong> to "Allowed".
            </p>
          </div>
        )}

        {notifPermission === 'default' && (
          <button onClick={handleEnableNotifications}
            className="w-full flex items-center justify-center gap-2 bg-green-600 text-white font-semibold py-2.5 rounded-xl text-sm active:bg-green-700">
            <Bell size={15} />Enable notifications
          </button>
        )}

        {notifPermission === 'granted' && (
          <div className="space-y-0 divide-y divide-gray-100 dark:divide-gray-700">
            {[
              { key: 'expenses',      label: 'Expense reminder',         hint: null },
              { key: 'sa_deadline',   label: 'Self Assessment deadline',  hint: '30 days, 7 days, and 1 day before 31 January' },
              { key: 'mtd_quarterly', label: 'MTD quarterly deadlines',   hint: '30, 7, and 1 day before each quarterly submission' },
              { key: 'outstanding',   label: 'Overdue payment alert',     hint: null },
            ].map(({ key, label, hint }) => (
              <div key={key} className="py-3">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700 dark:text-gray-200">{label}</p>
                    {hint && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{hint}</p>}
                    {key === 'expenses' && (
                      <div className="flex items-center gap-2 mt-1.5">
                        <p className="text-xs text-gray-400 dark:text-gray-500">If no expenses in</p>
                        <input type="number" min="1" max="30"
                          value={notifPrefs.expenses_days ?? 7}
                          onChange={e => updateNotifPref('expenses_days', Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-14 px-2 py-1 text-xs border border-gray-200 dark:border-gray-700 rounded-lg text-center dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500" />
                        <p className="text-xs text-gray-400 dark:text-gray-500">days</p>
                      </div>
                    )}
                    {key === 'outstanding' && (
                      <div className="flex items-center gap-2 mt-1.5">
                        <p className="text-xs text-gray-400 dark:text-gray-500">Alert after</p>
                        <input type="number" min="1" max="30"
                          value={notifPrefs.outstanding_days ?? 3}
                          onChange={e => updateNotifPref('outstanding_days', Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-14 px-2 py-1 text-xs border border-gray-200 dark:border-gray-700 rounded-lg text-center dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500" />
                        <p className="text-xs text-gray-400 dark:text-gray-500">days unpaid</p>
                      </div>
                    )}
                  </div>
                  <button onClick={() => updateNotifPref(key, !notifPrefs[key])}
                    className={`w-10 h-6 rounded-full flex items-center px-1 transition-colors flex-shrink-0 ml-4 ${notifPrefs[key] ? 'bg-green-600' : 'bg-gray-200 dark:bg-gray-600'}`}>
                    <span className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${notifPrefs[key] ? 'translate-x-4' : 'translate-x-0'}`} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
