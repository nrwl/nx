import { Stylesheet } from 'cytoscape';
import { NrwlPalette } from './palette';

const allEdges: Stylesheet = {
  selector: 'edge',
  style: {
    width: '1px',
    'line-color': NrwlPalette.black,
    'curve-style': 'straight',
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
  },
};

const implicitEdges: Stylesheet = {
  selector: 'edge.implicit',
  style: {
    label: 'implicit',
    'font-size': '16px',
    'edge-text-rotation': 'autorotate',
  },
};

const dynamicEdges: Stylesheet = {
  selector: 'edge.dynamic',
  style: {
    'line-dash-pattern': [5, 5],
    'line-style': 'dashed',
  },
};

export const edgeStyles: Stylesheet[] = [
  allEdges,
  affectedEdges,
  implicitEdges,
  dynamicEdges,
];
