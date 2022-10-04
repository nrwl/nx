import { Stylesheet } from 'cytoscape';
import { selectValueByThemeDynamic } from '../theme-resolver';
import { NrwlPalette } from './palette';

const allEdges: Stylesheet = {
  selector: 'edge',
  style: {
    width: '1px',
    'line-color': selectValueByThemeDynamic(
      NrwlPalette.slate_400,
      NrwlPalette.slate_500
    ),
    'text-outline-color': selectValueByThemeDynamic(
      NrwlPalette.slate_400,
      NrwlPalette.slate_500
    ),
    'text-outline-width': '0px',
    color: selectValueByThemeDynamic(
      NrwlPalette.slate_400,
      NrwlPalette.slate_500
    ),
    'curve-style': 'unbundled-bezier',
    'target-arrow-shape': 'triangle',
    'target-arrow-fill': 'filled',
    'target-arrow-color': selectValueByThemeDynamic(
      NrwlPalette.slate_400,
      NrwlPalette.slate_500
    ),
  },
};

const affectedEdges: Stylesheet = {
  selector: 'edge.affected',
  style: {
    'line-color': selectValueByThemeDynamic(
      NrwlPalette.fuchsia_500,
      NrwlPalette.pink_500
    ),
    'target-arrow-color': selectValueByThemeDynamic(
      NrwlPalette.fuchsia_500,
      NrwlPalette.pink_500
    ),
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
