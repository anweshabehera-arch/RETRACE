'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import {
  Activity, ArrowLeft, ArrowRight, Battery, Bell, Check, CheckCircle2, ChevronDown, CircleHelp,
  Clock3, CloudOff, Compass, Copy, ExternalLink, Eye, EyeOff, FileKey2, Fingerprint, Globe2,
  HeartHandshake, Laptop, LockKeyhole, LogOut, MapPin, Menu, MoreHorizontal, Navigation,
  Phone, Plus, QrCode, Radar, RefreshCw, Search, Send, Settings, Shield, ShieldCheck,
  Smartphone, Sparkles, Target, UserRound, UsersRound, Wifi, X, Zap
} from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { signIn, signUp, signOut } from '@/lib/supabase/auth'

const blue = '#1463ff'
const nav = [
  ['Overview','/dashboard',Activity], ['My Devices','/devices',Smartphone], ['Recover Device','/recovery',Radar],
  ['Trusted Circle','/trusted-circle',UsersRound], ['Emergency Passport','/emergency-passport',FileKey2], ['Activity Timeline','/activity',Clock3], ['Settings','/settings',Settings],
] as const

const contacts = [
  { name: 'Maya Patel', relation: 'Sister', phone: '+1 (415) ••• ••82', approved: true, initials: 'MP' },
  { name: 'Rohan Mehta', relation: 'Friend', phone: '+1 (650) ••• ••41', approved: true, initials: 'RM' },
  { name: 'Nisha Kapoor', relation: 'Parent', phone: '+1 (408) ••• ••19', approved: false, initials: 'NK' },
]

interface AuthContextType {
  user: User | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
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

function Button({ children, variant='primary', href, onClick, className='', disabled=false, type='button' }: any) {
  const cls = `inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0 ${
    variant==='primary'
      ? 'bg-[#1463ff] text-white shadow-[0_10px_24px_rgba(20,99,255,.18)] hover:bg-[#0b54e9]'
      : variant==='dark'
      ? 'bg-[#0b1b35] text-white hover:bg-[#162a49]'
      : variant==='danger'
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
              An independent recovery identity that helps you regain control of your lost device without depending on your primary Google or Apple account.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Button href="/register">Create your recovery identity <ArrowRight className="size-4" /></Button>
              <Button href="/recover" variant="outline">Recover my phone</Button>
            </div>
            <div className="mt-8 flex items-center gap-3 text-xs font-medium text-[#7489a3]">
              <div className="flex -space-x-2">
                <span className="grid size-7 place-items-center rounded-full border-2 border-[#f8fbff] bg-[#dce8ff] text-[9px] font-bold text-[#3567bc]">AS</span>
                <span className="grid size-7 place-items-center rounded-full border-2 border-[#f8fbff] bg-[#d9f3e7] text-[9px] font-bold text-[#21835a]">JM</span>
                <span className="grid size-7 place-items-center rounded-full border-2 border-[#f8fbff] bg-[#ffe6c9] text-[9px] font-bold text-[#a66a1a]">RK</span>
              </div>
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
              ['Independent Recovery Identity',Fingerprint,'A separate, secure way back in.'],
              ['Trusted Circle Recovery',UsersRound,'Recover with people who know you.'],
              ['Last Known Location',MapPin,'See the last place your device checked in.'],
              ['Digital Emergency Passport',FileKey2,'Your essential recovery information, organized.'],
              ['Smart Recovery Assistant',Sparkles,'Clear, rule-based guidance when it matters.'],
              ['Smart Return QR',QrCode,'Help a finder return your phone safely.']
            ].map(([title,Icon,desc]: any) => (
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
                  ['01','Register','Create your independent identity.'],
                  ['02','Protect','Add a device and trusted circle.'],
                  ['03','Recover','Verify, locate and return.']
                ].map(([n,t,d]) => (
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
                Permission-based location collection, masked contact details and clear recovery controls. Independent recovery identity secured through Supabase Auth.
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
              <a href="mailto:hello@retrace.demo">Contact</a>
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
          <span className="text-xs font-semibold text-[#637790]">Last known location</span>
          <MapPin className="size-4 text-[#e24d59]" />
        </div>
        <p className="mt-3 text-sm font-semibold">Mission District, SF</p>
        <p className="mt-1 text-xs text-[#8192a8]">Updated 12 minutes ago</p>
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
          <span className="mr-1.5 inline-block size-1.5 rounded-full bg-[#37b979]" /> Demo location
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
  const { user, signOut } = useAuth()

  const userInitials = useMemo(() => {
    const fullName = user?.user_metadata?.full_name
    if (fullName && typeof fullName === 'string') {
      const parts = fullName.trim().split(/\s+/).filter(Boolean)
      if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      }
      return parts[0].slice(0, 2).toUpperCase()
    }
    return user?.email ? user.email.slice(0, 2).toUpperCase() : 'AS'
  }, [user])

  const handleSignOut = async () => {
    try {
      await signOut()
      router.push('/')
    } catch (err) {
      console.error('Sign out error:', err)
      router.push('/')
    }
  }

  return (
    <div className="min-h-screen bg-[#f7faff] text-[#0b1b35]">
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-[#e2eaf4] bg-white px-4 py-5 transition-transform lg:translate-x-0 ${mobile ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between px-2">
          <Brand />
          <button className="lg:hidden" onClick={() => setMobile(false)}>
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
          <button className="rounded-lg p-2 lg:hidden" onClick={() => setMobile(true)}>
            <Menu className="size-5" />
          </button>
          <div className="hidden lg:block">
            <p className="text-sm font-semibold">{title}</p>
            {description && <p className="mt-0.5 text-xs text-[#8192a8]">{description}</p>}
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-xl border border-[#e1e9f3] px-3 py-2 text-xs text-[#9aaabd] sm:flex">
              <Search className="size-4" /> Search
            </div>
            <button className="relative rounded-xl p-2.5 text-[#71839a] hover:bg-[#f4f7fb]">
              <Bell className="size-[18px]" />
              <span className="absolute right-2 top-2 size-1.5 rounded-full bg-[#e24d59]" />
            </button>
            <div className="grid size-9 place-items-center rounded-full bg-[#dce8ff] text-xs font-bold text-[#3567bc]">
              {userInitials}
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-[1480px] px-5 py-8 lg:px-10">
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
          tone === 'green' ? 'bg-[#eaf8f0] text-[#2b9d69]' : tone === 'orange' ? 'bg-[#fff5e7] text-[#db8a2d]' : 'bg-[#edf4ff] text-[#1463ff]'
        }`}>
          <Icon className="size-[18px]" />
        </span>
      </div>
      <p className="mt-4 text-2xl font-semibold tracking-tight">{value}</p>
    </div>
  )
}

function Dashboard() {
  const [lost, setLost] = useState(false)
  const { user } = useAuth()

  const displayName = useMemo(() => {
    return user?.user_metadata?.full_name || (user?.email ? user.email.split('@')[0] : 'Anwesha')
  }, [user])

  return (
    <AppShell title="Overview" description="Your recovery command center">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm text-[#71839a]">Tuesday, November 10, 2026</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Welcome back, {displayName}.</h1>
          <p className="mt-2 text-sm text-[#71839a]">Your recovery identity is active and ready.</p>
        </div>
        <Button href="/recovery"><Radar className="size-4" /> Start recovery</Button>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Registered devices" value="2" icon={Smartphone} />
        <Stat label="Protected devices" value="2" icon={ShieldCheck} tone="green" />
        <Stat label="Trusted contacts" value="3" icon={UsersRound} />
        <Stat label="Recovery status" value="Active" icon={Zap} tone="green" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_.65fr]">
        <section className="rounded-2xl border border-[#e2eaf4] bg-white p-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className={`size-2 rounded-full ${lost ? 'bg-[#e24d59]' : 'bg-[#37b979]'}`} />
                <span className="text-sm font-semibold">{lost ? 'Marked as lost' : 'Protected device'}</span>
              </div>
              <h2 className="mt-2 text-xl font-semibold">{displayName}&apos;s iPhone 15 Pro</h2>
              <p className="mt-1 text-sm text-[#71839a]">iPhone · Registered October 24, 2026</p>
            </div>
            <button className="rounded-lg p-1 text-[#9aaabd]">
              <MoreHorizontal className="size-5" />
            </button>
          </div>
          <div className="mt-7 grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl bg-[#f6f9fd] p-4">
              <p className="text-xs text-[#8192a8]">Last active</p>
              <p className="mt-2 text-sm font-semibold">12 min ago</p>
            </div>
            <div className="rounded-xl bg-[#f6f9fd] p-4">
              <p className="text-xs text-[#8192a8]">Battery</p>
              <p className="mt-2 flex items-center gap-1.5 text-sm font-semibold">
                <Battery className="size-4 text-[#db8a2d]" /> 18%
              </p>
            </div>
            <div className="rounded-xl bg-[#f6f9fd] p-4">
              <p className="text-xs text-[#8192a8]">Connection</p>
              <p className="mt-2 flex items-center gap-1.5 text-sm font-semibold">
                <Wifi className="size-4 text-[#37a673]" /> Online
              </p>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button href="/recovery"><Navigation className="size-4" /> View recovery</Button>
            <Button variant={lost ? 'outline' : 'danger'} onClick={() => setLost(!lost)}>
              {lost ? 'Restore protected status' : 'Mark as lost'}
            </Button>
          </div>
        </section>

        <section className="rounded-2xl border border-[#e2eaf4] bg-[#0e2341] p-6 text-white">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="size-4 text-[#78a9ff]" /> Smart recovery guide
          </div>
          <p className="mt-6 text-lg font-semibold leading-7">Your device was last recorded online 12 minutes ago.</p>
          <p className="mt-3 text-sm leading-6 text-[#aebdd2]">
            Battery at last update: 18%. Consider acting soon while the device may still be reachable.
          </p>
          <div className="mt-6 rounded-xl bg-white/8 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#78a9ff]">Recommended next</p>
            <div className="mt-3 flex items-start gap-2 text-sm">
              <CheckCircle2 className="mt-0.5 size-4 text-[#64d19b]" /> Save the last known location
            </div>
            <div className="mt-2 flex items-start gap-2 text-sm">
              <UsersRound className="mt-0.5 size-4 text-[#64d19b]" /> Notify your trusted circle
            </div>
          </div>
        </section>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_.9fr]">
        <section className="rounded-2xl border border-[#e2eaf4] bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold">Last known location</h2>
              <p className="mt-1 text-xs text-[#8192a8]">Demo location · Updated 12 minutes ago</p>
            </div>
            <Button href="/recovery" variant="outline" className="px-3 py-2 text-xs">View full map</Button>
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
              Mission District, SF
            </span>
          </div>
        </section>
        <ActivityList />
      </div>
    </AppShell>
  )
}

function ActivityList() {
  return (
    <section className="rounded-2xl border border-[#e2eaf4] bg-white p-6">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Recent activity</h2>
        <Link href="/activity" className="text-xs font-semibold text-[#1463ff]">View all</Link>
      </div>
      <div className="mt-5 flex flex-col gap-5">
        {[
          ['Device registered', 'Anwesha’s iPhone 15 Pro', 'Today, 9:42 AM', Smartphone],
          ['Location updated', 'Mission District, SF', 'Today, 9:30 AM', MapPin],
          ['Trusted contact added', 'Nisha Kapoor', 'Yesterday, 4:18 PM', UsersRound],
          ['Security verification completed', 'Recovery identity verified', 'Oct 24, 2026', ShieldCheck]
        ].map(([a, b, c, Icon]: any) => (
          <div className="flex gap-3" key={a}>
            <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#edf4ff] text-[#1463ff]">
              <Icon className="size-4" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium">{a}</p>
              <p className="mt-0.5 truncate text-xs text-[#8192a8]">{b}</p>
            </div>
            <span className="ml-auto whitespace-nowrap text-[10px] text-[#a1afc0]">{c}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

function Recovery() {
  const [status, setStatus] = useState('active')
  const [toast, setToast] = useState('')
  const act = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2400)
  }

  return (
    <AppShell title="Recover device" description="Take the next right step">
      <div className="max-w-5xl">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-sm font-semibold text-[#1463ff]">Recovery center</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Let&apos;s bring your device back.</h1>
            <p className="mt-2 text-sm text-[#71839a]">All actions below are simulated for this prototype.</p>
          </div>
          <Button href="/dashboard" variant="outline"><ArrowLeft className="size-4" /> Back to overview</Button>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.05fr_.95fr]">
          <section className="rounded-2xl border border-[#e2eaf4] bg-white p-6">
            <div className="flex items-center gap-4">
              <div className="grid size-16 place-items-center rounded-2xl bg-[#edf4ff] text-[#1463ff]">
                <Smartphone className="size-8" />
              </div>
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold text-[#e24d59]">
                  <span className="size-1.5 rounded-full bg-[#e24d59]" /> {status === 'recovered' ? 'Recovered' : 'Recovery in progress'}
                </div>
                <h2 className="mt-1 text-xl font-semibold">Anwesha&apos;s iPhone 15 Pro</h2>
                <p className="mt-1 text-sm text-[#71839a]">Last seen 12 minutes ago · Battery 18%</p>
              </div>
            </div>

            {status === 'recovered' ? (
              <div className="mt-8 rounded-xl bg-[#eaf8f0] p-6 text-center">
                <div className="mx-auto grid size-14 place-items-center rounded-full bg-[#2b9d69] text-white">
                  <Check className="size-7" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-[#1f8056]">Device marked as recovered</h3>
                <p className="mt-2 text-sm text-[#4b8a6d]">Your recovery timeline has been updated.</p>
              </div>
            ) : (
              <>
                <div className="mt-8">
                  <div className="flex justify-between text-xs font-semibold">
                    <span>Recovery progress</span>
                    <span className="text-[#1463ff]">2 of 4 steps</span>
                  </div>
                  <div className="mt-3 flex gap-1.5">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className={`h-2 flex-1 rounded-full ${i <= 2 ? 'bg-[#1463ff]' : 'bg-[#e8eef7]'}`} />
                    ))}
                  </div>
                </div>

                <div className="mt-8 grid gap-3 sm:grid-cols-2">
                  {[
                    ['Ring device', 'Play a simulated sound on your phone.', Zap],
                    ['Mark as lost', 'Secure your recovery status.', Shield],
                    ['Notify trusted circle', 'Send a simulated recovery request.', Send],
                    ['View location', 'Open the demo last known location.', MapPin]
                  ].map(([t, d, Icon]: any) => (
                    <button
                      key={t}
                      onClick={() => act(`${t} action simulated`)}
                      className="flex items-start gap-3 rounded-xl border border-[#e1e9f3] p-4 text-left transition hover:border-[#b8cbea] hover:bg-[#fbfdff]"
                    >
                      <span className="grid size-9 place-items-center rounded-lg bg-[#edf4ff] text-[#1463ff]">
                        <Icon className="size-4" />
                      </span>
                      <span>
                        <span className="block text-sm font-semibold">{t}</span>
                        <span className="mt-1 block text-xs leading-5 text-[#8192a8]">{d}</span>
                      </span>
                    </button>
                  ))}
                </div>

                <Button variant="dark" className="mt-6 w-full" onClick={() => setStatus('recovered')}>
                  <CheckCircle2 className="size-4" /> Mark as recovered
                </Button>
              </>
            )}
          </section>

          <section className="rounded-2xl border border-[#e2eaf4] bg-white p-6">
            <div className="flex items-center gap-2">
              <MapPin className="size-4 text-[#e24d59]" />
              <h2 className="font-semibold">Last recorded location</h2>
            </div>
            <div
              className="mt-5 h-64 rounded-xl bg-[#dceaf9]"
              style={{
                backgroundImage:
                  'linear-gradient(34deg, transparent 45%, #b7cce4 46%, #b7cce4 48%, transparent 49%), linear-gradient(110deg, transparent 44%, #c5d8ed 45%, #c5d8ed 47%, transparent 48%)'
              }}
            >
              <div className="flex h-full items-center justify-center">
                <div className="grid size-16 place-items-center rounded-full bg-[#1463ff]/15">
                  <span className="grid size-9 place-items-center rounded-full bg-[#1463ff] text-white">
                    <MapPin className="size-5" />
                  </span>
                </div>
              </div>
            </div>
            <p className="mt-4 text-sm font-semibold">Mission District, San Francisco</p>
            <p className="mt-1 text-xs text-[#8192a8]">Demo data · Tuesday, 9:30 AM</p>
            <div className="mt-5 rounded-xl bg-[#fff7e9] p-4 text-xs leading-5 text-[#9a6a26]">
              <strong>Safety note:</strong> Do not approach an unfamiliar location alone. Contact local authorities if theft is suspected.
            </div>
          </section>
        </div>
      </div>
      {toast && (
        <div className="fixed bottom-5 right-5 rounded-xl bg-[#0b1b35] px-4 py-3 text-sm font-medium text-white shadow-xl">
          {toast}
        </div>
      )}
    </AppShell>
  )
}

function TrustedCircle() {
  const [approved, setApproved] = useState(2)
  const [toast, setToast] = useState('')

  return (
    <AppShell title="Trusted Circle" description="People you trust, ready when needed">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold text-[#1463ff]">Your safety network</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Trusted Circle</h1>
          <p className="mt-2 text-sm text-[#71839a]">Two out of three approvals are required for recovery.</p>
        </div>
        <Button onClick={() => {
          setToast('Recovery request sent to your circle')
          setTimeout(() => setToast(''), 2400)
        }}>
          <Send className="size-4" /> Send recovery request
        </Button>
      </div>

      <div className="mt-8 rounded-2xl border border-[#dce8f6] bg-[#eef5ff] p-6">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#4773b8]">Approval status</p>
            <p className="mt-2 text-xl font-semibold">{approved >= 2 ? 'Recovery approved' : 'Waiting for approvals'}</p>
          </div>
          <div className="flex items-center gap-3">
            {contacts.map((c, i) => (
              <div
                key={c.name}
                className={`grid size-11 place-items-center rounded-full border-2 text-xs font-bold ${
                  i < approved ? 'border-[#37b979] bg-[#eaf8f0] text-[#2b9d69]' : 'border-white bg-white text-[#a1afc0]'
                }`}
              >
                {i < approved ? <Check className="size-4" /> : c.initials}
              </div>
            ))}
          </div>
        </div>
        <div className="mt-5 h-2 overflow-hidden rounded-full bg-white">
          <div
            className="h-full rounded-full bg-[#37b979] transition-all"
            style={{ width: `${(approved / 3) * 100}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-[#637790]">{approved} of 3 approvals received</p>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {contacts.map((c, i) => (
          <div key={c.name} className="rounded-2xl border border-[#e2eaf4] bg-white p-5">
            <div className="flex items-start justify-between">
              <div className="grid size-11 place-items-center rounded-full bg-[#edf4ff] text-xs font-bold text-[#3567bc]">
                {c.initials}
              </div>
              <button className="text-[#9aaabd]">
                <MoreHorizontal className="size-5" />
              </button>
            </div>
            <h2 className="mt-5 font-semibold">{c.name}</h2>
            <p className="mt-1 text-sm text-[#71839a]">{c.relation} · {c.phone}</p>
            <div className="mt-5 flex items-center justify-between">
              <span className={`flex items-center gap-1.5 text-xs font-semibold ${i < approved ? 'text-[#2b9d69]' : 'text-[#a1afc0]'}`}>
                <span className={`size-1.5 rounded-full ${i < approved ? 'bg-[#37b979]' : 'bg-[#c6d0dc]'}`} />
                {i < approved ? 'Approved' : 'Waiting'}
              </span>
              {i >= approved && (
                <button onClick={() => setApproved(Math.min(3, approved + 1))} className="text-xs font-semibold text-[#1463ff]">
                  Simulate approve
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-2xl border border-[#e2eaf4] bg-white p-6">
        <div className="flex items-start gap-3">
          <div className="grid size-10 place-items-center rounded-xl bg-[#edf4ff] text-[#1463ff]">
            <ShieldCheck className="size-5" />
          </div>
          <div>
            <h2 className="font-semibold">Why 2-of-3?</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-[#71839a]">
              No single contact can trigger recovery alone. This simulated threshold gives you a safety layer against unauthorized access while staying practical in an emergency.
            </p>
          </div>
        </div>
      </div>
      {toast && (
        <div className="fixed bottom-5 right-5 rounded-xl bg-[#0b1b35] px-4 py-3 text-sm font-medium text-white shadow-xl">
          {toast}
        </div>
      )}
    </AppShell>
  )
}

function Devices() {
  return (
    <AppShell title="My devices" description="Your protected devices">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">My devices</h1>
          <p className="mt-2 text-sm text-[#71839a]">2 devices protected by your recovery identity.</p>
        </div>
        <Button onClick={() => alert('Add device flow simulated')}>
          <Plus className="size-4" /> Add device
        </Button>
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        {[
          ['Anwesha’s iPhone 15 Pro', 'iPhone', 'Online', '18%', 'Mission District, SF', 'Oct 24, 2026', Smartphone],
          ['Anwesha’s MacBook Air', 'MacBook', 'Offline', '—', 'Last seen in Oakland, CA', 'Oct 24, 2026', Laptop]
        ].map(([name, type, online, battery, location, date, Icon]: any) => (
          <div key={name} className="rounded-2xl border border-[#e2eaf4] bg-white p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="grid size-14 place-items-center rounded-2xl bg-[#edf4ff] text-[#1463ff]">
                  <Icon className="size-7" />
                </div>
                <div>
                  <h2 className="font-semibold">{name}</h2>
                  <p className="mt-1 text-sm text-[#71839a]">{type} · Registered {date}</p>
                </div>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                online === 'Online' ? 'bg-[#eaf8f0] text-[#2b9d69]' : 'bg-[#f1f4f8] text-[#8192a8]'
              }`}>
                {online}
              </span>
            </div>
            <div className="mt-7 grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-[#8192a8]">Last known battery</p>
                <p className="mt-1 text-sm font-semibold">{battery}</p>
              </div>
              <div>
                <p className="text-xs text-[#8192a8]">Last known location</p>
                <p className="mt-1 text-sm font-semibold">{location}</p>
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <Button href="/recovery" className="flex-1">View details</Button>
              <Button variant="outline" onClick={() => alert('Location view simulated')}>
                <MapPin className="size-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  )
}

function ActivityPage() {
  const [filter, setFilter] = useState('All Activity')
  const events = [
    ['Device registered', 'Anwesha’s iPhone 15 Pro', 'Today, 9:42 AM', 'Device', Smartphone],
    ['Last location recorded', 'Mission District, San Francisco', 'Today, 9:30 AM', 'Device', MapPin],
    ['Device went offline', 'Anwesha’s MacBook Air', 'Yesterday, 6:22 PM', 'Device', CloudOff],
    ['Recovery dashboard accessed', 'Safari on MacBook Air', 'Yesterday, 4:20 PM', 'Security', Globe2],
    ['Trusted contact approved', 'Maya Patel approved recovery', 'Yesterday, 4:18 PM', 'Recovery', UsersRound],
    ['Backup verification completed', 'Recovery identity verified', 'Oct 24, 2026', 'Security', ShieldCheck]
  ]

  return (
    <AppShell title="Activity timeline" description="A transparent record of your safety">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Activity timeline</h1>
        <p className="mt-2 text-sm text-[#71839a]">A clear record of everything important.</p>
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
        <div className="flex flex-col gap-7">
          {events.filter((e) => filter === 'All Activity' || e[3] === filter).map(([a, b, c, , Icon]: any, i) => (
            <div key={a} className="relative flex gap-4">
              <div className="relative z-10 grid size-10 shrink-0 place-items-center rounded-xl bg-[#edf4ff] text-[#1463ff]">
                <Icon className="size-4" />
              </div>
              {i < events.length - 1 && (
                <div className="absolute bottom-[-28px] left-5 top-10 w-px bg-[#e3ebf5]" />
              )}
              <div>
                <p className="font-semibold">{a}</p>
                <p className="mt-1 text-sm text-[#71839a]">{b}</p>
                <p className="mt-2 text-xs text-[#a1afc0]">{c}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  )
}

function Passport() {
  return (
    <AppShell title="Emergency passport" description="Your essential recovery information">
      <div className="max-w-4xl">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Digital emergency passport</h1>
            <p className="mt-2 text-sm text-[#71839a]">Private, practical information for a stressful moment.</p>
          </div>
          <Button variant="outline" onClick={() => alert('Print view simulated')}>
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
              <p className="mt-1 font-semibold">RTR-2048-ANWESHA</p>
            </div>
            <span className="ml-auto rounded-full bg-[#eaf8f0] px-2.5 py-1 text-[11px] font-semibold text-[#2b9d69]">
              Active
            </span>
          </div>
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <section className="rounded-2xl border border-[#e2eaf4] bg-white p-6">
            <h2 className="font-semibold">Registered device</h2>
            <div className="mt-5 flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-xl bg-[#edf4ff] text-[#1463ff]">
                <Smartphone className="size-5" />
              </div>
              <div>
                <p className="text-sm font-semibold">iPhone 15 Pro</p>
                <p className="text-xs text-[#8192a8]">Serial ending in 4821 · Protected</p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-[#e2eaf4] bg-white p-6">
            <h2 className="font-semibold">Recovery contacts</h2>
            <div className="mt-5 flex gap-2">
              {contacts.map((c) => (
                <div key={c.name} className="grid size-10 place-items-center rounded-full bg-[#edf4ff] text-xs font-bold text-[#3567bc]">
                  {c.initials}
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-[#8192a8]">Phone numbers and email remain masked.</p>
          </section>
        </div>

        <section className="mt-6 rounded-2xl border border-[#e2eaf4] bg-white p-6">
          <h2 className="font-semibold">Emergency checklist</h2>
          <div className="mt-5 grid gap-3">
            {[
              'Attempt to locate the device.',
              'Contact trusted people.',
              'Mark the device as lost.',
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
  const { user, signOut } = useAuth()

  const handleSignOut = async () => {
    try {
      await signOut()
      router.push('/')
    } catch (err) {
      console.error('Sign out error:', err)
      router.push('/')
    }
  }

  const profileSummary = user?.user_metadata?.full_name
    ? `${user.user_metadata.full_name} · ${user.email ?? ''}`
    : user?.email ?? 'Anwesha Sharma · anwesha@example.com'

  return (
    <AppShell title="Settings" description="Manage your recovery identity">
      <div className="max-w-4xl">
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-2 text-sm text-[#71839a]">Keep your recovery identity current and secure.</p>
        <div className="mt-8 flex flex-col gap-5">
          {[
            ['Profile information', profileSummary, UserRound],
            ['Account security', 'Password, recovery PIN and verification', LockKeyhole],
            ['Backup phone number', '+1 (415) ••• ••82', Phone],
            ['Notification preferences', 'Recovery requests and device updates', Bell],
            ['Privacy and location permissions', 'Location sharing is permission-based', Globe2]
          ].map(([t, d, Icon]: any) => (
            <button
              key={t}
              onClick={() => alert(`${t} settings simulated`)}
              className="flex items-center gap-4 rounded-2xl border border-[#e2eaf4] bg-white p-5 text-left transition hover:border-[#b8cbea]"
            >
              <span className="grid size-11 place-items-center rounded-xl bg-[#edf4ff] text-[#1463ff]">
                <Icon className="size-5" />
              </span>
              <span className="flex-1">
                <span className="block font-semibold">{t}</span>
                <span className="mt-1 block text-sm text-[#8192a8]">{d}</span>
              </span>
              <ArrowRight className="size-4 text-[#9aaabd]" />
            </button>
          ))}
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
  const [rememberMe, setRememberMe] = useState(false)

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
    setStep(nextStep)
  }

  const handleRegisterSubmit = async () => {
    setError(null)
    setLoading(true)
    try {
      // Per security requirements:
      // Store ONLY full_name in Supabase Auth user metadata for now.
      // Do not store recovery PIN, backup phone, device or contact info in plain text or Auth metadata.
      const result = await signUp({
        email: email.trim(),
        password,
        fullName: fullName.trim(),
      })

      if (result.session) {
        // Auto-confirm was enabled in project settings
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
                Your recovery identity is protected. Once you confirm your email address, you can sign in and manage your protected devices and trusted circle.
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

          {isRecover ? (
            <div className="mt-8 flex flex-col gap-3">
              <Button href="/verify" className="w-full">
                Continue with RETRACE credentials <ArrowRight className="size-4" />
              </Button>
              <Button href="/verify" variant="outline" className="w-full">
                <FileKey2 className="size-4" /> Use recovery code
              </Button>
              <div className="mt-4 rounded-xl bg-[#f5f8fd] p-4 text-sm leading-6 text-[#637790]">
                <Phone className="mr-2 inline size-4 text-[#1463ff]" /> Backup phone verification and Trusted Circle approval are available on the next step.
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
                      placeholder="Anwesha Sharma"
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
                        placeholder="8+ characters"
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
                    {step === 2 ? 'Backup phone number' : step === 3 ? 'Device name' : 'Trusted contact name'}
                    <input
                      value={step === 2 ? backupPhone : step === 3 ? deviceName : contactName}
                      onChange={(e) => {
                        if (step === 2) setBackupPhone(e.target.value)
                        else if (step === 3) setDeviceName(e.target.value)
                        else setContactName(e.target.value)
                      }}
                      disabled={loading}
                      className="mt-2 w-full rounded-xl border border-[#dce5f2] px-4 py-3 text-sm outline-none focus:border-[#1463ff] disabled:bg-[#f6f9fc]"
                      placeholder={step === 2 ? '+1 415 555 0182' : step === 3 ? 'Anwesha’s iPhone 15 Pro' : 'Maya Patel'}
                    />
                  </label>
                  <label className="text-sm font-semibold">
                    {step === 2 ? 'Create recovery PIN' : step === 3 ? 'Device type' : 'Phone number'}
                    <input
                      value={step === 2 ? recoveryPin : step === 3 ? deviceType : contactPhone}
                      onChange={(e) => {
                        if (step === 2) setRecoveryPin(e.target.value)
                        else if (step === 3) setDeviceType(e.target.value)
                        else setContactPhone(e.target.value)
                      }}
                      disabled={loading}
                      className="mt-2 w-full rounded-xl border border-[#dce5f2] px-4 py-3 text-sm outline-none focus:border-[#1463ff] disabled:bg-[#f6f9fc]"
                      placeholder={step === 2 ? '••••' : step === 3 ? 'iPhone' : '+1 415 555 0182'}
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
                    Email or registered phone
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
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                      /> Remember me
                    </label>
                    <a className="font-semibold text-[#1463ff]" href="#">Forgot password?</a>
                  </div>
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
  const [approved, setApproved] = useState(1)
  return (
    <div className="min-h-screen bg-[#f7faff] text-[#0b1b35]">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 lg:px-8">
        <Brand />
        <Link href="/recover" className="flex items-center gap-2 text-sm font-semibold text-[#71839a]">
          <ArrowLeft className="size-4" /> Back
        </Link>
      </header>
      <main className="mx-auto max-w-xl px-5 pb-16 pt-10">
        <div className="rounded-3xl border border-[#e1e9f3] bg-white p-7 shadow-[0_20px_70px_rgba(36,70,110,.08)] sm:p-10">
          <div className="grid size-12 place-items-center rounded-2xl bg-[#eaf8f0] text-[#2b9d69]">
            <ShieldCheck className="size-6" />
          </div>
          <h1 className="mt-6 text-3xl font-semibold tracking-tight">Verify your recovery</h1>
          <p className="mt-3 text-sm leading-6 text-[#71839a]">
            We sent a simulated verification code to your backup phone ending in <strong className="text-[#27405e]">82</strong>.
          </p>
          <div className="mt-8 flex gap-2">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <input
                key={n}
                maxLength={1}
                className="size-11 rounded-xl border border-[#dce5f2] text-center text-lg font-semibold outline-none focus:border-[#1463ff]"
                aria-label={`Digit ${n}`}
              />
            ))}
          </div>
          <Button href="/dashboard" className="mt-6 w-full">
            Verify and continue <ArrowRight className="size-4" />
          </Button>
          <div className="mt-8 rounded-2xl bg-[#f5f8fd] p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Trusted Circle approval</p>
              <span className="text-xs font-semibold text-[#2b9d69]">{approved} of 2 required</span>
            </div>
            <div className="mt-4 flex gap-2">
              <div className="h-2 flex-1 rounded-full bg-[#37b979]" />
              <div className={`h-2 flex-1 rounded-full ${approved >= 2 ? 'bg-[#37b979]' : 'bg-[#dfe8f3]'}`} />
            </div>
            <p className="mt-3 text-xs leading-5 text-[#8192a8]">One contact has approved. This is a simulated workflow for the prototype.</p>
            <button onClick={() => setApproved(2)} className="mt-3 text-xs font-semibold text-[#1463ff]">
              Simulate second approval
            </button>
          </div>
          <button className="mt-6 flex w-full items-center justify-center gap-2 text-sm font-semibold text-[#1463ff]">
            <FileKey2 className="size-4" /> Use a recovery code instead
          </button>
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
  const route = initialRoute || pathname

  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    // Check initial active session
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

    // Listen to real-time auth changes across tabs and actions
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

  const handleSignOut = async () => {
    await signOut()
    setUser(null)
  }

  const isProtectedRoute = protectedRoutes.includes(route)

  // Calmer loader when verifying session on a protected route
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

  // Client-side route protection: Redirect unauthenticated users
  if (!loading && !user && isProtectedRoute) {
    return (
      <AuthContext.Provider value={{ user, loading, signOut: handleSignOut }}>
        <AuthPage type="login" redirectMessage="Please sign in to access your recovery command center." />
      </AuthContext.Provider>
    )
  }

  return (
    <AuthContext.Provider value={{ user, loading, signOut: handleSignOut }}>
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
