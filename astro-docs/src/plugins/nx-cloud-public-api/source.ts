import { parseOpenApiDocument } from './openapi';
import { fetchOpenApiSpecificationText } from './fetch-specification.mjs';
import type { OpenApiDocument } from './types';

export {
  NX_CLOUD_PUBLIC_API_SPEC_URL,
  openApiSpecificationUrl,
} from './fetch-specification.mjs';

export async function fetchOpenApiSpecification(
  sourceUrl: string,
  fetchSpecification: typeof fetch = fetch
): Promise<OpenApiDocument> {
  const content = await fetchOpenApiSpecificationText(
    sourceUrl,
    fetchSpecification
  );
  return parseOpenApiDocument(JSON.parse(content));
}
