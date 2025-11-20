import { DefaultLayout } from '@nx/nx-dev-ui-common';
import type { ReactElement } from 'react';
import { NextSeo } from 'next-seo';
import { ResourceContainer } from '@nx/nx-dev-ui-resources';
import { Resource } from '@nx/nx-dev-ui-resources';

export async function getStaticProps() {
  const fs = require('fs');
  const path = require('path');

  const resourcesPath = path.join(process.cwd(), 'public/data/resources.json');
  const resourcesData = fs.readFileSync(resourcesPath, 'utf8');
  const resources: Resource[] = JSON.parse(resourcesData);

  return {
    props: {
      resources,
    },
  };
}

interface ResourcesPageProps {
  resources: Resource[];
}

export function ResourcesPage({ resources }: ResourcesPageProps): ReactElement {
  return (
    <>
      <NextSeo
        title="Resources Library - Nx"
        description="Download whitepapers, books, case studies, and cheatsheets to learn more about Nx and modern development practices."
        openGraph={{
          url: 'https://nx.dev/resources-library',
          title: 'Resources Library - Nx',
          description:
            'Download whitepapers, books, case studies, and cheatsheets to learn more about Nx and modern development practices.',
          images: [
            {
              url: 'https://nx.dev/socials/nx-media.png',
              width: 800,
              height: 421,
              alt: 'Nx: Smart Repos · Fast Builds',
              type: 'image/jpeg',
            },
          ],
          siteName: 'Nx',
          type: 'website',
        }}
        canonical="https://nx.dev/resources-library"
      />
      <DefaultLayout hideBackground={false}>
        <ResourceContainer resources={resources} />
      </DefaultLayout>
    </>
  );
}

export default ResourcesPage;
