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
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchClient()
  }, [id])

  async function fetchClient() {
    const { data } = await supabase.from('clients').select('*').eq('id', id).single()
    setClient(data)
    setLoading(false)
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

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-2">
        <button className="bg-green-600 text-white font-semibold py-3 rounded-xl text-sm active:bg-green-700 transition-colors">
          Log a visit
        </button>
        <button className="bg-white border border-gray-200 text-gray-700 font-semibold py-3 rounded-xl text-sm active:bg-gray-50 transition-colors">
          Log mileage
        </button>
      </div>
    </div>
  )
}
