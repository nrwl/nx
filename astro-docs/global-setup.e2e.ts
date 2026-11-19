export default async function globalSetup() {
  const { waitForServer } = await import('./scripts/check-server.mjs');
  await waitForServer('http://localhost:4321/docs');
}
