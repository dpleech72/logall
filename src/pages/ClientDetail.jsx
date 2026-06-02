import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ArrowLeft, Pencil, Phone, Mail, MapPin, CreditCard, FileText } from 'lucide-react'

const paymentLabel = {
  cash: 'Cash',
  bank_transfer: 'Bank transfer',
  cheque: 'Cheque',
}

export default function ClientDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [client, setClient] = useState(null)
  const [visits, setVisits] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchClient()
    fetchVisits()
  }, [id])

  async function fetchClient() {
    const { data } = await supabase.from('clients').select('*').eq('id', id).single()
    setClient(data)
    setLoading(false)
  }

  async function fetchVisits() {
    const now = new Date()
    const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`
    const { data } = await supabase
      .from('visits')
      .select('*')
      .eq('client_id', id)
      .gte('scheduled_date', today)
      .neq('status', 'cancelled')
      .order('scheduled_date')
      .limit(10)
    setVisits(data || [])
  }

  if (loading) {
    return <div className="p-4 pt-6 text-gray-400 text-sm">Loading...</div>
  }

  if (!client) {
    return <div className="p-4 pt-6 text-gray-400 text-sm">Client not found.</div>
  }

  return (
    <div className="p-4">
      {/* Header */}
      <div className="pt-2 flex items-center justify-between mb-6">
        <button onClick={() => navigate('/clients')} className="p-2 -ml-2 text-gray-400">
          <ArrowLeft size={20} />
        </button>
        <button
          onClick={() => navigate(`/clients/${id}/edit`)}
          className="flex items-center gap-1.5 text-green-600 font-semibold text-sm"
        >
          <Pencil size={15} />
          Edit
        </button>
      </div>

      {/* Avatar and name */}
      <div className="flex items-center gap-4 mb-6">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-bold text-2xl flex-shrink-0"
          style={{ backgroundColor: client.colour || '#16a34a' }}
        >
          {client.name.charAt(0).toUpperCase()}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{client.name}</h1>
          {client.hourly_rate && (
            <p className="text-gray-500 text-sm">£{client.hourly_rate}/hr</p>
          )}
        </div>
      </div>

      {/* Details card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50 mb-4">
        {client.mobile && (
          <div className="flex items-center gap-3 p-4">
            <Phone size={16} className="text-gray-400 flex-shrink-0" />
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Mobile</p>
              <a href={`tel:${client.mobile}`} className="text-sm font-medium text-green-600">{client.mobile}</a>
            </div>
          </div>
        )}
        {client.home_phone && (
          <div className="flex items-center gap-3 p-4">
            <Phone size={16} className="text-gray-400 flex-shrink-0" />
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Home phone</p>
              <a href={`tel:${client.home_phone}`} className="text-sm font-medium text-green-600">{client.home_phone}</a>
            </div>
          </div>
        )}
        {client.email && (
          <div className="flex items-center gap-3 p-4">
            <Mail size={16} className="text-gray-400 flex-shrink-0" />
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Email</p>
              <a href={`mailto:${client.email}`} className="text-sm font-medium text-green-600">{client.email}</a>
            </div>
          </div>
        )}
        {(client.address || client.postcode) && (
          <div className="flex items-center gap-3 p-4">
            <MapPin size={16} className="text-gray-400 flex-shrink-0" />
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Address</p>
              <p className="text-sm font-medium text-gray-900">
                {[client.address, client.postcode].filter(Boolean).join(', ')}
              </p>
            </div>
          </div>
        )}
        <div className="flex items-center gap-3 p-4">
          <CreditCard size={16} className="text-gray-400 flex-shrink-0" />
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Payment method</p>
            <p className="text-sm font-medium text-gray-900">{paymentLabel[client.payment_method]}</p>
          </div>
        </div>
        {client.notes && (
          <div className="flex items-start gap-3 p-4">
            <FileText size={16} className="text-gray-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Notes</p>
              <p className="text-sm text-gray-700 leading-relaxed">{client.notes}</p>
            </div>
          </div>
        )}
      </div>

      {/* Upcoming visits */}
      {visits.length > 0 && (
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Upcoming jobs</h2>
          <div className="space-y-2">
            {visits.map(visit => (
              <div key={visit.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    {new Date(visit.scheduled_date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                    {visit.scheduled_time && ` · ${visit.scheduled_time.slice(0,5)}`}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {visit.duration_minutes && (
                      <span className="text-xs text-gray-400">
                        {visit.duration_minutes >= 60 ? `${Math.floor(visit.duration_minutes/60)}${visit.duration_minutes%60 ? `.${visit.duration_minutes%60}` : ''}hr` : `${visit.duration_minutes}m`}
                      </span>
                    )}
                    {visit.recurrence_rule && visit.recurrence_rule !== 'none' && (
                      <span className="text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full">
                        {visit.recurrence_rule === 'weekly' ? 'Weekly' : visit.recurrence_rule === 'biweekly' ? 'Bi-weekly' : 'Monthly'}
                      </span>
                    )}
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                      visit.status === 'done_paid' ? 'bg-green-50 text-green-700' :
                      visit.status === 'awaiting_payment' ? 'bg-amber-50 text-amber-700' :
                      'bg-blue-50 text-blue-700'
                    }`}>
                      {visit.status === 'done_paid' ? 'Paid' : visit.status === 'awaiting_payment' ? 'Awaiting payment' : 'Scheduled'}
                    </span>
                  </div>
                </div>
                {visit.amount && (
                  <p className="font-bold text-green-600 text-sm">£{parseFloat(visit.amount).toFixed(2)}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => navigate(`/schedule/add?client_id=${client.id}`)}
          className="bg-green-600 text-white font-semibold py-3 rounded-xl text-sm active:bg-green-700 transition-colors"
        >
          Log a visit
        </button>
        <button
          onClick={() => navigate(`/mileage?client_id=${client.id}`)}
          className="bg-white border border-gray-200 text-gray-700 font-semibold py-3 rounded-xl text-sm active:bg-gray-50 transition-colors"
        >
          Log mileage
        </button>
      </div>
    </div>
  )
}
