import type { EventParameters } from '../analytics/analytics';

export interface TrackedDetail extends EventParameters {
  track: true;
  [key: string]: string | number | boolean;
}

interface TrackedMeasureOptions {
  start?: string | number;
  end?: string | number;
  duration?: number;
  detail: TrackedDetail;
}

declare module 'perf_hooks' {
  interface Performance {
    measure(name: string, options: TrackedMeasureOptions): PerformanceMeasure;
  }
}
