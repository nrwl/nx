// nx-ignore-next-line
import { CollectionReturnValue, use } from 'cytoscape';
import cytoscapeDagre from 'cytoscape-dagre';
import popper from 'cytoscape-popper';
import { GraphPerfReport, GraphRenderEvents } from './interfaces';
import { GraphInteractionEvents } from './graph-interaction-events';
import { RenderGraph } from './util-cytoscape/render-graph';
import { ProjectTraversalGraph } from './util-cytoscape/project-traversal-graph';

export class GraphService {
  private traversalGraph: ProjectTraversalGraph;
  private renderGraph: RenderGraph;

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
    this.traversalGraph = new ProjectTraversalGraph();
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

  handleEvent(event: GraphRenderEvents): {
    selectedProjectNames: string[];
    perfReport: GraphPerfReport;
  } {
    const time = Date.now();

    if (event.type !== 'notifyGraphUpdateGraph') {
      this.renderGraph.clearFocussedElement();
    }

    this.broadcast({ type: 'GraphRegenerated' });

    let elementsToSendToRender: CollectionReturnValue;

    switch (event.type) {
      case 'notifyGraphInitGraph':
        this.renderGraph.collapseEdges = event.collapseEdges;
        this.broadcast({ type: 'GraphRegenerated' });
        this.traversalGraph.initGraph(
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
        this.traversalGraph.initGraph(
          event.projects,
          event.groupByFolder,
          event.workspaceLayout,
          event.dependencies,
          event.affectedProjects,
          event.collapseEdges
        );
        elementsToSendToRender = this.traversalGraph.setShownProjects(
          event.selectedProjects.length > 0
            ? event.selectedProjects
            : this.renderGraph.getCurrentlyShownProjectIds()
        );
        break;

      case 'notifyGraphFocusProject':
        elementsToSendToRender = this.traversalGraph.focusProject(
          event.projectName,
          event.searchDepth
        );

        break;

      case 'notifyGraphFilterProjectsByText':
        elementsToSendToRender = this.traversalGraph.filterProjectsByText(
          event.search,
          event.includeProjectsByPath,
          event.searchDepth
        );
        break;

      case 'notifyGraphShowProjects':
        elementsToSendToRender = this.traversalGraph.showProjects(
          event.projectNames,
          this.renderGraph.getCurrentlyShownProjectIds()
        );
        break;

      case 'notifyGraphHideProjects':
        elementsToSendToRender = this.traversalGraph.hideProjects(
          event.projectNames,
          this.renderGraph.getCurrentlyShownProjectIds()
        );
        break;

      case 'notifyGraphShowAllProjects':
        elementsToSendToRender = this.traversalGraph.showAllProjects();
        break;

      case 'notifyGraphHideAllProjects':
        elementsToSendToRender = this.traversalGraph.hideAllProjects();
        break;

      case 'notifyGraphShowAffectedProjects':
        elementsToSendToRender = this.traversalGraph.showAffectedProjects();
        break;

      case 'notifyGraphTracing':
        if (event.start && event.end) {
          if (event.algorithm === 'shortest') {
            elementsToSendToRender = this.traversalGraph.traceProjects(
              event.start,
              event.end
            );
          } else {
            elementsToSendToRender = this.traversalGraph.traceAllProjects(
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

    if (this.renderGraph && elementsToSendToRender) {
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
    }

    return { selectedProjectNames, perfReport };
  }

  getImage() {
    return this.renderGraph.getImage();
  }
}
