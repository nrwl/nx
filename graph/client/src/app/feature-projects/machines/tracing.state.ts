import { assign } from '@xstate/immer';
import { ProjectGraphStateNodeConfig } from './interfaces';
import { send } from 'xstate';

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
    setTracingEnd: {
      actions: [
        assign((ctx, event) => {
          ctx.tracing.end = event.projectName;
        }),
        send(
          (ctx) => ({
            type: 'trace',
            start: `project-${ctx.tracing.start}`,
            end: `project-${ctx.tracing.end}`,
            algorithm: ctx.tracing.algorithm,
          }),
          { to: (ctx) => ctx.graphActor }
        ),
      ],
    },
    setTracingAlgorithm: {
      actions: [
        assign((ctx, event) => {
          ctx.tracing.algorithm = event.algorithm;
        }),
        send(
          (ctx) => ({
            type: 'trace',
            start: `project-${ctx.tracing.start}`,
            end: `project-${ctx.tracing.end}`,
            algorithm: ctx.tracing.algorithm,
          }),
          { to: (ctx) => ctx.graphActor }
        ),
      ],
    },
    clearTraceStart: {
      target: 'unselected',
    },
    clearTraceEnd: {
      actions: [
        assign((ctx) => {
          ctx.tracing.end = null;
        }),
        send(() => ({ type: 'showAll', autoExpand: false }), {
          to: (ctx) => ctx.graphActor,
        }),
      ],
    },
  },
};
