import { assign } from '@xstate/immer';
import { DepGraphStateNodeConfig } from './interfaces';

export const tracingStateConfig: DepGraphStateNodeConfig = {
  entry: [
    assign((ctx, event) => {
      if (event.type === 'setTracingStart') {
        ctx.tracing.start = event.projectName;
      } else if (event.type === 'setTracingEnd') {
        ctx.tracing.end = event.projectName;
      }
    }),
    'notifyRouteTracing',
    'notifyGraphTracing',
  ],
  on: {
    clearTraceStart: {
      actions: [
        assign((ctx) => {
          ctx.tracing.start = null;
        }),
        'notifyRouteTracing',
        'notifyGraphTracing',
      ],
    },
    clearTraceEnd: {
      actions: [
        assign((ctx) => {
          ctx.tracing.end = null;
        }),
        'notifyRouteTracing',
        'notifyGraphTracing',
      ],
    },
  },
};
