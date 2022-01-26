import { Stylesheet } from 'cytoscape';
import { selectDynamically } from '../theme-resolver';
import { NrwlPalette } from './palette';

const allEdges: Stylesheet = {
  selector: 'edge',
  style: {
    width: '2px',
    'line-color': selectDynamically(NrwlPalette.gray, NrwlPalette.darkGray),
    'curve-style': 'unbundled-bezier',
    'target-arrow-shape': 'triangle',
    'arrow-scale': 2,
    'target-arrow-fill': 'filled',
    'target-arrow-color': selectDynamically(
      NrwlPalette.gray,
      NrwlPalette.darkGray
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
    'font-size': '18px',
    'curve-style': 'unbundled-bezier',
    'text-rotation': 'autorotate',
    'text-background-padding': '5px',
    'text-background-color': selectDynamically(
      NrwlPalette.lightBlue,
      NrwlPalette.blue
    ),
    'text-background-opacity': selectDynamically(0.7, 0.1),
    color: selectDynamically(NrwlPalette.gray, NrwlPalette.black),
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

export const edgeStyles: Stylesheet[] = [
  allEdges,
  affectedEdges,
  implicitEdges,
  dynamicEdges,
];
