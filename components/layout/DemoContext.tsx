"use client"
import { createContext, useContext, useState, useEffect } from "react"

const DemoContext = createContext<{ demo: boolean; toggleDemo: () => void }>({ demo: false, toggleDemo: () => {} })

export function DemoProvider({ children }: { children: React.ReactNode }) {
  const [demo, setDemo] = useState(false)
  useEffect(() => {
    const saved = localStorage.getItem("demo_mode")
    if (saved === "1") setDemo(true)
  }, [])
  function toggleDemo() {
    setDemo(v => {
      localStorage.setItem("demo_mode", v ? "0" : "1")
      return !v
    })
  }
  return <DemoContext.Provider value={{ demo, toggleDemo }}>{children}</DemoContext.Provider>
}

export function useDemo() { return useContext(DemoContext) }

// Masks a number/currency string for demo mode
export function mask(value: string | number, demo: boolean): string {
  if (!demo) return String(value)
  return "••••"
}
