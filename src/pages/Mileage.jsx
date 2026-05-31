export default function Mileage() {
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold text-gray-900 pt-2 mb-1">Mileage</h1>
      <p className="text-gray-500 text-sm mb-6">55p/mile — HMRC approved rate</p>
      <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex flex-col items-center justify-center text-center gap-3">
        <div className="text-4xl">🚗</div>
        <p className="font-semibold text-gray-700">No journeys logged yet</p>
        <p className="text-gray-400 text-sm">Every mile you drive for work is tax deductible</p>
        <button className="mt-2 bg-green-600 text-white font-semibold px-6 py-2.5 rounded-xl active:bg-green-700 transition-colors">
          Log a journey
        </button>
      </div>
    </div>
  )
}
