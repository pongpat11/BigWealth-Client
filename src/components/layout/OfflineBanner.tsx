import { useEffect, useState } from 'react'
import { WifiOff } from 'lucide-react'
import { t } from '@/lib/i18n'

/** Tracks the browser's online/offline state. */
function useOnline(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine)
  useEffect(() => {
    const goOnline = () => setOnline(true)
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])
  return online
}

/** Shown while the device has no connection. Renders nothing when online. */
export function OfflineBanner() {
  const online = useOnline()
  if (online) return null
  return (
    <div
      role="status"
      className="mb-4 flex print:hidden items-center gap-2 rounded-xl bg-amber-500/15 px-3 py-2 text-sm font-medium text-amber-600"
    >
      <WifiOff size={16} aria-hidden className="shrink-0" />
      {t("You're offline. Data can't load or save until you reconnect.")}
    </div>
  )
}
