import type { Metadata } from "next"
import "./globals.css"
import LayoutWrapper from "@/components/layout/LayoutWrapper"
import { ThemeProvider } from "@/components/ThemeProvider"
import { DemoProvider } from "@/components/DemoContext"

export const metadata: Metadata = {
  title: "itstour CRM",
  description: "Turizm idarəetməsi sistemi",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    apple: "/apple-touch-icon.png",
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="az">
      <body>
        <ThemeProvider>
          <DemoProvider>
            <LayoutWrapper>{children}</LayoutWrapper>
          </DemoProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
