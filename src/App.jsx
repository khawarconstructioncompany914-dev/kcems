import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useSelectors } from './store.jsx'
import { ROLES } from './data/model.js'
import { Toasts } from './components/bits.jsx'

import Login from './screens/Login.jsx'
import ChangePassword from './screens/ChangePassword.jsx'
import DesktopShell from './screens/office/DesktopShell.jsx'
import Dashboard from './screens/office/Dashboard.jsx'
import ReviewQueue from './screens/office/ReviewQueue.jsx'
import Approvals from './screens/office/Approvals.jsx'
import People from './screens/office/People.jsx'
import PersonLedger from './screens/office/PersonLedger.jsx'
import Sites from './screens/office/Sites.jsx'
import SiteDetail from './screens/office/SiteDetail.jsx'
import Reports from './screens/office/Reports.jsx'
import AdminAccess from './screens/office/AdminAccess.jsx'

import MobileShell from './screens/mobile/MobileShell.jsx'
import MobileHome from './screens/mobile/Home.jsx'
import MobileAdd from './screens/mobile/AddExpense.jsx'
import MobileHistory from './screens/mobile/History.jsx'
import MobileFunds from './screens/mobile/Funds.jsx'
import MobileMe from './screens/mobile/Me.jsx'

// Route the authed user to their role's landing surface (Build Spec §1 router).
function Landing() {
  const { me } = useSelectors()
  if (!me) return <Navigate to="/login" replace />
  if (me.mustChangePassword) return <Navigate to="/change-password" replace />
  return <Navigate to={ROLES[me.role]?.landing || '/login'} replace />
}

// Guard: office roles (owner/admin/finance/engineer). Supervisors -> mobile.
function RequireOffice({ children }) {
  const { me } = useSelectors()
  const loc = useLocation()
  if (!me) return <Navigate to="/login" replace state={{ from: loc.pathname }} />
  if (me.mustChangePassword) return <Navigate to="/change-password" replace />
  if (me.role === 'supervisor') return <Navigate to="/m" replace />
  return children
}

function RequireMobile({ children }) {
  const { me } = useSelectors()
  if (!me) return <Navigate to="/login" replace />
  if (me.mustChangePassword) return <Navigate to="/change-password" replace />
  return children
}

// Per-route role gate (Build Spec §2) — falls back to the user's landing.
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

        {/* Office (desktop) surfaces */}
        <Route element={<RequireOffice><DesktopShell /></RequireOffice>}>
          <Route path="/dashboard" element={<RoleGate roles={['owner', 'admin', 'finance']}><Dashboard /></RoleGate>} />
          <Route path="/review" element={<ReviewQueue />} />
          <Route path="/approvals" element={<Approvals />} />
          <Route path="/people" element={<People />} />
          <Route path="/people/:id" element={<PersonLedger />} />
          <Route path="/sites" element={<Sites />} />
          <Route path="/sites/:id" element={<SiteDetail />} />
          <Route path="/reports" element={<RoleGate roles={['owner', 'finance']}><Reports /></RoleGate>} />
          <Route path="/admin" element={<RoleGate roles={['owner', 'admin']}><AdminAccess /></RoleGate>} />
        </Route>

        {/* Supervisor field app (mobile) */}
        <Route path="/m" element={<RequireMobile><MobileShell /></RequireMobile>}>
          <Route index element={<MobileHome />} />
          <Route path="add" element={<MobileAdd />} />
          <Route path="history" element={<MobileHistory />} />
          <Route path="funds" element={<MobileFunds />} />
          <Route path="me" element={<MobileMe />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toasts />
    </>
  )
}
