import { PerformanceObserver } from 'perf_hooks';

if (process.env.NX_PERF_LOGGING) {
  const obs = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      console.log(`Time for '${entry.name}'`, entry.duration);
    }
  });
  obs.observe({ entryTypes: ['measure'] });
}
