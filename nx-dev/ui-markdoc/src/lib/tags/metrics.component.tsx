'use client';

import { MetricsCTA } from './metrics-cta';
import { Metric } from './metrics.schema';

export interface MetricsProps {
  metrics: Metric[];
  variant?: 'horizontal' | 'vertical';
}

export function Metrics({
  metrics,
  variant = 'vertical',
}: MetricsProps): JSX.Element {
  if (variant === 'horizontal') {
    return (
      <div className="not-content mx-auto w-full max-w-none">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {metrics.map((metric, index) => (
            <div
              key={index}
              className="flex flex-col items-center space-y-1 text-center"
            >
              <div className="text-2xl font-bold text-slate-700 dark:text-slate-200">
                {metric.value}
              </div>
              <div className="text-sm leading-snug text-slate-500 dark:text-slate-400">
                {metric.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="not-content space-y-8">
      {metrics.map((metric, index) => (
        <div key={index} className="flex flex-col space-y-2">
          <div className="text-4xl font-bold text-slate-700 dark:text-slate-200">
            {metric.value}
          </div>
          <div className="text-sm leading-snug text-slate-500 dark:text-slate-400">
            {metric.label}
          </div>
        </div>
      ))}
      <MetricsCTA />
    </div>
  );
}
