import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Languages, LogOut, Monitor, Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { PageHeader } from '@/components/ui/PageHeader'
import { ApiError } from '@/lib/api'
import { changePassword, logout, me, updateProfile, type AuthUser } from '@/lib/auth'
import { browserTimezone } from '@/lib/format'
import { getLanguagePreference, reloadPage, setLanguagePreference, t, type LanguagePreference } from '@/lib/i18n'
import {
  getThemePreference,
  setThemePreference,
  type ThemePreference,
} from '@/lib/theme'

const MIN_PASSWORD = 8

const THEMES: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: t('Light'), icon: Sun },
  { value: 'dark', label: t('Dark'), icon: Moon },
  { value: 'system', label: t('System'), icon: Monitor },
]

// Each language is named in itself, so it's findable whichever one is active.
const LANGUAGES: { value: LanguagePreference; label: string; icon: typeof Sun }[] = [
  { value: 'th', label: 'ไทย', icon: Languages },
  { value: 'en', label: 'English', icon: Languages },
  { value: 'system', label: t('System'), icon: Monitor },
]

function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: { value: T; label: string; icon: typeof Sun }[]
  value: T
  onChange: (next: T) => void
}) {
  return (
    <div className="flex gap-2" role="group" aria-label={label}>
      {options.map(({ value: option, label: text, icon: IconCmp }) => (
        <button
          key={option}
          type="button"
          aria-pressed={value === option}
          onClick={() => onChange(option)}
          className={
            'flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-semibold transition-colors ' +
            (value === option
              ? 'bg-brand-600 text-white'
              : 'bg-[var(--color-canvas)] text-[var(--color-muted)]')
          }
        >
          <IconCmp size={15} aria-hidden />
          {text}
        </button>
      ))}
    </div>
  )
}

function Notice({ tone, children }: { tone: 'error' | 'success'; children: string }) {
  return (
    <p
      role={tone === 'error' ? 'alert' : 'status'}
      className={
        'rounded-xl px-3 py-2 text-sm ' +
        (tone === 'error'
          ? 'bg-rose-500/10 text-[var(--color-loss)]'
          : 'bg-brand-500/10 text-[var(--color-gain)]')
      }
    >
      {children}
    </p>
  )
}

function ProfileCard() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null)

  useEffect(() => {
    let active = true
    me()
      .then((u) => {
        if (!active) return
        setUser(u)
        setName(u.name ?? '')
      })
      .catch(
        (err) =>
          active &&
          setMessage({
            tone: 'error',
            text: err instanceof ApiError ? err.message : t('Could not load your profile.'),
          }),
      )
    return () => {
      active = false
    }
  }, [])

  const dirty = user !== null && name.trim() !== (user.name ?? '')

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setMessage(null)
    setSaving(true)
    try {
      const updated = await updateProfile(name)
      setUser(updated)
      setName(updated.name ?? '')
      setMessage({ tone: 'success', text: t('Profile saved.') })
    } catch (err) {
      setMessage({
        tone: 'error',
        text: err instanceof ApiError ? err.message : t('Could not save. Try again.'),
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader title={t('Profile')} />
      <CardBody>
        <form className="space-y-4" onSubmit={handleSubmit}>
          {message && <Notice tone={message.tone}>{message.text}</Notice>}
          <div>
            <p className="text-[13px] font-medium text-[var(--color-muted)]">{t('Email')}</p>
            <p className="mt-1 text-[15px] text-[var(--color-ink)]">{user?.email ?? '…'}</p>
          </div>
          <Input
            id="profile-name"
            label={t('Display name')}
            placeholder={t('How should we greet you?')}
            maxLength={120}
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={user === null}
          />
          <Button type="submit" disabled={!dirty || saving}>
            {saving ? t('Saving…') : t('Save profile')}
          </Button>
        </form>
      </CardBody>
    </Card>
  )
}

function AppearanceCard() {
  const [theme, setTheme] = useState<ThemePreference>(() => getThemePreference())

  const [language, setLanguage] = useState<LanguagePreference>(() => getLanguagePreference())

  function chooseTheme(next: ThemePreference) {
    setTheme(next)
    setThemePreference(next)
  }

  function chooseLanguage(next: LanguagePreference) {
    setLanguage(next)
    // Labels are translated as modules load, so a new language needs a reload.
    if (setLanguagePreference(next)) reloadPage()
  }

  return (
    <Card>
      <CardHeader title={t('Appearance')} />
      <CardBody className="space-y-4">
        <div className="space-y-2">
          <p className="text-[13px] font-medium text-[var(--color-muted)]">{t('Theme')}</p>
          <Segmented label={t('Theme')} options={THEMES} value={theme} onChange={chooseTheme} />
        </div>
        <div className="space-y-2">
          <p className="text-[13px] font-medium text-[var(--color-muted)]">{t('Language')}</p>
          <Segmented
            label={t('Language')}
            options={LANGUAGES}
            value={language}
            onChange={chooseLanguage}
          />
          <p className="text-xs text-[var(--color-muted)]">
            {t('Changing the language reloads the page. Save your edits first.')}
          </p>
        </div>
      </CardBody>
    </Card>
  )
}

function PasswordCard() {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fail = (text: string) => setMessage({ tone: 'error', text })
    if (!current) return fail(t('Enter your current password.'))
    if (next.length < MIN_PASSWORD) {
      return fail(t('New password must be at least {n} characters.', { n: MIN_PASSWORD }))
    }
    if (next !== confirm) return fail(t('New passwords do not match.'))
    if (next === current) return fail(t('New password must differ from the current one.'))

    setMessage(null)
    setSaving(true)
    try {
      await changePassword(current, next)
      setCurrent('')
      setNext('')
      setConfirm('')
      setMessage({
        tone: 'success',
        text: t('Password changed. Other devices have been signed out.'),
      })
    } catch (err) {
      fail(err instanceof ApiError ? err.message : t('Could not change the password. Try again.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader title={t('Change password')} />
      <CardBody>
        <form className="space-y-4" onSubmit={handleSubmit} noValidate>
          {message && <Notice tone={message.tone}>{message.text}</Notice>}
          <Input
            id="password-current"
            label={t('Current password')}
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
          <Input
            id="password-new"
            label={t('New password')}
            type="password"
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
          />
          <Input
            id="password-confirm"
            label={t('Confirm new password')}
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          <Button type="submit" disabled={saving}>
            {saving ? t('Changing…') : t('Change password')}
          </Button>
        </form>
      </CardBody>
    </Card>
  )
}

export function Settings() {
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="space-y-4">
      <PageHeader title={t('Settings')} />
      <ProfileCard />
      <AppearanceCard />

      <Card>
        <CardHeader title={t('Preferences')} />
        <CardBody>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-[var(--color-muted)]">{t('Base currency')}</dt>
              <dd className="font-medium text-[var(--color-ink)]">{t('THB (฿)')}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-[var(--color-muted)]">{t('Timezone')}</dt>
              <dd className="font-medium text-[var(--color-ink)]">{browserTimezone()}</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-[var(--color-muted)]">
            {t("Months and days follow this device's timezone.")}
          </p>
        </CardBody>
      </Card>

      <PasswordCard />

      <Button variant="secondary" className="w-full" onClick={handleLogout}>
        <LogOut size={16} aria-hidden />
        {t('Log out')}
      </Button>
    </div>
  )
}
