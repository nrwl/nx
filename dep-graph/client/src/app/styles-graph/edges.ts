import { Stylesheet } from 'cytoscape';
import { selectDynamically } from '../theme-resolver';
import { NrwlPalette } from './palette';

const allEdges: Stylesheet = {
  selector: 'edge',
  style: {
    width: selectDynamically('2px', '1px'),
    'line-color': selectDynamically(NrwlPalette.gray, NrwlPalette.black),
    'text-outline-color': selectDynamically(NrwlPalette.black, 'none'),
    'text-outline-width': selectDynamically('1px', '0px'),
    'color': selectDynamically(NrwlPalette.white, NrwlPalette.black),
    'curve-style': 'unbundled-bezier',
    'target-arrow-shape': 'triangle',
    'target-arrow-fill': 'filled',
    'target-arrow-color': selectDynamically(
      NrwlPalette.gray,
      NrwlPalette.black
    ),
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
    'curve-style': 'unbundled-bezier',
    'text-rotation': 'autorotate',
  },
};

const transparentEdges: Stylesheet = {
  selector: 'edge.transparent',
  style: { opacity: 0.2 },
};

const dynamicEdges: Stylesheet = {
  selector: 'edge.dynamic',
  style: {
    'line-dash-pattern': [5, 5],
    'line-style': 'dashed',
    'curve-style': 'unbundled-bezier',
  },
};

export const edgeStyles: Stylesheet[] = [
  allEdges,
  affectedEdges,
  implicitEdges,
  dynamicEdges,
  transparentEdges,
];
