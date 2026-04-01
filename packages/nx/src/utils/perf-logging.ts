import { PerformanceObserver } from 'perf_hooks';

import { customDimensions, reportEvent } from '../analytics';
import type { EventParameters } from '../analytics';
import type { TrackedDetail } from './perf-hooks';
import { isOnDaemon } from '../daemon/is-on-daemon';
import { serverLogger } from '../daemon/logger';

function isTrackedDetail(detail: unknown): detail is TrackedDetail {
  return (
    typeof detail === 'object' &&
    detail !== null &&
    (detail as any).track === true
  );
}

const dimensionValues = customDimensions
  ? new Set(Object.values(customDimensions))
  : null;

let initialized = false;

if (!initialized) {
  initialized = true;

  const obs = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      const { detail } = entry;

      if (process.env.NX_PERF_LOGGING === 'true') {
        const message = `Time taken for '${entry.name}' ${entry.duration}ms`;
        if (isOnDaemon()) {
          serverLogger.log(message);
        } else {
          console.log(message);
        }
      }

      if (isTrackedDetail(detail) && dimensionValues) {
        const { track, ...rest } = detail;
        const eventParameters: EventParameters = {
          [customDimensions.duration]: entry.duration,
        };
        for (const [key, value] of Object.entries(rest)) {
          if (dimensionValues.has(key)) {
            eventParameters[key] = value;
          }
        }
        reportEvent(entry.name, eventParameters);
      }
    }
  });
  obs.observe({ entryTypes: ['measure'] });
}
