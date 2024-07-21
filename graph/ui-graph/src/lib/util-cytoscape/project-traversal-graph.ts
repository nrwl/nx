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
import { CompositeProjectNode } from './composite/composite-project-node';
import {
  CompositeProjectEdge,
  NodeForEdge,
} from './composite/composite-project-edge';
import { CompositeNode } from './composite/composite-node';

export class ProjectTraversalGraph {
  private cy?: Core;
  private _compositeNodes: Record<string, CompositeNode> = {};
  private _compositeEdges: Record<string, CompositeProjectEdge> = {};

  mode: 'normal' | 'composite' = 'normal';
  compositeContext: string | null = null;

  get compositeNodes() {
    return Object.values(this._compositeNodes);
  }

  setShownProjects(selectedProjectNames: string[]) {
    let nodesToAdd = this.cy.collection();

    if (this.mode === 'composite') {
      const compositeNodes = this.cy.elements('node.composite');
      const rootNodes = this.cy.elements('node.root');

      if (compositeNodes.size() > 0) {
        nodesToAdd = nodesToAdd.union(compositeNodes);
      }

      if (rootNodes.size() > 0) {
        nodesToAdd = nodesToAdd.union(rootNodes);
      }

      if (this.compositeContext) {
        const projectNodes = this.cy.elements('node.projectNode');
        if (projectNodes.size() > 0) {
          nodesToAdd = nodesToAdd.union(projectNodes);
        }
      }
    }

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
    let elements: ElementDefinition[] = [];

    if (this.mode === 'composite') {
      if (this.compositeContext) {
        if (Object.keys(this._compositeNodes).length === 0) {
          this.createCompositeElements(
            fileMap,
            allProjects,
            workspaceLayout,
            dependencies,
            affectedProjectIds
          );
        }

        elements = this.createCompositeElementsWithContext(
          fileMap,
          allProjects,
          workspaceLayout,
          dependencies,
          affectedProjectIds
        );
      } else {
        elements = this.createCompositeElements(
          fileMap,
          allProjects,
          workspaceLayout,
          dependencies,
          affectedProjectIds
        );
      }
    } else {
      elements = this.createElements(
        fileMap,
        allProjects,
        groupByFolder,
        workspaceLayout,
        dependencies,
        affectedProjectIds
      );
    }

    this.cy = cytoscape({
      headless: true,
      elements: [...elements],
      boxSelectionEnabled: false,
    });
  }

  private createCompositeElements(
    fileMap: ProjectFileMap,
    allProjects: ProjectGraphProjectNode[],
    workspaceLayout: { appsDir: string; libsDir: string },
    dependencies: Record<string, ProjectGraphDependency[]>,
    affectedProjectIds: string[]
  ) {
    this._compositeNodes = {};
    this._compositeEdges = {};

    const elements: ElementDefinition[] = [];
    const projectNodes: Record<string, CompositeProjectNode> = {};
    const rootProjects: CompositeProjectNode[] = [];

    for (const project of allProjects) {
      const projectNode = (projectNodes[project.name] =
        new CompositeProjectNode(project, fileMap));
      projectNode.deps.push(...(dependencies[project.name] || []));

      if (project.data.root) {
        const pathSegments = project.data.root.split('/');
        pathSegments.pop();
        let previousParent: CompositeNode | null = null;

        for (let i = 0; i < pathSegments.length; i++) {
          const segment = pathSegments[i];
          if (segment !== project.name) {
            if (!(segment in this._compositeNodes)) {
              this._compositeNodes[segment] = new CompositeNode(segment);
            }

            const parentNode = this._compositeNodes[segment];

            if (i === pathSegments.length - 1) {
              parentNode.projects.push(projectNode);
              projectNode.parent = parentNode;
            }

            if (previousParent) {
              parentNode.parent = previousParent;
              if (!parentNode.parent.composites.has(parentNode)) {
                parentNode.parent.composites.add(parentNode);
              }
            }
            previousParent = parentNode;
          } else if (segment in this._compositeNodes) {
            this._compositeNodes[segment].projects.push(projectNode);
            projectNode.parent = this._compositeNodes[segment];
          }
        }
      }

      // if a project doesn't have a parent, it is a root project aka project in the root of the workspace
      if (projectNode.isRoot) {
        rootProjects.push(projectNode);
      }
    }

    const addEdge = (
      edgeId: string,
      dep: ProjectGraphDependency,
      source: NodeForEdge,
      target: NodeForEdge,
      depId?: string
    ) => {
      let exist = this._compositeEdges[edgeId];
      if (!exist) {
        exist = this._compositeEdges[edgeId] = new CompositeProjectEdge(
          edgeId,
          dep,
          source,
          target
        );
      }

      if (depId) {
        exist.deps.add(depId);
      }
    };

    for (const [projectName, deps] of Object.entries(dependencies)) {
      const projectNode = projectNodes[projectName];
      if (!projectNode) continue;

      for (const dep of deps) {
        const targetNode = projectNodes[dep.target];
        if (!targetNode) continue;

        if (projectNode.isRoot) {
          const edgeId = targetNode.isRoot
            ? `${projectNode.id}|${targetNode.id}`
            : `${projectNode.id}|${targetNode.parent.id}`;

          addEdge(
            edgeId,
            dep,
            projectNode,
            targetNode.isRoot ? targetNode : targetNode.parent,
            targetNode.isRoot
              ? ''
              : `${projectNode.id}|${targetNode.id}|${dep.type}`
          );
          continue;
        }

        const compositeNode = projectNode.parent;
        if (!compositeNode || !!compositeNode.parent) continue;
        if (targetNode.parent === compositeNode || !!targetNode.parent?.parent)
          continue;

        const edgeId = targetNode.isRoot
          ? `${projectNode.id}|${targetNode.id}`
          : `${compositeNode.id}|${targetNode.parent.id}`;

        addEdge(
          edgeId,
          dep,
          compositeNode,
          targetNode.parent || targetNode,
          targetNode.isRoot
            ? ''
            : `${projectNode.id}|${targetNode.id}|${dep.type}`
        );
      }
    }

    for (const compositeNode of Object.values(this._compositeNodes)) {
      const compositeNodeElement = compositeNode.getCytoscapeElementDef();
      if (!compositeNodeElement.data.hidden) {
        elements.push(compositeNodeElement);
      }
    }

    for (const rootProject of rootProjects) {
      elements.push(rootProject.getCytoscapeElementDef());
    }

    for (const edge of Object.values(this._compositeEdges)) {
      elements.push(edge.getCytoscapeElementDef());
    }

    return elements;
  }

  private createCompositeElementsWithContext(
    fileMap: ProjectFileMap,
    allProjects: ProjectGraphProjectNode[],
    workspaceLayout: { appsDir: string; libsDir: string },
    dependencies: Record<string, ProjectGraphDependency[]>,
    affectedProjectIds: string[]
  ) {
    const contextNode = Object.values(this._compositeNodes).find(
      (node) => node.id === this.compositeContext
    );

    if (!contextNode) {
      console.log(`No context node found for ${this.compositeContext}`);
      return [];
    }

    const elements: ElementDefinition[] = [];

    const compositeEdgesForContext = Object.values(this._compositeEdges).filter(
      (edge) => edge.id.split('|').includes(this.compositeContext)
    );

    for (const projectNode of contextNode.projects) {
      elements.push(projectNode.getCytoscapeElementDef(contextNode.id));

      for (const dep of projectNode.deps) {
        const targetNode = contextNode.projects.find(
          (node) => node.id === dep.target
        );
        if (!targetNode) continue;

        elements.push({
          group: 'edges',
          data: {
            id: `${projectNode.id}|${targetNode.id}`,
            source: projectNode.id,
            target: targetNode.id,
            type: dep.type,
          },
          classes: dep.type,
        });
      }
    }

    for (const compositeNode of contextNode.composites) {
      elements.push(compositeNode.getCytoscapeElementDef(contextNode.id));
    }

    // if we have composite edges for context node
    if (compositeEdgesForContext.length > 0) {
      const { circular, nonCircular } = this.partitionCompositeEdges(
        compositeEdgesForContext
      );

      const inContext = {
        items: [],
        definition: {
          group: 'nodes',
          data: {
            id: `in-context-${contextNode.id}`,
            label: '',
            parent: contextNode.id,
          },
          classes: 'inContextGroup',
        } as ElementDefinition,
      };

      const outContext = {
        items: [],
        definition: {
          group: 'nodes',
          data: {
            id: `out-context-${contextNode.id}`,
            label: '',
            parent: contextNode.id,
          },
          classes: 'outContextGroup',
        } as ElementDefinition,
      };

      const circularContext = {
        items: [],
        definition: {
          group: 'nodes',
          data: {
            id: `circular-context-${contextNode.id}`,
            label: '',
            parent: contextNode.id,
          },
          classes: 'circularContextGroup',
        } as ElementDefinition,
      };

      const createdCircularElements = new Set<string>();

      const handleEdge = (
        edge: CompositeProjectEdge,
        inParentId: string,
        outParentId?: string
      ) => {
        if (outParentId === undefined) {
          outParentId = inParentId;
        }

        const isContextTarget = edge.target.id === this.compositeContext;
        if (isContextTarget) {
          if (!createdCircularElements.has(edge.source.id)) {
            createdCircularElements.add(edge.source.id);
            elements.push(edge.source.getCytoscapeElementDef(inParentId));
          }

          edge.deps.forEach((dep) => {
            const [, targetId, type] = dep.split('|');
            elements.push({
              group: 'edges',
              data: {
                id: `${edge.source.id}|${targetId}`,
                source: edge.source.id,
                target: targetId,
                type,
              },
              classes: type,
            });
          });
        } else {
          if (!createdCircularElements.has(edge.target.id)) {
            createdCircularElements.add(edge.target.id);
            elements.push(edge.target.getCytoscapeElementDef(outParentId));
          }
          edge.deps.forEach((dep) => {
            const [sourceId, , type] = dep.split('|');
            elements.push({
              group: 'edges',
              data: {
                id: `${sourceId}|${edge.target.id}`,
                source: sourceId,
                target: edge.target.id,
                type,
              },
              classes: type,
            });
          });
        }

        return isContextTarget;
      };

      for (const [first, second] of circular) {
        circularContext.items.push(first.id, second.id);

        handleEdge(first, circularContext.definition.data.id);
        handleEdge(second, circularContext.definition.data.id);
      }

      for (const edge of nonCircular) {
        const isContextTarget = handleEdge(
          edge,
          inContext.definition.data.id,
          outContext.definition.data.id
        );
        if (isContextTarget) {
          inContext.items.push(edge.id);
        } else {
          outContext.items.push(edge.id);
        }
      }

      if (inContext.items.length > 1) {
        elements.push(inContext.definition);
      }

      if (outContext.items.length > 1) {
        elements.push(outContext.definition);
      }

      if (circularContext.items.length > 2) {
        elements.push(circularContext.definition);
      }
    }

    return elements;
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

  expandCompositeNode(compositeNodeId: string) {
    const compositeNode = Object.values(this._compositeNodes).find(
      (node) => node.id === compositeNodeId
    );

    if (!compositeNode) {
      console.log(`No composite node found for ${compositeNodeId}`);
      return this.setShownProjects([]);
    }

    const compositeNodeElement = this.cy.$id(compositeNodeId);
    compositeNodeElement.addClass('expanded');

    let elementsToRender = this.cy.elements();

    const elementsToAdd: ElementDefinition[] = [];
    const elementsToRemove = [];

    for (const projectNode of compositeNode.projects) {
      elementsToAdd.push(projectNode.getCytoscapeElementDef(compositeNode.id));

      for (const dep of projectNode.deps) {
        const targetNode = compositeNode.projects.find(
          (node) => node.id === dep.target
        );
        if (!targetNode) continue;

        elementsToAdd.push({
          group: 'edges',
          data: {
            id: `${projectNode.id}|${targetNode.id}`,
            source: projectNode.id,
            target: targetNode.id,
            type: dep.type,
          },
          classes: dep.type,
        });
      }
    }

    const compositeEdges = Object.values(this._compositeEdges).filter(
      (edge) => {
        return (
          edge.source.id === compositeNodeId ||
          edge.target.id === compositeNodeId
        );
      }
    );

    for (const edge of compositeEdges) {
      const edgeElement = this.cy.$id(edge.id);
      if (!edgeElement) continue;

      elementsToRender = elementsToRender.difference(
        this.cy.remove(edgeElement)
      );

      const isTarget = edge.target.id === compositeNodeId;
      if (isTarget) {
        edge.deps.forEach((dep) => {
          const [, targetId, type] = dep.split('|');
          elementsToAdd.push({
            group: 'edges',
            data: {
              id: `${edge.source.id}|${targetId}`,
              source: edge.source.id,
              target: targetId,
              type,
            },
            classes: type,
          });
        });
      } else {
        edge.deps.forEach((dep) => {
          const [sourceId, , type] = dep.split('|');
          elementsToAdd.push({
            group: 'edges',
            data: {
              id: `${sourceId}|${edge.target.id}`,
              source: sourceId,
              target: edge.target.id,
              type,
            },
            classes: type,
          });
        });
      }
    }

    elementsToRender = elementsToRender.union(this.cy.add(elementsToAdd));
    // .difference(elementsToRemove);

    return elementsToRender;
  }

  collapseCompositeNode(compositeNodeId: string) {
    const compositeNode = Object.values(this._compositeNodes).find(
      (node) => node.id === compositeNodeId
    );

    if (!compositeNode) {
      console.log(`No composite node found for ${compositeNodeId}`);
      return this.setShownProjects([]);
    }

    const compositeNodeElement = this.cy.$id(compositeNodeId);
    compositeNodeElement.removeClass('expanded');

    let elementsToRender = this.cy.elements();
    const projectNodes = this.cy.remove(
      `node.composite[id="${compositeNodeId}"] > node.projectNode`
    );

    elementsToRender = elementsToRender.difference(projectNodes);

    const compositeEdges = Object.values(this._compositeEdges).filter(
      (edge) => {
        return (
          edge.source.id === compositeNodeId ||
          edge.target.id === compositeNodeId
        );
      }
    );

    for (const edge of compositeEdges) {
      elementsToRender = elementsToRender.union(
        this.cy.add(edge.getCytoscapeElementDef())
      );
    }

    return elementsToRender;
  }

  private partitionCompositeEdges(edges: CompositeProjectEdge[]) {
    const circularDependencies: CompositeProjectEdge[][] = [];
    const nonCircularDependencies: CompositeProjectEdge[] = [];
    const edgeMap = new Map<string, CompositeProjectEdge>();

    // NOTE: Populate the map with edges for quick lookup
    edges.forEach((edge) => {
      edgeMap.set(edge.id, edge);
    });

    for (const edge of edges) {
      const reverseEdgeId = `${edge.target.id}|${edge.source.id}`;
      const reverseEdge = edgeMap.get(reverseEdgeId);

      if (reverseEdge) {
        // NOTE: Circular dependency case
        if (
          !circularDependencies.some((pair) =>
            pair.some((e) => e.id === edge.id || e.id === reverseEdge.id)
          )
        ) {
          circularDependencies.push([edge, reverseEdge]);
        }
      } else {
        // NOTE: Non-circular dependency case
        nonCircularDependencies.push(edge);
      }
    }

    return {
      circular: circularDependencies,
      nonCircular: nonCircularDependencies,
    };
  }
}
