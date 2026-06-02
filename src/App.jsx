import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './hooks/useAuth'
import ProtectedRoute from './components/ui/ProtectedRoute'
import BottomNav from './components/layout/BottomNav'

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
import Profile from './pages/Profile'
import BulkVisits from './pages/BulkVisits'
import Outstanding from './pages/Outstanding'

function AppShell() {
  return (
    <div className="flex flex-col h-full">
      <main className="flex-1 overflow-y-auto pb-safe">
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
        </Routes>
      </main>
      <BottomNav />
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/sign-in" element={<SignIn />} />
          <Route path="/sign-up" element={<SignUp />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
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
