"use client"
import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  LayoutDashboard, ClipboardList, Wallet, CreditCard, Globe,
  Settings, HelpCircle, LogOut, BotMessageSquare, Users,
  PlaneTakeoff, Building2, Scale, Clock, MessageCircle,
  ChevronRight, FileText, User, Activity, Trophy,
  BarChart3, ChevronLeft, Menu, X
} from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useUserRole } from "@/lib/hooks/useUserRole"
import { ThemeToggle } from "@/components/ThemeProvider"
import { useDemo } from "@/components/DemoContext"

// ── Menu config ──────────────────────────────────────────────
const ALL_MENU = [
  { href: "/",          label: "Dashboard",    icon: LayoutDashboard, roles: ["it_admin","boss","direktor","muhasib","menecer","bilet_menecer","tender_menecer"] },
  { href: "/bookings",  label: "Sifarişlər",   icon: ClipboardList,   roles: ["it_admin","boss","direktor","muhasib","menecer","bilet_menecer"] },
  { href: "/drafts",    label: "Təsdiq",       icon: Clock,           roles: ["it_admin","direktor","muhasib","menecer"] },
  { href: "/mesajlar",  label: "Mesajlar",     icon: MessageCircle,   roles: ["it_admin","boss","direktor","muhasib","menecer","bilet_menecer"] },
  { href: "/tenders",   label: "Tenderlər",    icon: Trophy,          roles: ["it_admin","boss","direktor","tender_menecer","muhasib"] },
  { href: "/employees", label: "İşçilər",      icon: Users,           roles: ["it_admin","boss","direktor","muhasib"] },
  { href: "/assistant", label: "AI Köməkçi",   icon: BotMessageSquare,roles: ["it_admin","boss","direktor","muhasib","menecer"] },
  { href: "/mir",       label: "MIR Import",   icon: FileText,        roles: ["it_admin","direktor","menecer","bilet_menecer"] },
  { href: "/flights",   label: "TK NDC",       icon: PlaneTakeoff,    roles: ["it_admin","direktor","menecer"] },
  { href: "/founder",   label: "Əsasçı",       icon: User,            roles: ["it_admin","direktor","boss","muhasib"] },
  { href: "/logs",      label: "Jurnal",        icon: Activity,        roles: ["it_admin"] },
  { href: "/settings",  label: "Ayarlar",      icon: Settings,        roles: ["it_admin","boss","direktor","muhasib","menecer","bilet_menecer","tender_menecer"] },
  { href: "/help",      label: "Yardım",       icon: HelpCircle,      roles: ["it_admin","boss","direktor","muhasib","menecer","bilet_menecer","tender_menecer"] },
]

const FINANCE_MENU = [
  { href: "/finances",  label: "Maliyyə",      icon: Wallet },
  { href: "/debts",     label: "Borclar",      icon: CreditCard },
  { href: "/creditors", label: "Kreditorlar",  icon: Building2 },
  { href: "/balances",  label: "Balanslar",    icon: Scale },
  { href: "/iata",      label: "IATA",         icon: Globe },
]

const FINANCE_ROLES = ["it_admin","boss","direktor","muhasib","bilet_menecer"]

const ROLE_LABELS: Record<string,string> = {
  it_admin: "IT Admin", boss: "Boss", direktor: "Direktor",
  muhasib: "Mühasib", menecer: "Menecer", bilet_menecer: "Bilet Menecer",
  tender_menecer: "Tender Menecer",
}

const ROLE_COLORS: Record<string,string> = {
  it_admin:      "#6366f1",
  boss:          "#dc2626",
  direktor:      "#2563eb",
  muhasib:       "#16a34a",
  menecer:       "#d97706",
  bilet_menecer: "#0891b2",
  tender_menecer:"#7c3aed",
}

// ── unread messages ─────────────────────────────────────────
function useUnread(profileId?: string) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!profileId) return
    const load = async () => {
      const { data } = await supabase.from("messages").select("id").eq("receiver_id", profileId).eq("is_read", false)
      setCount(data?.length ?? 0)
    }
    load()
    const t = setInterval(load, 8000)
    return () => clearInterval(t)
  }, [profileId])
  return count
}

// ── NavItem ──────────────────────────────────────────────────
function NavItem({ item, expanded, pathname, badge }: { item: any; expanded: boolean; pathname: string; badge?: number }) {
  const isActive = pathname === item.href
  const Icon = item.icon
  return (
    <Link href={item.href}
      className={`nav-item group relative ${isActive ? "active" : ""}`}
      style={{ justifyContent: expanded ? "flex-start" : "center", padding: expanded ? "7px 10px" : "8px" }}>
      <div className="relative flex-shrink-0">
        <Icon size={16} strokeWidth={isActive ? 2.2 : 1.8} />
        {badge && badge > 0 && !expanded && (
          <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full text-white flex items-center justify-center"
            style={{ background: "#dc2626", fontSize: "9px", fontWeight: 700 }}>
            {badge > 9 ? "9+" : badge}
          </span>
        )}
      </div>
      {expanded && (
        <>
          <span className="flex-1 text-xs truncate">{item.label}</span>
          {badge && badge > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white"
              style={{ background: "#dc2626" }}>
              {badge > 9 ? "9+" : badge}
            </span>
          )}
        </>
      )}
      {!expanded && (
        <div className="tooltip">{item.label}</div>
      )}
    </Link>
  )
}

// ── Mobile Nav ───────────────────────────────────────────────
export function MobileNav() {
  const pathname = usePathname()
  const router = useRouter()
  const { profile } = useUserRole()
  const [open, setOpen] = useState(false)
  const unread = useUnread(profile?.id)
  const MENU = ALL_MENU.filter(m => !profile || m.roles.includes(profile.role))
  const finMenu = profile && FINANCE_ROLES.includes(profile.role)
    ? (profile.role === "bilet_menecer" ? FINANCE_MENU.filter(f => f.href === "/iata") : FINANCE_MENU)
    : []

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push("/login"); router.refresh()
  }

  return (
    <>
      {/* Top bar */}
      <div className="md:hidden flex items-center justify-between px-4 h-12 sticky top-0 z-40"
        style={{ background: "var(--bg-card)", borderBottom: "1px solid var(--border-color)" }}>
        <div className="flex items-center gap-2">
          <span className="font-black text-sm" style={{ color: "var(--accent)" }}>its</span>
          <span className="font-black text-sm" style={{ color: "var(--text-primary)" }}>tour</span>
        </div>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <button onClick={() => setOpen(v => !v)}
            className="w-8 h-8 flex items-center justify-center rounded-lg"
            style={{ color: "var(--text-secondary)", background: "var(--bg-hover)" }}>
            <Menu size={16} />
          </button>
        </div>
      </div>

      {/* Drawer */}
      {open && (
        <div className="md:hidden fixed inset-0 z-50" onClick={() => setOpen(false)}>
          <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)" }} />
          <div className="absolute right-0 top-0 bottom-0 w-72 overflow-y-auto"
            style={{ background: "var(--bg-card)", borderLeft: "1px solid var(--border-color)" }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4" style={{ borderBottom: "1px solid var(--border-color)" }}>
              <div className="flex items-center gap-2">
                <span className="font-black text-base" style={{ color: "var(--accent)" }}>its</span>
                <span className="font-black text-base" style={{ color: "var(--text-primary)" }}>tour</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: "var(--accent-light)", color: "var(--accent)" }}>CRM</span>
              </div>
              <button onClick={() => setOpen(false)} style={{ color: "var(--text-muted)" }}><X size={16} /></button>
            </div>

            <div className="p-3 space-y-0.5">
              {MENU.map(item => {
                const isActive = pathname === item.href
                const Icon = item.icon
                return (
                  <Link key={item.href} href={item.href} onClick={() => setOpen(false)}
                    className={`nav-item ${isActive ? "active" : ""}`}>
                    <Icon size={16} strokeWidth={1.8} />
                    <span className="text-xs">{item.label}</span>
                  </Link>
                )
              })}

              {finMenu.length > 0 && (
                <>
                  <div className="pt-3 pb-1">
                    <span className="section-label">Maliyyə</span>
                  </div>
                  {finMenu.map(item => {
                    const isActive = pathname === item.href
                    const Icon = item.icon
                    return (
                      <Link key={item.href} href={item.href} onClick={() => setOpen(false)}
                        className={`nav-item ${isActive ? "active" : ""}`}>
                        <Icon size={16} strokeWidth={1.8} />
                        <span className="text-xs">{item.label}</span>
                      </Link>
                    )
                  })}
                </>
              )}
            </div>

            <div className="p-3" style={{ borderTop: "1px solid var(--border-color)" }}>
              <button onClick={handleLogout}
                className="nav-item w-full"
                style={{ color: "var(--danger)" }}>
                <LogOut size={15} />
                <span className="text-xs">Çıxış</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40"
        style={{ background: "var(--bg-card)", borderTop: "1px solid var(--border-color)", paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="flex items-center justify-around py-2 px-2">
          {[
            MENU.find(m => m.href === "/"),
            MENU.find(m => m.href === "/bookings"),
            MENU.find(m => m.href === "/finances") ?? MENU.find(m => m.href === "/mesajlar"),
            MENU.find(m => m.href === "/mesajlar"),
          ].filter(Boolean).slice(0, 4).map(item => {
            if (!item) return null
            const isActive = pathname === item.href
            const Icon = item.icon
            return (
              <Link key={item.href} href={item.href}
                className="flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-all"
                style={{ color: isActive ? "var(--accent)" : "var(--text-muted)" }}>
                <Icon size={20} strokeWidth={isActive ? 2.2 : 1.6} />
                <span style={{ fontSize: "10px", fontWeight: isActive ? 600 : 400 }}>{item.label}</span>
              </Link>
            )
          })}
          <button onClick={() => setOpen(true)}
            className="flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl"
            style={{ color: "var(--text-muted)" }}>
            <Menu size={20} strokeWidth={1.6} />
            <span style={{ fontSize: "10px" }}>Menyu</span>
          </button>
        </div>
      </div>
      <div className="md:hidden h-16" />
    </>
  )
}

// ── Desktop Sidebar ──────────────────────────────────────────
export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { profile } = useUserRole()
  const { demo, toggleDemo } = useDemo()
  const [expanded, setExpanded] = useState(true)
  const [financeExpanded, setFinanceExpanded] = useState(false)
  const [mounted, setMounted] = useState(false)
  const unread = useUnread(profile?.id)

  useEffect(() => {
    setMounted(true)
    const saved = localStorage.getItem("sidebar_expanded")
    if (saved !== null) setExpanded(saved === "1")
    // Auto-expand finance if on finance page
    const finPaths = ["/finances","/debts","/creditors","/balances","/iata"]
    if (finPaths.some(p => pathname === p)) setFinanceExpanded(true)
  }, [])

  function toggleSidebar() {
    const next = !expanded
    setExpanded(next)
    localStorage.setItem("sidebar_expanded", next ? "1" : "0")
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push("/login"); router.refresh()
  }

  if (!mounted) return (
    <div className="hidden md:block" style={{ width: 56, minHeight: "100vh", background: "var(--sidebar-bg)", borderRight: "1px solid var(--sidebar-border)" }} />
  )

  const MENU = ALL_MENU.filter(m => !profile || m.roles.includes(profile.role))
  const showFinance = profile && FINANCE_ROLES.includes(profile.role)
  const finMenu = profile?.role === "bilet_menecer"
    ? FINANCE_MENU.filter(f => f.href === "/iata")
    : FINANCE_MENU
  const isFinActive = finMenu.some(f => pathname === f.href)

  // Split menu — before finance group and after
  const mainMenu = MENU.filter(m => !["/settings","/help","/logs","/founder"].includes(m.href))
  const bottomMenu = MENU.filter(m => ["/settings","/help","/founder"].includes(m.href))
  const adminMenu = MENU.filter(m => ["/logs"].includes(m.href))

  const accentColor = ROLE_COLORS[profile?.role ?? ""] ?? "var(--accent)"
  const initials = profile?.fullName?.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2) ?? "?"

  return (
    <>
      <div className="hidden md:flex flex-col fixed top-0 left-0 h-full z-40"
        style={{
          width: expanded ? 220 : 56,
          background: "var(--sidebar-bg)",
          borderRight: "1px solid var(--sidebar-border)",
          transition: "width 0.22s cubic-bezier(0.4,0,0.2,1)",
          overflow: "hidden",
        }}>

        {/* ── Logo ── */}
        <div className="flex items-center h-14 px-3 flex-shrink-0"
          style={{ borderBottom: "1px solid var(--sidebar-border)", justifyContent: expanded ? "space-between" : "center" }}>
          {expanded && (
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="flex items-center gap-1">
                <span className="font-black text-base tracking-tight" style={{ color: "var(--accent)" }}>its</span>
                <span className="font-black text-base tracking-tight" style={{ color: "var(--text-primary)" }}>tour</span>
              </div>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                style={{ background: "var(--accent-light)", color: "var(--accent)", letterSpacing: "0.05em" }}>
                CRM
              </span>
            </div>
          )}
          <button onClick={toggleSidebar}
            className="w-7 h-7 flex items-center justify-center rounded-lg flex-shrink-0 transition-all hover:scale-110"
            style={{ color: "var(--text-muted)", background: "var(--bg-hover)" }}>
            {expanded ? <ChevronLeft size={13} /> : <ChevronRight size={13} />}
          </button>
        </div>

        {/* ── Nav ── */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-2 space-y-0.5">

          {/* Main items */}
          {mainMenu.map(item => (
            <NavItem key={item.href} item={item} expanded={expanded} pathname={pathname}
              badge={item.href === "/mesajlar" ? unread : undefined} />
          ))}

          {/* Finance section */}
          {showFinance && (
            <div className="pt-2">
              {expanded && <div className="section-label mb-1">Maliyyə</div>}
              {!expanded && <div className="h-px mx-2 my-2" style={{ background: "var(--border-color)" }} />}

              {expanded ? (
                <>
                  <button
                    onClick={() => setFinanceExpanded(v => !v)}
                    className={`nav-item w-full ${isFinActive ? "active" : ""}`}>
                    <Wallet size={16} strokeWidth={1.8} />
                    <span className="flex-1 text-xs">Maliyyə</span>
                    <ChevronRight size={12} style={{ transform: financeExpanded ? "rotate(90deg)" : "rotate(0)", transition: "transform 0.2s ease", opacity: 0.5 }} />
                  </button>
                  {financeExpanded && (
                    <div className="ml-3 pl-3 mt-0.5 space-y-0.5" style={{ borderLeft: "1px solid var(--border-color)" }}>
                      {finMenu.map(item => {
                        const isActive = pathname === item.href
                        const Icon = item.icon
                        return (
                          <Link key={item.href} href={item.href}
                            className={`nav-item ${isActive ? "active" : ""}`}>
                            <Icon size={13} strokeWidth={1.8} />
                            <span className="text-xs">{item.label}</span>
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </>
              ) : (
                finMenu.map(item => (
                  <NavItem key={item.href} item={item} expanded={false} pathname={pathname} />
                ))
              )}
            </div>
          )}

          {/* Admin */}
          {adminMenu.length > 0 && (
            <div className="pt-2">
              {expanded && <div className="section-label mb-1">Admin</div>}
              {adminMenu.map(item => (
                <NavItem key={item.href} item={item} expanded={expanded} pathname={pathname} />
              ))}
            </div>
          )}
        </div>

        {/* ── Bottom ── */}
        <div className="px-2 py-3 space-y-0.5 flex-shrink-0" style={{ borderTop: "1px solid var(--sidebar-border)" }}>
          {bottomMenu.map(item => (
            <NavItem key={item.href} item={item} expanded={expanded} pathname={pathname} />
          ))}

          {/* Demo toggle */}
          <button onClick={toggleDemo}
            className={`nav-item w-full ${demo ? "active" : ""}`}
            style={{ justifyContent: expanded ? "flex-start" : "center" }}>
            <span style={{ fontSize: 14, lineHeight: 1 }}>🎬</span>
            {expanded && <span className="text-xs flex-1">Demo{demo ? ": ON" : ""}</span>}
            {!expanded && <div className="tooltip">Demo rejimi</div>}
          </button>

          <div className="flex items-center gap-1.5 pt-1" style={{ flexDirection: expanded ? "row" : "column" }}>
            <ThemeToggle />
            <button onClick={handleLogout}
              className="nav-item flex-1"
              style={{
                justifyContent: expanded ? "flex-start" : "center",
                color: "var(--text-secondary)",
                flex: expanded ? 1 : "none",
                width: expanded ? "auto" : 36, height: 32,
              }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "var(--danger)"}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)"}>
              <LogOut size={14} strokeWidth={1.8} />
              {expanded && <span className="text-xs">Çıxış</span>}
            </button>
          </div>

          {/* Profile */}
          {expanded && (
            <div className="flex items-center gap-2.5 px-2 py-2 rounded-xl mt-1"
              style={{ background: "var(--bg-hover)" }}>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                style={{ background: accentColor }}>
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold truncate" style={{ color: "var(--text-primary)", lineHeight: 1.3 }}>
                  {profile?.fullName ?? "..."}
                </p>
                <p className="text-[10px] truncate" style={{ color: "var(--text-muted)" }}>
                  {ROLE_LABELS[profile?.role ?? ""] ?? ""}
                </p>
              </div>
            </div>
          )}
          {!expanded && (
            <div className="flex justify-center pt-1">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold"
                style={{ background: accentColor }}>
                {initials}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Spacer */}
      <div className="hidden md:block flex-shrink-0"
        style={{ width: expanded ? 220 : 56, transition: "width 0.22s cubic-bezier(0.4,0,0.2,1)" }} />
    </>
  )
}
