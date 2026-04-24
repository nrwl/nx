import { PerformanceObserver } from 'perf_hooks';

import type { TrackedDetail } from './perf-hooks';

function isTrackedDetail(detail: unknown): detail is TrackedDetail {
  return (
    typeof detail === 'object' &&
    detail !== null &&
    (detail as any).track === true
  );
}

new PerformanceObserver((list) => {
  const entries = list.getEntries();
  const logEnabled = process.env.NX_PERF_LOGGING === 'true';
  const tracked = entries.filter((e) => isTrackedDetail(e.detail));

  // Short-circuit before loading analytics / daemon logger (~60ms of native
  // binding + module init) when there's nothing to do.
  if (!logEnabled && tracked.length === 0) return;

  if (logEnabled) {
    const { isOnDaemon } =
      require('../daemon/is-on-daemon') as typeof import('../daemon/is-on-daemon');
    const { serverLogger } =
      require('../daemon/logger') as typeof import('../daemon/logger');
    const log = isOnDaemon()
      ? (msg: string) => serverLogger.log(msg)
      : console.log;
    for (const entry of entries) {
      log(`Time taken for '${entry.name}' ${entry.duration}ms`);
    }
  }

  if (tracked.length === 0) return;

  const { customDimensions, reportEvent } =
    require('../analytics') as typeof import('../analytics');
  if (!customDimensions) return;
  const dimensionValues = new Set(Object.values(customDimensions));

  for (const entry of tracked) {
    const { track, ...rest } = entry.detail as TrackedDetail;
    const params: import('../analytics').EventParameters = {
      [customDimensions.duration]: entry.duration,
    };
    for (const [key, value] of Object.entries(rest)) {
      if (dimensionValues.has(key)) params[key] = value;
    }
    reportEvent(entry.name, params);
  }
}).observe({ entryTypes: ['measure'] });
