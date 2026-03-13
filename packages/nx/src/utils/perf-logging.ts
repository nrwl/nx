import { PerformanceObserver } from 'perf_hooks';

import { reportPerfEvent } from '../analytics';
import { isOnDaemon } from '../daemon/is-on-daemon';
import { serverLogger } from '../daemon/logger';

const TRACK_PREFIX = '[track] ';

/**
 * Like `performance.measure()` but automatically reports to telemetry.
 */
export function measureAndTrack(
  name: string,
  startMark: string,
  endMark: string
) {
  performance.measure(`${TRACK_PREFIX}${name}`, startMark, endMark);
}

let initialized = false;

if (!initialized) {
  initialized = true;

  const obs = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      const shouldTrack = entry.name.startsWith(TRACK_PREFIX);
      const displayName = shouldTrack
        ? entry.name.slice(TRACK_PREFIX.length)
        : entry.name;

      if (process.env.NX_PERF_LOGGING === 'true') {
        const message = `Time taken for '${displayName}' ${entry.duration}ms`;
        if (isOnDaemon()) {
          serverLogger.log(message);
        } else {
          console.log(message);
        }
      }

      if (shouldTrack) {
        reportPerfEvent(displayName, entry.duration);
      }
    }
  });
  obs.observe({ entryTypes: ['measure'] });
}
