import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { ArrowLeft, Check, AlertCircle, Plus, Trash2 } from 'lucide-react'

const ALL_DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']

function formatHolidayDates(startDate, endDate) {
  const start = new Date(startDate + 'T12:00:00')
  const end   = new Date(endDate   + 'T12:00:00')
  const opts  = { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }
  if (startDate === endDate) return start.toLocaleDateString('en-GB', opts)
  return `${start.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })} – ${end.toLocaleDateString('en-GB', opts)}`
}

export default function ProfileWorkingHours() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [capacity, setCapacity] = useState({
    working_days: ['Mon','Tue','Wed','Thu','Fri'],
    work_start: '08:00', work_end: '17:00',
    travel_buffer_mins: 30,
    job_dur_one_off: 120, job_dur_weekly: 90, job_dur_biweekly: 90, job_dur_monthly: 120,
  })
  const [capacitySaving, setCapacitySaving] = useState(false)
  const [capacitySaved,  setCapacitySaved]  = useState(false)

  const [holidays, setHolidays] = useState([])
  const [newHolidayStart, setNewHolidayStart] = useState('')
  const [newHolidayEnd,   setNewHolidayEnd]   = useState('')
  const [newHolidayName,  setNewHolidayName]  = useState('')
  const [holidayAdding,   setHolidayAdding]   = useState(false)
  const [holidayError,    setHolidayError]    = useState('')

  const [recurringBlocks, setRecurringBlocks] = useState([])
  const [newBlock, setNewBlock] = useState({ name: '', day_of_week: 'Fri', block_type: 'full', recurrence: 'weekly', start_date: '', end_date: '' })
  const [blockAdding, setBlockAdding] = useState(false)
  const [blockError,  setBlockError]  = useState('')

  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([fetchProfile(), fetchHolidays(), fetchRecurringBlocks()])
      .finally(() => setLoading(false))
  }, [])

  async function fetchProfile() {
    const { data } = await supabase.from('profiles').select(
      'working_days,work_start,work_end,travel_buffer_mins,job_dur_one_off,job_dur_weekly,job_dur_biweekly,job_dur_monthly'
    ).eq('id', user.id).single()
    if (data) {
      setCapacity({
        working_days:       JSON.parse(data.working_days || '["Mon","Tue","Wed","Thu","Fri"]'),
        work_start:         data.work_start         || '08:00',
        work_end:           data.work_end           || '17:00',
        travel_buffer_mins: data.travel_buffer_mins ?? 30,
        job_dur_one_off:    data.job_dur_one_off    ?? 120,
        job_dur_weekly:     data.job_dur_weekly     ?? 90,
        job_dur_biweekly:   data.job_dur_biweekly   ?? 90,
        job_dur_monthly:    data.job_dur_monthly    ?? 120,
      })
    }
  }

  async function fetchHolidays() {
    const { data } = await supabase.from('holidays').select('*').order('date', { ascending: true })
    setHolidays(data || [])
  }

  async function fetchRecurringBlocks() {
    const { data } = await supabase.from('recurring_blocks').select('*').order('day_of_week')
    setRecurringBlocks(data || [])
  }

  function toggleWorkDay(day) {
    setCapacity(c => ({
      ...c,
      working_days: c.working_days.includes(day)
        ? c.working_days.filter(d => d !== day)
        : [...c.working_days, day],
    }))
  }

  async function saveCapacity() {
    setCapacitySaving(true)
    await supabase.from('profiles').update({
      working_days:       JSON.stringify(capacity.working_days),
      work_start:         capacity.work_start,
      work_end:           capacity.work_end,
      travel_buffer_mins: Number(capacity.travel_buffer_mins),
      job_dur_one_off:    Number(capacity.job_dur_one_off),
      job_dur_weekly:     Number(capacity.job_dur_weekly),
      job_dur_biweekly:   Number(capacity.job_dur_biweekly),
      job_dur_monthly:    Number(capacity.job_dur_monthly),
    }).eq('id', user.id)
    setCapacitySaving(false)
    setCapacitySaved(true)
    setTimeout(() => setCapacitySaved(false), 3000)
  }

  async function addHoliday() {
    if (!newHolidayStart || !newHolidayName.trim()) { setHolidayError('Please enter a start date and a name.'); return }
    const endDate = newHolidayEnd || newHolidayStart
    if (endDate < newHolidayStart) { setHolidayError('End date must be on or after the start date.'); return }
    setHolidayAdding(true); setHolidayError('')
    const { error } = await supabase.from('holidays').insert({ user_id: user.id, date: newHolidayStart, end_date: endDate, name: newHolidayName.trim() })
    setHolidayAdding(false)
    if (error) { setHolidayError(error.code === '23505' ? 'You already have a holiday starting on that date.' : error.message); return }
    setNewHolidayStart(''); setNewHolidayEnd(''); setNewHolidayName('')
    fetchHolidays()
  }

  async function deleteHoliday(id) {
    await supabase.from('holidays').delete().eq('id', id)
    setHolidays(h => h.filter(x => x.id !== id))
  }

  async function addRecurringBlock() {
    if (!newBlock.name.trim()) { setBlockError('Please enter a name for this block.'); return }
    if (newBlock.end_date && newBlock.start_date && newBlock.end_date < newBlock.start_date) { setBlockError('End date must be after start date.'); return }
    setBlockAdding(true); setBlockError('')
    const { error } = await supabase.from('recurring_blocks').insert({
      user_id: user.id, name: newBlock.name.trim(), day_of_week: newBlock.day_of_week,
      block_type: newBlock.block_type, recurrence: newBlock.recurrence,
      start_date: newBlock.start_date || null, end_date: newBlock.end_date || null,
    })
    setBlockAdding(false)
    if (error) { setBlockError(error.message); return }
    setNewBlock({ name: '', day_of_week: 'Fri', block_type: 'full', recurrence: 'weekly', start_date: '', end_date: '' })
    fetchRecurringBlocks()
  }

  async function deleteRecurringBlock(id) {
    await supabase.from('recurring_blocks').delete().eq('id', id)
    setRecurringBlocks(b => b.filter(x => x.id !== id))
  }

  const inputCls = "w-full px-3 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:text-white"
  const selectCls = inputCls

  if (loading) return <div className="p-4 pt-6 text-gray-400 dark:text-gray-500 text-sm">Loading...</div>

  return (
    <div className="p-4 pb-8 md:max-w-3xl md:mx-auto space-y-5">
      <div className="pt-2 flex items-center gap-3">
        <button onClick={() => navigate('/profile')} className="p-2 -ml-2 text-gray-400 dark:text-gray-500">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Working hours</h1>
      </div>

      {/* Working hours & capacity */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-4 space-y-4">
        <div>
          <h2 className="font-semibold text-gray-900 dark:text-white">Capacity settings</h2>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Used on the Schedule screen to calculate available slots each month.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Working days</label>
          <div className="flex gap-2 flex-wrap">
            {ALL_DAYS.map(day => (
              <button key={day} type="button" onClick={() => toggleWorkDay(day)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                  capacity.working_days.includes(day)
                    ? 'bg-green-600 text-white border-green-600'
                    : 'bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-600'
                }`}>
                {day}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Work start</label>
            <input type="time" value={capacity.work_start} onChange={e => setCapacity(c => ({ ...c, work_start: e.target.value }))} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Work end</label>
            <input type="time" value={capacity.work_end} onChange={e => setCapacity(c => ({ ...c, work_end: e.target.value }))} className={inputCls} />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">Travel time between jobs (minutes)</label>
          <input type="number" min="0" max="120" step="5" value={capacity.travel_buffer_mins}
            onChange={e => setCapacity(c => ({ ...c, travel_buffer_mins: e.target.value }))} className={inputCls} />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Typical job duration (minutes)</label>
          <div className="grid grid-cols-2 gap-3">
            {[
              { key: 'job_dur_one_off',  label: 'One-off' },
              { key: 'job_dur_weekly',   label: 'Weekly' },
              { key: 'job_dur_biweekly', label: 'Bi-weekly' },
              { key: 'job_dur_monthly',  label: 'Monthly' },
            ].map(({ key, label }) => (
              <div key={key}>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</label>
                <input type="number" min="15" max="480" step="15" value={capacity[key]}
                  onChange={e => setCapacity(c => ({ ...c, [key]: e.target.value }))} className={inputCls} />
              </div>
            ))}
          </div>
        </div>

        {capacitySaved && (
          <div className="flex items-center gap-2 bg-green-50 border border-green-100 rounded-xl p-3 text-sm text-green-700">
            <Check size={15} />Saved!
          </div>
        )}
        <button type="button" onClick={saveCapacity} disabled={capacitySaving}
          className="w-full bg-green-600 text-white font-semibold py-3 rounded-xl text-sm active:bg-green-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2">
          <Check size={16} />{capacitySaving ? 'Saving...' : 'Save capacity settings'}
        </button>
      </div>

      {/* Recurring time off */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-4 space-y-4">
        <div>
          <h2 className="font-semibold text-gray-900 dark:text-white">Recurring time off</h2>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Block out regular time — e.g. every Friday afternoon. Full-day blocks show on your schedule; partial blocks reduce capacity.</p>
        </div>

        {blockError && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl p-3 text-sm text-red-700">
            <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />{blockError}
          </div>
        )}

        <div className="space-y-2">
          <input type="text" placeholder="Name, e.g. Friday afternoons off" value={newBlock.name}
            onChange={e => { setNewBlock(b => ({ ...b, name: e.target.value })); setBlockError('') }}
            className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400" />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 ml-1">Day</label>
              <select value={newBlock.day_of_week} onChange={e => setNewBlock(b => ({ ...b, day_of_week: e.target.value }))} className={selectCls}>
                {ALL_DAYS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 ml-1">Time</label>
              <select value={newBlock.block_type} onChange={e => setNewBlock(b => ({ ...b, block_type: e.target.value }))} className={selectCls}>
                <option value="full">Full day</option>
                <option value="morning">Morning</option>
                <option value="afternoon">Afternoon</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 ml-1">Repeat</label>
              <select value={newBlock.recurrence} onChange={e => setNewBlock(b => ({ ...b, recurrence: e.target.value }))} className={selectCls}>
                <option value="weekly">Every week</option>
                <option value="fortnightly">Every 2 weeks</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 ml-1">From (optional)</label>
              <input type="date" value={newBlock.start_date} onChange={e => setNewBlock(b => ({ ...b, start_date: e.target.value }))} className={inputCls} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 ml-1">Until (optional — leave blank for indefinite)</label>
            <div className="flex gap-2">
              <input type="date" value={newBlock.end_date} min={newBlock.start_date || undefined}
                onChange={e => setNewBlock(b => ({ ...b, end_date: e.target.value }))} className="flex-1 px-3 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:text-white" />
              <button type="button" onClick={addRecurringBlock} disabled={blockAdding}
                className="bg-green-600 text-white font-semibold px-3 py-2.5 rounded-xl text-sm active:bg-green-700 disabled:opacity-60 flex items-center gap-1 flex-shrink-0">
                <Plus size={14} />Add
              </button>
            </div>
          </div>
        </div>

        {recurringBlocks.length > 0 ? (
          <div className="space-y-2">
            {recurringBlocks.map(b => (
              <div key={b.id} className="flex items-center justify-between bg-violet-50 dark:bg-violet-900/30 border border-violet-100 dark:border-violet-800 rounded-xl px-3 py-2.5">
                <div>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{b.name}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                    {b.recurrence === 'fortnightly' ? 'Every 2 weeks' : 'Every week'} · {b.day_of_week} · {b.block_type === 'full' ? 'Full day' : b.block_type === 'morning' ? 'Morning' : 'Afternoon'}
                    {b.start_date && ` · from ${new Date(b.start_date+'T12:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}`}
                    {b.end_date   && ` · until ${new Date(b.end_date  +'T12:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}`}
                  </p>
                </div>
                <button type="button" onClick={() => deleteRecurringBlock(b.id)} className="p-2 text-red-400 active:text-red-600 -mr-1 flex-shrink-0">
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-1">No recurring blocks added yet</p>
        )}
      </div>

      {/* Holidays */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-4 space-y-4">
        <div>
          <h2 className="font-semibold text-gray-900 dark:text-white">My holidays</h2>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Add your own days off — highlighted in purple on your schedule. UK bank holidays are highlighted automatically in red.</p>
        </div>

        {holidayError && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl p-3 text-sm text-red-700">
            <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />{holidayError}
          </div>
        )}

        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 ml-1">From</label>
              <input type="date" value={newHolidayStart} onChange={e => { setNewHolidayStart(e.target.value); setHolidayError('') }}
                className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 ml-1">To</label>
              <input type="date" value={newHolidayEnd} min={newHolidayStart || undefined}
                onChange={e => { setNewHolidayEnd(e.target.value); setHolidayError('') }} className={inputCls} />
            </div>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 ml-1">Leave "To" blank for a single day.</p>
          <div className="flex gap-2">
            <input type="text" placeholder="Holiday name" value={newHolidayName}
              onChange={e => { setNewHolidayName(e.target.value); setHolidayError('') }}
              className="flex-1 px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400" />
            <button type="button" onClick={addHoliday} disabled={holidayAdding}
              className="bg-green-600 text-white font-semibold px-3 py-3 rounded-xl text-sm active:bg-green-700 disabled:opacity-60 flex items-center gap-1 flex-shrink-0">
              <Plus size={14} />Add
            </button>
          </div>
        </div>

        {holidays.length > 0 ? (
          <div className="space-y-2">
            {holidays.map(h => (
              <div key={h.id} className="flex items-center justify-between bg-violet-50 dark:bg-violet-900/30 border border-violet-100 dark:border-violet-800 rounded-xl px-3 py-2.5">
                <div>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{h.name}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">{formatHolidayDates(h.date, h.end_date)}</p>
                </div>
                <button type="button" onClick={() => deleteHoliday(h.id)} className="p-2 text-red-400 active:text-red-600 -mr-1 flex-shrink-0">
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-1">No personal holidays added yet</p>
        )}
      </div>
    </div>
  )
}
