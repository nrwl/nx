/**
 * Starlight skips every remark/rehype transform it owns - heading anchor links, asides,
 * RTL code support - for files whose vfile has no path. Loader-generated entries have
 * none, so they need a notional path inside the docs collection to be treated like any
 * other page. Replaces the `@astrojs/starlight` patch we used to carry for this.
 */
export function generatedDocFileURL(slug: string): URL {
  return new URL(`../../content/docs/${slug}.md`, import.meta.url);
}
