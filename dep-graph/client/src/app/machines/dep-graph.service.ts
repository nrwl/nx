import { interpret, Interpreter, Typestate } from 'xstate';
import { depGraphMachine } from './dep-graph.machine';
import {
  DepGraphContext,
  DepGraphSchema,
  DepGraphUIEvents,
} from './interfaces';

let depGraphService: Interpreter<
  DepGraphContext,
  DepGraphSchema,
  DepGraphUIEvents,
  Typestate<DepGraphContext>
>;

export function getDepGraphService() {
  if (!depGraphService) {
    depGraphService = interpret(depGraphMachine, {
      devTools: !!window.useXstateInspect,
    });
    depGraphService.start();
  }

  return depGraphService;
}
