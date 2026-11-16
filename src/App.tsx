import { Route, Routes } from 'react-router-dom'
import { RequireAuth } from '@/components/auth/RequireAuth'
import { AppShell } from '@/components/layout/AppShell'
import { Accounts } from '@/pages/Accounts'
import { Budgets } from '@/pages/Budgets'
import { Categories } from '@/pages/Categories'
import { ComingSoon } from '@/pages/ComingSoon'
import { Dashboard } from '@/pages/Dashboard'
import { Debts } from '@/pages/Debts'
import { Goals } from '@/pages/Goals'
import { Labels } from '@/pages/Labels'
import { Login } from '@/pages/Login'
import { More } from '@/pages/More'
import { NotFound } from '@/pages/NotFound'
import { Reports } from '@/pages/Reports'
import { Settings } from '@/pages/Settings'
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
          <Route path="/categories" element={<Categories />} />
          <Route path="/labels" element={<Labels />} />
          <Route path="/portfolio" element={<ComingSoon title="Portfolio" />} />
          <Route path="/budgets" element={<Budgets />} />
          <Route path="/more" element={<More />} />
          <Route path="/goals" element={<Goals />} />
          <Route path="/debts" element={<Debts />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/accounts" element={<Accounts />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Route>
    </Routes>
  )
}

export default App
