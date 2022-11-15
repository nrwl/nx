import { interpret, InterpreterStatus } from 'xstate';
import { projectGraphMachine } from '../feature-projects/machines/project-graph.machine';

let projectGraphService = interpret(projectGraphMachine, {
  devTools: !!window.useXstateInspect,
});

export function getProjectGraphService() {
  if (projectGraphService.status === InterpreterStatus.Stopped) {
  }

  return projectGraphService;
}
