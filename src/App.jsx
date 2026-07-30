import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useSelectors } from './store.jsx'
import { ROLES } from './data/model.js'
import { Toasts } from './components/bits.jsx'
import AppShell from './components/AppShell.jsx'

import Login from './screens/Login.jsx'
import ChangePassword from './screens/ChangePassword.jsx'

import Dashboard from './screens/office/Dashboard.jsx'
import ReviewQueue from './screens/office/ReviewQueue.jsx'
import Approvals from './screens/office/Approvals.jsx'
import People from './screens/office/People.jsx'
import PersonLedger from './screens/office/PersonLedger.jsx'
import Sites from './screens/office/Sites.jsx'
import SiteDetail from './screens/office/SiteDetail.jsx'
import Reports from './screens/office/Reports.jsx'
import AdminAccess from './screens/office/AdminAccess.jsx'
import Bills from './screens/office/Bills.jsx'
import MyExpenses from './screens/office/MyExpenses.jsx'
import OfficeAttendance from './screens/office/Attendance.jsx'
import FieldAttendance from './screens/mobile/Attendance.jsx'

import FieldHome from './screens/mobile/Home.jsx'
import LogExpense from './screens/mobile/AddExpense.jsx'
import FieldHistory from './screens/mobile/History.jsx'
import FieldFunds from './screens/mobile/Funds.jsx'
import FieldMe from './screens/mobile/Me.jsx'

const OFFICE = ['owner', 'admin', 'finance', 'engineer']

// Send the authed user to their role's landing surface.
function Landing() {
  const { me } = useSelectors()
  if (!me) return <Navigate to="/login" replace />
  if (me.mustChangePassword) return <Navigate to="/change-password" replace />
  return <Navigate to={ROLES[me.role]?.landing || '/login'} replace />
}

// Authentication only — this guard knows nothing about roles or devices.
function RequireAuth({ children }) {
  const { me } = useSelectors()
  const loc = useLocation()
  if (!me) return <Navigate to="/login" replace state={{ from: loc.pathname }} />
  if (me.mustChangePassword) return <Navigate to="/change-password" replace />
  return children
}

// Attendance has no role gate — everyone marks their own day — but a site
// engineer gets the field version and the office roles get the month grid.
// Split on role rather than viewport: what differs is the job, not the screen.
function AttendanceRoute() {
  const { me } = useSelectors()
  if (!me) return <Navigate to="/login" replace />
  return me.role === 'supervisor' ? <FieldAttendance /> : <OfficeAttendance />
}

// Per-route permission (Build Spec §2) — falls back to the user's landing.
function RoleGate({ roles, children }) {
  const { me } = useSelectors()
  if (!me) return <Navigate to="/login" replace />
  if (!roles.includes(me.role)) return <Navigate to={ROLES[me.role]?.landing || '/login'} replace />
  return children
}

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/change-password" element={<ChangePassword />} />
        <Route path="/" element={<Landing />} />

        {/* One shell for every role; the shell adapts to the viewport, not the role. */}
        <Route element={<RequireAuth><AppShell /></RequireAuth>}>
          {/* office surfaces */}
          <Route path="/dashboard" element={<RoleGate roles={['owner', 'admin', 'finance']}><Dashboard /></RoleGate>} />
          <Route path="/review"    element={<RoleGate roles={['owner', 'engineer']}><ReviewQueue /></RoleGate>} />
          <Route path="/approvals" element={<RoleGate roles={['owner', 'finance']}><Approvals /></RoleGate>} />
          <Route path="/people"      element={<RoleGate roles={OFFICE}><People /></RoleGate>} />
          <Route path="/people/:id"  element={<RoleGate roles={OFFICE}><PersonLedger /></RoleGate>} />
          <Route path="/sites"       element={<RoleGate roles={OFFICE}><Sites /></RoleGate>} />
          <Route path="/sites/:id"   element={<RoleGate roles={OFFICE}><SiteDetail /></RoleGate>} />
          <Route path="/reports"   element={<RoleGate roles={['owner', 'finance']}><Reports /></RoleGate>} />
          <Route path="/admin"     element={<RoleGate roles={['owner', 'admin']}><AdminAccess /></RoleGate>} />
          <Route path="/bills"     element={<RoleGate roles={['owner', 'finance', 'admin']}><Bills /></RoleGate>} />
          {/* an engineer's own reimbursement claims — office shell, same as their queue */}
          <Route path="/my-expenses" element={<RoleGate roles={['engineer']}><MyExpenses /></RoleGate>} />
          {/* Attendance is the one surface every role reaches. The office roles
              get the month grid; a site engineer gets the field version, which
              is the same split the rest of the app already uses. */}
          <Route path="/attendance" element={<AttendanceRoute />} />

          {/* field surfaces (supervisor) — same shell, same breakpoints */}
          <Route path="/home"        element={<RoleGate roles={['supervisor']}><FieldHome /></RoleGate>} />
          <Route path="/history"     element={<RoleGate roles={['supervisor']}><FieldHistory /></RoleGate>} />
          <Route path="/funds"       element={<RoleGate roles={['supervisor']}><FieldFunds /></RoleGate>} />
          <Route path="/me"          element={<RoleGate roles={['supervisor']}><FieldMe /></RoleGate>} />
          <Route path="/log-expense" element={<RoleGate roles={['supervisor']}><LogExpense /></RoleGate>} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toasts />
    </>
  )
}
