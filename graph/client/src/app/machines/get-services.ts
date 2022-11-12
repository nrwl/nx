import { interpret, InterpreterFrom, InterpreterStatus } from 'xstate';
import { appMachine } from './app.machine';
import { projectGraphMachine } from '../feature-projects/machines/project-graph.machine';
import { taskGraphMachine } from '../feature-tasks/machines/task-graph.machine';

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
  const projectGraphService =
    appService.getSnapshot().context.projectGraphActor;
  return projectGraphService as InterpreterFrom<typeof projectGraphMachine>;
}

export function getTaskGraphService() {
  const appService = getAppService();
  const taskGraph = appService.getSnapshot().context.taskGraphActor;
  return taskGraph as InterpreterFrom<typeof taskGraphMachine>;
}
