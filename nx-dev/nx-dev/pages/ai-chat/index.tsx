import { FeedContainer } from '@nx/nx-dev-feature-ai';
import {
  DocumentationHeader,
  Header,
  SidebarContainer,
} from '@nx/nx-dev-ui-common';
import { NextSeo } from 'next-seo';
import { useNavToggle } from '../../lib/navigation-toggle.effect';
import { cx } from '@nx/nx-dev-ui-primitives';

export default function AiDocs(): JSX.Element {
  const { toggleNav, navIsOpen } = useNavToggle();

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
              alt: 'Nx: Smart Repos · Fast Builds',
              type: 'image/png',
            },
          ],
          siteName: 'Nx',
          type: 'website',
        }}
      />
      <div
        id="shell"
        className={cx(
          'flex flex-col',
          // Adjust dynamically to mobile viewport height (e.g. when navigational tabs are open).
          'h-[calc(100dvh)]'
        )}
      >
        {process.env.NEXT_PUBLIC_ASTRO_URL ? (
          <div className="mb-12">
            <Header />
          </div>
        ) : (
          <div className="w-full flex-shrink-0">
            <DocumentationHeader isNavOpen={navIsOpen} toggleNav={toggleNav} />
          </div>
        )}
        <main
          id="main"
          role="main"
          className="flex h-full flex-1 overflow-y-hidden"
        >
          <div className="hidden">
            <SidebarContainer
              menu={{ sections: [] }}
              navIsOpen={navIsOpen}
              toggleNav={toggleNav}
            />
          </div>

          <FeedContainer />
        </main>
      </div>
    </>
  );
}
