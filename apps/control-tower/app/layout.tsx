import type { Metadata } from "next"

import "@workspace/ui/globals.css"
import { cn } from "@workspace/ui/lib/utils"

export const metadata: Metadata = {
  title: {
    default: "Presk Control Tower",
    template: "%s · Presk Control Tower",
  },
  description: "Internal platform administration for Presk.",
  robots: { index: false, follow: false },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={cn("font-sans antialiased")}>
      <body>{children}</body>
    </html>
  )
}
