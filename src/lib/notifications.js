import { supabase } from './supabase'

const PREFS_KEY  = 'logall_notif_prefs'
const FIRED_KEY  = 'logall_notif_fired'
const CHECK_KEY  = 'logall_notif_last_check'

const DEFAULT_PREFS = {
  expenses:         true,
  expenses_days:    7,
  sa_deadline:      true,
  outstanding:      true,
  outstanding_days: 3,
}

export function getPrefs() {
  try { return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(PREFS_KEY)) } } catch { return DEFAULT_PREFS }
}

export function setPrefs(prefs) {
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
}

function getFired() {
  try { return JSON.parse(localStorage.getItem(FIRED_KEY)) || {} } catch { return {} }
}

function markFired(tag) {
  const fired = getFired()
  fired[tag] = new Date().toISOString().slice(0, 10)
  localStorage.setItem(FIRED_KEY, JSON.stringify(fired))
}

function firedToday(tag) {
  return getFired()[tag] === new Date().toISOString().slice(0, 10)
}

function firedThisYear(tag) {
  const fired = getFired()[tag]
  if (!fired) return false
  return fired.slice(0, 4) === String(new Date().getFullYear())
}

export function canNotify() {
  return 'Notification' in window && Notification.permission === 'granted'
}

export async function requestPermission() {
  if (!('Notification' in window)) return 'unsupported'
  if (Notification.permission === 'granted') return 'granted'
  if (Notification.permission === 'denied') return 'denied'
  const result = await Notification.requestPermission()
  return result
}

function fire(title, body, tag, icon = '/icon-192.png') {
  if (!canNotify()) return
  if (firedToday(tag)) return
  new Notification(title, { body, tag, icon })
  markFired(tag)
}

// Check all conditions and fire relevant notifications
export async function checkNotifications() {
  if (!canNotify()) return

  const prefs = getPrefs()
  const today = new Date()
  const todayStr = today.toISOString().slice(0, 10)

  // Only run checks once per day
  const lastCheck = localStorage.getItem(CHECK_KEY)
  if (lastCheck === todayStr) return
  localStorage.setItem(CHECK_KEY, todayStr)

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  // 1. Expense reminder — if no expense in N days
  if (prefs.expenses) {
    const days = Math.max(1, parseInt(prefs.expenses_days) || 7)
    const cutoff = new Date(today)
    cutoff.setDate(cutoff.getDate() - days)
    const { data } = await supabase
      .from('expenses')
      .select('expense_date')
      .gte('expense_date', cutoff.toISOString().slice(0, 10))
      .limit(1)
    if (!data?.length) {
      fire(
        "Don't forget your expenses 🧾",
        `You haven't logged any expenses in the last ${days} day${days === 1 ? '' : 's'}. Tap to add one.`,
        'expense_reminder'
      )
    }
  }

  // 2. Self Assessment deadline — 31 January
  if (prefs.sa_deadline) {
    const year = today.getMonth() === 0 ? today.getFullYear() : today.getFullYear() + 1
    const deadline = new Date(`${year}-01-31`)
    const daysLeft = Math.ceil((deadline - today) / (1000 * 60 * 60 * 24))

    if (daysLeft === 30 && !firedThisYear('sa_30')) {
      fire(
        '📅 Self Assessment in 30 days',
        `Your tax return is due 31 January. Log into LogAll to check you're ready.`,
        'sa_30'
      )
    } else if (daysLeft === 7 && !firedThisYear('sa_7')) {
      fire(
        '⚠️ Self Assessment due in 7 days',
        'Your Self Assessment return is due 31 January. File now at gov.uk.',
        'sa_7'
      )
    } else if (daysLeft === 1 && !firedThisYear('sa_1')) {
      fire(
        '🚨 Self Assessment due TOMORROW',
        'Last chance — file your Self Assessment at gov.uk today.',
        'sa_1'
      )
    }
  }

  // 3. Outstanding payments — any overdue beyond user-configured threshold
  if (prefs.outstanding) {
    const days = Math.max(1, parseInt(prefs.outstanding_days) || 3)
    const cutoff = new Date(today)
    cutoff.setDate(cutoff.getDate() - days)
    const { data } = await supabase
      .from('schedule')
      .select('id')
      .eq('status', 'completed')
      .eq('paid', false)
      .lte('scheduled_date', cutoff.toISOString().slice(0, 10))
    if (data?.length) {
      fire(
        `💰 ${data.length} overdue payment${data.length > 1 ? 's' : ''}`,
        `${data.length} client${data.length > 1 ? 's have' : ' has'} outstanding payments older than ${days} day${days === 1 ? '' : 's'}.`,
        'outstanding_payments'
      )
    }
  }
}
