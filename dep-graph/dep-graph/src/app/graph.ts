import { ProjectGraph, ProjectGraphNode } from '@nrwl/workspace';
import * as cy from 'cytoscape';
import anywherePanning from 'cytoscape-anywhere-panning';
import cytoscapeDagre from 'cytoscape-dagre';
import popper from 'cytoscape-popper';
import { Instance } from 'tippy.js';
import { ProjectNodeToolTip } from './project-node-tooltip';
import { edgeStyles, nodeStyles } from './styles-graph';
import { GraphTooltipService } from './tooltip-service';
import {
  CytoscapeDagreConfig,
  ParentNode,
  ProjectEdge,
  ProjectNode,
} from './util-cytoscape';

export class GraphComponent {
  private graph: cy.Core;
  private openTooltip: Instance = null;

  affectedProjects: string[];
  projectGraph: ProjectGraph;

  constructor(private tooltipService: GraphTooltipService) {
    cy.use(cytoscapeDagre);
    cy.use(popper);
    cy.use(anywherePanning);
  }

  render(selectedProjects: ProjectGraphNode[], groupByFolder: boolean) {
    this.tooltipService.hideAll();
    this.generateCytoscapeLayout(selectedProjects, groupByFolder);
    this.listenForProjectNodeClicks();
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

    this.graph.anywherePanning();

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
      const projectNode = new ProjectNode(project);
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

      let ref = node.popperRef(); // used only for positioning

      const content = new ProjectNodeToolTip(node).render();

      this.openTooltip = this.tooltipService.open(ref, content);
    });
  }
}
