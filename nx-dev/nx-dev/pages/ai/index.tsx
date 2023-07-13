import { DocumentationHeader } from '@nx/nx-dev/ui-common';
import { FeatureAi } from '@nx/nx-dev/feature-ai';
import { useNavToggle } from '../../lib/navigation-toggle.effect';
import { NextSeo } from 'next-seo';

export default function AiDocs(): JSX.Element {
  const { toggleNav, navIsOpen } = useNavToggle();
  return (
    <>
      <NextSeo
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
      <div id="shell" className="flex h-full flex-col">
        <div className="w-full flex-shrink-0">
          <DocumentationHeader isNavOpen={navIsOpen} toggleNav={toggleNav} />
        </div>
        <main id="main" role="main" className="flex h-full flex-1">
          <FeatureAi />
        </main>
      </div>
    </>
  );
}
