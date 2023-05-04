// nx-ignore-next-line
import { CollectionReturnValue, use } from 'cytoscape';
import cytoscapeDagre from 'cytoscape-dagre';
import popper from 'cytoscape-popper';
import {
  GraphPerfReport,
  ProjectGraphRenderEvents,
  TaskGraphRenderEvents,
} from './interfaces';
import { GraphInteractionEvents } from './graph-interaction-events';
import { RenderGraph } from './util-cytoscape/render-graph';
import { ProjectTraversalGraph } from './util-cytoscape/project-traversal-graph';
import { TaskTraversalGraph } from './util-cytoscape/task-traversal.graph';

export class GraphService {
  private projectTraversalGraph: ProjectTraversalGraph;
  private taskTraversalGraph: TaskTraversalGraph;
  private renderGraph: RenderGraph;

  lastPerformanceReport: GraphPerfReport = {
    numEdges: 0,
    numNodes: 0,
    renderTime: 0,
  };

  private listeners = new Map<
    number,
    (event: GraphInteractionEvents) => void
  >();

  constructor(
    container: string | HTMLElement,
    theme: 'light' | 'dark',
    renderMode?: 'nx-console' | 'nx-docs',
    rankDir: 'TB' | 'LR' = 'TB'
  ) {
    use(cytoscapeDagre);
    use(popper);

    this.renderGraph = new RenderGraph(container, theme, renderMode, rankDir);

    this.renderGraph.listen((event) => this.broadcast(event));
    this.projectTraversalGraph = new ProjectTraversalGraph();
    this.taskTraversalGraph = new TaskTraversalGraph();
  }

  set theme(theme: 'light' | 'dark') {
    this.renderGraph.theme = theme;
  }

  set rankDir(rankDir: 'TB' | 'LR') {
    this.renderGraph.rankDir = rankDir;
  }

  listen(callback: (event: GraphInteractionEvents) => void) {
    const listenerId = this.listeners.size + 1;
    this.listeners.set(listenerId, callback);

    return () => {
      this.listeners.delete(listenerId);
    };
  }

  broadcast(event: GraphInteractionEvents) {
    this.listeners.forEach((callback) => callback(event));
  }

  handleProjectEvent(event: ProjectGraphRenderEvents): {
    selectedProjectNames: string[];
    perfReport: GraphPerfReport;
  } {
    const time = Date.now();

    if (event.type !== 'notifyGraphUpdateGraph') {
      this.renderGraph.clearFocussedElement();
    }

    let elementsToSendToRender: CollectionReturnValue;

    switch (event.type) {
      case 'notifyGraphInitGraph':
        this.renderGraph.collapseEdges = event.collapseEdges;
        this.broadcast({ type: 'GraphRegenerated' });
        this.projectTraversalGraph.initGraph(
          event.fileMap,
          event.projects,
          event.groupByFolder,
          event.workspaceLayout,
          event.dependencies,
          event.affectedProjects,
          event.collapseEdges
        );
        break;

      case 'notifyGraphUpdateGraph':
        this.renderGraph.collapseEdges = event.collapseEdges;
        this.broadcast({ type: 'GraphRegenerated' });
        this.projectTraversalGraph.initGraph(
          event.fileMap,
          event.projects,
          event.groupByFolder,
          event.workspaceLayout,
          event.dependencies,
          event.affectedProjects,
          event.collapseEdges
        );
        elementsToSendToRender = this.projectTraversalGraph.setShownProjects(
          event.selectedProjects.length > 0
            ? event.selectedProjects
            : this.renderGraph.getCurrentlyShownProjectIds()
        );
        break;

      case 'notifyGraphFocusProject':
        elementsToSendToRender = this.projectTraversalGraph.focusProject(
          event.projectName,
          event.searchDepth
        );

        break;

      case 'notifyGraphFilterProjectsByText':
        elementsToSendToRender =
          this.projectTraversalGraph.filterProjectsByText(
            event.search,
            event.includeProjectsByPath,
            event.searchDepth
          );
        break;

      case 'notifyGraphShowProjects':
        elementsToSendToRender = this.projectTraversalGraph.showProjects(
          event.projectNames,
          this.renderGraph.getCurrentlyShownProjectIds()
        );
        break;

      case 'notifyGraphHideProjects':
        elementsToSendToRender = this.projectTraversalGraph.hideProjects(
          event.projectNames,
          this.renderGraph.getCurrentlyShownProjectIds()
        );
        break;

      case 'notifyGraphShowAllProjects':
        elementsToSendToRender = this.projectTraversalGraph.showAllProjects();
        break;

      case 'notifyGraphHideAllProjects':
        elementsToSendToRender = this.projectTraversalGraph.hideAllProjects();
        break;

      case 'notifyGraphShowAffectedProjects':
        elementsToSendToRender =
          this.projectTraversalGraph.showAffectedProjects();
        break;

      case 'notifyGraphTracing':
        if (event.start && event.end) {
          if (event.algorithm === 'shortest') {
            elementsToSendToRender = this.projectTraversalGraph.traceProjects(
              event.start,
              event.end
            );
          } else {
            elementsToSendToRender =
              this.projectTraversalGraph.traceAllProjects(
                event.start,
                event.end
              );
          }
        }
        break;
    }

    let selectedProjectNames: string[] = [];
    let perfReport: GraphPerfReport = {
      numEdges: 0,
      numNodes: 0,
      renderTime: 0,
    };

    if (this.renderGraph) {
      if (elementsToSendToRender) {
        this.renderGraph.setElements(elementsToSendToRender);

        if (event.type === 'notifyGraphFocusProject') {
          this.renderGraph.setFocussedElement(event.projectName);
        }

        const { numEdges, numNodes } = this.renderGraph.render();

        selectedProjectNames = (
          elementsToSendToRender.nodes('[type!="dir"]') ?? []
        ).map((node) => node.id());

        const renderTime = Date.now() - time;

        perfReport = {
          renderTime,
          numNodes,
          numEdges,
        };
      } else {
        const { numEdges, numNodes } = this.renderGraph.render();

        this.renderGraph.getCurrentlyShownProjectIds();

        const renderTime = Date.now() - time;

        perfReport = {
          renderTime,
          numNodes,
          numEdges,
        };
      }
    }

    this.lastPerformanceReport = perfReport;
    this.broadcast({ type: 'GraphRegenerated' });

    return { selectedProjectNames, perfReport };
  }

  handleTaskEvent(event: TaskGraphRenderEvents) {
    const time = Date.now();

    this.broadcast({ type: 'GraphRegenerated' });

    let elementsToSendToRender: CollectionReturnValue;
    switch (event.type) {
      case 'notifyTaskGraphSetProjects':
        this.taskTraversalGraph.setProjects(event.projects, event.taskGraphs);
        break;
      case 'notifyTaskGraphSetTasks':
        elementsToSendToRender = this.taskTraversalGraph.setTasks(
          event.taskIds
        );
        break;
      case 'notifyTaskGraphTasksSelected':
        elementsToSendToRender = this.taskTraversalGraph.selectTask(
          event.taskIds
        );
        break;
      case 'notifyTaskGraphTasksDeselected':
        elementsToSendToRender = this.taskTraversalGraph.deselectTask(
          event.taskIds
        );
        break;
      case 'setGroupByProject':
        elementsToSendToRender = this.taskTraversalGraph.setGroupByProject(
          event.groupByProject
        );
        break;
    }

    let selectedProjectNames: string[] = [];
    let perfReport: GraphPerfReport = {
      numEdges: 0,
      numNodes: 0,
      renderTime: 0,
    };

    if (this.renderGraph && elementsToSendToRender) {
      this.renderGraph.setElements(elementsToSendToRender);

      const { numEdges, numNodes } = this.renderGraph.render();

      selectedProjectNames = (
        elementsToSendToRender.nodes('[type!="dir"]') ?? []
      ).map((node) => node.id());

      const renderTime = Date.now() - time;

      perfReport = {
        renderTime,
        numNodes,
        numEdges,
      };
    }

    this.lastPerformanceReport = perfReport;
    this.broadcast({ type: 'GraphRegenerated' });

    return { selectedProjectNames, perfReport };
  }

  getImage() {
    return this.renderGraph.getImage();
  }
}
