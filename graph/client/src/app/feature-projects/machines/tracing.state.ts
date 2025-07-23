import { assign } from '@xstate/immer';
import { ProjectGraphStateNodeConfig } from './interfaces';

export const tracingStateConfig: ProjectGraphStateNodeConfig = {
  entry: [
    assign((ctx, event) => {
      if (event.type === 'setTracingStart') {
        ctx.tracing.start = event.projectName;
      } else if (event.type === 'setTracingEnd') {
        ctx.tracing.end = event.projectName;
      }
    }),
  ],
  exit: [
    assign((ctx, event) => {
      if (event.type !== 'setTracingStart' && event.type !== 'setTracingEnd') {
        ctx.tracing.start = null;
        ctx.tracing.end = null;
      }
    }),
  ],
  on: {
    clearTraceStart: {
      actions: [
        assign((ctx) => {
          ctx.tracing.start = null;
        }),
      ],
    },
    clearTraceEnd: {
      actions: [
        assign((ctx) => {
          ctx.tracing.end = null;
        }),
      ],
    },
  },
};
