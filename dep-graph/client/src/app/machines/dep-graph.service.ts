import { interpret, InterpreterStatus } from 'xstate';
import { depGraphMachine } from './dep-graph.machine';

// TODO: figure out what happened to make the interprett return type get so weird
let depGraphService = interpret(depGraphMachine, {
  devTools: !!window.useXstateInspect,
});

export function getDepGraphService() {
  if (depGraphService.status === InterpreterStatus.NotStarted) {
    depGraphService.start();
  }

  return depGraphService;
}
