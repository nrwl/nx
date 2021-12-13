import { Stylesheet } from 'cytoscape';
import { NrwlPalette } from './palette';

const allEdges: Stylesheet = {
  selector: 'edge',
  style: {
    width: '1px',
    'line-color': NrwlPalette.black,
    'curve-style': 'unbundled-bezier',
    'target-arrow-shape': 'triangle',
    'target-arrow-fill': 'filled',
    'target-arrow-color': NrwlPalette.black,
  },
};

const affectedEdges: Stylesheet = {
  selector: 'edge.affected',
  style: {
    'line-color': NrwlPalette.red,
    'target-arrow-color': NrwlPalette.red,
    'curve-style': 'unbundled-bezier',
  },
};

const implicitEdges: Stylesheet = {
  selector: 'edge.implicit',
  style: {
    label: 'implicit',
    'font-size': '16px',
    'edge-text-rotation': 'autorotate',
    'curve-style': 'unbundled-bezier',
  },
};

const dynamicEdges: Stylesheet = {
  selector: 'edge.dynamic',
  style: {
    'line-dash-pattern': [5, 5],
    'line-style': 'dashed',
    'curve-style': 'unbundled-bezier',
  },
};

const typeOnlyEdges: Stylesheet = {
  selector: 'edge.typeOnly',
  style: {
    label: 'type only',
    'font-size': '16px',
    'edge-text-rotation': 'autorotate',
    'curve-style': 'unbundled-bezier',
    'line-dash-pattern': [5, 5],
    'line-style': 'dashed',
  },
};

export const edgeStyles: Stylesheet[] = [
  allEdges,
  affectedEdges,
  implicitEdges,
  dynamicEdges,
  typeOnlyEdges,
];
