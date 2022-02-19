// nx-ignore-next-line
import type {
  ProjectGraphDependency,
  ProjectGraphProjectNode,
} from '@nrwl/devkit';
import type { VirtualElement } from '@popperjs/core';
import { default as cy } from 'cytoscape';
import { default as cytoscapeDagre } from 'cytoscape-dagre';
import { default as popper } from 'cytoscape-popper';
import path from 'path/posix';
import type { Instance } from 'tippy.js';
import EdgeNodeTooltip from '../edge-tooltip';
import ProjectNodeToolTip from '../project-node-tooltip';
import { edgeStyles, nodeStyles } from '../styles-graph';
import { GraphTooltipService } from '../tooltip-service';
import {
  CytoscapeDagreConfig,
  ParentNode,
  ProjectEdge,
  ProjectNode,
} from '../util-cytoscape';
import { GraphRenderEvents, GraphPerfReport } from './interfaces';
import { selectValueByThemeStatic } from '../theme-resolver';

export class GraphService {
  private traversalGraph: cy.Core;
  private renderGraph: cy.Core;

  private openTooltip: Instance = null;
  private collapseEdges = false;

  constructor(
    private tooltipService: GraphTooltipService,
    private containerId: string
  ) {
    cy.use(cytoscapeDagre);
    cy.use(popper);
  }

  handleEvent(event: GraphRenderEvents): {
    selectedProjectNames: string[];
    perfReport: GraphPerfReport;
  } {
    const time = Date.now();

    if (this.renderGraph && event.type !== 'notifyGraphUpdateGraph') {
      this.renderGraph.nodes('.focused').removeClass('focused');
    }

    this.tooltipService.hideAll();

    switch (event.type) {
      case 'notifyGraphInitGraph':
        this.initGraph(
          event.projects,
          event.groupByFolder,
          event.workspaceLayout,
          event.dependencies,
          event.affectedProjects,
          event.collapseEdges
        );
        break;

      case 'notifyGraphUpdateGraph':
        this.initGraph(
          event.projects,
          event.groupByFolder,
          event.workspaceLayout,
          event.dependencies,
          event.affectedProjects,
          event.collapseEdges
        );
        this.setShownProjects(
          event.selectedProjects.length > 0
            ? event.selectedProjects
            : this.renderGraph.nodes(':childless').map((node) => node.id())
        );
        break;

      case 'notifyGraphFocusProject':
        this.focusProject(event.projectName, event.searchDepth);
        break;

      case 'notifyGraphFilterProjectsByText':
        this.filterProjectsByText(
          event.search,
          event.includeProjectsByPath,
          event.searchDepth
        );
        break;

      case 'notifyGraphShowProject':
        this.showProjects([event.projectName]);
        break;

      case 'notifyGraphHideProject':
        this.hideProject(event.projectName);
        break;

      case 'notifyGraphShowAllProjects':
        this.showAllProjects();
        break;

      case 'notifyGraphHideAllProjects':
        this.hideAllProjects();
        break;

      case 'notifyGraphShowAffectedProjects':
        this.showAffectedProjects();
        break;

      case 'notifyGraphTracing':
        if (event.start && event.end) {
          this.traceProjects(event.start, event.end);
          // this.traceAllProjects(event.start, event.end);
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
      const elements = this.renderGraph.elements().sort((a, b) => {
        return a.id().localeCompare(b.id());
      });

      elements
        .layout({
          name: 'dagre',
          nodeDimensionsIncludeLabels: true,
          rankSep: 75,
          rankDir: 'TB',
          edgeSep: 50,
          ranker: 'network-simplex',
        } as CytoscapeDagreConfig)
        .run();

      if (this.collapseEdges) {
        this.renderGraph.remove(this.renderGraph.edges());

        elements.edges().forEach((edge) => {
          const sourceNode = edge.source();
          const targetNode = edge.target();

          if (
            sourceNode.parent().first().id() ===
            targetNode.parent().first().id()
          ) {
            this.renderGraph.add(edge);
          } else {
            let sourceAncestors, targetAncestors;
            const commonAncestors = edge.connectedNodes().commonAncestors();

            if (commonAncestors.length > 0) {
              sourceAncestors = sourceNode
                .ancestors()
                .filter((anc) => !commonAncestors.contains(anc));
              targetAncestors = targetNode
                .ancestors()
                .filter((anc) => !commonAncestors.contains(anc));
            } else {
              sourceAncestors = sourceNode.ancestors();
              targetAncestors = targetNode.ancestors();
            }

            let sourceId, targetId;

            if (sourceAncestors.length > 0 && targetAncestors.length === 0) {
              sourceId = sourceAncestors.last().id();
              targetId = targetNode.id();
            } else if (
              targetAncestors.length > 0 &&
              sourceAncestors.length === 0
            ) {
              sourceId = sourceNode.id();
              targetId = targetAncestors.last().id();
            } else {
              sourceId = sourceAncestors.last().id();
              targetId = targetAncestors.last().id();
            }

            if (sourceId !== undefined && targetId !== undefined) {
              const edgeId = `${sourceId}|${targetId}`;

              if (this.renderGraph.$id(edgeId).length === 0) {
                const ancestorEdge: cy.EdgeDefinition = {
                  group: 'edges',
                  data: {
                    id: edgeId,
                    source: sourceId,
                    target: targetId,
                  },
                };

                this.renderGraph.add(ancestorEdge);
              }
            } else {
              console.log(`Couldn't figure out how to draw edge ${edge.id()}`);
              console.log(
                'source ancestors',
                sourceAncestors.map((anc) => anc.id())
              );
              console.log(
                'target ancestors',
                targetAncestors.map((anc) => anc.id())
              );
            }
          }
        });
      }

      this.renderGraph.fit().center().resize();

      selectedProjectNames = this.renderGraph
        .nodes('[type!="dir"]')
        .map((node) => node.id());

      const renderTime = Date.now() - time;

      perfReport = {
        renderTime,
        numNodes: this.renderGraph.nodes().length,
        numEdges: this.renderGraph.edges().length,
      };
    }

    return { selectedProjectNames, perfReport };
  }

  setShownProjects(selectedProjectNames: string[]) {
    let nodesToAdd = this.traversalGraph.collection();

    selectedProjectNames.forEach((name) => {
      nodesToAdd = nodesToAdd.union(this.traversalGraph.$id(name));
    });

    const ancestorsToAdd = nodesToAdd.ancestors();

    const nodesToRender = nodesToAdd.union(ancestorsToAdd);
    const edgesToRender = nodesToRender.edgesTo(nodesToRender);

    this.transferToRenderGraph(nodesToRender.union(edgesToRender));
  }

  showProjects(selectedProjectNames: string[]) {
    const currentNodes =
      this.renderGraph?.nodes() ?? this.traversalGraph.collection();

    let nodesToAdd = this.traversalGraph.collection();

    selectedProjectNames.forEach((name) => {
      nodesToAdd = nodesToAdd.union(this.traversalGraph.$id(name));
    });

    const ancestorsToAdd = nodesToAdd.ancestors();

    const nodesToRender = currentNodes.union(nodesToAdd).union(ancestorsToAdd);
    const edgesToRender = nodesToRender.edgesTo(nodesToRender);

    this.transferToRenderGraph(nodesToRender.union(edgesToRender));
  }

  hideProject(projectName: string) {
    const currentNodes =
      this.renderGraph?.nodes() ?? this.traversalGraph.collection();
    const nodeToHide = this.renderGraph.$id(projectName);

    const nodesToAdd = currentNodes
      .difference(nodeToHide)
      .difference(nodeToHide.ancestors());
    const ancestorsToAdd = nodesToAdd.ancestors();

    let nodesToRender = nodesToAdd.union(ancestorsToAdd);

    const edgesToRender = nodesToRender.edgesTo(nodesToRender);

    this.transferToRenderGraph(nodesToRender.union(edgesToRender));
  }

  showAffectedProjects() {
    const affectedProjects = this.traversalGraph.nodes('.affected');
    const affectedAncestors = affectedProjects.ancestors();

    const affectedNodes = affectedProjects.union(affectedAncestors);
    const affectedEdges = affectedNodes.edgesTo(affectedNodes);

    this.transferToRenderGraph(affectedNodes.union(affectedEdges));
  }

  focusProject(focusedProjectName: string, searchDepth: number = 1) {
    const focusedProject = this.traversalGraph.$id(focusedProjectName);

    const includedProjects = this.includeProjectsByDepth(
      focusedProject,
      searchDepth
    );

    const includedNodes = focusedProject.union(includedProjects);

    const includedAncestors = includedNodes.ancestors();

    const nodesToRender = includedNodes.union(includedAncestors);
    const edgesToRender = nodesToRender.edgesTo(nodesToRender);

    this.transferToRenderGraph(nodesToRender.union(edgesToRender));

    this.renderGraph.$id(focusedProjectName).addClass('focused');
  }

  showAllProjects() {
    this.transferToRenderGraph(this.traversalGraph.elements());
  }

  hideAllProjects() {
    this.transferToRenderGraph(this.traversalGraph.collection());
  }

  filterProjectsByText(
    search: string,
    includePath: boolean,
    searchDepth: number = -1
  ) {
    if (search === '') {
      this.transferToRenderGraph(this.traversalGraph.collection());
    } else {
      const split = search.split(',');

      let filteredProjects = this.traversalGraph.nodes().filter((node) => {
        return (
          split.findIndex((splitItem) => node.id().includes(splitItem)) > -1
        );
      });

      if (includePath) {
        filteredProjects = filteredProjects.union(
          this.includeProjectsByDepth(filteredProjects, searchDepth)
        );
      }

      filteredProjects = filteredProjects.union(filteredProjects.ancestors());
      const edgesToRender = filteredProjects.edgesTo(filteredProjects);

      this.transferToRenderGraph(filteredProjects.union(edgesToRender));
    }
  }

  traceProjects(start: string, end: string) {
    const dijkstra = this.traversalGraph
      .elements()
      .dijkstra({ root: `[id = "${start}"]`, directed: true });

    const path = dijkstra.pathTo(this.traversalGraph.$(`[id = "${end}"]`));

    this.transferToRenderGraph(path.union(path.ancestors()));
  }

  traceAllProjects(start: string, end: string) {
    const startNode = this.traversalGraph.$id(start).nodes().first();

    const queue: cy.NodeSingular[][] = [[startNode]];

    const paths: cy.NodeSingular[][] = [];
    let iterations = 0;

    while (queue.length > 0 && iterations <= 1000) {
      const currentPath = queue.pop();

      const nodeToTest = currentPath[currentPath.length - 1];

      const outgoers = nodeToTest.outgoers('node');

      if (outgoers.length > 0) {
        outgoers.forEach((outgoer) => {
          const newPath = [...currentPath, outgoer];
          if (outgoer.id() === end) {
            paths.push(newPath);
          } else {
            queue.push(newPath);
          }
        });
      }

      iterations++;
    }

    if (iterations >= 1000) {
      console.log('failsafe triggered!');
    }
    paths.forEach((currentPath) => {
      console.log(
        currentPath
          .map((path) => path.map((element) => element.id()))
          .join(' => ')
      );
    });

    let finalCollection = this.traversalGraph.collection();

    paths.forEach((path) => {
      for (let i = 0; i < path.length; i++) {
        finalCollection = finalCollection.union(path[i]);

        const nextIndex = i + 1;
        if (nextIndex < path.length) {
          finalCollection = finalCollection.union(
            path[i].edgesTo(path[nextIndex])
          );
        }
      }
    });

    console.log(finalCollection.length);

    finalCollection.union(finalCollection.ancestors());
    console.log(finalCollection.map((element) => element.id()));
    this.transferToRenderGraph(finalCollection);
  }

  private transferToRenderGraph(elements: cy.Collection) {
    let currentFocusedProjectName;
    if (this.renderGraph) {
      currentFocusedProjectName = this.renderGraph
        .nodes('.focused')
        .first()
        .id();
      this.renderGraph.destroy();
      delete this.renderGraph;
    }
    const container = document.getElementById(this.containerId);

    this.renderGraph = cy({
      container: container,
      headless: !container,
      boxSelectionEnabled: false,
      style: [...nodeStyles, ...edgeStyles],
    });

    this.renderGraph.add(elements);

    if (!!currentFocusedProjectName) {
      this.renderGraph.$id(currentFocusedProjectName).addClass('focused');
    }

    this.renderGraph.on('zoom', () => {
      if (this.openTooltip) {
        this.openTooltip.hide();
        this.openTooltip = null;
      }
    });

    this.listenForProjectNodeClicks();
    this.listenForEdgeNodeClicks();
    this.listenForProjectNodeHovers();
  }

  private includeProjectsByDepth(
    projects: cy.NodeCollection | cy.NodeSingular,
    depth: number = -1
  ) {
    let predecessors = this.traversalGraph.collection();

    if (depth === -1) {
      predecessors = projects.predecessors();
    } else {
      predecessors = projects.incomers();

      for (let i = 1; i < depth; i++) {
        predecessors = predecessors.union(predecessors.incomers());
      }
    }

    let successors = this.traversalGraph.collection();

    if (depth === -1) {
      successors = projects.successors();
    } else {
      successors = projects.outgoers();

      for (let i = 1; i < depth; i++) {
        successors = successors.union(successors.outgoers());
      }
    }

    return projects.union(predecessors).union(successors);
  }

  initGraph(
    allProjects: ProjectGraphProjectNode[],
    groupByFolder: boolean,
    workspaceLayout,
    dependencies: Record<string, ProjectGraphDependency[]>,
    affectedProjectIds: string[],
    collapseEdges: boolean
  ) {
    this.collapseEdges = collapseEdges;
    this.tooltipService.hideAll();

    this.generateCytoscapeLayout(
      allProjects,
      groupByFolder,
      workspaceLayout,
      dependencies,
      affectedProjectIds
    );
  }

  private generateCytoscapeLayout(
    allProjects: ProjectGraphProjectNode[],
    groupByFolder: boolean,
    workspaceLayout,
    dependencies: Record<string, ProjectGraphDependency[]>,
    affectedProjectIds: string[]
  ) {
    const elements = this.createElements(
      allProjects,
      groupByFolder,
      workspaceLayout,
      dependencies,
      affectedProjectIds
    );

    this.traversalGraph = cy({
      headless: true,
      elements: [...elements],
      boxSelectionEnabled: false,
      style: [...nodeStyles, ...edgeStyles],
    });
  }

  private createElements(
    projects: ProjectGraphProjectNode[],
    groupByFolder: boolean,
    workspaceLayout: {
      appsDir: string;
      libsDir: string;
    },
    dependencies: Record<string, ProjectGraphDependency[]>,
    affectedProjectIds: string[]
  ) {
    let elements: cy.ElementDefinition[] = [];
    const filteredProjectNames = projects.map((project) => project.name);

    const projectNodes: ProjectNode[] = [];
    const edgeNodes: ProjectEdge[] = [];
    const parents: Record<
      string,
      { id: string; parentId: string; label: string }
    > = {};

    projects.forEach((project) => {
      const workspaceRoot =
        project.type === 'app' || project.type === 'e2e'
          ? workspaceLayout.appsDir
          : workspaceLayout.libsDir;

      const projectNode = new ProjectNode(project, workspaceRoot);

      projectNode.affected = affectedProjectIds.includes(project.name);

      projectNodes.push(projectNode);

      dependencies[project.name].forEach((dep) => {
        if (filteredProjectNames.includes(dep.target)) {
          const edge = new ProjectEdge(dep);
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
    this.renderGraph.$('node:childless').on('click', (event) => {
      const node = event.target;

      let ref: VirtualElement = node.popperRef(); // used only for positioning

      const content = ProjectNodeToolTip({
        id: node.id(),
        type: node.data('type'),
        tags: node.data('tags'),
      });

      this.openTooltip = this.tooltipService.open(ref, content);
    });
  }

  listenForEdgeNodeClicks() {
    this.renderGraph.$('edge').on('click', (event) => {
      const edge: cy.EdgeSingular = event.target;
      let ref: VirtualElement = edge.popperRef(); // used only for positioning

      const tooltipContent = EdgeNodeTooltip({
        type: edge.data('type'),
        source: edge.source().id(),
        target: edge.target().id(),
        fileDependencies: edge
          .source()
          .data('files')
          .filter((file) => file.deps && file.deps.includes(edge.target().id()))
          .map((file) => {
            return {
              fileName: file.file.replace(`${edge.source().data('root')}/`, ''),
              target: edge.target().id(),
            };
          }),
      });

      this.openTooltip = this.tooltipService.open(ref, tooltipContent);
    });
  }

  listenForProjectNodeHovers(): void {
    this.renderGraph.on('mouseover', (event) => {
      const node = event.target;
      if (!node.isNode || !node.isNode() || node.isParent()) return;

      this.renderGraph
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

    this.renderGraph.on('mouseout', (event) => {
      const node = event.target;
      if (!node.isNode || !node.isNode() || node.isParent()) return;

      this.renderGraph.elements().removeClass('transparent');
      node
        .removeClass('highlight')
        .outgoers()
        .union(node.incomers())
        .removeClass('highlight');
    });
  }

  getImage() {
    const bg = selectValueByThemeStatic('#262626', '#fff');
    return this.renderGraph.png({ bg, full: true });
  }

  evaluateStyles() {
    if (this.renderGraph) {
      const container = this.renderGraph.container();
      this.renderGraph.unmount();

      this.renderGraph.mount(container);
    }
  }
}
