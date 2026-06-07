import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './hooks/useAuth'
import { useDarkMode } from './hooks/useDarkMode'
import ProtectedRoute from './components/ui/ProtectedRoute'
import BottomNav from './components/layout/BottomNav'
import Sidebar from './components/layout/Sidebar'
import InstallPrompt from './components/ui/InstallPrompt'

import SignIn from './pages/auth/SignIn'
import SignUp from './pages/auth/SignUp'
import ForgotPassword from './pages/auth/ForgotPassword'

import Dashboard from './pages/Dashboard'
import Schedule from './pages/Schedule'
import Income from './pages/Income'
import Mileage from './pages/Mileage'
import Expenses from './pages/Expenses'
import Clients from './pages/Clients'
import ClientForm from './pages/ClientForm'
import ClientDetail from './pages/ClientDetail'
import VisitForm from './pages/VisitForm'
import VisitEditForm from './pages/VisitEditForm'
import TaxSummary from './pages/TaxSummary'
import TaxReport from './pages/TaxReport'
import Profile from './pages/Profile'
import BulkVisits from './pages/BulkVisits'
import Outstanding from './pages/Outstanding'
import Help from './pages/Help'

function AppShell() {
  return (
    <div className="flex h-full">
      {/* Sidebar — desktop only */}
      <Sidebar />

      {/* Main content */}
      <div className="flex flex-col flex-1 min-w-0">
        <main className="flex-1 overflow-y-auto pb-16 lg:pb-0">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/schedule" element={<Schedule />} />
            <Route path="/schedule/add" element={<VisitForm />} />
            <Route path="/schedule/:id/edit" element={<VisitEditForm />} />
            <Route path="/income" element={<Income />} />
            <Route path="/mileage" element={<Mileage />} />
            <Route path="/expenses" element={<Expenses />} />
            <Route path="/clients" element={<Clients />} />
            <Route path="/clients/add" element={<ClientForm />} />
            <Route path="/clients/:id" element={<ClientDetail />} />
            <Route path="/clients/:id/edit" element={<ClientForm />} />
            <Route path="/tax" element={<TaxSummary />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/schedule/bulk" element={<BulkVisits />} />
            <Route path="/outstanding" element={<Outstanding />} />
            <Route path="/help" element={<Help />} />
          </Routes>
        </main>
        <InstallPrompt />
        <BottomNav />
      </div>
    </div>
  )
}

export default function App() {
  useDarkMode() // applies dark class to <html> and persists preference

  useEffect(() => {
    // Reload when a new service worker takes control — picks up fresh deploys
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.location.reload()
      })
    }

    // Reload if the app has been in the background for 10+ minutes —
    // catches stale sessions when tapping the home screen icon
    let hiddenAt = null
    const onVisibility = () => {
      if (document.hidden) {
        hiddenAt = Date.now()
      } else if (hiddenAt && Date.now() - hiddenAt > 10 * 60 * 1000) {
        window.location.reload()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/sign-in" element={<SignIn />} />
          <Route path="/sign-up" element={<SignUp />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          {/* Tax report is outside AppShell so it prints without the bottom nav */}
          <Route
            path="/tax/report"
            element={
              <ProtectedRoute>
                <TaxReport />
              </ProtectedRoute>
            }
          />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <AppShell />
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
