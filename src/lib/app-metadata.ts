import type { Metadata, Viewport } from 'next'

// Makes the CRM + admin (crm.proluxshine.com) installable to the home screen.
export const crmAppMetadata: Metadata = {
  title: 'Prolux CRM',
  description: 'Säljverktyg och admin för Prolux Shine-teamet',
  manifest: '/crm-manifest.json',
  appleWebApp: {
    capable: true,
    title: 'Prolux CRM',
    // Opaque bar: 'black-translucent' would draw the page under the iOS status bar.
    statusBarStyle: 'black',
  },
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180' }],
  },
}

export const crmAppViewport: Viewport = {
  themeColor: '#0F1115',
}
