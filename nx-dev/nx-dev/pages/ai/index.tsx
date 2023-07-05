import { Footer, Header } from '@nx/nx-dev/ui-common';
import { DocViewer } from '@nx/nx-dev/feature-doc-viewer';
import { NextSeo } from 'next-seo';
import { useRouter } from 'next/router';

export default function AiDocs(props: { document }): JSX.Element {
  const router = useRouter();

  return (
    <>
      <NextSeo
        title="Nx Ai Docs"
        description="Nx Ai Docs assistant - powered by Nx + OpenAI GPT-3.5"
        openGraph={{
          url: 'https://nx.dev' + router.asPath,
          title: 'Nx Community',
          description: 'Nx Ai Docs assistant - powered by Nx + OpenAI GPT-3.5',
          images: [
            {
              url: 'https://nx.dev/images/nx-media.webp',
              width: 800,
              height: 421,
              alt: 'Nx: Smart, Fast and Extensible Build System',
              type: 'image/jpeg',
            },
          ],
          siteName: 'NxDev',
          type: 'website',
        }}
      />
      <Header />
      <main id="main" role="main">
        <DocViewer document={document} relatedDocuments={vm.relatedDocuments} />
      </main>
      <Footer />
    </>
  );
}
