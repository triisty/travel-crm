"use client"
import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import {
  LayoutDashboard, ClipboardList, Wallet, CreditCard, Globe,
  Settings, HelpCircle, LogOut, BotMessageSquare, Users,
  PlaneTakeoff, Building2, Scale, Clock, MessageCircle,
  ChevronRight, ChevronLeft, FileText, User, Activity, Trophy,
  Menu, X, ChevronDown, Lock
} from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useUserRole } from "@/lib/hooks/useUserRole"
import { ThemeToggle } from "@/components/ThemeProvider"
import { useDemo } from "@/components/DemoContext"

// ── Menu config ───────────────────────────────────────────────
const MAIN_MENU = [
  { href: "/",          label: "Dashboard",   icon: LayoutDashboard, section: "menu", roles: ["it_admin","boss","direktor","muhasib","menecer","bilet_menecer","tender_menecer"] },
  { href: "/bookings",  label: "Sifarişlər",  icon: ClipboardList,   section: "menu", roles: ["it_admin","boss","direktor","muhasib","menecer","bilet_menecer"] },
  { href: "/drafts",    label: "Təsdiq",      icon: Clock,           section: "menu", roles: ["it_admin","direktor","muhasib","menecer"] },
  { href: "/mesajlar",  label: "Mesajlar",    icon: MessageCircle,   section: "menu", roles: ["it_admin","boss","direktor","muhasib","menecer","bilet_menecer"] },
  { href: "/tenders",   label: "Tenderlər",   icon: Trophy,          section: "menu", roles: ["it_admin","boss","direktor","tender_menecer","muhasib"] },
  { href: "/employees", label: "İşçilər",     icon: Users,           section: "menu", roles: ["it_admin","boss","direktor","muhasib"] },
  { href: "/assistant", label: "AI Köməkçi",  icon: BotMessageSquare,section: "menu", roles: ["it_admin","boss","direktor","muhasib","menecer"] },
  { href: "/mir",       label: "MIR Import",  icon: FileText,        section: "menu", roles: ["it_admin","direktor","menecer","bilet_menecer"] },
  { href: "/flights",   label: "TK NDC",      icon: PlaneTakeoff,    section: "menu", roles: ["it_admin","direktor","menecer"] },
  { href: "/passwords", label: "Parollar", icon: Lock, section: "menu", roles: ["it_admin", "direktor", "smm"] },
]

const FINANCE_MENU = [
  { href: "/finances",  label: "Maliyyə",     icon: Wallet },
  { href: "/debts",     label: "Borclar",     icon: CreditCard },
  { href: "/creditors", label: "Kreditorlar", icon: Building2 },
  { href: "/balances",  label: "Balanslar",   icon: Scale },
  { href: "/iata",      label: "IATA",        icon: Globe },
]

const TOOLS_MENU = [
  { href: "/logs",      label: "Jurnal",      icon: Activity,  roles: ["it_admin"] },
  { href: "/founder",   label: "Əsasçı",      icon: User,      roles: ["it_admin","direktor","boss","muhasib"] },
  { href: "/settings",  label: "Ayarlar",     icon: Settings,  roles: ["it_admin","boss","direktor","muhasib","menecer","bilet_menecer","tender_menecer"] },
  { href: "/help",      label: "Yardım",      icon: HelpCircle,roles: ["it_admin","boss","direktor","muhasib","menecer","bilet_menecer","tender_menecer"] },
]

const FINANCE_ROLES = ["it_admin","boss","direktor","muhasib","bilet_menecer"]

const ROLE_LABELS: Record<string,string> = {
  it_admin: "IT Admin", boss: "Boss", direktor: "Direktor",
  muhasib: "Mühasib", menecer: "Menecer", bilet_menecer: "Bilet Menecer",
  tender_menecer: "Tender Menecer",
}
const ROLE_COLOR: Record<string,string> = {
  it_admin:"#e84545", boss:"#e84545", direktor:"#4a90d9",
  muhasib:"#2bb5a0", menecer:"#f5a623", bilet_menecer:"#7c5cbf",
  tender_menecer:"#2bb5a0",
}

function useUnread(id?: string) {
  const [n, setN] = useState(0)
  useEffect(() => {
    if (!id) return
    const load = async () => {
      const { data } = await supabase.from("messages").select("id").eq("receiver_id", id).eq("is_read", false)
      setN(data?.length ?? 0)
    }
    load()
    const t = setInterval(load, 10000)
    return () => clearInterval(t)
  }, [id])
  return n
}

// ── NavItem ───────────────────────────────────────────────────
function NavItem({ href, label, icon: Icon, active, badge, collapsed }: any) {
  return (
    <Link href={href}
      className={`nav-item ${active ? "active" : ""}`}
      style={{ justifyContent: collapsed ? "center" : "flex-start", padding: collapsed ? "8px" : "6px 10px" }}>
      <div className="relative flex-shrink-0">
        <Icon size={15} strokeWidth={active ? 2.2 : 1.8} />
        {badge > 0 && collapsed && (
          <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full text-white text-[8px] font-bold flex items-center justify-center"
            style={{ background: "var(--accent)" }}>
            {badge > 9 ? "9" : badge}
          </span>
        )}
      </div>
      {!collapsed && (
        <>
          <span className="flex-1 text-[13px] truncate">{label}</span>
          {badge > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white"
              style={{ background: "var(--accent)" }}>
              {badge > 9 ? "9+" : badge}
            </span>
          )}
        </>
      )}
      {collapsed && (
        <div className="absolute left-full ml-2.5 px-2.5 py-1 rounded-md text-[12px] font-medium text-white pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50"
          style={{ background: "#1a2332", top: "50%", transform: "translateY(-50%)", boxShadow: "0 4px 12px rgba(0,0,0,0.2)" }}>
          {label}
          <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent" style={{ borderRightColor: "#1a2332" }} />
        </div>
      )}
    </Link>
  )
}

// ── Mobile nav ────────────────────────────────────────────────
export function MobileNav() {
  const pathname = usePathname()
  const router = useRouter()
  const { profile } = useUserRole()
  const [open, setOpen] = useState(false)
  const unread = useUnread(profile?.id)
  const mainMenu = MAIN_MENU.filter(m => !profile || m.roles.includes(profile.role))
  const toolsMenu = TOOLS_MENU.filter(m => !profile || m.roles.includes(profile.role))
  const showFin = profile && FINANCE_ROLES.includes(profile.role)
  const finMenu = profile?.role === "bilet_menecer" ? FINANCE_MENU.filter(f => f.href === "/iata") : FINANCE_MENU

  async function logout() { await supabase.auth.signOut(); router.push("/login"); router.refresh() }

  return (
    <>
      {/* Top bar */}
      <div className="md:hidden sticky top-0 z-40 flex items-center justify-between px-4 h-12"
        style={{ background: "var(--sidebar-bg)", borderBottom: "1px solid var(--sidebar-border)" }}>
        <Image src="/logo.png" alt="ITS Tour" width={72} height={24} style={{ objectFit: "contain" }} />
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <button onClick={() => setOpen(v => !v)}
            className="w-8 h-8 flex items-center justify-center rounded-lg"
            style={{ color: "var(--text-secondary)", background: "var(--bg-hover)" }}>
            {open ? <X size={16} /> : <Menu size={16} />}
          </button>
        </div>
      </div>

      {/* Drawer */}
      {open && (
        <div className="md:hidden fixed inset-0 z-50" onClick={() => setOpen(false)}>
          <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.4)" }} />
          <div className="absolute right-0 top-0 h-full w-72 overflow-y-auto"
            style={{ background: "var(--sidebar-bg)", borderLeft: "1px solid var(--sidebar-border)" }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4" style={{ borderBottom: "1px solid var(--sidebar-border)" }}>
              <Image src="/logo.png" alt="ITS Tour" width={80} height={28} style={{ objectFit: "contain" }} />
              <button onClick={() => setOpen(false)} style={{ color: "var(--text-muted)" }}><X size={16} /></button>
            </div>
            <div className="p-3 space-y-0.5">
              <span className="section-label">MENU</span>
              {mainMenu.map(item => (
                <NavItem key={item.href} {...item} active={pathname === item.href}
                  badge={item.href === "/mesajlar" ? unread : 0} collapsed={false} />
              ))}
              {showFin && <>
                <span className="section-label mt-3">MALİYYƏ</span>
                {finMenu.map(item => <NavItem key={item.href} {...item} active={pathname === item.href} badge={0} collapsed={false} />)}
              </>}
              <span className="section-label mt-3">TOOLS</span>
              {toolsMenu.map(item => <NavItem key={item.href} {...item} active={pathname === item.href} badge={0} collapsed={false} />)}
            </div>
            <div className="p-3" style={{ borderTop: "1px solid var(--sidebar-border)" }}>
              <button onClick={logout} className="nav-item w-full" style={{ color: "var(--danger)" }}>
                <LogOut size={15} /><span>Çıxış</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom tab bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40"
        style={{ background: "var(--sidebar-bg)", borderTop: "1px solid var(--sidebar-border)", paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="flex items-center justify-around py-1.5 px-3">
          {[
            { href: "/", label: "Dashboard", icon: LayoutDashboard },
            { href: "/bookings", label: "Sifarişlər", icon: ClipboardList },
            { href: "/finances", label: "Maliyyə", icon: Wallet },
            { href: "/mesajlar", label: "Mesajlar", icon: MessageCircle },
          ].map(item => {
            const isActive = pathname === item.href
            const Icon = item.icon
            return (
              <Link key={item.href} href={item.href}
                className="flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg transition-all"
                style={{ color: isActive ? "var(--accent)" : "var(--text-muted)" }}>
                <Icon size={19} strokeWidth={isActive ? 2.2 : 1.6} />
                <span style={{ fontSize: "10px", fontWeight: isActive ? 600 : 400 }}>{item.label}</span>
              </Link>
            )
          })}
          <button onClick={() => setOpen(true)} className="flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg" style={{ color: "var(--text-muted)" }}>
            <Menu size={19} strokeWidth={1.6} />
            <span style={{ fontSize: "10px" }}>Menyu</span>
          </button>
        </div>
      </div>
      <div className="md:hidden h-16" />
    </>
  )
}

// ── Desktop Sidebar ───────────────────────────────────────────
export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { profile } = useUserRole()
  const { demo, toggleDemo } = useDemo()
  const [collapsed, setCollapsed] = useState(false)
  const [finOpen, setFinOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const unread = useUnread(profile?.id)

  useEffect(() => {
    setMounted(true)
    const c = localStorage.getItem("sb_collapsed")
    if (c !== null) setCollapsed(c === "1")
    const finPaths = ["/finances","/debts","/creditors","/balances","/iata"]
    if (finPaths.includes(pathname)) setFinOpen(true)
  }, [])

  function toggle() {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem("sb_collapsed", next ? "1" : "0")
  }

  async function logout() { await supabase.auth.signOut(); router.push("/login"); router.refresh() }

  if (!mounted) return (
    <div className="hidden md:block flex-shrink-0" style={{ width: 56, minHeight: "100vh", background: "var(--sidebar-bg)", borderRight: "1px solid var(--sidebar-border)" }} />
  )

  const mainMenu = MAIN_MENU.filter(m => !profile || m.roles.includes(profile.role))
  const toolsMenu = TOOLS_MENU.filter(m => !profile || m.roles.includes(profile.role))
  const showFin = profile && FINANCE_ROLES.includes(profile.role)
  const finMenu = profile?.role === "bilet_menecer" ? FINANCE_MENU.filter(f => f.href === "/iata") : FINANCE_MENU
  const isFinActive = finMenu.some(f => pathname === f.href)
  const initials = profile?.fullName?.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2) ?? "?"
  const roleColor = ROLE_COLOR[profile?.role ?? ""] ?? "var(--accent)"
  const w = collapsed ? 56 : 220

  return (
    <>
      <div className="hidden md:flex flex-col fixed top-0 left-0 h-full z-40"
        style={{ width: w, background: "var(--sidebar-bg)", borderRight: "1px solid var(--sidebar-border)", transition: "width 0.22s cubic-bezier(0.4,0,0.2,1)", overflow: "hidden" }}>

        {/* Logo */}
        <div className="flex items-center h-[60px] px-3 flex-shrink-0"
          style={{ borderBottom: "1px solid var(--sidebar-border)", justifyContent: collapsed ? "center" : "space-between" }}>
          {!collapsed && (
            <Image src="/logo.png" alt="ITS Tour" width={90} height={30}
              style={{ objectFit: "contain", objectPosition: "left" }} priority />
          )}
          <button onClick={toggle}
            className="w-7 h-7 flex items-center justify-center rounded-lg flex-shrink-0 transition-all hover:scale-110"
            style={{ color: "var(--text-muted)", background: "var(--bg-hover)" }}>
            {collapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
          </button>
        </div>

        {/* Nav */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden py-4 px-2 space-y-0.5">

          {/* Main menu */}
          {!collapsed && <span className="section-label">MENU</span>}
          {mainMenu.map(item => (
            <div key={item.href} className="relative group">
              <NavItem href={item.href} label={item.label} icon={item.icon}
                active={pathname === item.href}
                badge={item.href === "/mesajlar" ? unread : 0}
                collapsed={collapsed} />
            </div>
          ))}

          {/* Finance section */}
          {showFin && (
            <div className="pt-3">
              {!collapsed && <span className="section-label">MALİYYƏ</span>}
              {collapsed && <div className="h-px my-2 mx-1" style={{ background: "var(--border-color)" }} />}

              {!collapsed ? (
                <>
                  <button onClick={() => setFinOpen(v => !v)}
                    className={`nav-item w-full ${isFinActive ? "active" : ""}`}>
                    <Wallet size={15} strokeWidth={1.8} />
                    <span className="flex-1 text-[13px]">Maliyyə</span>
                    <ChevronDown size={12} style={{ opacity: 0.5, transform: finOpen ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s" }} />
                  </button>
                  {finOpen && (
                    <div className="mt-1 ml-4 pl-3 space-y-0.5" style={{ borderLeft: "1.5px solid var(--border-color)" }}>
                      {finMenu.map(item => {
                        const Icon = item.icon
                        return (
                          <Link key={item.href} href={item.href}
                            className={`nav-item ${pathname === item.href ? "active" : ""}`}>
                            <Icon size={13} strokeWidth={1.8} />
                            <span className="text-[12px]">{item.label}</span>
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </>
              ) : (
                finMenu.map(item => (
                  <div key={item.href} className="relative group">
                    <NavItem href={item.href} label={item.label} icon={item.icon} active={pathname === item.href} badge={0} collapsed={true} />
                  </div>
                ))
              )}
            </div>
          )}

          {/* Tools */}
          <div className="pt-3">
            {!collapsed && <span className="section-label">TOOLS</span>}
            {collapsed && <div className="h-px my-2 mx-1" style={{ background: "var(--border-color)" }} />}
            {toolsMenu.map(item => (
              <div key={item.href} className="relative group">
                <NavItem href={item.href} label={item.label} icon={item.icon} active={pathname === item.href} badge={0} collapsed={collapsed} />
              </div>
            ))}
          </div>
        </div>

        {/* Bottom */}
        <div className="flex-shrink-0 p-2 space-y-1" style={{ borderTop: "1px solid var(--sidebar-border)" }}>
          {/* Demo */}
          <div className="relative group">
            <button onClick={toggleDemo}
              className={`nav-item w-full ${demo ? "active" : ""}`}
              style={{ justifyContent: collapsed ? "center" : "flex-start" }}>
              <span style={{ fontSize: 14 }}>🎬</span>
              {!collapsed && <span className="text-[13px] flex-1">Demo{demo ? ": ON" : ""}</span>}
            </button>
          </div>

          {/* Theme + logout row */}
          <div className="flex items-center gap-1" style={{ flexDirection: collapsed ? "column" : "row" }}>
            <ThemeToggle />
            <button onClick={logout}
              className="nav-item flex-1"
              style={{ justifyContent: collapsed ? "center" : "flex-start", color: "var(--text-muted)" }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "var(--danger)"}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "var(--text-muted)"}>
              <LogOut size={14} strokeWidth={1.8} />
              {!collapsed && <span className="text-[13px]">Çıxış</span>}
            </button>
          </div>

          {/* Profile */}
          {!collapsed ? (
            <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg"
              style={{ background: "var(--bg-hover)", borderRadius: "var(--radius)" }}>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                style={{ background: roleColor }}>
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-semibold truncate leading-tight" style={{ color: "var(--text-primary)" }}>
                  {profile?.fullName ?? "..."}
                </p>
                <p className="text-[10px] truncate" style={{ color: "var(--text-muted)" }}>
                  {ROLE_LABELS[profile?.role ?? ""] ?? ""}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex justify-center">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold"
                style={{ background: roleColor }}>
                {initials}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Spacer */}
      <div className="hidden md:block flex-shrink-0" style={{ width: w, transition: "width 0.22s cubic-bezier(0.4,0,0.2,1)" }} />
    </>
  )
}
