import { PerformanceObserver } from 'perf_hooks';
import { logger } from './logger';

let initialized = false;

if (process.env.NX_PERF_LOGGING === 'true' && !initialized) {
  initialized = true;

  const obs = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      logger.warn(`Time for '${entry.name}'`, entry.duration);
    }
  });
  obs.observe({ entryTypes: ['measure'] });
}
