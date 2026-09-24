import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Kassa',
  robots: { index: false, follow: false },
}

export default function KassaLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
