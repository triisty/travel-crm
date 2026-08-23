"use client"
import { createContext, useContext, useState, useEffect } from "react"

const DemoContext = createContext<{ demo: boolean; toggleDemo: () => void }>({ demo: false, toggleDemo: () => {} })

export function DemoProvider({ children }: { children: React.ReactNode }) {
  const [demo, setDemo] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem("demo_mode")
    if (saved === "1") { setDemo(true); document.body.classList.add("demo-mode") }
  }, [])

  function toggleDemo() {
    setDemo(v => {
      const next = !v
      localStorage.setItem("demo_mode", next ? "1" : "0")
      if (next) document.body.classList.add("demo-mode")
      else document.body.classList.remove("demo-mode")
      return next
    })
  }

  return <DemoContext.Provider value={{ demo, toggleDemo }}>{children}</DemoContext.Provider>
}

export function useDemo() { return useContext(DemoContext) }
export function mask(value: string | number, demo: boolean): string {
  if (!demo) return String(value)
  return "••••"
}
