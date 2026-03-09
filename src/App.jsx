import { Navigate, Route, Routes } from 'react-router-dom'
import AuthBootstrap from './components/AuthBootstrap'
import ProtectedRoute from './components/ProtectedRoute'
import Dashboard from './pages/Dashboard'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Projects from './pages/Projects'
import Credits from './pages/Credits'
import PaymentCallback from './pages/PaymentCallback'
import CreativeProfile from './pages/CreativeProfile'
import Templates from './pages/Templates'
import Billing from './pages/Billing'

function App() {
  return (
    <>
      <AuthBootstrap />
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/projects"
          element={
            <ProtectedRoute allowedRoles={['client', 'creative', 'admin', 'super_admin']}>
              <Projects />
            </ProtectedRoute>
          }
        />
        <Route
          path="/credits"
          element={
            <ProtectedRoute allowedRoles={['client', 'admin', 'super_admin']}>
              <Credits />
            </ProtectedRoute>
          }
        />
        <Route
          path="/payment/callback"
          element={
            <ProtectedRoute allowedRoles={['client', 'admin', 'super_admin']}>
              <PaymentCallback />
            </ProtectedRoute>
          }
        />
        <Route
          path="/creative/profile"
          element={
            <ProtectedRoute allowedRoles={['creative']}>
              <CreativeProfile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/templates"
          element={
            <ProtectedRoute allowedRoles={['client']}>
              <Templates />
            </ProtectedRoute>
          }
        />
        <Route
          path="/billing"
          element={
            <ProtectedRoute allowedRoles={['client']}>
              <Billing />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </>
  )
}

export default App
