import { PerformanceObserver } from 'perf_hooks';

let initialized = false;

if (process.env.NX_PERF_LOGGING === 'true' && !initialized) {
  initialized = true;

  const obs = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      console.log(`Time for '${entry.name}'`, entry.duration);
    }
  });
  obs.observe({ entryTypes: ['measure'] });
}
