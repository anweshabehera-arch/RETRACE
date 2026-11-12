'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import {
  Activity, ArrowLeft, ArrowRight, Battery, Bell, Check, CheckCircle2, CircleHelp,
  Clock3, CloudOff, ExternalLink, Eye, EyeOff, FileKey2, Fingerprint, Globe2,
  Laptop, LockKeyhole, LogOut, MapPin, Menu, Navigation, Pencil,
  Phone, Plus, QrCode, Radar, RefreshCw, Search, Send, Settings, Shield, ShieldCheck,
  Smartphone, Sparkles, Trash2, UserRound, UsersRound, Wifi, X, Zap
} from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { sendPasswordReset, signIn, signOut, signUp } from '@/lib/supabase/auth'
import { getUserProfile, maskPhoneNumber, type PublicProfile } from '@/lib/supabase/profile'
import {
  createDevice,
  createRecoveryRequestServer,
  createTrustedContact,
  deleteDevice,
  deleteTrustedContact,
  formatShortDate,
  formatTimestamp,
  getActivityLogs,
  getDevices,
  getEffectiveDeviceStatus,
  getRecoveryOverview,
  getRecoveryRequests,
  getTrustedContacts,
  resolveRecoveryRequestServer,
  saveRecoveryPinServer,
  updateDeviceLocation,
  updateDeviceStatus,
  updateProfileDetails,
  updateTrustedContact,
  verifyRecoveryPinServer,
} from '@/lib/supabase/data'
import type { ActivityLog, Device, RecoveryRequest, TrustedContact } from '@/lib/supabase/types'

const nav = [
  ['Overview', '/dashboard', Activity],
  ['My Devices', '/devices', Smartphone],
  ['Recover Device', '/recovery', Radar],
  ['Trusted Circle', '/trusted-circle', UsersRound],
  ['Emergency Passport', '/emergency-passport', FileKey2],
  ['Activity Timeline', '/activity', Clock3],
  ['Settings', '/settings', Settings],
] as const

interface AuthContextType {
  user: User | null
  profile: PublicProfile | null
  devices: Device[]
  contacts: TrustedContact[]
  recoveryRequests: RecoveryRequest[]
  activityLogs: ActivityLog[]
  loading: boolean
  profileLoading: boolean
  dataLoading: boolean
  profileError: string | null
  dataError: string | null
  refreshProfile: () => Promise<void>
  refreshData: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  devices: [],
  contacts: [],
  recoveryRequests: [],
  activityLogs: [],
  loading: true,
  profileLoading: false,
  dataLoading: false,
  profileError: null,
  dataError: null,
  refreshProfile: async () => {},
  refreshData: async () => {},
  signOut: async () => {},
})

export function useAuth() {
  return useContext(AuthContext)
}

function Brand({ dark = false }: { dark?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2.5 font-semibold tracking-tight">
      <span className={`grid size-9 place-items-center rounded-xl ${dark ? 'bg-white/12 text-white' : 'bg-[#eaf1ff] text-[#1463ff]'}`}>
        <ShieldCheck className="size-5" />
      </span>
      <span className="text-[15px] tracking-[0.22em]">RETRACE</span>
    </Link>
  )
}

function Button({ children, variant = 'primary', href, onClick, className = '', disabled = false, type = 'button' }: any) {
  const cls = `inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0 ${
    variant === 'primary'
      ? 'bg-[#1463ff] text-white shadow-[0_10px_24px_rgba(20,99,255,.18)] hover:bg-[#0b54e9]'
      : variant === 'dark'
      ? 'bg-[#0b1b35] text-white hover:bg-[#162a49]'
      : variant === 'danger'
      ? 'bg-[#fff0f0] text-[#c53d47] hover:bg-[#ffe2e2]'
      : 'border border-[#dce5f2] bg-white text-[#27405e] hover:border-[#b9cae0]'
  } ${className}`

  return href && !disabled ? (
    <Link href={href} className={cls}>
      {children}
    </Link>
  ) : (
    <button type={type} disabled={disabled} onClick={onClick} className={cls}>
      {children}
    </button>
  )
}

function DeviceIcon({ type, className = 'size-7' }: { type: string; className?: string }) {
  const lower = type.toLowerCase()
  if (lower.includes('mac') || lower.includes('laptop') || lower.includes('pc') || lower.includes('desktop')) {
    return <Laptop className={className} />
  }
  return <Smartphone className={className} />
}

function PublicNav() {
  const { user } = useAuth()
  return (
    <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-5 lg:px-8">
      <Brand />
      <nav className="hidden items-center gap-7 text-sm font-medium text-[#60738c] md:flex">
        <a href="#how">How it works</a>
        <a href="#features">Features</a>
        <a href="#security">Security</a>
      </nav>
      <div className="flex items-center gap-3">
        {user ? (
          <Button href="/dashboard" className="px-4">
            Dashboard <ArrowRight className="size-4" />
          </Button>
        ) : (
          <>
            <Link className="hidden text-sm font-semibold text-[#27405e] sm:block" href="/login">
              Log in
            </Link>
            <Button href="/register" className="px-4">
              Get started <ArrowRight className="size-4" />
            </Button>
          </>
        )}
      </div>
    </header>
  )
}

function Landing() {
  return (
    <div className="min-h-screen bg-[#f8fbff] text-[#0b1b35]">
      <PublicNav />
      <main>
        <section className="mx-auto grid max-w-7xl items-center gap-14 px-5 pb-20 pt-14 lg:grid-cols-[1.04fr_.96fr] lg:px-8 lg:pb-28 lg:pt-20">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#d8e5fa] bg-white px-3 py-1.5 text-xs font-semibold text-[#4773b8]">
              <span className="size-1.5 rounded-full bg-[#37b979]" /> Independent recovery, reimagined
            </div>
            <h1 className="max-w-2xl text-5xl font-semibold leading-[1.05] tracking-[-.055em] text-[#0b1b35] sm:text-6xl">
              Your phone is lost.<br />
              <span className="text-[#1463ff]">Your recovery</span> shouldn&apos;t be.
            </h1>
            <p className="mt-7 max-w-xl text-lg leading-8 text-[#637790]">
              An independent recovery identity that helps you organize devices, trusted contacts, and recovery check-ins without depending on your primary Google or Apple account.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Button href="/register">Create your recovery identity <ArrowRight className="size-4" /></Button>
              <Button href="/recover" variant="outline">Recover my phone</Button>
            </div>
            <div className="mt-8 flex items-center gap-3 text-xs font-medium text-[#7489a3]">
              <ShieldCheck className="size-4 text-[#1463ff]" />
              <span>Built for the moments that matter.</span>
            </div>
          </div>
          <HeroVisual />
        </section>

        <section className="border-y border-[#e8eff8] bg-white py-14">
          <div className="mx-auto grid max-w-7xl gap-10 px-5 lg:grid-cols-3 lg:px-8">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[.16em] text-[#1463ff]">The gap</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight">Losing a phone shouldn&apos;t mean losing your way back in.</h2>
            </div>
            <p className="text-[15px] leading-7 text-[#637790]">
              Your phone is often your second factor, your map, your wallet and your connection to the people you trust. When it disappears, traditional recovery flows can leave you locked out at the exact moment you need them most.
            </p>
            <div className="rounded-2xl bg-[#f4f8fd] p-5">
              <p className="text-sm font-semibold text-[#27405e]">RETRACE creates a safe path around that problem.</p>
              <div className="mt-4 flex items-center gap-3 text-sm text-[#637790]">
                <Shield className="size-5 text-[#1463ff]" /> Recovery identity, separate from your device
              </div>
              <div className="mt-3 flex items-center gap-3 text-sm text-[#637790]">
                <UsersRound className="size-5 text-[#37a673]" /> People you trust, ready when needed
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="mx-auto max-w-7xl px-5 py-20 lg:px-8">
          <div className="max-w-xl">
            <p className="text-sm font-semibold uppercase tracking-[.16em] text-[#1463ff]">One safety net</p>
            <h2 className="mt-3 text-4xl font-semibold tracking-tight">Recovery designed around real life.</h2>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ['Independent Recovery Identity', Fingerprint, 'A separate, secure way back in.'],
              ['Trusted Circle Recovery', UsersRound, 'Organize the people who can help you recover.'],
              ['Permission-Based Check-Ins', MapPin, 'Record your device’s last known location when you choose.'],
              ['Digital Emergency Passport', FileKey2, 'Your essential recovery information, organized.'],
              ['Incident Recovery Tracking', Sparkles, 'Track lost-device incidents and recovery status.'],
              ['Server-Hashed Security PIN', QrCode, 'Protect sensitive actions with a server-hashed PIN.']
            ].map(([title, Icon, desc]: any) => (
              <div key={title} className="rounded-2xl border border-[#e1eaf5] bg-white p-6 shadow-[0_8px_30px_rgba(36,70,110,.04)]">
                <div className="grid size-11 place-items-center rounded-xl bg-[#edf4ff] text-[#1463ff]">
                  <Icon className="size-5" />
                </div>
                <h3 className="mt-5 font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#71839a]">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="how" className="bg-[#0b1b35] py-20 text-white">
          <div className="mx-auto max-w-7xl px-5 lg:px-8">
            <div className="grid gap-12 lg:grid-cols-[.8fr_1.2fr]">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[.16em] text-[#78a9ff]">How it works</p>
                <h2 className="mt-4 text-4xl font-semibold tracking-tight">A calm plan for a chaotic moment.</h2>
                <p className="mt-5 leading-7 text-[#aebdd2]">Prepare once. Keep your recovery options open. RETRACE puts the next right action within reach.</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                {[
                  ['01', 'Register', 'Create your independent identity.'],
                  ['02', 'Protect', 'Add a device and trusted circle.'],
                  ['03', 'Recover', 'Track incidents, verify PIN, and recover.']
                ].map(([n, t, d]) => (
                  <div key={n} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                    <span className="text-sm text-[#78a9ff]">{n}</span>
                    <h3 className="mt-10 font-semibold">{t}</h3>
                    <p className="mt-2 text-sm leading-6 text-[#aebdd2]">{d}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="security" className="mx-auto max-w-7xl px-5 py-20 lg:px-8">
          <div className="flex flex-col justify-between gap-8 rounded-3xl border border-[#dce8f6] bg-[#eef5ff] p-8 sm:p-12 lg:flex-row lg:items-center">
            <div className="max-w-2xl">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#1463ff]">
                <LockKeyhole className="size-4" /> Privacy-first by design
              </div>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight">Your recovery belongs to you.</h2>
              <p className="mt-4 leading-7 text-[#637790]">
                Permission-based location check-ins, masked contact details, PostgreSQL Row Level Security, and server-side PIN hashing via Supabase.
              </p>
            </div>
            <Button href="/register">Prepare your safety net <ArrowRight className="size-4" /></Button>
          </div>
        </section>

        <section className="border-t border-[#e8eff8] bg-white py-12">
          <div className="mx-auto flex max-w-7xl flex-col justify-between gap-5 px-5 text-sm text-[#71839a] sm:flex-row lg:px-8">
            <Brand />
            <span>© 2026 RETRACE. Your Digital Life&apos;s Safety Net.</span>
            <div className="flex gap-5">
              <a href="#security">Privacy</a>
              <a href="#security">Terms</a>
              <Link href="/login">Sign in</Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

function HeroVisual() {
  return (
    <div className="relative min-h-[480px] rounded-[30px] bg-[#eaf2ff] p-5 shadow-[0_25px_70px_rgba(51,96,160,.12)]">
      <div className="absolute right-5 top-5 rounded-2xl border border-white/80 bg-white/85 p-3 shadow-lg backdrop-blur">
        <div className="flex items-center gap-2 text-xs font-semibold text-[#27405e]">
          <span className="grid size-7 place-items-center rounded-lg bg-[#eaf8f0] text-[#2b9d69]">
            <ShieldCheck className="size-4" />
          </span>
          Identity protected
        </div>
      </div>
      <div className="absolute bottom-8 left-6 z-10 w-56 rounded-2xl border border-white bg-white p-4 shadow-xl">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-[#637790]">Location check-in</span>
          <MapPin className="size-4 text-[#e24d59]" />
        </div>
        <p className="mt-3 text-sm font-semibold">Permission-based</p>
        <p className="mt-1 text-xs text-[#8192a8]">Stored only on check-in</p>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#e9eef6]">
          <div className="h-full w-3/4 rounded-full bg-[#1463ff]" />
        </div>
      </div>
      <div className="absolute inset-12 overflow-hidden rounded-[24px] border border-white/70 bg-[#dbe9fa]">
        <div
          className="absolute inset-0 opacity-70"
          style={{
            backgroundImage:
              'linear-gradient(28deg, transparent 45%, #b4cbe6 46%, #b4cbe6 48%, transparent 49%), linear-gradient(110deg, transparent 42%, #b4cbe6 43%, #b4cbe6 45%, transparent 46%), linear-gradient(8deg, transparent 62%, #c6d9ed 63%, #c6d9ed 65%, transparent 66%)'
          }}
        />
        <div className="absolute left-[52%] top-[40%] grid size-20 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-[#1463ff]/10">
          <span className="grid size-10 place-items-center rounded-full border-4 border-white bg-[#1463ff] text-white shadow-lg">
            <Smartphone className="size-5" />
          </span>
        </div>
        <div className="absolute bottom-8 right-8 rounded-xl bg-white/90 px-3 py-2 text-xs font-semibold text-[#27405e] shadow">
          <span className="mr-1.5 inline-block size-1.5 rounded-full bg-[#37b979]" /> RLS Secured
        </div>
      </div>
      <div className="absolute bottom-10 right-12 h-48 w-24 rotate-[-8deg] rounded-[22px] border-[5px] border-[#172b48] bg-[#f4f8ff] shadow-2xl">
        <div className="mx-auto mt-2 h-1.5 w-8 rounded-full bg-[#172b48]" />
        <div className="mx-3 mt-8 rounded-xl bg-[#eaf2ff] p-2">
          <ShieldCheck className="mx-auto size-8 text-[#1463ff]" />
        </div>
        <div className="mx-3 mt-3 h-2 rounded-full bg-[#d7e5f6]" />
        <div className="mx-3 mt-2 h-2 w-2/3 rounded-full bg-[#d7e5f6]" />
      </div>
    </div>
  )
}

function AppShell({ children, title, description }: { children: React.ReactNode; title: string; description?: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobile, setMobile] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [notifOpen, setNotifOpen] = useState(false)
  const {
    user,
    profile,
    devices,
    contacts,
    recoveryRequests,
    activityLogs,
    profileError,
    dataError,
    profileLoading,
    dataLoading,
    refreshProfile,
    refreshData,
    signOut,
  } = useAuth()

  const activeDeviceIds = useMemo(
    () => new Set(recoveryRequests.filter((r) => r.status === 'active').map((r) => r.device_id)),
    [recoveryRequests]
  )

  const userInitials = useMemo(() => {
    const fullName = profile?.full_name || user?.user_metadata?.full_name
    if (fullName && typeof fullName === 'string') {
      const parts = fullName.trim().split(/\s+/).filter(Boolean)
      if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      }
      if (parts.length === 1) {
        return parts[0].slice(0, 2).toUpperCase()
      }
    }
    return user?.email ? user.email.slice(0, 2).toUpperCase() : 'U'
  }, [profile, user])

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return []
    const items: { label: string; sub: string; href: string }[] = []
    for (const d of devices) {
      if (d.name.toLowerCase().includes(q) || d.type.toLowerCase().includes(q) || d.last_location_name.toLowerCase().includes(q)) {
        const effStatus = getEffectiveDeviceStatus(d, activeDeviceIds)
        items.push({ label: d.name, sub: `Device · ${effStatus}`, href: '/devices' })
      }
    }
    for (const c of contacts) {
      if (c.name.toLowerCase().includes(q) || c.relation.toLowerCase().includes(q)) {
        items.push({ label: c.name, sub: `Trusted Contact · ${c.relation}`, href: '/trusted-circle' })
      }
    }
    for (const a of activityLogs) {
      if (a.title.toLowerCase().includes(q) || a.description.toLowerCase().includes(q)) {
        items.push({ label: a.title, sub: `Activity · ${a.category}`, href: '/activity' })
      }
    }
    return items.slice(0, 6)
  }, [searchQuery, devices, contacts, activityLogs])

  const handleSignOut = async () => {
    try {
      await signOut()
      router.push('/')
    } catch (err) {
      console.error('Sign out error:', err)
      router.push('/')
    }
  }

  const combinedError = profileError || dataError

  return (
    <div className="min-h-screen bg-[#f7faff] text-[#0b1b35]">
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-[#e2eaf4] bg-white px-4 py-5 transition-transform lg:translate-x-0 ${mobile ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between px-2">
          <Brand />
          <button className="lg:hidden" onClick={() => setMobile(false)} aria-label="Close navigation">
            <X className="size-5" />
          </button>
        </div>
        <div className="mt-10 flex flex-1 flex-col gap-1">
          {nav.map(([label, href, Icon]) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMobile(false)}
              className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition ${
                pathname === href ? 'bg-[#edf4ff] text-[#1463ff]' : 'text-[#71839a] hover:bg-[#f5f8fc] hover:text-[#27405e]'
              }`}
            >
              <Icon className="size-[18px]" />
              {label}
            </Link>
          ))}
        </div>
        <div className="rounded-2xl bg-[#f2f7ff] p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#27405e]">
            <CircleHelp className="size-4 text-[#1463ff]" /> Need help?
          </div>
          <p className="mt-2 text-xs leading-5 text-[#71839a]">Your recovery plan is always within reach.</p>
          <Button href="/recover" variant="outline" className="mt-3 w-full px-2 py-2 text-xs">
            Open recovery
          </Button>
        </div>
        <button
          onClick={handleSignOut}
          className="mt-5 flex w-full items-center gap-3 px-3 text-sm font-medium text-[#71839a] transition hover:text-[#c53d47]"
        >
          <LogOut className="size-4" /> Sign out
        </button>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-[76px] items-center justify-between border-b border-[#e5edf6] bg-white/90 px-5 backdrop-blur lg:px-10">
          <button className="rounded-lg p-2 lg:hidden" onClick={() => setMobile(true)} aria-label="Open navigation">
            <Menu className="size-5" />
          </button>
          <div className="hidden lg:block">
            <p className="text-sm font-semibold">{title}</p>
            {description && <p className="mt-0.5 text-xs text-[#8192a8]">{description}</p>}
          </div>
          <div className="relative flex items-center gap-3">
            <div className="relative hidden sm:block">
              <div className="flex items-center gap-2 rounded-xl border border-[#e1e9f3] bg-white px-3 py-2 text-xs text-[#27405e]">
                <Search className="size-4 text-[#9aaabd]" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search devices, contacts..."
                  className="w-40 bg-transparent text-xs outline-none placeholder:text-[#9aaabd]"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="text-[#9aaabd] hover:text-[#27405e]">
                    <X className="size-3.5" />
                  </button>
                )}
              </div>
              {searchQuery.trim() && (
                <div className="absolute right-0 top-11 z-50 w-72 rounded-2xl border border-[#e1e9f3] bg-white p-2 shadow-xl">
                  {searchResults.length === 0 ? (
                    <p className="p-3 text-xs text-[#8192a8]">No matching devices, contacts, or activity.</p>
                  ) : (
                    searchResults.map((item, idx) => (
                      <Link
                        key={`${item.href}-${idx}`}
                        href={item.href}
                        onClick={() => setSearchQuery('')}
                        className="block rounded-xl px-3 py-2 hover:bg-[#f4f8ff]"
                      >
                        <p className="text-xs font-semibold text-[#0b1b35]">{item.label}</p>
                        <p className="text-[11px] text-[#8192a8]">{item.sub}</p>
                      </Link>
                    ))
                  )}
                </div>
              )}
            </div>

            <div className="relative">
              <button
                onClick={() => setNotifOpen((v) => !v)}
                className="relative rounded-xl p-2.5 text-[#71839a] hover:bg-[#f4f7fb]"
                aria-label="Recent activity notifications"
              >
                <Bell className="size-[18px]" />
                {activityLogs.length > 0 && <span className="absolute right-2 top-2 size-1.5 rounded-full bg-[#1463ff]" />}
              </button>
              {notifOpen && (
                <div className="absolute right-0 top-12 z-50 w-80 rounded-2xl border border-[#e1e9f3] bg-white p-4 shadow-xl">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-[#0b1b35]">Recent events</p>
                    <Link href="/activity" onClick={() => setNotifOpen(false)} className="text-xs font-semibold text-[#1463ff]">
                      View all
                    </Link>
                  </div>
                  <div className="mt-3 flex flex-col gap-3">
                    {activityLogs.slice(0, 4).length === 0 ? (
                      <p className="text-xs text-[#8192a8]">No activity recorded yet.</p>
                    ) : (
                      activityLogs.slice(0, 4).map((log) => (
                        <div key={log.id} className="border-t border-[#f1f5fa] pt-2 first:border-t-0 first:pt-0">
                          <p className="text-xs font-medium text-[#0b1b35]">{log.title}</p>
                          <p className="mt-0.5 text-[11px] text-[#8192a8]">{formatTimestamp(log.created_at)}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="grid size-9 place-items-center rounded-full bg-[#dce8ff] text-xs font-bold text-[#3567bc]">
              {userInitials}
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-[1480px] px-5 py-8 lg:px-10">
          {combinedError && (
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#fcdada] bg-[#fff5f5] px-4 py-3 text-sm text-[#c53030]">
              <span>Unable to load account data: {combinedError}</span>
              <button
                onClick={() => {
                  refreshProfile()
                  refreshData()
                }}
                disabled={profileLoading || dataLoading}
                className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-[#c53030] shadow-xs transition hover:bg-[#fff0f0] disabled:opacity-60"
              >
                <RefreshCw className={`size-3.5 ${profileLoading || dataLoading ? 'animate-spin' : ''}`} />
                {profileLoading || dataLoading ? 'Retrying...' : 'Retry'}
              </button>
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  )
}

function Stat({ label, value, icon: Icon, tone = 'blue' }: any) {
  return (
    <div className="rounded-2xl border border-[#e2eaf4] bg-white p-5 shadow-[0_8px_30px_rgba(36,70,110,.03)]">
      <div className="flex items-center justify-between">
        <span className="text-sm text-[#71839a]">{label}</span>
        <span className={`grid size-9 place-items-center rounded-xl ${
          tone === 'green'
            ? 'bg-[#eaf8f0] text-[#2b9d69]'
            : tone === 'orange'
            ? 'bg-[#fff5e7] text-[#db8a2d]'
            : tone === 'red'
            ? 'bg-[#fff0f0] text-[#c53d47]'
            : 'bg-[#edf4ff] text-[#1463ff]'
        }`}>
          <Icon className="size-[18px]" />
        </span>
      </div>
      <p className="mt-4 text-2xl font-semibold tracking-tight">{value}</p>
    </div>
  )
}

function Dashboard() {
  const { user, profile, devices, contacts, recoveryRequests, activityLogs, profileLoading, dataLoading, refreshData } = useAuth()
  const [actionBusy, setActionBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const displayName = useMemo(() => {
    return profile?.full_name || user?.user_metadata?.full_name || (user?.email ? user.email.split('@')[0] : 'User')
  }, [profile, user])

  const formattedDate = useMemo(() => {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date())
  }, [])

  const { activeRequests, activeDeviceIds, lostDevices, protectedCount, recoveryStatus } = useMemo(
    () => getRecoveryOverview(devices, recoveryRequests),
    [devices, recoveryRequests]
  )

  const primaryDevice = useMemo(() => {
    return lostDevices[0] || devices[0] || null
  }, [lostDevices, devices])

  const primaryEffectiveStatus = useMemo(
    () => (primaryDevice ? getEffectiveDeviceStatus(primaryDevice, activeDeviceIds) : null),
    [primaryDevice, activeDeviceIds]
  )

  const recoveryStatusLabel = useMemo(() => {
    if (dataLoading) return '...'
    return recoveryStatus
  }, [dataLoading, recoveryStatus])

  const handleTogglePrimaryDeviceLost = async () => {
    if (!user?.id || !primaryDevice) return
    setActionError(null)
    setActionBusy(true)
    try {
      if (primaryEffectiveStatus === 'lost') {
        const activeReq = activeRequests.find((r) => r.device_id === primaryDevice.id)
        if (activeReq) {
          await resolveRecoveryRequestServer(activeReq.id, 'cancel')
        } else {
          await updateDeviceStatus(user.id, primaryDevice.id, primaryDevice.name, 'protected')
        }
      } else {
        await createRecoveryRequestServer(primaryDevice.id, 'Marked as lost from overview')
      }
      await refreshData()
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Unable to update device status.')
    } finally {
      setActionBusy(false)
    }
  }

  return (
    <AppShell title="Overview" description="Your recovery command center">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm text-[#71839a]">{formattedDate}</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Welcome back, {displayName}.</h1>
          <p className="mt-2 text-sm text-[#71839a]">
            {profileLoading
              ? 'Loading your recovery identity...'
              : profile?.recovery_id
              ? `Recovery ID: ${profile.recovery_id} · Your recovery identity is active and ready.`
              : 'Your recovery identity is active and ready.'}
          </p>
        </div>
        <Button href="/recovery"><Radar className="size-4" /> Start recovery</Button>
      </div>

      {actionError && (
        <div className="mt-5 rounded-xl border border-[#fcdada] bg-[#fff5f5] p-3.5 text-xs font-medium text-[#c53030]">
          {actionError}
        </div>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Registered devices" value={dataLoading ? '—' : String(devices.length)} icon={Smartphone} />
        <Stat label="Protected devices" value={dataLoading ? '—' : String(protectedCount)} icon={ShieldCheck} tone="green" />
        <Stat label="Trusted contacts" value={dataLoading ? '—' : String(contacts.length)} icon={UsersRound} />
        <Stat
          label="Recovery status"
          value={recoveryStatusLabel}
          icon={Zap}
          tone={activeRequests.length > 0 || lostDevices.length > 0 ? 'orange' : 'green'}
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_.65fr]">
        <section className="rounded-2xl border border-[#e2eaf4] bg-white p-6">
          {dataLoading ? (
            <div className="py-10 text-center text-sm text-[#8192a8]">Loading your devices...</div>
          ) : !primaryDevice ? (
            <div className="flex flex-col items-start justify-between gap-4 py-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-[#9aaabd]" />
                  <span className="text-sm font-semibold text-[#60738c]">No devices registered yet</span>
                </div>
                <h2 className="mt-2 text-xl font-semibold">Protect your first device</h2>
                <p className="mt-1 text-sm text-[#71839a]">
                  Register a phone, laptop, or tablet to track check-in locations and open recovery requests if it goes missing.
                </p>
              </div>
              <Button href="/devices"><Plus className="size-4" /> Register a device</Button>
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`size-2 rounded-full ${
                      primaryEffectiveStatus === 'lost' ? 'bg-[#e24d59]' : 'bg-[#37b979]'
                    }`} />
                    <span className="text-sm font-semibold">
                      {primaryEffectiveStatus === 'lost' ? 'Marked as lost' : 'Protected device'}
                    </span>
                  </div>
                  <h2 className="mt-2 text-xl font-semibold">{primaryDevice.name}</h2>
                  <p className="mt-1 text-sm text-[#71839a]">
                    {primaryDevice.type} · Registered {formatShortDate(primaryDevice.created_at)}
                  </p>
                </div>
                <Link href="/devices" className="rounded-lg p-1.5 text-xs font-semibold text-[#1463ff] hover:bg-[#edf4ff]">
                  Manage
                </Link>
              </div>
              <div className="mt-7 grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl bg-[#f6f9fd] p-4">
                  <p className="text-xs text-[#8192a8]">Last check-in</p>
                  <p className="mt-2 text-sm font-semibold">{formatTimestamp(primaryDevice.last_seen_at)}</p>
                </div>
                <div className="rounded-xl bg-[#f6f9fd] p-4">
                  <p className="text-xs text-[#8192a8]">Battery</p>
                  <p className="mt-2 flex items-center gap-1.5 text-sm font-semibold">
                    <Battery className="size-4 text-[#8192a8]" />
                    {primaryDevice.battery_level !== null ? `${primaryDevice.battery_level}%` : 'Not reported'}
                  </p>
                </div>
                <div className="rounded-xl bg-[#f6f9fd] p-4">
                  <p className="text-xs text-[#8192a8]">Connection</p>
                  <p className="mt-2 flex items-center gap-1.5 text-sm font-semibold">
                    <Wifi className={`size-4 ${primaryDevice.is_online ? 'text-[#37a673]' : 'text-[#8192a8]'}`} />
                    {primaryDevice.is_online ? 'Online' : 'Offline'}
                  </p>
                </div>
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                <Button href="/recovery"><Navigation className="size-4" /> View recovery</Button>
                <Button
                  variant={primaryEffectiveStatus === 'lost' ? 'outline' : 'danger'}
                  onClick={handleTogglePrimaryDeviceLost}
                  disabled={actionBusy}
                >
                  {actionBusy
                    ? 'Updating...'
                    : primaryEffectiveStatus === 'lost'
                    ? 'Restore protected status'
                    : 'Mark as lost'}
                </Button>
              </div>
            </>
          )}
        </section>

        <section className="rounded-2xl border border-[#e2eaf4] bg-[#0e2341] p-6 text-white">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="size-4 text-[#78a9ff]" /> Smart recovery guide
          </div>
          <p className="mt-6 text-lg font-semibold leading-7">
            {activeRequests.length > 0
              ? `You currently have ${activeRequests.length} active recovery ${activeRequests.length === 1 ? 'request' : 'requests'}.`
              : devices.length === 0
              ? 'Your identity is ready. Add a device to begin protection.'
              : `${protectedCount} of ${devices.length} registered ${devices.length === 1 ? 'device is' : 'devices are'} protected.`}
          </p>
          <p className="mt-3 text-sm leading-6 text-[#aebdd2]">
            {profile?.has_recovery_pin
              ? 'Your Recovery PIN is configured. Keep your location check-ins and trusted circle up to date.'
              : 'Set up a 4–6 digit Recovery PIN in Settings to strengthen account verification.'}
          </p>
          <div className="mt-6 rounded-xl bg-white/8 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#78a9ff]">Recommended next</p>
            {devices.length === 0 ? (
              <Link href="/devices" className="mt-3 flex items-start gap-2 text-sm hover:text-[#78a9ff]">
                <Smartphone className="mt-0.5 size-4 text-[#64d19b]" /> Register your primary device
              </Link>
            ) : (
              <Link href="/recovery" className="mt-3 flex items-start gap-2 text-sm hover:text-[#78a9ff]">
                <CheckCircle2 className="mt-0.5 size-4 text-[#64d19b]" /> Record a location check-in
              </Link>
            )}
            {contacts.length === 0 ? (
              <Link href="/trusted-circle" className="mt-2 flex items-start gap-2 text-sm hover:text-[#78a9ff]">
                <UsersRound className="mt-0.5 size-4 text-[#64d19b]" /> Add a trusted contact
              </Link>
            ) : !profile?.has_recovery_pin ? (
              <Link href="/settings" className="mt-2 flex items-start gap-2 text-sm hover:text-[#78a9ff]">
                <LockKeyhole className="mt-0.5 size-4 text-[#64d19b]" /> Configure your Recovery PIN
              </Link>
            ) : (
              <Link href="/emergency-passport" className="mt-2 flex items-start gap-2 text-sm hover:text-[#78a9ff]">
                <FileKey2 className="mt-0.5 size-4 text-[#64d19b]" /> Review your Emergency Passport
              </Link>
            )}
          </div>
        </section>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_.9fr]">
        <section className="rounded-2xl border border-[#e2eaf4] bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold">Last known location</h2>
              <p className="mt-1 text-xs text-[#8192a8]">
                {!primaryDevice
                  ? 'No registered devices yet'
                  : primaryDevice.last_location_name === 'Unknown location' && primaryDevice.latitude === null
                  ? 'Location not recorded yet'
                  : `Updated ${formatTimestamp(primaryDevice.last_seen_at)}`}
              </p>
            </div>
            <Button href="/recovery" variant="outline" className="px-3 py-2 text-xs">
              Check in location
            </Button>
          </div>
          <div
            className="relative mt-5 h-52 overflow-hidden rounded-xl bg-[#dceaf9]"
            style={{
              backgroundImage:
                'linear-gradient(32deg, transparent 45%, #b7cce4 46%, #b7cce4 48%, transparent 49%), linear-gradient(120deg, transparent 40%, #c5d8ed 41%, #c5d8ed 43%, transparent 44%)'
            }}
          >
            <div className="absolute left-[48%] top-[45%] grid size-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-[#1463ff]/15">
              <span className="grid size-8 place-items-center rounded-full bg-[#1463ff] text-white shadow-lg">
                <MapPin className="size-4" />
              </span>
            </div>
            <span className="absolute bottom-3 left-3 rounded-lg bg-white/90 px-2.5 py-1.5 text-xs font-semibold text-[#27405e]">
              {!primaryDevice
                ? 'No location recorded'
                : primaryDevice.last_location_name === 'Unknown location'
                ? 'Location unavailable'
                : primaryDevice.last_location_name}
            </span>
          </div>
        </section>
        <ActivityList logs={activityLogs} loading={dataLoading} />
      </div>
    </AppShell>
  )
}

function ActivityList({ logs, loading }: { logs: ActivityLog[]; loading: boolean }) {
  return (
    <section className="rounded-2xl border border-[#e2eaf4] bg-white p-6">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Recent activity</h2>
        <Link href="/activity" className="text-xs font-semibold text-[#1463ff]">View all</Link>
      </div>
      <div className="mt-5 flex flex-col gap-5">
        {loading ? (
          <p className="text-sm text-[#8192a8]">Loading recent activity...</p>
        ) : logs.length === 0 ? (
          <p className="text-sm text-[#8192a8]">No activity recorded yet.</p>
        ) : (
          logs.slice(0, 4).map((log) => {
            const Icon =
              log.category === 'Device'
                ? Smartphone
                : log.category === 'Recovery'
                ? Radar
                : ShieldCheck
            return (
              <div className="flex gap-3" key={log.id}>
                <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#edf4ff] text-[#1463ff]">
                  <Icon className="size-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium">{log.title}</p>
                  <p className="mt-0.5 truncate text-xs text-[#8192a8]">{log.description}</p>
                </div>
                <span className="ml-auto whitespace-nowrap text-[10px] text-[#a1afc0]">
                  {formatTimestamp(log.created_at)}
                </span>
              </div>
            )
          })
        )}
      </div>
    </section>
  )
}

function Recovery() {
  const { user, devices, recoveryRequests, dataLoading, refreshData } = useAuth()
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [geoBusy, setGeoBusy] = useState(false)
  const [manualLocationOpen, setManualLocationOpen] = useState(false)
  const [manualLocation, setManualLocation] = useState('')
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    if (!selectedDeviceId && devices.length > 0) {
      const lostFirst = devices.find((d) => d.status === 'lost')
      setSelectedDeviceId((lostFirst || devices[0]).id)
    }
  }, [devices, selectedDeviceId])

  const selectedDevice = useMemo(
    () => devices.find((d) => d.id === selectedDeviceId) || devices[0] || null,
    [devices, selectedDeviceId]
  )

  const activeRequest = useMemo(
    () =>
      selectedDevice
        ? recoveryRequests.find((r) => r.device_id === selectedDevice.id && r.status === 'active') || null
        : null,
    [recoveryRequests, selectedDevice]
  )

  const handleStartRecovery = async () => {
    if (!selectedDevice) return
    setFeedback(null)
    setBusy(true)
    try {
      await createRecoveryRequestServer(selectedDevice.id, notes.trim() || undefined)
      setNotes('')
      await refreshData()
      setFeedback({ type: 'success', text: `Recovery incident created and ${selectedDevice.name} marked as lost.` })
    } catch (err: unknown) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Unable to start recovery request.' })
    } finally {
      setBusy(false)
    }
  }

  const handleResolveRequest = async (requestId: string, action: 'recover' | 'cancel') => {
    setFeedback(null)
    setBusy(true)
    try {
      await resolveRecoveryRequestServer(requestId, action)
      await refreshData()
      setFeedback({
        type: 'success',
        text: action === 'recover' ? 'Device marked as recovered and incident closed.' : 'Recovery request cancelled.',
      })
    } catch (err: unknown) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Unable to update recovery request.' })
    } finally {
      setBusy(false)
    }
  }

  const handleBrowserGeolocationCheckIn = () => {
    if (!user?.id || !selectedDevice) return
    setFeedback(null)

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setManualLocationOpen(true)
      setFeedback({
        type: 'error',
        text: 'Browser geolocation is not supported on this device. Enter a manual location below.',
      })
      return
    }

    setGeoBusy(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const lat = Number(pos.coords.latitude.toFixed(5))
          const lng = Number(pos.coords.longitude.toFixed(5))
          const label = `Checked in (${lat}, ${lng})`
          await updateDeviceLocation(user.id, selectedDevice.id, selectedDevice.name, {
            locationName: label,
            latitude: lat,
            longitude: lng,
          })
          await refreshData()
          setFeedback({ type: 'success', text: `Location check-in saved for ${selectedDevice.name}.` })
        } catch (err: unknown) {
          setFeedback({
            type: 'error',
            text: err instanceof Error ? err.message : 'Unable to save geolocation check-in.',
          })
        } finally {
          setGeoBusy(false)
        }
      },
      (geoErr) => {
        setGeoBusy(false)
        setManualLocationOpen(true)
        const reason =
          geoErr.code === geoErr.PERMISSION_DENIED
            ? 'Location permission was denied. You can enter a manual location instead.'
            : 'Unable to determine your location automatically. Enter a manual location instead.'
        setFeedback({ type: 'error', text: reason })
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 0 }
    )
  }

  const handleManualLocationSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user?.id || !selectedDevice) return
    setFeedback(null)
    setGeoBusy(true)
    try {
      await updateDeviceLocation(user.id, selectedDevice.id, selectedDevice.name, {
        locationName: manualLocation,
        latitude: null,
        longitude: null,
      })
      setManualLocation('')
      setManualLocationOpen(false)
      await refreshData()
      setFeedback({ type: 'success', text: 'Manual location check-in saved.' })
    } catch (err: unknown) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Unable to save manual location.' })
    } finally {
      setGeoBusy(false)
    }
  }

  return (
    <AppShell title="Recover device" description="Take the next right step">
      <div className="max-w-5xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-[#1463ff]">Recovery center</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Let&apos;s bring your device back.</h1>
            <p className="mt-2 text-sm text-[#71839a]">
              Create and manage real recovery incidents backed by your Supabase database.
            </p>
          </div>
          <Button href="/dashboard" variant="outline"><ArrowLeft className="size-4" /> Back to overview</Button>
        </div>

        {feedback && (
          <div
            className={`mt-6 rounded-xl border p-3.5 text-xs font-medium ${
              feedback.type === 'success'
                ? 'border-[#b9ebd2] bg-[#eaf8f0] text-[#1f8056]'
                : 'border-[#fcdada] bg-[#fff5f5] text-[#c53030]'
            }`}
          >
            {feedback.text}
          </div>
        )}

        {dataLoading ? (
          <div className="mt-8 rounded-2xl border border-[#e2eaf4] bg-white p-8 text-center text-sm text-[#8192a8]">
            Loading devices and recovery history...
          </div>
        ) : devices.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-[#e2eaf4] bg-white p-8">
            <h2 className="text-lg font-semibold">No devices registered yet</h2>
            <p className="mt-2 text-sm text-[#71839a]">
              You need at least one registered device before opening a recovery request.
            </p>
            <Button href="/devices" className="mt-5"><Plus className="size-4" /> Register a device</Button>
          </div>
        ) : (
          <div className="mt-8 grid gap-6 lg:grid-cols-[1.05fr_.95fr]">
            <section className="rounded-2xl border border-[#e2eaf4] bg-white p-6">
              {devices.length > 1 && (
                <div className="mb-6">
                  <label className="text-xs font-semibold uppercase tracking-wider text-[#71839a]">
                    Select device
                    <select
                      value={selectedDevice?.id ?? ''}
                      onChange={(e) => setSelectedDeviceId(e.target.value)}
                      className="mt-2 w-full rounded-xl border border-[#dce5f2] bg-white px-3 py-2.5 text-sm font-medium outline-none focus:border-[#1463ff]"
                    >
                      {devices.map((d) => {
                        const effStatus = getEffectiveDeviceStatus(
                          d,
                          new Set(recoveryRequests.filter((r) => r.status === 'active').map((r) => r.device_id))
                        )
                        return (
                          <option key={d.id} value={d.id}>
                            {d.name} ({effStatus})
                          </option>
                        )
                      })}
                    </select>
                  </label>
                </div>
              )}

              {selectedDevice && (
                <>
                  <div className="flex items-center gap-4">
                    <div className="grid size-16 place-items-center rounded-2xl bg-[#edf4ff] text-[#1463ff]">
                      <DeviceIcon type={selectedDevice.type} className="size-8" />
                    </div>
                    <div>
                      <div className={`flex items-center gap-2 text-xs font-semibold ${
                        activeRequest || selectedDevice.status === 'lost' ? 'text-[#e24d59]' : 'text-[#2b9d69]'
                      }`}>
                        <span className={`size-1.5 rounded-full ${
                          activeRequest || selectedDevice.status === 'lost' ? 'bg-[#e24d59]' : 'bg-[#37b979]'
                        }`} />
                        {activeRequest
                          ? 'Active recovery request'
                          : selectedDevice.status === 'lost'
                          ? 'Marked as lost'
                          : 'Protected'}
                      </div>
                      <h2 className="mt-1 text-xl font-semibold">{selectedDevice.name}</h2>
                      <p className="mt-1 text-sm text-[#71839a]">
                        Last check-in: {formatTimestamp(selectedDevice.last_seen_at)}
                      </p>
                    </div>
                  </div>

                  {activeRequest ? (
                    <div className="mt-6">
                      <div className="rounded-xl bg-[#f7faff] p-4 text-sm text-[#27405e]">
                        <p className="font-semibold">Incident opened {formatTimestamp(activeRequest.created_at)}</p>
                        <p className="mt-1 text-xs text-[#71839a]">
                          Trusted circle approvals recorded: {activeRequest.approvals_received} of {activeRequest.approvals_required}
                        </p>
                        {activeRequest.notes && (
                          <p className="mt-2 text-xs text-[#60738c]">Note: {activeRequest.notes}</p>
                        )}
                      </div>

                      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                        <Button
                          variant="dark"
                          className="flex-1"
                          disabled={busy}
                          onClick={() => handleResolveRequest(activeRequest.id, 'recover')}
                        >
                          <CheckCircle2 className="size-4" /> {busy ? 'Updating...' : 'Mark as recovered'}
                        </Button>
                        <Button
                          variant="outline"
                          className="flex-1"
                          disabled={busy}
                          onClick={() => handleResolveRequest(activeRequest.id, 'cancel')}
                        >
                          Cancel request
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-6">
                      <label className="text-sm font-semibold">
                        Incident notes (optional)
                        <textarea
                          rows={3}
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder="Where or when you last remember having the device..."
                          className="mt-2 w-full rounded-xl border border-[#dce5f2] px-4 py-3 text-sm outline-none focus:border-[#1463ff]"
                        />
                      </label>
                      <Button
                        variant="danger"
                        className="mt-4 w-full"
                        disabled={busy}
                        onClick={handleStartRecovery}
                      >
                        <Shield className="size-4" />
                        {busy ? 'Creating recovery request...' : 'Mark as lost & start recovery request'}
                      </Button>
                    </div>
                  )}
                </>
              )}
            </section>

            <section className="rounded-2xl border border-[#e2eaf4] bg-white p-6">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <MapPin className="size-4 text-[#e24d59]" />
                  <h2 className="font-semibold">Last recorded location</h2>
                </div>
                {selectedDevice && (
                  <button
                    onClick={() => setManualLocationOpen((v) => !v)}
                    className="text-xs font-semibold text-[#1463ff]"
                  >
                    {manualLocationOpen ? 'Hide manual entry' : 'Enter manually'}
                  </button>
                )}
              </div>

              <div
                className="mt-5 h-52 rounded-xl bg-[#dceaf9]"
                style={{
                  backgroundImage:
                    'linear-gradient(34deg, transparent 45%, #b7cce4 46%, #b7cce4 48%, transparent 49%), linear-gradient(110deg, transparent 44%, #c5d8ed 45%, #c5d8ed 47%, transparent 48%)'
                }}
              >
                <div className="flex h-full flex-col items-center justify-center p-4 text-center">
                  <div className="grid size-14 place-items-center rounded-full bg-[#1463ff]/15">
                    <span className="grid size-9 place-items-center rounded-full bg-[#1463ff] text-white">
                      <MapPin className="size-5" />
                    </span>
                  </div>
                  {selectedDevice?.latitude !== null && selectedDevice?.longitude !== null && (
                    <span className="mt-3 rounded-lg bg-white/90 px-3 py-1 text-xs font-semibold text-[#27405e] shadow-xs">
                      {selectedDevice?.latitude}, {selectedDevice?.longitude}
                    </span>
                  )}
                </div>
              </div>

              <p className="mt-4 text-sm font-semibold">
                {!selectedDevice || selectedDevice.last_location_name === 'Unknown location'
                  ? 'Location unavailable — no check-in recorded yet'
                  : selectedDevice.last_location_name}
              </p>
              <p className="mt-1 text-xs text-[#8192a8]">
                {selectedDevice ? `Last updated: ${formatTimestamp(selectedDevice.last_seen_at)}` : 'Select a device'}
              </p>

              {selectedDevice && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    className="w-full"
                    disabled={geoBusy}
                    onClick={handleBrowserGeolocationCheckIn}
                  >
                    <Navigation className="size-4" />
                    {geoBusy ? 'Requesting location...' : 'Check in current location (Browser GPS)'}
                  </Button>
                </div>
              )}

              {manualLocationOpen && selectedDevice && (
                <form onSubmit={handleManualLocationSave} className="mt-4 flex flex-col gap-2 rounded-xl bg-[#f7faff] p-3">
                  <label className="text-xs font-semibold text-[#27405e]">
                    Manual location note
                    <input
                      value={manualLocation}
                      onChange={(e) => setManualLocation(e.target.value)}
                      placeholder="e.g., Campus library 2nd floor"
                      className="mt-1.5 w-full rounded-lg border border-[#dce5f2] bg-white px-3 py-2 text-xs outline-none focus:border-[#1463ff]"
                    />
                  </label>
                  <Button type="submit" disabled={geoBusy || !manualLocation.trim()} className="py-2 text-xs">
                    Save manual location
                  </Button>
                </form>
              )}

              <div className="mt-5 rounded-xl bg-[#fff7e9] p-4 text-xs leading-5 text-[#9a6a26]">
                <strong>Privacy &amp; Safety:</strong> RETRACE does not run background GPS tracking. Location updates are saved only when you grant browser permission or enter a location manually. Do not approach an unfamiliar location alone.
              </div>
            </section>
          </div>
        )}

        {recoveryRequests.length > 0 && (
          <section className="mt-8 rounded-2xl border border-[#e2eaf4] bg-white p-6">
            <h2 className="font-semibold">Recovery history</h2>
            <div className="mt-4 flex flex-col gap-3">
              {recoveryRequests.map((req) => {
                const dev = devices.find((d) => d.id === req.device_id)
                return (
                  <div
                    key={req.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#edf2f8] bg-[#f9fbff] px-4 py-3 text-sm"
                  >
                    <div>
                      <p className="font-semibold">{dev?.name ?? 'Registered device'}</p>
                      <p className="text-xs text-[#8192a8]">
                        Opened {formatTimestamp(req.created_at)}
                        {req.notes ? ` · ${req.notes}` : ''}
                      </p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ${
                      req.status === 'active'
                        ? 'bg-[#fff0f0] text-[#c53d47]'
                        : req.status === 'recovered'
                        ? 'bg-[#eaf8f0] text-[#2b9d69]'
                        : 'bg-[#f1f4f8] text-[#71839a]'
                    }`}>
                      {req.status}
                    </span>
                  </div>
                )
              })}
            </div>
          </section>
        )}
      </div>
    </AppShell>
  )
}

function TrustedCircle() {
  const { user, contacts, dataLoading, refreshData } = useAuth()
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [relation, setRelation] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const verifiedCount = useMemo(() => contacts.filter((c) => c.approved).length, [contacts])

  const resetForm = () => {
    setName('')
    setRelation('')
    setPhone('')
    setEmail('')
    setEditingId(null)
    setFormOpen(false)
  }

  const startEdit = (c: TrustedContact) => {
    setEditingId(c.id)
    setName(c.name)
    setRelation(c.relation)
    setPhone(c.phone)
    setEmail(c.email ?? '')
    setFormOpen(true)
    setFeedback(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user?.id) return
    setFeedback(null)
    setBusy(true)
    try {
      if (editingId) {
        await updateTrustedContact(user.id, editingId, { name, relation, phone, email })
        setFeedback({ type: 'success', text: 'Trusted contact updated.' })
      } else {
        await createTrustedContact(user.id, { name, relation, phone, email })
        setFeedback({
          type: 'success',
          text: 'Trusted contact saved as pending verification.',
        })
      }
      resetForm()
      await refreshData()
    } catch (err: unknown) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Unable to save trusted contact.' })
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async (c: TrustedContact) => {
    if (!user?.id) return
    setFeedback(null)
    setBusy(true)
    try {
      await deleteTrustedContact(user.id, c.id, c.name)
      await refreshData()
      setFeedback({ type: 'success', text: `${c.name} removed from Trusted Circle.` })
    } catch (err: unknown) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Unable to remove contact.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <AppShell title="Trusted Circle" description="People you trust, ready when needed">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold text-[#1463ff]">Your safety network</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Trusted Circle</h1>
          <p className="mt-2 text-sm text-[#71839a]">
            Manage the emergency contacts saved to your recovery identity.
          </p>
        </div>
        <Button onClick={() => {
          if (formOpen) resetForm()
          else {
            setEditingId(null)
            setFormOpen(true)
          }
        }}>
          <Plus className="size-4" /> {formOpen ? 'Cancel' : 'Add trusted contact'}
        </Button>
      </div>

      {feedback && (
        <div
          className={`mt-6 rounded-xl border p-3.5 text-xs font-medium ${
            feedback.type === 'success'
              ? 'border-[#b9ebd2] bg-[#eaf8f0] text-[#1f8056]'
              : 'border-[#fcdada] bg-[#fff5f5] text-[#c53030]'
          }`}
        >
          {feedback.text}
        </div>
      )}

      {formOpen && (
        <form onSubmit={handleSubmit} className="mt-6 rounded-2xl border border-[#dce8f6] bg-white p-6">
          <h2 className="font-semibold">{editingId ? 'Edit trusted contact' : 'Add trusted contact'}</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold">
              Full name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Contact full name"
                className="mt-2 w-full rounded-xl border border-[#dce5f2] px-4 py-2.5 text-sm outline-none focus:border-[#1463ff]"
              />
            </label>
            <label className="text-sm font-semibold">
              Relationship
              <input
                value={relation}
                onChange={(e) => setRelation(e.target.value)}
                required
                placeholder="e.g., Sister, Parent, Friend"
                className="mt-2 w-full rounded-xl border border-[#dce5f2] px-4 py-2.5 text-sm outline-none focus:border-[#1463ff]"
              />
            </label>
            <label className="text-sm font-semibold">
              Phone number
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                placeholder="+1 415 555 0100"
                className="mt-2 w-full rounded-xl border border-[#dce5f2] px-4 py-2.5 text-sm outline-none focus:border-[#1463ff]"
              />
            </label>
            <label className="text-sm font-semibold">
              Email (optional)
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="contact@example.com"
                className="mt-2 w-full rounded-xl border border-[#dce5f2] px-4 py-2.5 text-sm outline-none focus:border-[#1463ff]"
              />
            </label>
          </div>
          <div className="mt-5 flex gap-3">
            <Button type="submit" disabled={busy}>
              {busy ? 'Saving...' : editingId ? 'Save changes' : 'Save contact'}
            </Button>
            <Button variant="outline" onClick={resetForm} disabled={busy}>Cancel</Button>
          </div>
        </form>
      )}

      <div className="mt-8 rounded-2xl border border-[#dce8f6] bg-[#eef5ff] p-6">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#4773b8]">Verification status</p>
            <p className="mt-2 text-xl font-semibold">
              {contacts.length === 0
                ? 'No trusted contacts added yet'
                : `${verifiedCount} of ${contacts.length} ${contacts.length === 1 ? 'contact' : 'contacts'} verified`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {contacts.map((c) => (
              <div
                key={c.id}
                className={`grid size-11 place-items-center rounded-full border-2 text-xs font-bold ${
                  c.approved ? 'border-[#37b979] bg-[#eaf8f0] text-[#2b9d69]' : 'border-white bg-white text-[#a1afc0]'
                }`}
              >
                {c.approved ? <Check className="size-4" /> : c.avatar_initials}
              </div>
            ))}
          </div>
        </div>
        <div className="mt-5 h-2 overflow-hidden rounded-full bg-white">
          <div
            className="h-full rounded-full bg-[#37b979] transition-all"
            style={{ width: contacts.length > 0 ? `${(verifiedCount / contacts.length) * 100}%` : '0%' }}
          />
        </div>
        <p className="mt-2 text-xs text-[#637790]">
          Contacts added here start as pending verification until confirmed through an out-of-band verification service.
        </p>
      </div>

      {dataLoading ? (
        <div className="mt-6 rounded-2xl border border-[#e2eaf4] bg-white p-8 text-center text-sm text-[#8192a8]">
          Loading trusted contacts...
        </div>
      ) : contacts.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-[#e2eaf4] bg-white p-8 text-center">
          <p className="font-semibold">Your Trusted Circle is empty</p>
          <p className="mt-1 text-sm text-[#71839a]">Add people you trust so their details are ready in an emergency.</p>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {contacts.map((c) => (
            <div key={c.id} className="rounded-2xl border border-[#e2eaf4] bg-white p-5">
              <div className="flex items-start justify-between">
                <div className="grid size-11 place-items-center rounded-full bg-[#edf4ff] text-xs font-bold text-[#3567bc]">
                  {c.avatar_initials}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => startEdit(c)}
                    className="rounded-lg p-1.5 text-[#71839a] hover:bg-[#f5f8fc] hover:text-[#1463ff]"
                    aria-label={`Edit ${c.name}`}
                  >
                    <Pencil className="size-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(c)}
                    disabled={busy}
                    className="rounded-lg p-1.5 text-[#71839a] hover:bg-[#fff0f0] hover:text-[#c53d47]"
                    aria-label={`Remove ${c.name}`}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
              <h2 className="mt-5 font-semibold">{c.name}</h2>
              <p className="mt-1 text-sm text-[#71839a]">{c.relation} · {maskPhoneNumber(c.phone)}</p>
              {c.email && <p className="mt-1 truncate text-xs text-[#8192a8]">{c.email}</p>}
              <div className="mt-5 flex items-center justify-between">
                <span className={`flex items-center gap-1.5 text-xs font-semibold ${
                  c.approved ? 'text-[#2b9d69]' : 'text-[#8192a8]'
                }`}>
                  <span className={`size-1.5 rounded-full ${c.approved ? 'bg-[#37b979]' : 'bg-[#c6d0dc]'}`} />
                  {c.approved ? 'Verified' : 'Pending verification'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 rounded-2xl border border-[#e2eaf4] bg-white p-6">
        <div className="flex items-start gap-3">
          <div className="grid size-10 place-items-center rounded-xl bg-[#edf4ff] text-[#1463ff]">
            <ShieldCheck className="size-5" />
          </div>
          <div>
            <h2 className="font-semibold">Honest Verification Policy</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-[#71839a]">
              RETRACE never marks a contact as verified or approved unless real verification occurs. Contact invitations require an external SMS or email delivery channel in a future release.
            </p>
          </div>
        </div>
      </div>
    </AppShell>
  )
}

function Devices() {
  const { user, devices, recoveryRequests, dataLoading, refreshData } = useAuth()
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [type, setType] = useState('Phone')
  const [serialEnding, setSerialEnding] = useState('')
  const [locationLabel, setLocationLabel] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [formBusy, setFormBusy] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const { activeRequests, activeDeviceIds } = useMemo(
    () => getRecoveryOverview(devices, recoveryRequests),
    [devices, recoveryRequests]
  )

  const handleAddDevice = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user?.id) return
    setFeedback(null)
    setFormBusy(true)
    try {
      await createDevice(user.id, {
        name,
        type,
        serialEnding,
        lastLocationName: locationLabel || undefined,
      })
      setName('')
      setType('Phone')
      setSerialEnding('')
      setLocationLabel('')
      setShowForm(false)
      await refreshData()
      setFeedback({ type: 'success', text: 'Device registered to your recovery identity.' })
    } catch (err: unknown) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Unable to register device.' })
    } finally {
      setFormBusy(false)
    }
  }

  const handleToggleLost = async (d: Device) => {
    if (!user?.id) return
    setFeedback(null)
    setBusyId(d.id)
    try {
      const effectiveStatus = getEffectiveDeviceStatus(d, activeDeviceIds)
      if (effectiveStatus === 'lost') {
        const activeReq = activeRequests.find((r) => r.device_id === d.id)
        if (activeReq) {
          await resolveRecoveryRequestServer(activeReq.id, 'cancel')
        } else {
          await updateDeviceStatus(user.id, d.id, d.name, 'protected')
        }
        setFeedback({ type: 'success', text: `${d.name} status restored to protected.` })
      } else {
        await createRecoveryRequestServer(d.id, 'Marked as lost from My Devices')
        setFeedback({ type: 'success', text: `${d.name} marked as lost and recovery incident opened.` })
      }
      await refreshData()
    } catch (err: unknown) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Unable to update device status.' })
    } finally {
      setBusyId(null)
    }
  }

  const handleDelete = async (d: Device) => {
    if (!user?.id) return
    setFeedback(null)
    setBusyId(d.id)
    try {
      await deleteDevice(user.id, d.id, d.name)
      await refreshData()
      setFeedback({ type: 'success', text: `${d.name} removed.` })
    } catch (err: unknown) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Unable to remove device.' })
    } finally {
      setBusyId(null)
    }
  }

  return (
    <AppShell title="My devices" description="Your protected devices">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">My devices</h1>
          <p className="mt-2 text-sm text-[#71839a]">
            {dataLoading
              ? 'Loading your devices...'
              : `${devices.length} ${devices.length === 1 ? 'device' : 'devices'} registered under your recovery identity.`}
          </p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)}>
          <Plus className="size-4" /> {showForm ? 'Cancel' : 'Add device'}
        </Button>
      </div>

      {feedback && (
        <div
          className={`mt-6 rounded-xl border p-3.5 text-xs font-medium ${
            feedback.type === 'success'
              ? 'border-[#b9ebd2] bg-[#eaf8f0] text-[#1f8056]'
              : 'border-[#fcdada] bg-[#fff5f5] text-[#c53030]'
          }`}
        >
          {feedback.text}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleAddDevice} className="mt-6 rounded-2xl border border-[#dce8f6] bg-white p-6">
          <h2 className="font-semibold">Register a device</h2>
          <p className="mt-1 text-xs text-[#8192a8]">
            Enter the device details you want to track in your recovery profile.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold">
              Device name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="e.g., Work Phone"
                className="mt-2 w-full rounded-xl border border-[#dce5f2] px-4 py-2.5 text-sm outline-none focus:border-[#1463ff]"
              />
            </label>
            <label className="text-sm font-semibold">
              Device type
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="mt-2 w-full rounded-xl border border-[#dce5f2] bg-white px-4 py-2.5 text-sm outline-none focus:border-[#1463ff]"
              >
                <option value="Phone">Phone</option>
                <option value="Laptop">Laptop</option>
                <option value="Tablet">Tablet</option>
                <option value="Other">Other</option>
              </select>
            </label>
            <label className="text-sm font-semibold">
              Last 4 digits of serial / IMEI (optional)
              <input
                value={serialEnding}
                onChange={(e) => setSerialEnding(e.target.value)}
                maxLength={12}
                placeholder="e.g., 1234"
                className="mt-2 w-full rounded-xl border border-[#dce5f2] px-4 py-2.5 text-sm outline-none focus:border-[#1463ff]"
              />
            </label>
            <label className="text-sm font-semibold">
              Current location label (optional)
              <input
                value={locationLabel}
                onChange={(e) => setLocationLabel(e.target.value)}
                placeholder="Leave blank if unknown"
                className="mt-2 w-full rounded-xl border border-[#dce5f2] px-4 py-2.5 text-sm outline-none focus:border-[#1463ff]"
              />
            </label>
          </div>
          <div className="mt-5 flex gap-3">
            <Button type="submit" disabled={formBusy}>
              {formBusy ? 'Registering...' : 'Save device'}
            </Button>
            <Button variant="outline" onClick={() => setShowForm(false)} disabled={formBusy}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {dataLoading ? (
        <div className="mt-8 rounded-2xl border border-[#e2eaf4] bg-white p-8 text-center text-sm text-[#8192a8]">
          Loading registered devices...
        </div>
      ) : devices.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-[#e2eaf4] bg-white p-8 text-center">
          <p className="font-semibold">No devices registered yet</p>
          <p className="mt-1 text-sm text-[#71839a]">
            Click &ldquo;Add device&rdquo; to register your phone, tablet, or laptop.
          </p>
        </div>
      ) : (
        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          {devices.map((d) => {
            const effectiveStatus = getEffectiveDeviceStatus(d, activeDeviceIds)
            return (
              <div key={d.id} className="rounded-2xl border border-[#e2eaf4] bg-white p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="grid size-14 place-items-center rounded-2xl bg-[#edf4ff] text-[#1463ff]">
                      <DeviceIcon type={d.type} />
                    </div>
                    <div>
                      <h2 className="font-semibold">{d.name}</h2>
                      <p className="mt-1 text-sm text-[#71839a]">
                        {d.type} · Registered {formatShortDate(d.created_at)}
                      </p>
                    </div>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ${
                    effectiveStatus === 'lost'
                      ? 'bg-[#fff0f0] text-[#c53d47]'
                      : 'bg-[#eaf8f0] text-[#2b9d69]'
                  }`}>
                    {effectiveStatus}
                  </span>
                </div>
                <div className="mt-7 grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-[#8192a8]">Serial / Battery</p>
                    <p className="mt-1 text-sm font-semibold">
                      {d.serial_ending ? `Ends in ${d.serial_ending}` : d.battery_level !== null ? `${d.battery_level}%` : 'Not specified'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-[#8192a8]">Last recorded location</p>
                    <p className="mt-1 text-sm font-semibold">
                      {d.last_location_name === 'Unknown location' ? 'Not recorded yet' : d.last_location_name}
                    </p>
                  </div>
                </div>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Button href="/recovery" className="flex-1">Recovery &amp; check-in</Button>
                  <Button
                    variant={effectiveStatus === 'lost' ? 'outline' : 'danger'}
                    disabled={busyId === d.id}
                    onClick={() => handleToggleLost(d)}
                  >
                    {busyId === d.id ? '...' : effectiveStatus === 'lost' ? 'Restore protected' : 'Mark lost'}
                  </Button>
                  <Button
                    variant="outline"
                    disabled={busyId === d.id}
                    onClick={() => handleDelete(d)}
                    aria-label={`Remove ${d.name}`}
                  >
                    <Trash2 className="size-4 text-[#c53d47]" />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </AppShell>
  )
}

function ActivityPage() {
  const { activityLogs, dataLoading } = useAuth()
  const [filter, setFilter] = useState('All Activity')

  const filteredLogs = useMemo(
    () => activityLogs.filter((e) => filter === 'All Activity' || e.category === filter),
    [activityLogs, filter]
  )

  return (
    <AppShell title="Activity timeline" description="A transparent record of your safety">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Activity timeline</h1>
        <p className="mt-2 text-sm text-[#71839a]">A clear record of real events across your account.</p>
      </div>

      <div className="mt-7 flex flex-wrap gap-2">
        {['All Activity', 'Device', 'Security', 'Recovery'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-xl px-3 py-2 text-xs font-semibold ${
              filter === f ? 'bg-[#1463ff] text-white' : 'border border-[#e1e9f3] bg-white text-[#71839a]'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="mt-8 max-w-3xl rounded-2xl border border-[#e2eaf4] bg-white p-6">
        {dataLoading ? (
          <p className="text-sm text-[#8192a8]">Loading activity history...</p>
        ) : filteredLogs.length === 0 ? (
          <div className="py-6 text-center">
            <p className="font-semibold">No activity logs found</p>
            <p className="mt-1 text-sm text-[#71839a]">
              {filter === 'All Activity'
                ? 'Actions such as registering devices, updating your PIN, or starting recovery will appear here.'
                : `No events recorded under ${filter}.`}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-7">
            {filteredLogs.map((log, i) => {
              const Icon =
                log.category === 'Device'
                  ? Smartphone
                  : log.category === 'Recovery'
                  ? Radar
                  : ShieldCheck
              return (
                <div key={log.id} className="relative flex gap-4">
                  <div className="relative z-10 grid size-10 shrink-0 place-items-center rounded-xl bg-[#edf4ff] text-[#1463ff]">
                    <Icon className="size-4" />
                  </div>
                  {i < filteredLogs.length - 1 && (
                    <div className="absolute bottom-[-28px] left-5 top-10 w-px bg-[#e3ebf5]" />
                  )}
                  <div>
                    <p className="font-semibold">{log.title}</p>
                    <p className="mt-1 text-sm text-[#71839a]">{log.description}</p>
                    <p className="mt-2 text-xs text-[#a1afc0]">
                      {log.category} · {formatTimestamp(log.created_at)}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </AppShell>
  )
}

function Passport() {
  const { user, profile, devices, contacts, recoveryRequests, profileLoading, dataLoading } = useAuth()
  const displayName = profile?.full_name || user?.user_metadata?.full_name || user?.email || 'Authenticated User'
  const { activeDeviceIds } = useMemo(
    () => getRecoveryOverview(devices, recoveryRequests),
    [devices, recoveryRequests]
  )

  return (
    <AppShell title="Emergency passport" description="Your essential recovery information">
      <div className="max-w-4xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Digital emergency passport</h1>
            <p className="mt-2 text-sm text-[#71839a]">Private, practical information for a stressful moment.</p>
          </div>
          <Button variant="outline" onClick={() => window.print()}>
            <ExternalLink className="size-4" /> Print view
          </Button>
        </div>

        <div className="mt-8 rounded-2xl border border-[#d7e5f7] bg-[#f0f6ff] p-6">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-xl bg-[#1463ff] text-white">
              <FileKey2 className="size-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#4773b8]">Recovery identity</p>
              <p className="mt-1 font-semibold">
                {profileLoading ? 'Loading recovery ID...' : profile?.recovery_id ?? 'Identity unavailable'}
              </p>
              <p className="mt-0.5 text-xs text-[#60738c]">Holder: {displayName}</p>
            </div>
            <span className="ml-auto rounded-full bg-[#eaf8f0] px-2.5 py-1 text-[11px] font-semibold text-[#2b9d69]">
              {profile?.is_verified ? 'Verified' : 'Active'}
            </span>
          </div>
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <section className="rounded-2xl border border-[#e2eaf4] bg-white p-6">
            <h2 className="font-semibold">Registered devices</h2>
            {dataLoading ? (
              <p className="mt-4 text-xs text-[#8192a8]">Loading devices...</p>
            ) : devices.length === 0 ? (
              <p className="mt-4 text-xs text-[#8192a8]">No devices registered yet.</p>
            ) : (
              <div className="mt-5 flex flex-col gap-4">
                {devices.map((d) => {
                  const effectiveStatus = getEffectiveDeviceStatus(d, activeDeviceIds)
                  return (
                    <div key={d.id} className="flex items-center gap-3">
                      <div className="grid size-10 place-items-center rounded-xl bg-[#edf4ff] text-[#1463ff]">
                        <DeviceIcon type={d.type} className="size-5" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{d.name}</p>
                        <p className="text-xs text-[#8192a8] capitalize">
                          {d.serial_ending ? `Serial ending in ${d.serial_ending} · ` : `${d.type} · `}
                          {effectiveStatus}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-[#e2eaf4] bg-white p-6">
            <h2 className="font-semibold">Recovery contacts</h2>
            {dataLoading ? (
              <p className="mt-4 text-xs text-[#8192a8]">Loading contacts...</p>
            ) : contacts.length === 0 ? (
              <p className="mt-4 text-xs text-[#8192a8]">No trusted contacts added yet.</p>
            ) : (
              <>
                <div className="mt-5 flex flex-wrap gap-2">
                  {contacts.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center gap-2 rounded-full bg-[#edf4ff] py-1.5 pl-1.5 pr-3 text-xs font-semibold text-[#3567bc]"
                    >
                      <span className="grid size-7 place-items-center rounded-full bg-white text-[11px] font-bold">
                        {c.avatar_initials}
                      </span>
                      <span>{c.name}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-xs text-[#8192a8]">Phone numbers remain masked for privacy.</p>
              </>
            )}
          </section>
        </div>

        <section className="mt-6 rounded-2xl border border-[#e2eaf4] bg-white p-6">
          <h2 className="font-semibold">Emergency checklist</h2>
          <div className="mt-5 grid gap-3">
            {[
              'Attempt to locate or check in the device.',
              'Contact trusted people in your circle.',
              'Mark the device as lost in RETRACE.',
              'Contact your mobile network provider.',
              'Contact relevant financial institutions if needed.',
              'Follow official reporting procedures if theft is suspected.'
            ].map((x, i) => (
              <div key={x} className="flex items-center gap-3 rounded-xl bg-[#f7faff] p-3 text-sm text-[#4f6783]">
                <span className="grid size-6 place-items-center rounded-full bg-[#eaf8f0] text-xs font-bold text-[#2b9d69]">
                  {i + 1}
                </span>
                {x}
              </div>
            ))}
          </div>
          <p className="mt-5 text-xs leading-5 text-[#8192a8]">
            Do not store banking passwords, email passwords or sensitive financial credentials in RETRACE.
          </p>
        </section>
      </div>
    </AppShell>
  )
}

function SettingsPage() {
  const router = useRouter()
  const { user, profile, profileLoading, refreshProfile, refreshData, signOut } = useAuth()

  const [activePanel, setActivePanel] = useState<'profile' | 'pin' | 'phone' | 'privacy' | null>(null)
  const [nameInput, setNameInput] = useState('')
  const [phoneInput, setPhoneInput] = useState('')
  const [pinInput, setPinInput] = useState('')
  const [confirmPinInput, setConfirmPinInput] = useState('')
  const [geoPermission, setGeoPermission] = useState<string>('Unknown')
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    if (profile) {
      setNameInput(profile.full_name)
      setPhoneInput(profile.backup_phone ?? '')
    }
  }, [profile])

  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.permissions?.query) {
      navigator.permissions
        .query({ name: 'geolocation' })
        .then((res) => setGeoPermission(res.state))
        .catch(() => setGeoPermission('Prompt on check-in'))
    }
  }, [])

  const handleSignOut = async () => {
    try {
      await signOut()
      router.push('/')
    } catch (err) {
      console.error('Sign out error:', err)
      router.push('/')
    }
  }

  const handleSaveProfileName = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user?.id) return
    setFeedback(null)
    setBusy(true)
    try {
      await updateProfileDetails(user.id, { fullName: nameInput })
      await Promise.all([refreshProfile(), refreshData()])
      setActivePanel(null)
      setFeedback({ type: 'success', text: 'Profile name updated.' })
    } catch (err: unknown) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Unable to update profile.' })
    } finally {
      setBusy(false)
    }
  }

  const handleSaveBackupPhone = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user?.id) return
    setFeedback(null)
    setBusy(true)
    try {
      await updateProfileDetails(user.id, { backupPhone: phoneInput })
      await Promise.all([refreshProfile(), refreshData()])
      setActivePanel(null)
      setFeedback({ type: 'success', text: 'Backup phone number updated.' })
    } catch (err: unknown) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Unable to update backup phone.' })
    } finally {
      setBusy(false)
    }
  }

  const handleSavePin = async (e: React.FormEvent) => {
    e.preventDefault()
    setFeedback(null)
    if (!/^\d{4,6}$/.test(pinInput.trim())) {
      setFeedback({ type: 'error', text: 'Recovery PIN must be 4 to 6 numeric digits.' })
      return
    }
    if (pinInput.trim() !== confirmPinInput.trim()) {
      setFeedback({ type: 'error', text: 'Recovery PINs do not match.' })
      return
    }
    setBusy(true)
    try {
      await saveRecoveryPinServer(pinInput.trim())
      setPinInput('')
      setConfirmPinInput('')
      await Promise.all([refreshProfile(), refreshData()])
      setActivePanel(null)
      setFeedback({ type: 'success', text: 'Recovery PIN hashed and saved securely on the server.' })
    } catch (err: unknown) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Unable to save Recovery PIN.' })
    } finally {
      setBusy(false)
    }
  }

  const displayName = profile?.full_name || user?.user_metadata?.full_name
  const profileSummary = profileLoading
    ? 'Loading profile...'
    : displayName
    ? `${displayName}${user?.email ? ` · ${user.email}` : ''}`
    : user?.email ?? 'Authenticated user'

  const securitySummary = profileLoading
    ? 'Checking security status...'
    : profile?.has_recovery_pin
    ? `Password active · Recovery PIN configured (${profile.is_verified ? 'Verified' : 'Unverified'})`
    : 'Password active · Recovery PIN not configured yet'

  const phoneSummary = profileLoading ? 'Loading...' : maskPhoneNumber(profile?.backup_phone)

  return (
    <AppShell title="Settings" description="Manage your recovery identity">
      <div className="max-w-4xl">
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-2 text-sm text-[#71839a]">Keep your recovery identity current and secure.</p>

        {feedback && (
          <div
            className={`mt-6 rounded-xl border p-3.5 text-xs font-medium ${
              feedback.type === 'success'
                ? 'border-[#b9ebd2] bg-[#eaf8f0] text-[#1f8056]'
                : 'border-[#fcdada] bg-[#fff5f5] text-[#c53030]'
            }`}
          >
            {feedback.text}
          </div>
        )}

        <div className="mt-8 flex flex-col gap-5">
          <div className="rounded-2xl border border-[#e2eaf4] bg-white">
            <button
              onClick={() => setActivePanel(activePanel === 'profile' ? null : 'profile')}
              className="flex w-full items-center gap-4 p-5 text-left transition hover:bg-[#fbfdff]"
            >
              <span className="grid size-11 place-items-center rounded-xl bg-[#edf4ff] text-[#1463ff]">
                <UserRound className="size-5" />
              </span>
              <span className="flex-1">
                <span className="block font-semibold">Profile information</span>
                <span className="mt-1 block text-sm text-[#8192a8]">{profileSummary}</span>
              </span>
              <ArrowRight className="size-4 text-[#9aaabd]" />
            </button>
            {activePanel === 'profile' && (
              <form onSubmit={handleSaveProfileName} className="border-t border-[#eef3f9] p-5">
                <label className="text-sm font-semibold">
                  Full name
                  <input
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    required
                    className="mt-2 w-full rounded-xl border border-[#dce5f2] px-4 py-2.5 text-sm outline-none focus:border-[#1463ff]"
                  />
                </label>
                <div className="mt-4 flex gap-3">
                  <Button type="submit" disabled={busy}>{busy ? 'Saving...' : 'Update name'}</Button>
                  <Button variant="outline" onClick={() => setActivePanel(null)}>Cancel</Button>
                </div>
              </form>
            )}
          </div>

          <div className="rounded-2xl border border-[#e2eaf4] bg-white">
            <button
              onClick={() => setActivePanel(activePanel === 'pin' ? null : 'pin')}
              className="flex w-full items-center gap-4 p-5 text-left transition hover:bg-[#fbfdff]"
            >
              <span className="grid size-11 place-items-center rounded-xl bg-[#edf4ff] text-[#1463ff]">
                <LockKeyhole className="size-5" />
              </span>
              <span className="flex-1">
                <span className="block font-semibold">Account security &amp; Recovery PIN</span>
                <span className="mt-1 block text-sm text-[#8192a8]">{securitySummary}</span>
              </span>
              <ArrowRight className="size-4 text-[#9aaabd]" />
            </button>
            {activePanel === 'pin' && (
              <form onSubmit={handleSavePin} className="border-t border-[#eef3f9] p-5">
                <p className="text-xs text-[#71839a]">
                  Your PIN is hashed server-side using scrypt and never stored in plaintext.
                </p>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <label className="text-sm font-semibold">
                    {profile?.has_recovery_pin ? 'New Recovery PIN (4–6 digits)' : 'Create Recovery PIN (4–6 digits)'}
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={6}
                      value={pinInput}
                      onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
                      placeholder="••••"
                      className="mt-2 w-full rounded-xl border border-[#dce5f2] px-4 py-2.5 text-sm outline-none focus:border-[#1463ff]"
                    />
                  </label>
                  <label className="text-sm font-semibold">
                    Confirm Recovery PIN
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={6}
                      value={confirmPinInput}
                      onChange={(e) => setConfirmPinInput(e.target.value.replace(/\D/g, ''))}
                      placeholder="••••"
                      className="mt-2 w-full rounded-xl border border-[#dce5f2] px-4 py-2.5 text-sm outline-none focus:border-[#1463ff]"
                    />
                  </label>
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Button type="submit" disabled={busy}>{busy ? 'Hashing & saving...' : 'Save Recovery PIN'}</Button>
                  <Button href="/verify" variant="outline">Verify existing PIN</Button>
                </div>
              </form>
            )}
          </div>

          <div className="rounded-2xl border border-[#e2eaf4] bg-white">
            <button
              onClick={() => setActivePanel(activePanel === 'phone' ? null : 'phone')}
              className="flex w-full items-center gap-4 p-5 text-left transition hover:bg-[#fbfdff]"
            >
              <span className="grid size-11 place-items-center rounded-xl bg-[#edf4ff] text-[#1463ff]">
                <Phone className="size-5" />
              </span>
              <span className="flex-1">
                <span className="block font-semibold">Backup phone number</span>
                <span className="mt-1 block text-sm text-[#8192a8]">{phoneSummary}</span>
              </span>
              <ArrowRight className="size-4 text-[#9aaabd]" />
            </button>
            {activePanel === 'phone' && (
              <form onSubmit={handleSaveBackupPhone} className="border-t border-[#eef3f9] p-5">
                <label className="text-sm font-semibold">
                  Backup phone number
                  <input
                    value={phoneInput}
                    onChange={(e) => setPhoneInput(e.target.value)}
                    placeholder="+1 415 555 0100"
                    className="mt-2 w-full rounded-xl border border-[#dce5f2] px-4 py-2.5 text-sm outline-none focus:border-[#1463ff]"
                  />
                </label>
                <div className="mt-4 flex gap-3">
                  <Button type="submit" disabled={busy}>{busy ? 'Saving...' : 'Save backup phone'}</Button>
                  <Button variant="outline" onClick={() => setActivePanel(null)}>Cancel</Button>
                </div>
              </form>
            )}
          </div>

          <div className="flex items-center gap-4 rounded-2xl border border-[#e2eaf4] bg-white p-5">
            <span className="grid size-11 place-items-center rounded-xl bg-[#edf4ff] text-[#1463ff]">
              <Bell className="size-5" />
            </span>
            <span className="flex-1">
              <span className="block font-semibold">Notification preferences</span>
              <span className="mt-1 block text-sm text-[#8192a8]">
                In-app activity timeline is active. SMS/email alerts require external messaging integration.
              </span>
            </span>
          </div>

          <div className="rounded-2xl border border-[#e2eaf4] bg-white">
            <button
              onClick={() => setActivePanel(activePanel === 'privacy' ? null : 'privacy')}
              className="flex w-full items-center gap-4 p-5 text-left transition hover:bg-[#fbfdff]"
            >
              <span className="grid size-11 place-items-center rounded-xl bg-[#edf4ff] text-[#1463ff]">
                <Globe2 className="size-5" />
              </span>
              <span className="flex-1">
                <span className="block font-semibold">Privacy and location permissions</span>
                <span className="mt-1 block text-sm text-[#8192a8]">
                  Browser geolocation status: {geoPermission} · Explicit check-in only
                </span>
              </span>
              <ArrowRight className="size-4 text-[#9aaabd]" />
            </button>
            {activePanel === 'privacy' && (
              <div className="border-t border-[#eef3f9] p-5 text-xs leading-5 text-[#60738c]">
                RETRACE only collects coordinates when you explicitly trigger a location check-in on the Recovery page and allow permission in your browser. All user records are protected by PostgreSQL Row Level Security.
              </div>
            )}
          </div>
        </div>

        <Button onClick={handleSignOut} variant="danger" className="mt-6">
          <LogOut className="size-4" /> Sign out
        </Button>
      </div>
    </AppShell>
  )
}

function AuthPage({ type, redirectMessage }: { type: string; redirectMessage?: string }) {
  const router = useRouter()
  const { user, refreshProfile, refreshData } = useAuth()
  const [show, setShow] = useState(false)
  const [step, setStep] = useState(1)
  const isRegister = type === 'register'
  const isRecover = type === 'recover'

  // Controlled form state
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [backupPhone, setBackupPhone] = useState('')
  const [recoveryPin, setRecoveryPin] = useState('')
  const [deviceName, setDeviceName] = useState('')
  const [deviceType, setDeviceType] = useState('')
  const [contactName, setContactName] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [rememberMe, setRememberMe] = useState(true)

  // Password reset inline state
  const [resetOpen, setResetOpen] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetSent, setResetSent] = useState(false)

  // Status & error states
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(redirectMessage || null)
  const [emailConfirmationNeeded, setEmailConfirmationNeeded] = useState(false)

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setError(null)

    const cleanEmail = email.trim()
    if (!cleanEmail) {
      setError('Please enter your email address.')
      return
    }
    if (!password) {
      setError('Please enter your password.')
      return
    }

    setLoading(true)
    try {
      await signIn(cleanEmail, password)
      router.push('/dashboard')
    } catch (err: any) {
      const msg = err?.message || 'Failed to sign in. Please check your credentials.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const targetEmail = (resetEmail || email).trim()
    if (!targetEmail || !targetEmail.includes('@')) {
      setError('Please enter a valid email address for password reset.')
      return
    }

    setLoading(true)
    try {
      const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/login` : undefined
      await sendPasswordReset(targetEmail, redirectTo)
      setResetSent(true)
    } catch (err: any) {
      setError(err?.message || 'Unable to send password reset email.')
    } finally {
      setLoading(false)
    }
  }

  const handleRegisterStep = (nextStep: number) => {
    setError(null)
    if (step === 1 && nextStep > 1) {
      if (!fullName.trim()) {
        setError('Please enter your full name.')
        return
      }
      if (!email.trim() || !email.includes('@')) {
        setError('Please enter a valid email address.')
        return
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters.')
        return
      }
    }
    if (step === 2 && nextStep > 2 && recoveryPin.trim()) {
      if (!/^\d{4,6}$/.test(recoveryPin.trim())) {
        setError('Recovery PIN must be 4 to 6 numeric digits (or leave blank to set later).')
        return
      }
    }
    setStep(nextStep)
  }

  const handleRegisterSubmit = async () => {
    setError(null)
    setLoading(true)
    try {
      // Store ONLY full_name in Supabase Auth user metadata.
      const result = await signUp({
        email: email.trim(),
        password,
        fullName: fullName.trim(),
      })

      if (result.session && result.user) {
        // Persist optional onboarding fields only when an authenticated session exists.
        if (backupPhone.trim()) {
          await updateProfileDetails(result.user.id, { backupPhone: backupPhone.trim() }).catch(() => {})
        }
        if (/^\d{4,6}$/.test(recoveryPin.trim())) {
          await saveRecoveryPinServer(recoveryPin.trim()).catch(() => {})
        }
        if (deviceName.trim() && deviceType.trim()) {
          await createDevice(result.user.id, {
            name: deviceName.trim(),
            type: deviceType.trim(),
          }).catch(() => {})
        }
        if (contactName.trim() && contactPhone.trim()) {
          await createTrustedContact(result.user.id, {
            name: contactName.trim(),
            relation: 'Trusted Contact',
            phone: contactPhone.trim(),
          }).catch(() => {})
        }
        await Promise.all([refreshProfile(), refreshData()])
        router.push('/dashboard')
      } else {
        // Email confirmation is required by Supabase
        setEmailConfirmationNeeded(true)
      }
    } catch (err: any) {
      const msg = err?.message || 'Registration failed. Please check your details and try again.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  if (emailConfirmationNeeded) {
    return (
      <div className="min-h-screen bg-[#f7faff] text-[#0b1b35]">
        <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 lg:px-8">
          <Brand />
          <Link href="/" className="flex items-center gap-2 text-sm font-semibold text-[#71839a]">
            <ArrowLeft className="size-4" /> Back home
          </Link>
        </header>
        <main className="mx-auto flex max-w-xl flex-col items-center px-5 pb-16 pt-10">
          <div className="w-full rounded-3xl border border-[#e1e9f3] bg-white p-7 text-center shadow-[0_20px_70px_rgba(36,70,110,.08)] sm:p-10">
            <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#edf4ff] text-[#1463ff]">
              <ShieldCheck className="size-8" />
            </div>
            <h1 className="mt-6 text-3xl font-semibold tracking-tight">Check your email</h1>
            <p className="mt-3 text-sm leading-6 text-[#71839a]">
              We sent a confirmation link to <strong className="text-[#0b1b35]">{email}</strong>.
              Please click the link in your email to activate your independent recovery identity.
            </p>
            <div className="mt-8 rounded-2xl bg-[#f5f8fd] p-5 text-left text-xs leading-5 text-[#637790]">
              <div className="flex items-center gap-2 font-semibold text-[#27405e]">
                <LockKeyhole className="size-4 text-[#1463ff]" /> Security Note
              </div>
              <p className="mt-1">
                For your security, devices, backup phone, Recovery PIN, and trusted contacts are saved only after your email is confirmed and you sign in.
              </p>
            </div>
            <Button href="/login" className="mt-8 w-full">
              Proceed to sign in <ArrowRight className="size-4" />
            </Button>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f7faff] text-[#0b1b35]">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 lg:px-8">
        <Brand />
        <Link href="/" className="flex items-center gap-2 text-sm font-semibold text-[#71839a]">
          <ArrowLeft className="size-4" /> Back home
        </Link>
      </header>
      <main className="mx-auto flex max-w-xl flex-col items-center px-5 pb-16 pt-10">
        <div className="w-full rounded-3xl border border-[#e1e9f3] bg-white p-7 shadow-[0_20px_70px_rgba(36,70,110,.08)] sm:p-10">
          {isRegister && (
            <div className="mb-8 flex items-center gap-2">
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className={`h-1.5 flex-1 rounded-full ${n <= step ? 'bg-[#1463ff]' : 'bg-[#e6edf6]'}`} />
              ))}
            </div>
          )}
          <div className="grid size-12 place-items-center rounded-2xl bg-[#edf4ff] text-[#1463ff]">
            <ShieldCheck className="size-6" />
          </div>
          <h1 className="mt-6 text-3xl font-semibold tracking-tight">
            {isRegister ? 'Create your recovery identity' : isRecover ? 'Let’s bring your device back.' : 'Welcome back to RETRACE'}
          </h1>
          <p className="mt-3 text-sm leading-6 text-[#71839a]">
            {isRegister
              ? 'A separate, secure way back into your digital life.'
              : isRecover
              ? 'Access your recovery identity from any device.'
              : 'Sign in with your RETRACE credentials — never your Google or Apple password.'}
          </p>

          {error && (
            <div className="mt-6 rounded-xl border border-[#fed7d7] bg-[#fff5f5] p-3.5 text-xs font-medium text-[#c53030]">
              {error}
            </div>
          )}

          {resetSent && (
            <div className="mt-6 rounded-xl border border-[#b9ebd2] bg-[#eaf8f0] p-3.5 text-xs font-medium text-[#1f8056]">
              Password reset instructions have been sent to {resetEmail || email}.
            </div>
          )}

          {isRecover ? (
            <div className="mt-8 flex flex-col gap-3">
              {user ? (
                <>
                  <Button href="/recovery" className="w-full">
                    Open lost-device recovery center <ArrowRight className="size-4" />
                  </Button>
                  <Button href="/verify" variant="outline" className="w-full">
                    <FileKey2 className="size-4" /> Verify Recovery PIN
                  </Button>
                </>
              ) : (
                <>
                  <Button href="/login" className="w-full">
                    Sign in with RETRACE credentials <ArrowRight className="size-4" />
                  </Button>
                  <Button variant="outline" onClick={() => setResetOpen((v) => !v)} className="w-full">
                    <FileKey2 className="size-4" /> Reset forgotten password
                  </Button>
                  {resetOpen && (
                    <form onSubmit={handlePasswordReset} className="mt-2 flex flex-col gap-3 rounded-xl bg-[#f5f8fd] p-4">
                      <label className="text-xs font-semibold text-[#27405e]">
                        Account email
                        <input
                          type="email"
                          value={resetEmail}
                          onChange={(e) => setResetEmail(e.target.value)}
                          placeholder="you@example.com"
                          className="mt-1.5 w-full rounded-xl border border-[#dce5f2] bg-white px-3 py-2 text-sm outline-none focus:border-[#1463ff]"
                        />
                      </label>
                      <Button type="submit" disabled={loading} className="py-2 text-xs">
                        {loading ? 'Sending...' : 'Send password reset email'}
                      </Button>
                    </form>
                  )}
                </>
              )}
              <div className="mt-4 rounded-xl bg-[#f5f8fd] p-4 text-sm leading-6 text-[#637790]">
                <Phone className="mr-2 inline size-4 text-[#1463ff]" /> Recovery actions are protected by Supabase Auth and Row Level Security.
              </div>
            </div>
          ) : (
            <div className="mt-8 flex flex-col gap-4">
              {isRegister && step === 1 ? (
                <>
                  <label className="text-sm font-semibold">
                    Full name
                    <input
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      disabled={loading}
                      className="mt-2 w-full rounded-xl border border-[#dce5f2] px-4 py-3 text-sm outline-none focus:border-[#1463ff] disabled:bg-[#f6f9fc]"
                      placeholder="Your full name"
                    />
                  </label>
                  <label className="text-sm font-semibold">
                    Email address
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={loading}
                      className="mt-2 w-full rounded-xl border border-[#dce5f2] px-4 py-3 text-sm outline-none focus:border-[#1463ff] disabled:bg-[#f6f9fc]"
                      placeholder="you@example.com"
                    />
                  </label>
                  <label className="text-sm font-semibold">
                    Create password
                    <div className="relative mt-2">
                      <input
                        type={show ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={loading}
                        className="w-full rounded-xl border border-[#dce5f2] px-4 py-3 pr-11 text-sm outline-none focus:border-[#1463ff] disabled:bg-[#f6f9fc]"
                        placeholder="6+ characters"
                      />
                      <button
                        type="button"
                        onClick={() => setShow(!show)}
                        className="absolute right-3 top-3 text-[#8192a8]"
                      >
                        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                  </label>
                  <Button onClick={() => handleRegisterStep(2)} disabled={loading} className="mt-2 w-full">
                    Continue <ArrowRight className="size-4" />
                  </Button>
                </>
              ) : isRegister ? (
                <>
                  <label className="text-sm font-semibold">
                    {step === 2 ? 'Backup phone number (optional)' : step === 3 ? 'Device name (optional)' : 'Trusted contact name (optional)'}
                    <input
                      value={step === 2 ? backupPhone : step === 3 ? deviceName : contactName}
                      onChange={(e) => {
                        if (step === 2) setBackupPhone(e.target.value)
                        else if (step === 3) setDeviceName(e.target.value)
                        else setContactName(e.target.value)
                      }}
                      disabled={loading}
                      className="mt-2 w-full rounded-xl border border-[#dce5f2] px-4 py-3 text-sm outline-none focus:border-[#1463ff] disabled:bg-[#f6f9fc]"
                      placeholder={step === 2 ? '+1 415 555 0100' : step === 3 ? 'My Primary Phone' : 'Contact full name'}
                    />
                  </label>
                  <label className="text-sm font-semibold">
                    {step === 2 ? 'Create recovery PIN (4–6 digits, optional)' : step === 3 ? 'Device type' : 'Contact phone number'}
                    <input
                      type={step === 2 ? 'password' : 'text'}
                      value={step === 2 ? recoveryPin : step === 3 ? deviceType : contactPhone}
                      onChange={(e) => {
                        if (step === 2) setRecoveryPin(e.target.value.replace(/\D/g, ''))
                        else if (step === 3) setDeviceType(e.target.value)
                        else setContactPhone(e.target.value)
                      }}
                      disabled={loading}
                      className="mt-2 w-full rounded-xl border border-[#dce5f2] px-4 py-3 text-sm outline-none focus:border-[#1463ff] disabled:bg-[#f6f9fc]"
                      placeholder={step === 2 ? '••••' : step === 3 ? 'Phone' : '+1 415 555 0100'}
                    />
                  </label>
                  <div className="flex gap-3">
                    <Button variant="outline" onClick={() => handleRegisterStep(step - 1)} disabled={loading} className="flex-1">
                      Back
                    </Button>
                    <Button
                      onClick={() => (step < 4 ? handleRegisterStep(step + 1) : handleRegisterSubmit())}
                      disabled={loading}
                      className="flex-1"
                    >
                      {step < 4 ? 'Continue' : loading ? 'Creating identity...' : 'Finish setup'} <ArrowRight className="size-4" />
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <label className="text-sm font-semibold">
                    Email address
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={loading}
                      className="mt-2 w-full rounded-xl border border-[#dce5f2] px-4 py-3 text-sm outline-none focus:border-[#1463ff] disabled:bg-[#f6f9fc]"
                      placeholder="you@example.com"
                    />
                  </label>
                  <label className="text-sm font-semibold">
                    RETRACE password
                    <div className="relative mt-2">
                      <input
                        type={show ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={loading}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleLogin()
                        }}
                        className="w-full rounded-xl border border-[#dce5f2] px-4 py-3 pr-11 text-sm outline-none focus:border-[#1463ff] disabled:bg-[#f6f9fc]"
                        placeholder="Enter your password"
                      />
                      <button
                        type="button"
                        onClick={() => setShow(!show)}
                        className="absolute right-3 top-3 text-[#8192a8]"
                      >
                        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                  </label>
                  <div className="flex justify-between text-xs text-[#71839a]">
                    <label className="flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                      /> Keep session active
                    </label>
                    <button
                      type="button"
                      onClick={() => setResetOpen((v) => !v)}
                      className="font-semibold text-[#1463ff]"
                    >
                      Forgot password?
                    </button>
                  </div>

                  {resetOpen && (
                    <form onSubmit={handlePasswordReset} className="flex flex-col gap-2 rounded-xl bg-[#f5f8fd] p-3">
                      <input
                        type="email"
                        value={resetEmail || email}
                        onChange={(e) => setResetEmail(e.target.value)}
                        placeholder="Enter email for reset link"
                        className="w-full rounded-lg border border-[#dce5f2] bg-white px-3 py-2 text-xs outline-none focus:border-[#1463ff]"
                      />
                      <Button type="submit" variant="outline" disabled={loading} className="py-2 text-xs">
                        {loading ? 'Sending...' : 'Send reset email'}
                      </Button>
                    </form>
                  )}

                  <Button onClick={() => handleLogin()} disabled={loading} className="mt-2 w-full">
                    {loading ? 'Signing in...' : 'Sign in'} <ArrowRight className="size-4" />
                  </Button>
                </>
              )}
            </div>
          )}

          {!isRecover && (
            <p className="mt-8 text-center text-sm text-[#71839a]">
              {isRegister ? 'Already have an identity?' : 'New to RETRACE?'}{' '}
              <Link className="font-semibold text-[#1463ff]" href={isRegister ? '/login' : '/register'}>
                {isRegister ? 'Sign in' : 'Create one'}
              </Link>
            </p>
          )}
        </div>
        <p className="mt-6 flex items-center gap-2 text-xs text-[#8192a8]">
          <LockKeyhole className="size-3.5" /> Authentication secured by Supabase Auth.
        </p>
      </main>
    </div>
  )
}

function Verify() {
  const router = useRouter()
  const { user, profile, refreshProfile, refreshData } = useAuth()
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [verified, setVerified] = useState(false)

  const handleVerifyPin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!/^\d{4,6}$/.test(pin.trim())) {
      setError('Enter your 4 to 6 digit Recovery PIN.')
      return
    }
    setBusy(true)
    try {
      const ok = await verifyRecoveryPinServer(pin.trim())
      if (ok) {
        setVerified(true)
        await Promise.all([refreshProfile(), refreshData()])
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Verification failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f7faff] text-[#0b1b35]">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 lg:px-8">
        <Brand />
        <Link href={user ? '/dashboard' : '/recover'} className="flex items-center gap-2 text-sm font-semibold text-[#71839a]">
          <ArrowLeft className="size-4" /> Back
        </Link>
      </header>
      <main className="mx-auto max-w-xl px-5 pb-16 pt-10">
        <div className="rounded-3xl border border-[#e1e9f3] bg-white p-7 shadow-[0_20px_70px_rgba(36,70,110,.08)] sm:p-10">
          <div className="grid size-12 place-items-center rounded-2xl bg-[#eaf8f0] text-[#2b9d69]">
            <ShieldCheck className="size-6" />
          </div>
          <h1 className="mt-6 text-3xl font-semibold tracking-tight">Security verification</h1>

          {!user ? (
            <>
              <p className="mt-3 text-sm leading-6 text-[#71839a]">
                Please sign in with your RETRACE account before verifying your Recovery PIN.
              </p>
              <Button href="/login" className="mt-6 w-full">
                Sign in to verify <ArrowRight className="size-4" />
              </Button>
            </>
          ) : !profile?.has_recovery_pin ? (
            <>
              <p className="mt-3 text-sm leading-6 text-[#71839a]">
                You haven&apos;t configured a Recovery PIN yet. Set one in Settings to enable PIN verification.
              </p>
              <Button href="/settings" className="mt-6 w-full">
                Configure Recovery PIN in Settings <ArrowRight className="size-4" />
              </Button>
            </>
          ) : verified ? (
            <div className="mt-6 rounded-2xl bg-[#eaf8f0] p-6 text-center">
              <CheckCircle2 className="mx-auto size-10 text-[#2b9d69]" />
              <h2 className="mt-3 text-lg font-semibold text-[#1f8056]">Recovery identity verified</h2>
              <p className="mt-1 text-sm text-[#4b8a6d]">Your Recovery PIN was verified securely on the server.</p>
              <Button onClick={() => router.push('/dashboard')} className="mt-5 w-full">
                Return to dashboard <ArrowRight className="size-4" />
              </Button>
            </div>
          ) : (
            <form onSubmit={handleVerifyPin} className="mt-6 flex flex-col gap-4">
              <p className="text-sm leading-6 text-[#71839a]">
                Enter your 4 to 6 digit Recovery PIN to verify your identity via server-side scrypt validation.
              </p>
              {error && (
                <div className="rounded-xl border border-[#fed7d7] bg-[#fff5f5] p-3.5 text-xs font-medium text-[#c53030]">
                  {error}
                </div>
              )}
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                placeholder="Enter 4–6 digit PIN"
                className="w-full rounded-xl border border-[#dce5f2] px-4 py-3 text-center text-lg font-semibold tracking-[0.4em] outline-none focus:border-[#1463ff]"
              />
              <Button type="submit" disabled={busy} className="w-full">
                {busy ? 'Verifying...' : 'Verify Recovery PIN'} <ArrowRight className="size-4" />
              </Button>
            </form>
          )}
        </div>
      </main>
    </div>
  )
}

const protectedRoutes = [
  '/dashboard',
  '/devices',
  '/recovery',
  '/trusted-circle',
  '/emergency-passport',
  '/activity',
  '/settings'
]

export default function RetraceApp({ initialRoute }: { initialRoute?: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const route = initialRoute || pathname

  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<PublicProfile | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)

  const [devices, setDevices] = useState<Device[]>([])
  const [contacts, setContacts] = useState<TrustedContact[]>([])
  const [recoveryRequests, setRecoveryRequests] = useState<RecoveryRequest[]>([])
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([])
  const [dataLoading, setDataLoading] = useState(false)
  const [dataError, setDataError] = useState<string | null>(null)

  const loadProfile = useCallback(async (userId: string, isCancelled?: () => boolean) => {
    setProfileLoading(true)
    setProfileError(null)
    try {
      const fetched = await getUserProfile(userId)
      if (isCancelled?.()) return
      setProfile(fetched)
      if (!fetched) {
        setProfileError('Profile record not found for this account.')
      }
    } catch (err: unknown) {
      if (isCancelled?.()) return
      const msg = err instanceof Error ? err.message : 'Unable to fetch your profile.'
      setProfileError(msg)
      setProfile(null)
    } finally {
      if (!isCancelled?.()) {
        setProfileLoading(false)
      }
    }
  }, [])

  const loadData = useCallback(async (userId: string, isCancelled?: () => boolean) => {
    setDataLoading(true)
    setDataError(null)
    try {
      const [devs, conts, reqs, logs] = await Promise.all([
        getDevices(userId),
        getTrustedContacts(userId),
        getRecoveryRequests(userId),
        getActivityLogs(userId),
      ])
      if (isCancelled?.()) return
      setDevices(devs)
      setContacts(conts)
      setRecoveryRequests(reqs)
      setActivityLogs(logs)
    } catch (err: unknown) {
      if (isCancelled?.()) return
      const msg = err instanceof Error ? err.message : 'Unable to fetch account records.'
      setDataError(msg)
    } finally {
      if (!isCancelled?.()) {
        setDataLoading(false)
      }
    }
  }, [])

  const refreshProfile = useCallback(async () => {
    if (user?.id) {
      await loadProfile(user.id)
    }
  }, [user?.id, loadProfile])

  const refreshData = useCallback(async () => {
    if (user?.id) {
      await loadData(user.id)
    }
  }, [user?.id, loadData])

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (mounted) {
        setUser(session?.user ?? null)
        setLoading(false)
      }
    }).catch(() => {
      if (mounted) {
        setLoading(false)
      }
    })

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        setUser(session?.user ?? null)
        setLoading(false)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    if (!user?.id) {
      setProfile(null)
      setProfileError(null)
      setProfileLoading(false)
      setDevices([])
      setContacts([])
      setRecoveryRequests([])
      setActivityLogs([])
      setDataError(null)
      setDataLoading(false)
      return
    }

    loadProfile(user.id, () => cancelled)
    loadData(user.id, () => cancelled)

    return () => {
      cancelled = true
    }
  }, [user?.id, loadProfile, loadData])

  useEffect(() => {
    if (!loading && user && (route === '/login' || route === '/register')) {
      router.replace('/dashboard')
    }
  }, [loading, user, route, router])

  const handleSignOut = async () => {
    await signOut()
    setUser(null)
    setProfile(null)
    setProfileError(null)
    setDevices([])
    setContacts([])
    setRecoveryRequests([])
    setActivityLogs([])
    setDataError(null)
  }

  const isProtectedRoute = protectedRoutes.includes(route)

  const authValue: AuthContextType = {
    user,
    profile,
    devices,
    contacts,
    recoveryRequests,
    activityLogs,
    loading,
    profileLoading,
    dataLoading,
    profileError,
    dataError,
    refreshProfile,
    refreshData,
    signOut: handleSignOut,
  }

  if (loading && isProtectedRoute) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7faff]">
        <div className="flex flex-col items-center gap-3">
          <div className="grid size-12 place-items-center rounded-2xl bg-[#edf4ff] text-[#1463ff]">
            <ShieldCheck className="size-6 animate-pulse" />
          </div>
          <p className="text-sm font-medium text-[#71839a]">Securing your session...</p>
        </div>
      </div>
    )
  }

  if (!loading && !user && isProtectedRoute) {
    return (
      <AuthContext.Provider value={authValue}>
        <AuthPage type="login" redirectMessage="Please sign in to access your recovery command center." />
      </AuthContext.Provider>
    )
  }

  return (
    <AuthContext.Provider value={authValue}>
      {route === '/' && <Landing />}
      {route === '/dashboard' && <Dashboard />}
      {route === '/devices' && <Devices />}
      {route === '/recovery' && <Recovery />}
      {route === '/trusted-circle' && <TrustedCircle />}
      {route === '/emergency-passport' && <Passport />}
      {route === '/activity' && <ActivityPage />}
      {route === '/settings' && <SettingsPage />}
      {route === '/register' && <AuthPage type="register" />}
      {route === '/login' && <AuthPage type="login" />}
      {route === '/recover' && <AuthPage type="recover" />}
      {route === '/verify' && <Verify />}
      {!['/', '/dashboard', '/devices', '/recovery', '/trusted-circle', '/emergency-passport', '/activity', '/settings', '/register', '/login', '/recover', '/verify'].includes(route) && <Landing />}
    </AuthContext.Provider>
  )
}
