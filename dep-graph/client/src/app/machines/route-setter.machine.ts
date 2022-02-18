import { assign } from '@xstate/immer';
import { createBrowserHistory } from 'history';
import { Machine } from 'xstate';
import { RouteEvents } from './interfaces';

type ParamKeys =
  | 'focus'
  | 'groupByFolder'
  | 'searchDepth'
  | 'select'
  | 'collapseEdges'
  | 'traceStart'
  | 'traceEnd';
type ParamRecord = Record<ParamKeys, string | null>;

function reduceParamRecordToQueryString(params: ParamRecord): string {
  const newParams = Object.entries(params).reduce((acc, [key, value]) => {
    if (value !== null) {
      acc[key] = value;
    }

    return acc;
  }, {});

  return new URLSearchParams(newParams).toString();
}

export const createRouteMachine = () => {
  const history = createBrowserHistory();

  const params = new URLSearchParams(history.location.search);
  const paramRecord: ParamRecord = {
    focus: params.get('focus'),
    groupByFolder: params.get('groupByFolder'),
    collapseEdges: params.get('collapseEdges'),
    searchDepth: params.get('searchDepth'),
    select: params.get('select'),
    traceStart: params.get('traceStart'),
    traceEnd: params.get('traceEnd'),
  };

  const initialContext = {
    currentParamString: reduceParamRecordToQueryString(paramRecord),
    params: paramRecord,
  };

  return Machine<
    { currentParamString: string; params: Record<ParamKeys, string | null> },
    {},
    RouteEvents
  >(
    {
      id: 'route',
      context: {
        currentParamString: '',
        params: {
          focus: null,
          groupByFolder: null,
          searchDepth: null,
          select: null,
          collapseEdges: null,
          traceStart: null,
          traceEnd: null,
        },
      },
      always: {
        actions: assign((ctx) => {
          const history = createBrowserHistory();

          const newParamString = reduceParamRecordToQueryString(ctx.params);

          history.push({
            search: newParamString,
          });

          ctx.currentParamString = newParamString;
        }),
        cond: 'didParamsChange',
      },
      on: {
        notifyRouteSelectAll: {
          actions: assign((ctx) => {
            ctx.params.select = 'all';
            ctx.params.focus = null;
          }),
        },
        notifyRouteSelectAffected: {
          actions: assign((ctx) => {
            ctx.params.select = 'affected';
            ctx.params.focus = null;
          }),
        },
        notifyRouteClearSelect: {
          actions: assign((ctx) => {
            ctx.params.select = null;
          }),
        },
        notifyRouteFocusProject: {
          actions: assign((ctx, event) => {
            ctx.params.focus = event.focusedProject;
            ctx.params.select = null;
          }),
        },
        notifyRouteUnfocusProject: {
          actions: assign((ctx, event) => {
            ctx.params.focus = null;
          }),
        },
        notifyRouteGroupByFolder: {
          actions: assign((ctx, event) => {
            ctx.params.groupByFolder = event.groupByFolder ? 'true' : null;
          }),
        },
        notifyRouteCollapseEdges: {
          actions: assign((ctx, event) => {
            ctx.params.collapseEdges = event.collapseEdges ? 'true' : null;
          }),
        },
        notifyRouteSearchDepth: {
          actions: assign((ctx, event) => {
            ctx.params.searchDepth = event.searchDepthEnabled
              ? event.searchDepth.toString()
              : null;
          }),
        },
        notifyRouteTracing: {
          actions: assign((ctx, event) => {
            if (event.start !== null && event.end !== null) {
              ctx.params.traceStart = event.start;
              ctx.params.traceEnd = event.end;

              ctx.params.focus = null;
              ctx.params.select = null;
            } else {
              ctx.params.traceStart = null;
              ctx.params.traceEnd = null;
            }
          }),
        },
      },
    },
    {
      guards: {
        didParamsChange: (ctx) => {
          const cond =
            ctx.currentParamString !==
            reduceParamRecordToQueryString(ctx.params);

          return cond;
        },
      },
    }
  ).withContext(initialContext);
};
