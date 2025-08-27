import './globals.css'
import { Work_Sans } from 'next/font/google'
import { ReactNode } from 'react'

const workSans = Work_Sans({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-sans' })

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es" className={workSans.variable}>
      <body>{children}</body>
    </html>
  )
}
