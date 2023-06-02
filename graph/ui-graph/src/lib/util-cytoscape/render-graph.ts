import cytoscape, {
  Collection,
  Core,
  EdgeDefinition,
  EdgeSingular,
} from 'cytoscape';
import { edgeStyles, nodeStyles } from '../styles-graph';
import { GraphInteractionEvents } from '../graph-interaction-events';
import { VirtualElement } from '@floating-ui/react';
import {
  darkModeScratchKey,
  switchValueByDarkMode,
} from '../styles-graph/dark-mode';
import { CytoscapeDagreConfig } from './cytoscape.models';

const cytoscapeDagreConfig = {
  name: 'dagre',
  nodeDimensionsIncludeLabels: true,
  rankSep: 75,
  rankDir: 'TB',
  edgeSep: 50,
  ranker: 'network-simplex',
} as CytoscapeDagreConfig;

export class RenderGraph {
  private cy?: Core;
  collapseEdges = false;

  private _theme: 'light' | 'dark';
  private _rankDir: 'TB' | 'LR' = 'TB';

  private listeners = new Map<
    number,
    (event: GraphInteractionEvents) => void
  >();

  constructor(
    private container: string | HTMLElement,
    theme: 'light' | 'dark',
    private renderMode?: 'nx-console' | 'nx-docs',
    rankDir: 'TB' | 'LR' = 'TB'
  ) {
    this._theme = theme;
    this._rankDir = rankDir;
  }

  set theme(theme: 'light' | 'dark') {
    this._theme = theme;
    this.render();
  }

  set rankDir(rankDir: 'LR' | 'TB') {
    this._rankDir = rankDir;
    this.render();
  }

  get activeContainer() {
    return typeof this.container === 'string'
      ? document.getElementById(this.container)
      : this.container;
  }

  private broadcast(event: GraphInteractionEvents) {
    this.listeners.forEach((callback) => callback(event));
  }

  listen(callback: (event: GraphInteractionEvents) => void) {
    const listenerId = this.listeners.size + 1;
    this.listeners.set(listenerId, callback);

    return () => {
      this.listeners.delete(listenerId);
    };
  }

  setElements(elements: Collection) {
    let currentFocusedProjectName;
    if (this.cy) {
      currentFocusedProjectName = this.cy.nodes('.focused').first().id();
      this.cy.destroy();
      delete this.cy;
    }

    this.cy = cytoscape({
      headless: this.activeContainer === null,
      container: this.activeContainer,
      boxSelectionEnabled: false,
      style: [...nodeStyles, ...edgeStyles],
      panningEnabled: true,
      userZoomingEnabled: this.renderMode !== 'nx-docs',
    });

    this.cy.add(elements);

    if (!!currentFocusedProjectName) {
      this.cy.$id(currentFocusedProjectName).addClass('focused');
    }

    this.cy.on('zoom pan', () => {
      this.broadcast({ type: 'GraphRegenerated' });
    });

    this.listenForProjectNodeClicks();
    this.listenForEdgeNodeClicks();
    this.listenForProjectNodeHovers();
    this.listenForTaskNodeClicks();
    this.listenForEmptyClicks();
  }

  render(): { numEdges: number; numNodes: number } {
    if (this.cy) {
      const elements = this.cy.elements().sort((a, b) => {
        return a.id().localeCompare(b.id());
      });

      elements
        .layout({
          ...cytoscapeDagreConfig,
          ...{ rankDir: this._rankDir },
        })
        .run();

      if (this.collapseEdges) {
        this.cy.remove(this.cy.edges());

        elements.edges().forEach((edge) => {
          const sourceNode = edge.source();
          const targetNode = edge.target();

          if (
            sourceNode.parent().first().id() ===
            targetNode.parent().first().id()
          ) {
            this.cy.add(edge);
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

              if (this.cy.$id(edgeId).length === 0) {
                const ancestorEdge: EdgeDefinition = {
                  group: 'edges',
                  data: {
                    id: edgeId,
                    source: sourceId,
                    target: targetId,
                  },
                };

                this.cy.add(ancestorEdge);
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

      if (this.renderMode === 'nx-console') {
        // when in the nx-console environment, adjust graph width and position to be to right of floating panel
        // 175 is a magic number that represents the width of the floating panels divided in half plus some padding
        this.cy
          .fit(this.cy.elements(), 175)
          .center()
          .resize()
          .panBy({ x: 150, y: 0 });
      } else {
        this.cy.fit(this.cy.elements(), 25).center().resize();
      }

      this.cy.scratch(darkModeScratchKey, this._theme === 'dark');
      this.cy.elements().scratch(darkModeScratchKey, this._theme === 'dark');

      this.cy.mount(this.activeContainer);
    }

    return {
      numNodes: this.cy?.nodes().length ?? 0,
      numEdges: this.cy?.edges().length ?? 0,
    };
  }

  private listenForProjectNodeClicks() {
    this.cy.$('node.projectNode').on('click', (event) => {
      const node = event.target;

      let ref: VirtualElement = node.popperRef(); // used only for positioning

      this.broadcast({
        type: 'ProjectNodeClick',
        ref,
        id: node.id(),

        data: {
          id: node.id(),
          type: node.data('type'),
          tags: node.data('tags'),
          description: node.data('description'),
        },
      });
    });
  }

  private listenForTaskNodeClicks() {
    this.cy.$('node.taskNode').on('click', (event) => {
      const node = event.target;

      let ref: VirtualElement = node.popperRef(); // used only for positioning

      this.broadcast({
        type: 'TaskNodeClick',
        ref,
        id: node.id(),

        data: {
          id: node.id(),
          label: node.data('label'),
          executor: node.data('executor'),
          description: node.data('description'),
        },
      });
    });
  }

  private listenForEdgeNodeClicks() {
    this.cy.$('edge.projectEdge').on('click', (event) => {
      const edge: EdgeSingular & { popperRef: () => VirtualElement } =
        event.target;
      let ref: VirtualElement = edge.popperRef(); // used only for positioning

      this.broadcast({
        type: 'EdgeClick',
        ref,
        id: edge.id(),

        data: {
          id: edge.id(),
          type: edge.data('type'),
          source: edge.source().id(),
          target: edge.target().id(),
          fileDependencies:
            edge
              .source()
              .data('files')
              ?.filter(
                (file) =>
                  file.deps &&
                  file.deps.find(
                    (d) =>
                      (typeof d === 'string' ? d : d[0]) === edge.target().id()
                  )
              )
              .map((file) => {
                return {
                  fileName: file.file.replace(
                    `${edge.source().data('root')}/`,
                    ''
                  ),
                  target: edge.target().id(),
                };
              }) || [],
        },
      });
    });
  }

  private listenForProjectNodeHovers(): void {
    this.cy.on('mouseover', (event) => {
      const node = event.target;
      if (!node.isNode || !node.isNode() || node.isParent()) return;

      this.cy
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

    this.cy.on('mouseout', (event) => {
      const node = event.target;
      if (!node.isNode || !node.isNode() || node.isParent()) return;

      this.cy.elements().removeClass('transparent');
      node
        .removeClass('highlight')
        .outgoers()
        .union(node.incomers())
        .removeClass('highlight');
    });
  }

  private listenForEmptyClicks(): void {
    this.cy.on('click', (event) => {
      if (event.target === this.cy) {
        this.broadcast({ type: 'BackgroundClick' });
      }
    });
  }

  getImage() {
    const bg = switchValueByDarkMode(this.cy, '#0F172A', '#FFFFFF');
    return this.cy.png({ bg, full: true });
  }

  setFocussedElement(id: string) {
    this.cy.$id(id).addClass('focused');
  }

  clearFocussedElement() {
    this.cy?.nodes('.focused').removeClass('focused');
  }

  getCurrentlyShownProjectIds(): string[] {
    return this.cy?.nodes().map((node) => node.data('id')) ?? [];
  }
}
