"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const perf_hooks_1 = require("perf_hooks");
function isTrackedDetail(detail) {
    return (typeof detail === 'object' &&
        detail !== null &&
        detail.track === true);
}
new perf_hooks_1.PerformanceObserver((list) => {
    // observer is configured for 'measure' entries only (see .observe call below)
    const entries = list.getEntries();
    const logEnabled = process.env.NX_PERF_LOGGING === 'true';
    const tracked = entries.filter((e) => isTrackedDetail(e.detail));
    // Short-circuit before loading analytics / daemon logger (~60ms of native
    // binding + module init) when there's nothing to do.
    if (!logEnabled && tracked.length === 0)
        return;
    if (logEnabled) {
        const { isOnDaemon } = require('../daemon/is-on-daemon');
        const { serverLogger } = require('../daemon/logger');
        const { logger } = require('./logger');
        const log = isOnDaemon()
            ? (msg) => serverLogger.log(msg)
            : (msg) => logger.warn(msg);
        for (const entry of entries) {
            log(`Time taken for '${entry.name}' ${entry.duration}ms`);
        }
    }
    if (tracked.length === 0)
        return;
    const { customDimensions, reportEvent } = require('../analytics');
    if (!customDimensions)
        return;
    const dimensionValues = new Set(Object.values(customDimensions));
    for (const entry of tracked) {
        const { track, ...rest } = entry.detail;
        const params = {
            [customDimensions.duration]: entry.duration,
        };
        for (const [key, value] of Object.entries(rest)) {
            if (dimensionValues.has(key))
                params[key] = value;
        }
        reportEvent(entry.name, params);
    }
}).observe({ entryTypes: ['measure'] });
