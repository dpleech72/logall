import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ArrowLeft, MessageCircle, Phone, CheckCircle, PoundSterling, X } from 'lucide-react'

function daysSince(dateStr) {
  const d = new Date(dateStr + 'T12:00:00')
  const now = new Date()
  return Math.floor((now - d) / (1000 * 60 * 60 * 24))
}

function urgencyColour(days) {
  if (days <= 7) return 'bg-amber-50 border-amber-200 text-amber-700'
  if (days <= 14) return 'bg-orange-50 border-orange-200 text-orange-700'
  return 'bg-red-50 border-red-200 text-red-700'
}

function ReminderSheet({ visit, client, onClose, onMarkPaid }) {
  const days = daysSince(visit.scheduled_date)
  const amount = visit.amount ? `£${parseFloat(visit.amount).toFixed(2)}` : 'the payment'
  const dateStr = new Date(visit.scheduled_date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })

  const message = `Hi ${client.name.split(' ')[0]}, just a friendly reminder that ${amount} is due for your visit on ${dateStr}. Thank you! 😊`

  const whatsappUrl = client.mobile
    ? `https://wa.me/44${client.mobile.replace(/^0/, '').replace(/\s/g, '')}?text=${encodeURIComponent(message)}`
    : null

  const smsUrl = client.mobile
    ? `sms:${client.mobile}?body=${encodeURIComponent(message)}`
    : null

  const homeUrl = client.home_phone
    ? `sms:${client.home_phone}?body=${encodeURIComponent(message)}`
    : null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6">
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 w-full max-w-sm">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Send reminder</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 mb-4">{client.name} · {days} days overdue</p>

        {/* Message preview */}
        <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-3 mb-4 text-sm text-gray-700 dark:text-gray-200 leading-relaxed border border-gray-100 dark:border-gray-700">
          {message}
        </div>

        <div className="space-y-2 mb-4">
          {whatsappUrl && (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 w-full bg-green-500 text-white font-semibold py-3 px-4 rounded-xl text-sm active:bg-green-600 transition-colors"
              onClick={onClose}
            >
              <MessageCircle size={18} />
              Send via WhatsApp
            </a>
          )}
          {smsUrl && (
            <a
              href={smsUrl}
              className="flex items-center gap-3 w-full bg-blue-500 text-white font-semibold py-3 px-4 rounded-xl text-sm active:bg-blue-600 transition-colors"
              onClick={onClose}
            >
              <Phone size={18} />
              Send via text message{client.mobile ? ` (${client.mobile})` : ''}
            </a>
          )}
          {homeUrl && (
            <a
              href={homeUrl}
              className="flex items-center gap-3 w-full bg-purple-500 text-white font-semibold py-3 px-4 rounded-xl text-sm active:bg-purple-600 transition-colors"
              onClick={onClose}
            >
              <Phone size={18} />
              Send via text message (home)
            </a>
          )}
          {!client.mobile && !client.home_phone && (
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-700 flex items-center justify-between gap-2">
              <span>No phone number saved for {client.name}.</span>
              <a
                href={`/clients/${client.id}/edit`}
                className="font-semibold underline whitespace-nowrap"
                onClick={onClose}
              >
                Add one →
              </a>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-600 dark:text-gray-300 active:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={onMarkPaid}
            className="flex-1 py-3 rounded-xl bg-green-600 text-white text-sm font-semibold active:bg-green-700 flex items-center justify-center gap-1.5"
          >
            <CheckCircle size={15} />
            Mark paid
          </button>
        </div>
      </div>
    </div>
  )
}

function RemindAllSheet({ visits, clientMap, onClose, onMarkPaid }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40">
      <div className="bg-white dark:bg-gray-800 rounded-t-3xl p-5 pb-24 max-h-[90vh] overflow-y-auto">
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Remind all</h2>
            <p className="text-sm text-gray-400 dark:text-gray-500">{visits.length} outstanding payment{visits.length > 1 ? 's' : ''}</p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 dark:text-gray-500"><X size={20} /></button>
        </div>
        <div className="space-y-3">
          {visits.map(visit => {
            const client = clientMap[visit.client_id]
            if (!client) return null
            const days = daysSince(visit.scheduled_date)
            const amount = visit.amount ? `£${parseFloat(visit.amount).toFixed(2)}` : 'the payment'
            const dateStr = new Date(visit.scheduled_date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })
            const message = `Hi ${client.name.split(' ')[0]}, just a friendly reminder that ${amount} is due for your visit on ${dateStr}. Thank you! 😊`
            const whatsappUrl = client.mobile
              ? `https://wa.me/44${client.mobile.replace(/^0/, '').replace(/\s/g, '')}?text=${encodeURIComponent(message)}`
              : null
            const smsUrl = client.mobile ? `sms:${client.mobile}?body=${encodeURIComponent(message)}` : null

            return (
              <div key={visit.id} className="bg-gray-50 dark:bg-gray-900 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                      style={{ backgroundColor: client.colour || '#16a34a' }}
                    >
                      {client.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white text-sm">{client.name}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">{days === 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`} · {visit.amount ? `£${parseFloat(visit.amount).toFixed(2)}` : 'no amount'}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => onMarkPaid(visit)}
                    className="text-xs font-semibold text-green-600 bg-green-50 px-2.5 py-1.5 rounded-lg active:bg-green-100 flex items-center gap-1"
                  >
                    <CheckCircle size={12} />
                    Paid
                  </button>
                </div>
                <div className="flex gap-2">
                  {whatsappUrl ? (
                    <a
                      href={whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-1.5 bg-green-500 text-white font-semibold py-2.5 rounded-xl text-xs active:bg-green-600"
                    >
                      <MessageCircle size={13} />
                      WhatsApp
                    </a>
                  ) : smsUrl ? (
                    <a
                      href={smsUrl}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-blue-500 text-white font-semibold py-2.5 rounded-xl text-xs active:bg-blue-600"
                    >
                      <Phone size={13} />
                      SMS
                    </a>
                  ) : (
                    <p className="flex-1 text-center text-xs text-gray-400 dark:text-gray-500 py-2.5">No phone number saved</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default function Outstanding() {
  const navigate = useNavigate()
  const [visits, setVisits] = useState([])
  const [clientMap, setClientMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [showRemindAll, setShowRemindAll] = useState(false)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    const [{ data: visitData }, { data: clientData }] = await Promise.all([
      supabase
        .from('visits')
        .select('*')
        .eq('status', 'awaiting_payment')
        .order('scheduled_date'),
      supabase
        .from('clients')
        .select('id, name, colour, mobile, home_phone')
        .eq('is_active', true),
    ])

    setVisits(visitData || [])
    const map = {}
    ;(clientData || []).forEach(c => { map[c.id] = c })
    setClientMap(map)
    setLoading(false)
  }

  async function markPaid(visit) {
    await supabase.from('visits').update({ status: 'done_paid' }).eq('id', visit.id)

    // Log income if amount set
    if (visit.amount) {
      const { data: { user } } = await supabase.auth.getUser()
      const client = clientMap[visit.client_id]
      await supabase.from('income').insert({
        user_id: user.id,
        client_id: visit.client_id,
        visit_id: visit.id,
        amount: visit.amount,
        payment_method: visit.payment_method || 'cash',
        received_date: visit.scheduled_date,
        description: `Payment — ${client?.name || 'Client'}`,
      })
    }

    setSelected(null)
    fetchData()
  }

  const total = visits.reduce((sum, v) => sum + parseFloat(v.amount || 0), 0)

  return (
    <div className="p-4">
      {/* Header */}
      <div className="pt-2 flex items-center gap-3 mb-4">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-gray-400 dark:text-gray-500">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Outstanding payments</h1>
          <p className="text-gray-500 dark:text-gray-400 dark:text-gray-500 text-sm mt-0.5">Clients who still owe you money</p>
        </div>
        {visits.length > 1 && (
          <button
            onClick={() => setShowRemindAll(true)}
            className="flex items-center gap-1.5 bg-green-600 text-white font-semibold px-3 py-2 rounded-xl text-sm active:bg-green-700 flex-shrink-0"
          >
            <MessageCircle size={14} />
            Remind all
          </button>
        )}
      </div>

      {/* Total */}
      {!loading && visits.length > 0 && (
        <div className="bg-amber-500 rounded-2xl p-4 mb-4 text-white">
          <p className="text-amber-100 text-xs font-medium mb-1">Total outstanding</p>
          <p className="text-3xl font-bold">£{total.toFixed(2)}</p>
          <p className="text-amber-100 text-xs mt-1">{visits.length} unpaid visit{visits.length > 1 ? 's' : ''}</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && visits.length === 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col items-center text-center gap-3">
          <div className="text-4xl">🎉</div>
          <p className="font-semibold text-gray-700 dark:text-gray-200">All paid up!</p>
          <p className="text-gray-400 dark:text-gray-500 text-sm">No outstanding payments at the moment</p>
        </div>
      )}

      {/* Outstanding visits */}
      <div className="space-y-3">
        {visits.map(visit => {
          const client = clientMap[visit.client_id]
          const days = daysSince(visit.scheduled_date)
          const colourClass = urgencyColour(days)

          return (
            <div key={visit.id} className={`rounded-2xl border p-4 ${colourClass}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                    style={{ backgroundColor: client?.colour || '#16a34a' }}
                  >
                    {client?.name?.charAt(0) || '?'}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">{client?.name || 'Unknown'}</p>
                    <p className="text-xs mt-0.5 opacity-70">
                      {new Date(visit.scheduled_date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      {' · '}
                      {days === 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`}
                    </p>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  {visit.amount && (
                    <p className="font-bold text-gray-900 dark:text-white">£{parseFloat(visit.amount).toFixed(2)}</p>
                  )}
                </div>
              </div>

              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => setSelected(visit)}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-white dark:bg-gray-800 border border-current font-semibold py-2.5 rounded-xl text-xs active:opacity-80 transition-colors"
                >
                  <MessageCircle size={14} />
                  Send reminder
                </button>
                <button
                  onClick={() => markPaid(visit)}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-white dark:bg-gray-800 border border-current font-semibold py-2.5 rounded-xl text-xs active:opacity-80 transition-colors"
                >
                  <CheckCircle size={14} />
                  Mark paid
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {selected && (
        <ReminderSheet
          visit={selected}
          client={clientMap[selected.client_id]}
          onClose={() => setSelected(null)}
          onMarkPaid={() => markPaid(selected)}
        />
      )}

      {showRemindAll && (
        <RemindAllSheet
          visits={visits}
          clientMap={clientMap}
          onClose={() => setShowRemindAll(false)}
          onMarkPaid={(visit) => { markPaid(visit); if (visits.length <= 1) setShowRemindAll(false) }}
        />
      )}
    </div>
  )
}
