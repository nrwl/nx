import type { EventParameters } from '../analytics/analytics';

interface TrackedMeasureOptions {
  start?: string | number;
  end?: string | number;
  duration?: number;
  detail: { track: true } & EventParameters;
}

declare module 'perf_hooks' {
  interface Performance {
    measure(name: string, options: TrackedMeasureOptions): PerformanceMeasure;
  }
}
