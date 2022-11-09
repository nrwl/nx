import { interpret, InterpreterStatus } from 'xstate';
import { appMachine } from './app.machine';

let appService = interpret(appMachine, {
  devTools: !!window.useXstateInspect,
});

export function getAppService() {
  if (appService.status === InterpreterStatus.NotStarted) {
    appService.start();
  }

  return appService;
}
export function getProjectGraphService() {
  const appService = getAppService();
  const depGraphService = appService.getSnapshot().context.projectGraphActor;
  return depGraphService;
}

export function getTaskGraphService() {
  const appService = getAppService();
  const taskGraph = appService.getSnapshot().context.taskGraphActor;
  return taskGraph;
}
