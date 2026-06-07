import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Plus, ChevronRight, Phone, ArrowLeft, Trash2, CheckSquare, Square } from 'lucide-react'

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
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState(new Set())
  const [confirmDelete, setConfirmDelete] = useState(false)
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

  async function bulkDelete() {
    for (const id of selected) {
      await supabase.from('clients').update({ is_active: false }).eq('id', id)
    }
    setSelected(new Set())
    setSelecting(false)
    setConfirmDelete(false)
    fetchClients()
  }

  if (loading) {
    return (
      <div className="p-4 space-y-3 pt-6">
        {[1,2,3].map(i => (
          <div key={i} className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700 animate-pulse">
            <div className="h-4 bg-gray-100 dark:bg-gray-700 rounded w-1/3 mb-2" />
            <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded w-1/2" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="p-4 md:max-w-3xl md:mx-auto lg:max-w-4xl lg:p-8">
      {/* Header */}
      <div className="pt-2 flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-gray-400 dark:text-gray-500 active:text-gray-600 dark:text-gray-300">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Clients</h1>
            <p className="text-gray-500 dark:text-gray-400 dark:text-gray-500 text-sm mt-0.5">
              {selecting
                ? `${selected.size} selected`
                : `${clients.length} ${clients.length === 1 ? 'client' : 'clients'}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {selecting ? (
            <>
              {selected.size > 0 && (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="flex items-center gap-1.5 bg-red-600 text-white font-semibold px-4 py-2.5 rounded-xl text-sm active:bg-red-700 transition-colors"
                >
                  <Trash2 size={16} />
                  Delete {selected.size}
                </button>
              )}
              <button
                onClick={() => { setSelecting(false); setSelected(new Set()) }}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 active:bg-gray-50"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setSelecting(true)}
                className="flex items-center gap-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 font-semibold px-4 py-2.5 rounded-xl text-sm active:bg-gray-50 transition-colors"
              >
                <CheckSquare size={16} />
                Select
              </button>
              <button
                onClick={() => navigate('/clients/add')}
                className="flex items-center gap-1.5 bg-green-600 text-white font-semibold px-4 py-2.5 rounded-xl text-sm active:bg-green-700 transition-colors"
              >
                <Plus size={16} />
                Add
              </button>
            </>
          )}
        </div>
      </div>

      {/* Empty state */}
      {clients.length === 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col items-center text-center gap-3">
          <div className="text-4xl">👤</div>
          <p className="font-semibold text-gray-700 dark:text-gray-200">No clients yet</p>
          <p className="text-gray-400 dark:text-gray-500 text-sm">Add your first client to get started</p>
          <button
            onClick={() => navigate('/clients/add')}
            className="mt-2 bg-green-600 text-white font-semibold px-6 py-2.5 rounded-xl active:bg-green-700 transition-colors text-sm"
          >
            Add a client
          </button>
        </div>
      )}

      {/* Client list */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {clients.map(client => (
          <button
            key={client.id}
            onClick={() => {
              if (selecting) {
                const next = new Set(selected)
                next.has(client.id) ? next.delete(client.id) : next.add(client.id)
                setSelected(next)
              } else {
                navigate(`/clients/${client.id}`)
              }
            }}
            className={`w-full bg-white dark:bg-gray-800 rounded-2xl p-4 border shadow-sm text-left transition-colors flex items-center gap-3 ${
              selected.has(client.id) ? 'border-red-300 bg-red-50' : 'border-gray-100 dark:border-gray-700 active:bg-gray-50'
            }`}
          >
            {selecting ? (
              <div className="w-11 h-11 flex items-center justify-center flex-shrink-0">
                {selected.has(client.id)
                  ? <CheckSquare size={24} className="text-red-500" />
                  : <Square size={24} className="text-gray-300" />
                }
              </div>
            ) : (
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 text-white font-bold text-lg"
                style={{ backgroundColor: client.colour || '#16a34a' }}
              >
                {client.name.charAt(0).toUpperCase()}
              </div>
            )}

            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 dark:text-white">{client.name}</p>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                {client.mobile && (
                  <span className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
                    <Phone size={11} />
                    {client.mobile}
                  </span>
                )}
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${paymentColour[client.payment_method]}`}>
                  {paymentLabel[client.payment_method]}
                </span>
                {client.hourly_rate && (
                  <span className="text-xs text-gray-400 dark:text-gray-500">£{client.hourly_rate}/hr</span>
                )}
              </div>
            </div>

            {!selecting && <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />}
          </button>
        ))}
      </div>

      {/* Confirm delete modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 w-full max-w-sm">
            <p className="font-semibold text-gray-900 dark:text-white mb-1">Delete {selected.size} client{selected.size > 1 ? 's' : ''}?</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 mb-4">Their history will be kept but they'll be removed from your client list.</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(false)} className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-600 dark:text-gray-300">Cancel</button>
              <button onClick={bulkDelete} className="flex-1 py-3 rounded-xl bg-red-600 text-white text-sm font-medium">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
