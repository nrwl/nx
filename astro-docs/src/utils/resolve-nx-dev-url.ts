export function resolveNxDevUrl(): string {
  // Deploy previews always point to the matching nx-dev preview,
  // overriding any site-level env var that would otherwise point to production.
  if (
    process.env.NETLIFY &&
    process.env.CONTEXT === 'deploy-preview' &&
    process.env.REVIEW_ID
  ) {
    const url = `https://deploy-preview-${process.env.REVIEW_ID}--nx-dev.netlify.app`;
    console.log(`[deploy-preview] NX_DEV_URL overridden to: ${url}`);
    return url;
  }
  return process.env.NX_DEV_URL ?? 'https://nx.dev';
}
