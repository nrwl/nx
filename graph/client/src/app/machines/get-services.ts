import { interpret, InterpreterStatus } from 'xstate';
import { projectGraphMachine } from '../feature-projects/machines/project-graph.machine';
import { getGraphService } from './graph.service';
import { GraphTooltipService } from '@nx/graph/ui-graph';

let projectGraphService = interpret(projectGraphMachine, {
  devTools: !!window.useXstateInspect,
});

export function getProjectGraphService() {
  if (projectGraphService.status === InterpreterStatus.NotStarted) {
    projectGraphService.start();
  }

  return projectGraphService;
}

let tooltipService: GraphTooltipService;

export function getTooltipService(): GraphTooltipService {
  if (!tooltipService) {
    const graph = getGraphService();
    tooltipService = new GraphTooltipService(graph);
  }

  return tooltipService;
}
