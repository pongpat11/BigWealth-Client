import { Route, Routes } from 'react-router-dom'
import { RequireAuth } from '@/components/auth/RequireAuth'
import { AppShell } from '@/components/layout/AppShell'
import { AccountDetail } from '@/pages/AccountDetail'
import { Accounts } from '@/pages/Accounts'
import { Budgets } from '@/pages/Budgets'
import { Categories } from '@/pages/Categories'
import { Dashboard } from '@/pages/Dashboard'
import { Debts } from '@/pages/Debts'
import { Goals } from '@/pages/Goals'
import { Labels } from '@/pages/Labels'
import { Login } from '@/pages/Login'
import { More } from '@/pages/More'
import { NotFound } from '@/pages/NotFound'
import { Portfolio } from '@/pages/Portfolio'
import { Recurring } from '@/pages/Recurring'
import { Reports } from '@/pages/Reports'
import { Settings } from '@/pages/Settings'
import { Transactions } from '@/pages/Transactions'
import { ImportTransactions } from '@/pages/ImportTransactions'

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
          <Route path="/transactions/import" element={<ImportTransactions />} />
          <Route path="/categories" element={<Categories />} />
          <Route path="/labels" element={<Labels />} />
          <Route path="/portfolio" element={<Portfolio />} />
          <Route path="/budgets" element={<Budgets />} />
          <Route path="/more" element={<More />} />
          <Route path="/recurring" element={<Recurring />} />
          <Route path="/goals" element={<Goals />} />
          <Route path="/debts" element={<Debts />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/accounts" element={<Accounts />} />
          <Route path="/accounts/:id" element={<AccountDetail />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Route>
    </Routes>
  )
}

export default App
