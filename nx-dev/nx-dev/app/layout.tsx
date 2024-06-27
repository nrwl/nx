import type { Metadata, Viewport } from 'next';
import { Header, Footer, AnnouncementBanner } from '@nx/nx-dev/ui-common';
import AppRouterAnalytics from './app-router-analytics';
import GlobalScripts from './global-scripts';

import '../styles/main.css';

// Metadata for the entire site
export const metadata: Metadata = {
  appleWebApp: { title: 'Nx' },
  applicationName: 'Nx',
  icons: [
    {
      url: '/favicon/favicon.svg',
      type: 'image/svg+xml',
      rel: 'icon',
    },
    {
      url: '/favicon/favicon-32x32.png',
      sizes: '32x32',
      type: 'image/png',
      rel: 'icon',
    },
    {
      url: '/favicon/favicon.ico',
      type: 'image/x-icon',
      rel: 'icon',
    },
    {
      url: '/favicon/apple-touch-icon.png',
      sizes: '180x180',
      rel: 'apple-touch-icon',
    },
    {
      url: '/favicon/safari-pinned-tab.svg',
      color: '#5bbad5',
      rel: 'mask-icon',
    },
  ],
};

// Viewport settings for the entire site
export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F8FAFC' },
    { media: '(prefers-color-scheme: dark)', color: '#0F172A' },
  ],
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const gaMeasurementId = 'UA-88380372-10';
  return (
    <html lang="en" className="h-full scroll-smooth" suppressHydrationWarning>
      <AppRouterAnalytics gaMeasurementId={gaMeasurementId} />
      <head>
        <meta
          name="msapplication-TileColor"
          content="#DA532C"
          key="windows-tile-color"
        />
        <script
          type="text/javascript"
          dangerouslySetInnerHTML={{
            __html: `
              try {
                if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                  document.documentElement.classList.add('dark')
                } else {
                  document.documentElement.classList.remove('dark')
                }
              } catch (_) {}
            `,
          }}
        />
      </head>
      <body className="h-full bg-white text-slate-700 antialiased selection:bg-blue-500 selection:text-white dark:bg-slate-900 dark:text-slate-400 dark:selection:bg-sky-500">
        <AnnouncementBanner />
        <Header />
        {children}
        <Footer />
        <GlobalScripts gaMeasurementId={gaMeasurementId} />
      </body>
    </html>
  );
}
