import * as cy from 'cytoscape';

export interface CytoscapeDagreConfig extends cy.BaseLayoutOptions {
  // dagre algo options, uses default value on undefined
  nodeSep: number; // the separation between adjacent nodes in the same rank
  edgeSep: number; // the separation between adjacent edges in the same rank
  rankSep: number; // the separation between each rank in the layout
  rankDir: 'TB' | 'LR'; // 'TB' for top to bottom flow, 'LR' for left to right,
  ranker: 'network-simplex' | 'tight-tree' | 'longest-path'; // Type of algorithm to assign a rank to each node in the input graph. Possible values: 'network-simplex', 'tight-tree' or 'longest-path'
  minLen: (edge: cy.EdgeSingular) => number; // number of ranks to keep between the source and target of the edge
  edgeWeight: (edge: cy.EdgeSingular) => number; // higher weight edges are generally made shorter and straighter than lower weight edges

  // general layout options
  fit: boolean; // whether to fit to viewport
  padding: number; // fit padding
  spacingFactor: number; // Applies a multiplicative factor (>0) to expand or compress the overall area that the nodes take up
  nodeDimensionsIncludeLabels: boolean; // whether labels should be included in determining the space used by a node
  animate: boolean; // whether to transition the node positions
  animateFilter: (node, i) => boolean; // whether to animate specific nodes when animation is on; non-animated nodes immediately go to their final positions
  animationDuration: number; // duration of animation in ms if enabled
  animationEasing: string; // easing of animation if enabled
  boundingBox:
    | { x1: number; y1: number; x2: number; y2: number }
    | { x1: number; y1: number; w: number; h: number }; // constrain layout bounds; { x1, y1, x2, y2 } or { x1, y1, w, h }
  transform: (node, pos) => cy.Position; // a function that applies a transform to the final node position
  ready: () => void; // on layoutready
  stop: () => void; // on layoutstop
}
