import type { Metadata, Viewport } from 'next'
import './globals.css'
import { Toaster } from 'react-hot-toast'
import { Analytics } from '@vercel/analytics/react'

export const metadata: Metadata = {
  title: '우리반 공부노트',
  description: '3학년 시험 자료 & 일정 공유',
  manifest: '/manifest.json',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: '#1d4ed8',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-screen">
        {children}
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 2500,
            style: { fontFamily: 'Pretendard, sans-serif', fontSize: '15px' },
          }}
        />
        <Analytics />
      </body>
    </html>
  )
}
