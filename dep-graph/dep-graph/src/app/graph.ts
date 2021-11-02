import type { ProjectGraph, ProjectGraphNode } from '@nrwl/devkit';
import * as cy from 'cytoscape';
import cytoscapeDagre from 'cytoscape-dagre';
import popper from 'cytoscape-popper';
import { Subject } from 'rxjs';
import type { Instance } from 'tippy.js';
import { ProjectNodeToolTip } from './project-node-tooltip';
import { edgeStyles, nodeStyles } from './styles-graph';
import { GraphTooltipService } from './tooltip-service';
import {
  CytoscapeDagreConfig,
  ParentNode,
  ProjectEdge,
  ProjectNode,
} from './util-cytoscape';
import type { VirtualElement } from '@popperjs/core';

export interface GraphPerfReport {
  renderTime: number;
  numNodes: number;
  numEdges: number;
}
export class GraphComponent {
  private graph: cy.Core;
  private openTooltip: Instance = null;

  affectedProjects: string[];
  projectGraph: ProjectGraph;

  private renderTimesSubject = new Subject<GraphPerfReport>();
  renderTimes$ = this.renderTimesSubject.asObservable();

  constructor(private tooltipService: GraphTooltipService) {
    cy.use(cytoscapeDagre);
    cy.use(popper);
  }

  render(selectedProjects: ProjectGraphNode[], groupByFolder: boolean) {
    const time = Date.now();

    this.tooltipService.hideAll();
    this.generateCytoscapeLayout(selectedProjects, groupByFolder);
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
    groupByFolder: boolean
  ) {
    const elements = this.createElements(selectedProjects, groupByFolder);

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
    groupByFolder: boolean
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
          ? window.workspaceLayout.appsDir
          : window.workspaceLayout.libsDir;

      const projectNode = new ProjectNode(project, workspaceRoot);
      projectNode.focused = project.name === window.focusedProject;
      projectNode.affected = this.affectedProjects.includes(project.name);

      projectNodes.push(projectNode);

      this.projectGraph.dependencies[project.name].forEach((dep) => {
        if (filteredProjectNames.includes(dep.target)) {
          const edge = new ProjectEdge(dep);
          edge.affected =
            this.affectedProjects.includes(dep.source) &&
            this.affectedProjects.includes(dep.target);
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
