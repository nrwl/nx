import type {
  ProjectGraph,
  ProjectGraphDependency,
  ProjectGraphNode,
} from '@nrwl/devkit';
import type { VirtualElement } from '@popperjs/core';
import * as cy from 'cytoscape';
import cytoscapeDagre from 'cytoscape-dagre';
import popper from 'cytoscape-popper';
import { Subject } from 'rxjs';
import type { Instance } from 'tippy.js';
import { useDepGraphService } from './machines/dep-graph.service';
import { ProjectNodeToolTip } from './project-node-tooltip';
import { edgeStyles, nodeStyles } from './styles-graph';
import { GraphTooltipService } from './tooltip-service';
import {
  CytoscapeDagreConfig,
  ParentNode,
  ProjectEdge,
  ProjectNode,
} from './util-cytoscape';

export interface GraphPerfReport {
  renderTime: number;
  numNodes: number;
  numEdges: number;
}
export class GraphComponent {
  private graph: cy.Core;
  private openTooltip: Instance = null;

  private renderTimesSubject = new Subject<GraphPerfReport>();
  renderTimes$ = this.renderTimesSubject.asObservable();

  private send;
  constructor(private tooltipService: GraphTooltipService) {
    cy.use(cytoscapeDagre);
    cy.use(popper);

    const [state$, send] = useDepGraphService();
    this.send = send;

    state$.subscribe((state) => {
      const projects = state.context.selectedProjects.map((projectName) =>
        state.context.projects.find((project) => project.name === projectName)
      );
      this.render(
        projects,
        state.context.groupByFolder,
        state.context.workspaceLayout,
        state.context.focusedProject,
        state.context.affectedProjects,
        state.context.dependencies
      );
    });
  }

  render(
    selectedProjects: ProjectGraphNode[],
    groupByFolder: boolean,
    workspaceLayout,
    focusedProject: string,
    affectedProjects: string[],
    dependencies: Record<string, ProjectGraphDependency[]>
  ) {
    const time = Date.now();

    if (selectedProjects.length === 0) {
      document.getElementById('no-projects-chosen').style.display = 'flex';
    } else {
      document.getElementById('no-projects-chosen').style.display = 'none';
    }

    this.tooltipService.hideAll();
    this.generateCytoscapeLayout(
      selectedProjects,
      groupByFolder,
      workspaceLayout,
      focusedProject,
      affectedProjects,
      dependencies
    );
    this.listenForProjectNodeClicks();
    this.listenForProjectNodeHovers();

    const renderTime = Date.now() - time;

    const report: GraphPerfReport = {
      renderTime,
      numNodes: this.graph.nodes().length,
      numEdges: this.graph.edges().length,
    };

    this.renderTimesSubject.next(report);
  }

  private generateCytoscapeLayout(
    selectedProjects: ProjectGraphNode[],
    groupByFolder: boolean,
    workspaceLayout,
    focusedProject: string,
    affectedProjects: string[],
    dependencies: Record<string, ProjectGraphDependency[]>
  ) {
    const elements = this.createElements(
      selectedProjects,
      groupByFolder,
      workspaceLayout,
      focusedProject,
      affectedProjects,
      dependencies
    );

    this.graph = cy({
      container: document.getElementById('graph-container'),
      elements: [...elements],
      layout: <CytoscapeDagreConfig>{
        name: 'dagre',
        nodeDimensionsIncludeLabels: true,
        rankSep: 75,
        edgeSep: 50,
        ranker: 'network-simplex',
      },
      boxSelectionEnabled: false,
      style: [...nodeStyles, ...edgeStyles],
    });

    this.graph.on('zoom', () => {
      if (this.openTooltip) {
        this.openTooltip.hide();
        this.openTooltip = null;
      }
    });
  }

  private createElements(
    selectedProjects: ProjectGraphNode[],
    groupByFolder: boolean,
    workspaceLayout: {
      appsDir: string;
      libsDir: string;
    },
    focusedProject: string,
    affectedProjects: string[],
    dependencies: Record<string, ProjectGraphDependency[]>
  ) {
    let elements: cy.ElementDefinition[] = [];
    const filteredProjectNames = selectedProjects.map(
      (project) => project.name
    );

    const projectNodes: ProjectNode[] = [];
    const edgeNodes: ProjectEdge[] = [];
    const parents: Record<
      string,
      { id: string; parentId: string; label: string }
    > = {};

    selectedProjects.forEach((project) => {
      const workspaceRoot =
        project.type === 'app' || project.type === 'e2e'
          ? workspaceLayout.appsDir
          : workspaceLayout.libsDir;

      const projectNode = new ProjectNode(project, workspaceRoot);
      projectNode.focused = project.name === focusedProject;
      projectNode.affected = affectedProjects.includes(project.name);

      projectNodes.push(projectNode);

      dependencies[project.name].forEach((dep) => {
        if (filteredProjectNames.includes(dep.target)) {
          const edge = new ProjectEdge(dep);
          edge.affected =
            affectedProjects.includes(dep.source) &&
            affectedProjects.includes(dep.target);
          edgeNodes.push(edge);
        }
      });

      if (groupByFolder) {
        const ancestors = projectNode.getAncestors();
        ancestors.forEach((ancestor) => (parents[ancestor.id] = ancestor));
      }
    });

    const projectElements = projectNodes.map((projectNode) =>
      projectNode.getCytoscapeNodeDef(groupByFolder)
    );

    const edgeElements = edgeNodes.map((edgeNode) =>
      edgeNode.getCytosacpeNodeDef()
    );

    elements = projectElements.concat(edgeElements);

    if (groupByFolder) {
      const parentElements = Object.keys(parents).map((id) =>
        new ParentNode(parents[id]).getCytoscapeNodeDef()
      );
      elements = parentElements.concat(elements);
    }

    return elements;
  }

  listenForProjectNodeClicks() {
    this.graph.$('node:childless').on('click', (event) => {
      const node = event.target;

      let ref: VirtualElement = node.popperRef(); // used only for positioning

      const content = new ProjectNodeToolTip(node).render();

      this.openTooltip = this.tooltipService.open(ref, content);
    });
  }

  listenForProjectNodeHovers(): void {
    this.graph.on('mouseover', (event) => {
      const node = event.target;
      if (!node.isNode || !node.isNode() || node.isParent()) return;

      this.graph
        .elements()
        .difference(node.outgoers().union(node.incomers()))
        .not(node)
        .addClass('transparent');
      node
        .addClass('highlight')
        .outgoers()
        .union(node.incomers())
        .addClass('highlight');
    });
    this.graph.on('mouseout', (event) => {
      const node = event.target;
      if (!node.isNode || !node.isNode() || node.isParent()) return;

      this.graph.elements().removeClass('transparent');
      node
        .removeClass('highlight')
        .outgoers()
        .union(node.incomers())
        .removeClass('highlight');
    });
  }
}
