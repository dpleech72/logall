import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import BottomNav from './components/layout/BottomNav'
import Dashboard from './pages/Dashboard'
import Schedule from './pages/Schedule'
import Income from './pages/Income'
import Mileage from './pages/Mileage'
import Expenses from './pages/Expenses'

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex flex-col h-full">
        {/* Page content — scrollable, padded above bottom nav */}
        <main className="flex-1 overflow-y-auto pb-safe">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/schedule" element={<Schedule />} />
            <Route path="/income" element={<Income />} />
            <Route path="/mileage" element={<Mileage />} />
            <Route path="/expenses" element={<Expenses />} />
          </Routes>
        </main>

        {/* Fixed bottom navigation */}
        <BottomNav />
      </div>
    </BrowserRouter>
  )
}
