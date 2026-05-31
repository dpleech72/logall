export default function Expenses() {
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold text-gray-900 pt-2 mb-1">Expenses</h1>
      <p className="text-gray-500 text-sm mb-6">Things you buy for work</p>
      <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex flex-col items-center justify-center text-center gap-3">
        <div className="text-4xl">🧾</div>
        <p className="font-semibold text-gray-700">No expenses logged yet</p>
        <p className="text-gray-400 text-sm">Cleaning products, equipment, insurance — it all counts</p>
        <button className="mt-2 bg-green-600 text-white font-semibold px-6 py-2.5 rounded-xl active:bg-green-700 transition-colors">
          Log an expense
        </button>
      </div>
    </div>
  )
}
