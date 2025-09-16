const url = 'http://localhost:4321/docs';
const timeout = 120000; // 2 minutes in milliseconds

console.log('starting up....');
export default async function globalSetup() {
  const startTime = Date.now();
  const maxEndTime = startTime + timeout;

  console.log(`Waiting for ${url} to be available...`);

  while (Date.now() < maxEndTime) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        console.log(`✓ Server is ready at ${url}`);
        return;
      }
      console.log(
        `Server responded with status ${response.status}, retrying...`
      );
    } catch (error) {
      // Server not available yet, continue polling
      const remainingTime = Math.round((maxEndTime - Date.now()) / 1000);
      if (remainingTime % 10 === 0 && remainingTime > 0) {
        console.log(`Still waiting... ${remainingTime} seconds remaining`);
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error(
    `Server at ${url} did not become available within ${timeout / 1000} seconds`
  );
}
