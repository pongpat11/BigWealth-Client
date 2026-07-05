import { Navigate, Route, Routes } from 'react-router-dom'
import { RequireAuth } from '@/components/auth/RequireAuth'
import { AppShell } from '@/components/layout/AppShell'
import { ComingSoon } from '@/pages/ComingSoon'
import { Dashboard } from '@/pages/Dashboard'
import { Login } from '@/pages/Login'
import { More } from '@/pages/More'
import { Transactions } from '@/pages/Transactions'

// Every app screen requires a session (RequireAuth). Unauthenticated visitors
// are redirected to /login and returned to their target after signing in.
function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/portfolio" element={<ComingSoon title="Portfolio" />} />
          <Route path="/budgets" element={<ComingSoon title="Budgets" />} />
          <Route path="/more" element={<More />} />
          <Route path="/goals" element={<ComingSoon title="Savings Goals" />} />
          <Route path="/debts" element={<ComingSoon title="Debts" />} />
          <Route path="/reports" element={<ComingSoon title="Reports" />} />
          <Route path="/accounts" element={<ComingSoon title="Accounts" />} />
          <Route path="/settings" element={<ComingSoon title="Settings" />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
