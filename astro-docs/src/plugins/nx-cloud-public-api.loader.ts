import type { Loader } from 'astro/loaders';
import { fileURLToPath } from 'node:url';
import { watchAndCall } from './utils/watch';
import { buildOpenApiReference } from './nx-cloud-public-api/model';
import {
  renderOpenApiReference,
  renderReferenceProse,
} from './nx-cloud-public-api/render';
import {
  fetchOpenApiSpecification,
  openApiSpecificationUrl,
} from './nx-cloud-public-api/source';

export { NX_CLOUD_PUBLIC_API_SPEC_URL } from './nx-cloud-public-api/source';
export const NX_CLOUD_PUBLIC_API_SLUG = 'reference/nx-cloud/public-api';

interface LoaderOptions {
  specificationUrl?: string;
  fetch?: typeof fetch;
}

export function NxCloudPublicApiLoader(options: LoaderOptions = {}): Loader {
  const specificationUrl =
    options.specificationUrl ?? openApiSpecificationUrl();
  const fetchSpecification = options.fetch ?? fetch;

  return {
    name: 'nx-cloud-public-api-loader',
    async load({
      store,
      parseData,
      renderMarkdown,
      generateDigest,
      logger,
      watcher,
    }) {
      const load = async () => {
        // Fetch on every content sync. Never fall back to a stale specification.
        const document = await fetchOpenApiSpecification(
          specificationUrl,
          fetchSpecification
        );
        const reference = buildOpenApiReference(document, specificationUrl);
        await renderReferenceProse(reference, renderMarkdown);
        const body = renderOpenApiReference(reference);
        const data = await parseData({
          id: 'reference',
          data: {
            title: document.info.title,
            description:
              'Nx Cloud Public API reference generated from the deployed OpenAPI specification.',
            slug: NX_CLOUD_PUBLIC_API_SLUG,
            filter: 'type:References',
            reference,
          },
        });
        store.set({
          id: 'reference',
          data,
          body,
          digest: generateDigest({ data, body }),
        });
        logger.info(
          `Loaded ${document.info.title} ${document.info.version} from ${specificationUrl}.`
        );
      };

      if (watcher) {
        watchAndCall(
          watcher,
          [
            fileURLToPath(import.meta.url),
            fileURLToPath(new URL('./nx-cloud-public-api/', import.meta.url)),
          ],
          load
        );
      }
      await load();
    },
  };
}
