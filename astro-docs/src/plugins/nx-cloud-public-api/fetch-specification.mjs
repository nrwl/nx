export const NX_CLOUD_PUBLIC_API_SPEC_URL =
  'https://cloud.nx.app/nx-cloud/data/openapi.json';

export function openApiSpecificationUrl() {
  return process.env.NX_CLOUD_OPENAPI_URL ?? NX_CLOUD_PUBLIC_API_SPEC_URL;
}

export async function fetchOpenApiSpecificationJson(
  sourceUrl,
  fetchSpecification = fetch
) {
  const response = await fetchSpecification(sourceUrl, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw new Error(
      `Could not fetch the OpenAPI specification from ${sourceUrl}: HTTP ${response.status}.`
    );
  }
  return response.json();
}
