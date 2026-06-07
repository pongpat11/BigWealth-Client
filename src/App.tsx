import { Navigate, Route, Routes } from 'react-router-dom'
import { Login } from '@/pages/Login'

// Minimal routing for now. The full authenticated app shell (bottom nav /
// sidebar + the other screens) lands later — see docs/DESIGN_SPEC.md.
function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

export default App
