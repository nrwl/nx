import { PerformanceObserver } from 'perf_hooks';

import { customDimensions, reportEvent } from '../analytics';
import type { EventParameters } from '../analytics';
import { isOnDaemon } from '../daemon/is-on-daemon';
import { serverLogger } from '../daemon/logger';

const dimensionValues = customDimensions
  ? new Set(Object.values(customDimensions))
  : null;

let initialized = false;

if (!initialized) {
  initialized = true;

  const obs = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      const detail = (entry as any).detail;
      const shouldTrack = detail?.track === true;

      if (process.env.NX_PERF_LOGGING === 'true') {
        const message = `Time taken for '${entry.name}' ${entry.duration}ms`;
        if (isOnDaemon()) {
          serverLogger.log(message);
        } else {
          console.log(message);
        }
      }

      if (shouldTrack && dimensionValues) {
        const { track, ...rest } = detail;
        const eventParameters: EventParameters = {
          [customDimensions.duration]: entry.duration,
        };
        for (const [key, value] of Object.entries(rest)) {
          if (dimensionValues.has(key)) {
            eventParameters[key] = value as string | number | boolean;
          }
        }
        reportEvent(entry.name, eventParameters);
      }
    }
  });
  obs.observe({ entryTypes: ['measure'] });
}
