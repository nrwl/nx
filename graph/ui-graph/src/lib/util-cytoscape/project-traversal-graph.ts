import cytoscape, {
  CollectionReturnValue,
  Core,
  ElementDefinition,
  NodeCollection,
  NodeSingular,
} from 'cytoscape';

/* eslint-disable @nx/enforce-module-boundaries */
// nx-ignore-next-line
import {
  ProjectFileMap,
  ProjectGraphDependency,
  ProjectGraphProjectNode,
} from 'nx/src/config/project-graph';
/* eslint-enable @nx/enforce-module-boundaries */
import { ProjectNode } from './project-node';
import { ProjectEdge } from './project-edge';
import { ParentNode } from './parent-node';

export class ProjectTraversalGraph {
  private cy?: Core;

  setShownProjects(selectedProjectNames: string[]) {
    let nodesToAdd = this.cy.collection();

    selectedProjectNames.forEach((name) => {
      nodesToAdd = nodesToAdd.union(this.cy.$id(name));
    });

    const ancestorsToAdd = nodesToAdd.ancestors();

    const nodesToRender = nodesToAdd.union(ancestorsToAdd);
    const edgesToRender = nodesToRender.edgesTo(nodesToRender);

    return nodesToRender.union(edgesToRender);
  }

  showProjects(selectedProjectNames: string[], alreadyShownProjects: string[]) {
    let nodesToAdd = this.cy.collection();

    selectedProjectNames.forEach((name) => {
      nodesToAdd = nodesToAdd.union(this.cy.$id(name));
    });

    alreadyShownProjects.forEach((name) => {
      nodesToAdd = nodesToAdd.union(this.cy.$id(name));
    });

    const ancestorsToAdd = nodesToAdd.ancestors();

    const nodesToRender = nodesToAdd.union(ancestorsToAdd);
    const edgesToRender = nodesToRender.edgesTo(nodesToRender);

    return nodesToRender.union(edgesToRender);
  }

  hideProjects(projectNames: string[], alreadyShownProjects: string[]) {
    let currentNodes = this.cy.collection();
    alreadyShownProjects.forEach((name) => {
      currentNodes = currentNodes.union(this.cy.$id(name));
    });
    let nodesToHide = this.cy.collection();

    projectNames.forEach((projectName) => {
      nodesToHide = nodesToHide.union(this.cy.$id(projectName));
    });

    const nodesToAdd = currentNodes
      .difference(nodesToHide)
      .difference(nodesToHide.ancestors());
    const ancestorsToAdd = nodesToAdd.ancestors();

    let nodesToRender = nodesToAdd.union(ancestorsToAdd);

    const edgesToRender = nodesToRender.edgesTo(nodesToRender);

    return nodesToRender.union(edgesToRender);
  }

  showAffectedProjects() {
    const affectedProjects = this.cy.nodes('.affected');
    const affectedAncestors = affectedProjects.ancestors();

    const affectedNodes = affectedProjects.union(affectedAncestors);
    const affectedEdges = affectedNodes.edgesTo(affectedNodes);

    return affectedNodes.union(affectedEdges);
  }

  focusProject(focusedProjectName: string, searchDepth: number = 1) {
    const focusedProject = this.cy.$id(focusedProjectName);

    const includedProjects = this.includeProjectsByDepth(
      focusedProject,
      searchDepth
    );

    const includedNodes = focusedProject.union(includedProjects);

    const includedAncestors = includedNodes.ancestors();

    const nodesToRender = includedNodes.union(includedAncestors);
    const edgesToRender = nodesToRender.edgesTo(nodesToRender);

    return nodesToRender.union(edgesToRender);
  }

  showAllProjects() {
    return this.cy.elements();
  }

  hideAllProjects() {
    return this.cy.collection();
  }

  filterProjectsByText(
    search: string,
    includePath: boolean,
    searchDepth: number = -1
  ) {
    if (search === '') {
      return this.cy.collection();
    } else {
      const split = search.split(',');

      let filteredProjects = this.cy.nodes().filter((node) => {
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

      return filteredProjects.union(edgesToRender);
    }
  }

  traceProjects(start: string, end: string) {
    const dijkstra = this.cy
      .elements()
      .dijkstra({ root: `[id = "${start}"]`, directed: true });

    const path = dijkstra.pathTo(this.cy.$(`[id = "${end}"]`));

    return path.union(path.ancestors());
  }

  traceAllProjects(start: string, end: string) {
    const startNode = this.cy.$id(start).nodes().first();

    const queue: NodeSingular[][] = [[startNode]];

    const paths: NodeSingular[][] = [];
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

    let finalCollection = this.cy.collection();

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

    return finalCollection.union(finalCollection.ancestors());
  }

  private includeProjectsByDepth(
    projects: NodeCollection | NodeSingular,
    depth: number = -1
  ) {
    let predecessors: CollectionReturnValue;

    if (depth === -1) {
      predecessors = projects.predecessors();
    } else {
      predecessors = projects.incomers();

      for (let i = 1; i < depth; i++) {
        predecessors = predecessors.union(predecessors.incomers());
      }
    }

    let successors: CollectionReturnValue;

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
    fileMap: ProjectFileMap,
    allProjects: ProjectGraphProjectNode[],
    groupByFolder: boolean,
    workspaceLayout,
    dependencies: Record<string, ProjectGraphDependency[]>,
    affectedProjectIds: string[],
    collapseEdges: boolean
  ) {
    this.generateCytoscapeLayout(
      fileMap,
      allProjects,
      groupByFolder,
      workspaceLayout,
      dependencies,
      affectedProjectIds
    );
  }

  private generateCytoscapeLayout(
    fileMap: ProjectFileMap,
    allProjects: ProjectGraphProjectNode[],
    groupByFolder: boolean,
    workspaceLayout,
    dependencies: Record<string, ProjectGraphDependency[]>,
    affectedProjectIds: string[]
  ) {
    const elements = this.createElements(
      fileMap,
      allProjects,
      groupByFolder,
      workspaceLayout,
      dependencies,
      affectedProjectIds
    );

    this.cy = cytoscape({
      headless: true,
      elements: [...elements],
      boxSelectionEnabled: false,
    });
  }

  private createElements(
    fileMap: ProjectFileMap,
    projects: ProjectGraphProjectNode[],
    groupByFolder: boolean,
    workspaceLayout: {
      appsDir: string;
      libsDir: string;
    },
    dependencies: Record<string, ProjectGraphDependency[]>,
    affectedProjectIds: string[]
  ) {
    let elements: ElementDefinition[] = [];
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

      const projectNode = new ProjectNode(fileMap, project, workspaceRoot);

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

    const projectElements: (ElementDefinition & { pannable?: boolean })[] =
      projectNodes.map((projectNode) =>
        projectNode.getCytoscapeNodeDef(groupByFolder)
      );

    const edgeElements = edgeNodes.map((edgeNode) =>
      edgeNode.getCytoscapeNodeDef()
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
}
