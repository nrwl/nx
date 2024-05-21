import { FeedContainer } from '@nx/nx-dev/feature-ai';
import { DocumentationHeader, SidebarContainer } from '@nx/nx-dev/ui-common';
import { NextSeo } from 'next-seo';
import { useNavToggle } from '../../lib/navigation-toggle.effect';
import { cx } from '@nx/nx-dev/ui-primitives';

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
      />
      <div
        id="shell"
        className={cx(
          'flex flex-col',
          // Adjust dynamically to mobile viewport height (e.g. when navigational tabs are open).
          'h-[calc(100dvh)]'
        )}
      >
        <div className="w-full flex-shrink-0">
          <DocumentationHeader isNavOpen={navIsOpen} toggleNav={toggleNav} />
        </div>
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
