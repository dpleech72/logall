import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Plus, ChevronRight, Phone, CreditCard, User } from 'lucide-react'

const paymentLabel = {
  cash: 'Cash',
  bank_transfer: 'Bank transfer',
  cheque: 'Cheque',
}

const paymentColour = {
  cash: 'bg-green-50 text-green-700',
  bank_transfer: 'bg-blue-50 text-blue-700',
  cheque: 'bg-purple-50 text-purple-700',
}

export default function Clients() {
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    fetchClients()
  }, [])

  async function fetchClients() {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('is_active', true)
      .order('name')

    if (!error) setClients(data)
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="p-4 space-y-3 pt-6">
        {[1,2,3].map(i => (
          <div key={i} className="bg-white rounded-2xl p-4 border border-gray-100 animate-pulse">
            <div className="h-4 bg-gray-100 rounded w-1/3 mb-2" />
            <div className="h-3 bg-gray-100 rounded w-1/2" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="p-4">
      {/* Header */}
      <div className="pt-2 flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {clients.length} {clients.length === 1 ? 'client' : 'clients'}
          </p>
        </div>
        <button
          onClick={() => navigate('/clients/add')}
          className="flex items-center gap-1.5 bg-green-600 text-white font-semibold px-4 py-2.5 rounded-xl text-sm active:bg-green-700 transition-colors"
        >
          <Plus size={16} />
          Add
        </button>
      </div>

      {/* Empty state */}
      {clients.length === 0 && (
        <div className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm flex flex-col items-center text-center gap-3">
          <div className="text-4xl">👤</div>
          <p className="font-semibold text-gray-700">No clients yet</p>
          <p className="text-gray-400 text-sm">Add your first client to get started</p>
          <button
            onClick={() => navigate('/clients/add')}
            className="mt-2 bg-green-600 text-white font-semibold px-6 py-2.5 rounded-xl text-sm active:bg-green-700 transition-colors"
          >
            Add a client
          </button>
        </div>
      )}

      {/* Client list */}
      <div className="space-y-2">
        {clients.map(client => (
          <button
            key={client.id}
            onClick={() => navigate(`/clients/${client.id}`)}
            className="w-full bg-white rounded-2xl p-4 border border-gray-100 shadow-sm text-left active:bg-gray-50 transition-colors flex items-center gap-3"
          >
            {/* Avatar */}
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 text-white font-bold text-lg"
              style={{ backgroundColor: client.colour || '#16a34a' }}
            >
              {client.name.charAt(0).toUpperCase()}
            </div>

            {/* Details */}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900">{client.name}</p>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                {client.phone && (
                  <span className="flex items-center gap-1 text-xs text-gray-400">
                    <Phone size={11} />
                    {client.phone}
                  </span>
                )}
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${paymentColour[client.payment_method]}`}>
                  {paymentLabel[client.payment_method]}
                </span>
                {client.hourly_rate && (
                  <span className="text-xs text-gray-400">£{client.hourly_rate}/hr</span>
                )}
              </div>
            </div>

            <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
          </button>
        ))}
      </div>
    </div>
  )
}
