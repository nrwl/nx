import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import '../styles/main.css';

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.CONTEXT === 'deploy-preview' ||
          process.env.CONTEXT === 'branch-deploy'
        ? process.env.DEPLOY_PRIME_URL ||
          process.env.DEPLOY_URL ||
          'https://nx.dev'
        : process.env.URL || 'https://nx.dev'
  ),
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
  ...(process.env.NEXT_PUBLIC_NO_INDEX === 'true' && {
    robots: {
      index: false,
      follow: false,
      googleBot: {
        index: false,
        follow: false,
      },
    },
  }),
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F8FAFC' },
    { media: '(prefers-color-scheme: dark)', color: '#0F172A' },
  ],
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="h-full scroll-smooth" suppressHydrationWarning>
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
      <body className="h-full bg-white text-zinc-700 antialiased selection:bg-blue-500 selection:text-white dark:bg-zinc-900 dark:text-zinc-400 dark:selection:bg-blue-500">
        {children}
      </body>
    </html>
  );
}
