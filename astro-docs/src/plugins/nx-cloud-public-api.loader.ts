import type { Loader } from 'astro/loaders';
import { watchAndCall } from './utils/watch';
import {
  openApiOperations,
  parseOpenApiDocument,
  renderOpenApiReference,
} from './utils/openapi-reference';

export const NX_CLOUD_PUBLIC_API_SPEC_URL =
  'https://cloud.nx.app/nx-cloud/data/openapi.json';
export const NX_CLOUD_PUBLIC_API_SLUG = 'reference/nx-cloud/public-api';

interface LoaderOptions {
  specificationUrl?: string;
  fetch?: typeof fetch;
}

export function NxCloudPublicApiLoader(options: LoaderOptions = {}): Loader {
  const specificationUrl =
    options.specificationUrl ??
    process.env.NX_CLOUD_OPENAPI_URL ??
    NX_CLOUD_PUBLIC_API_SPEC_URL;
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
        // Fetch on every content sync. A failed fetch must not silently publish stale API docs.
        const response = await fetchSpecification(specificationUrl, {
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(30_000),
        });
        if (!response.ok) {
          throw new Error(
            `Could not fetch the OpenAPI specification from ${specificationUrl}: HTTP ${response.status}.`
          );
        }
        const document = parseOpenApiDocument(await response.json());
        const body = renderOpenApiReference(document);
        const data = await parseData({
          id: 'reference',
          data: {
            title: document.info.title,
            description:
              'Nx Cloud Public API reference generated from the deployed OpenAPI specification.',
            slug: NX_CLOUD_PUBLIC_API_SLUG,
            specificationUrl,
            apiVersion: document.info.version,
            openapiVersion: document.openapi,
            operationCount: openApiOperations(document).length,
          },
        });
        const rendered = await renderMarkdown(body);
        store.set({
          id: 'reference',
          data,
          body,
          rendered,
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
            new URL(import.meta.url).pathname,
            new URL('./utils/openapi-reference.ts', import.meta.url).pathname,
          ],
          load
        );
      }
      await load();
    },
  };
}
