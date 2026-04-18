import { FeedContainer } from '@nx/nx-dev-feature-ai';
import { cx } from '@nx/nx-dev-ui-primitives';
import { NextSeo } from 'next-seo';
import Link from 'next/link';

export default function AiChat(): JSX.Element {
  return (
    <>
      <NextSeo
        title="Nx AI Chat"
        description="AI chat powered by Nx docs."
        noindex={true}
        robotsProps={{
          nosnippet: true,
          notranslate: true,
          noimageindex: true,
          noarchive: true,
          maxSnippet: -1,
          maxImagePreview: 'none',
          maxVideoPreview: -1,
        }}
        openGraph={{
          url: 'https://nx.dev/ai-chat',
          title: 'Nx AI Chat',
          description: 'AI chat powered by Nx docs.',
          images: [
            {
              url: 'https://nx.dev/socials/nx-media.png',
              width: 800,
              height: 421,
              alt: 'Nx: Smart Monorepos · Fast Builds',
              type: 'image/png',
            },
          ],
          siteName: 'Nx',
          type: 'website',
        }}
      />
      <div id="shell" className={cx('flex flex-col', 'h-[calc(100dvh)]')}>
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-4 dark:border-zinc-800 dark:bg-zinc-900">
          <Link
            href="/docs"
            className="flex items-center gap-2 text-zinc-900 dark:text-white"
            prefetch={false}
          >
            <svg
              role="img"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
              className="h-7 w-7"
              fill="currentColor"
              aria-hidden="true"
            >
              <title>Nx</title>
              <path d="M11.987 14.138l-3.132 4.923-5.193-8.427-.012 8.822H0V4.544h3.691l5.247 8.833.005-3.998 3.044 4.759zm.601-5.761c.024-.048 0-3.784.008-3.833h-3.65c.002.059-.005 3.776-.003 3.833h3.645zm5.634 4.134a2.061 2.061 0 0 0-1.969 1.336 1.963 1.963 0 0 1 2.343-.739c.396.161.917.422 1.33.283a2.1 2.1 0 0 0-1.704-.88zm3.39 1.061c-.375-.13-.8-.277-1.109-.681-.06-.08-.116-.17-.176-.265a2.143 2.143 0 0 0-.533-.642c-.294-.216-.68-.322-1.18-.322a2.482 2.482 0 0 0-2.294 1.536 2.325 2.325 0 0 1 4.002.388.75.75 0 0 0 .836.334c.493-.105.46.36 1.203.518v-.133c-.003-.446-.246-.55-.75-.733zm2.024 1.266a.723.723 0 0 0 .347-.638c-.01-2.957-2.41-5.487-5.37-5.487a5.364 5.364 0 0 0-4.487 2.418c-.01-.026-1.522-2.39-1.538-2.418H8.943l3.463 5.423-3.379 5.32h3.54l1.54-2.366 1.568 2.366h3.541l-3.21-5.052a.7.7 0 0 1-.084-.32 2.69 2.69 0 0 1 2.69-2.691h.001c1.488 0 1.736.89 2.057 1.308.634.826 1.9.464 1.9 1.541a.707.707 0 0 0 1.066.596zm.35.133c-.173.372-.56.338-.755.639-.176.271.114.412.114.412s.337.156.538-.311c.104-.231.14-.488.103-.74z" />
            </svg>
            <span className="text-sm font-medium">Nx Docs</span>
          </Link>
          <Link
            href="/docs"
            className="text-sm font-medium text-zinc-600 hover:text-blue-500 dark:text-zinc-300 dark:hover:text-blue-500"
            prefetch={false}
          >
            Back to Docs
          </Link>
        </header>
        <main
          id="main"
          role="main"
          className="flex h-full flex-1 overflow-y-hidden"
        >
          <FeedContainer />
        </main>
      </div>
    </>
  );
}
