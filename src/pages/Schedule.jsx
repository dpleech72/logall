import { useNavigate } from 'react-router-dom'
import { Users } from 'lucide-react'

export default function Schedule() {
  const navigate = useNavigate()
  return (
    <div className="p-4">
      <div className="pt-2 flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Schedule</h1>
          <p className="text-gray-500 text-sm">Your jobs this week</p>
        </div>
        <button
          onClick={() => navigate('/clients')}
          className="flex items-center gap-1.5 bg-green-600 text-white font-semibold px-4 py-2.5 rounded-xl text-sm active:bg-green-700 transition-colors shadow-sm"
        >
          <Users size={15} />
          Clients
        </button>
      </div>
      <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex flex-col items-center justify-center text-center gap-3">
        <div className="text-4xl">📅</div>
        <p className="font-semibold text-gray-700">No jobs yet</p>
        <p className="text-gray-400 text-sm">Add your first client to get started</p>
        <button
          onClick={() => navigate('/clients/add')}
          className="mt-2 bg-green-600 text-white font-semibold px-6 py-2.5 rounded-xl active:bg-green-700 transition-colors text-sm"
        >
          Add a client
        </button>
      </div>
    </div>
  )
}
