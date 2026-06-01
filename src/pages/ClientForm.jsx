import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ArrowLeft, Trash2, AlertCircle } from 'lucide-react'

const COLOURS = [
  '#16a34a', '#2563eb', '#7c3aed', '#db2777',
  '#ea580c', '#0891b2', '#ca8a04', '#dc2626',
]

const Field = ({ label, children }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
    {children}
  </div>
)

const Input = ({ ...props }) => (
  <input
    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
    {...props}
  />
)

export default function ClientForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEditing = Boolean(id)

  const [form, setForm] = useState({
    name: '',
    mobile: '',
    home_phone: '',
    email: '',
    address: '',
    postcode: '',
    payment_method: 'cash',
    hourly_rate: '',
    notes: '',
    colour: '#16a34a',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showDelete, setShowDelete] = useState(false)

  useEffect(() => {
    if (isEditing) fetchClient()
  }, [id])

  async function fetchClient() {
    const { data } = await supabase.from('clients').select('*').eq('id', id).single()
    if (data) {
      setForm({
        name: data.name || '',
        mobile: data.mobile || '',
        home_phone: data.home_phone || '',
        email: data.email || '',
        address: data.address || '',
        postcode: data.postcode || '',
        payment_method: data.payment_method || 'cash',
        hourly_rate: data.hourly_rate || '',
        notes: data.notes || '',
        colour: data.colour || '#16a34a',
      })
    }
  }

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }))

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!form.name.trim()) {
      setError('Please enter a client name.')
      return
    }

    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()

    const payload = {
      ...form,
      user_id: user.id,
      hourly_rate: form.hourly_rate ? parseFloat(form.hourly_rate) : null,
    }

    const { error } = isEditing
      ? await supabase.from('clients').update(payload).eq('id', id)
      : await supabase.from('clients').insert(payload)

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      navigate('/clients')
    }
  }

  async function handleDelete() {
    setLoading(true)
    await supabase.from('clients').update({ is_active: false }).eq('id', id)
    navigate('/clients')
  }

  return (
    <div className="p-4">
      {/* Header */}
      <div className="pt-2 flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/clients')} className="p-2 -ml-2 text-gray-400 active:text-gray-600">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-gray-900">
          {isEditing ? 'Edit client' : 'Add a client'}
        </h1>
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl p-3 mb-4 text-sm text-red-700">
          <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Colour picker */}
        <Field label="Colour">
          <div className="flex gap-2 flex-wrap">
            {COLOURS.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setForm(f => ({ ...f, colour: c }))}
                className="w-8 h-8 rounded-lg transition-transform active:scale-90"
                style={{
                  backgroundColor: c,
                  outline: form.colour === c ? `3px solid ${c}` : 'none',
                  outlineOffset: '2px',
                }}
              />
            ))}
          </div>
        </Field>

        <Field label="Full name *">
          <Input
            type="text"
            placeholder="e.g. Mrs Johnson"
            value={form.name}
            onChange={set('name')}
            required
          />
        </Field>

        <Field label="Mobile number">
          <Input
            type="tel"
            placeholder="e.g. 07700 900123"
            value={form.mobile}
            onChange={set('mobile')}
          />
        </Field>

        <Field label="Home phone (optional)">
          <Input
            type="tel"
            placeholder="e.g. 01234 567890"
            value={form.home_phone}
            onChange={set('home_phone')}
          />
        </Field>

        <Field label="Email address">
          <Input
            type="email"
            placeholder="e.g. mrsjohnson@email.com"
            value={form.email}
            onChange={set('email')}
          />
        </Field>

        <Field label="Address">
          <Input
            type="text"
            placeholder="e.g. 12 Oak Street"
            value={form.address}
            onChange={set('address')}
          />
        </Field>

        <Field label="Postcode">
          <Input
            type="text"
            placeholder="e.g. CV11 4AB"
            value={form.postcode}
            onChange={set('postcode')}
          />
        </Field>

        <Field label="How do they pay?">
          <div className="grid grid-cols-3 gap-2">
            {[
              { value: 'cash', label: '💵 Cash' },
              { value: 'bank_transfer', label: '🏦 Bank transfer' },
              { value: 'cheque', label: '📝 Cheque' },
            ].map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setForm(f => ({ ...f, payment_method: opt.value }))}
                className={`py-2.5 px-2 rounded-xl text-xs font-semibold border-2 transition-colors text-center ${
                  form.payment_method === opt.value
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : 'border-gray-200 text-gray-600'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Hourly rate (optional)">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">£</span>
            <input
              type="number"
              step="0.50"
              min="0"
              placeholder="0.00"
              value={form.hourly_rate}
              onChange={set('hourly_rate')}
              className="w-full pl-7 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>
        </Field>

        <Field label="Notes (optional)">
          <textarea
            placeholder="e.g. Has a dog, key under mat, prefers morning visits"
            value={form.notes}
            onChange={set('notes')}
            rows={3}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
          />
        </Field>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-green-600 text-white font-semibold py-3.5 rounded-xl text-sm active:bg-green-700 disabled:opacity-60 transition-colors"
        >
          {loading ? 'Saving...' : isEditing ? 'Save changes' : 'Add client'}
        </button>
      </form>

      {/* Delete */}
      {isEditing && (
        <div className="mt-6 pt-6 border-t border-gray-100">
          {!showDelete ? (
            <button
              onClick={() => setShowDelete(true)}
              className="flex items-center gap-2 text-red-500 text-sm font-medium mx-auto"
            >
              <Trash2 size={15} />
              Remove this client
            </button>
          ) : (
            <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-center">
              <p className="text-sm text-red-700 font-medium mb-3">Remove {form.name}?</p>
              <p className="text-xs text-red-500 mb-4">They'll be hidden but their history will be kept.</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowDelete(false)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-medium"
                >
                  Remove
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
