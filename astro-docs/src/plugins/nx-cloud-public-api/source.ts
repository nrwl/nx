import { parseOpenApiDocument } from './openapi';
import { fetchOpenApiSpecificationJson } from './fetch-specification.mjs';
import type { OpenApiDocument } from './types';

export {
  NX_CLOUD_PUBLIC_API_SPEC_URL,
  openApiSpecificationUrl,
} from './fetch-specification.mjs';

export async function fetchOpenApiSpecification(
  sourceUrl: string,
  fetchSpecification: typeof fetch = fetch
): Promise<OpenApiDocument> {
  return parseOpenApiDocument(
    await fetchOpenApiSpecificationJson(sourceUrl, fetchSpecification)
  );
}
