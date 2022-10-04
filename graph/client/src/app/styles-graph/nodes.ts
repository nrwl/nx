import { Stylesheet } from 'cytoscape';
import { selectValueByThemeDynamic } from '../theme-resolver';
import { FONTS } from './fonts';
import { NrwlPalette } from './palette';
import { LabelWidthCalculator } from './label-width';

const labelWidthCalculator = new LabelWidthCalculator();

const allNodes: Stylesheet = {
  selector: 'node',
  style: {
    'font-size': '32px',
    'font-family': FONTS,
    backgroundColor: selectValueByThemeDynamic(
      NrwlPalette.slate_600,
      NrwlPalette.slate_200
    ),
    'border-style': 'solid',
    'border-color': selectValueByThemeDynamic(
      NrwlPalette.slate_700,
      NrwlPalette.slate_300
    ),
    'border-width': '1px',
    'text-halign': 'center',
    'text-valign': 'center',
    'padding-left': '16px',
    color: selectValueByThemeDynamic(
      NrwlPalette.slate_200,
      NrwlPalette.slate_600
    ),
    label: 'data(id)',
    // width: (node) => node.data('id').length * 16,
    width: (node) => labelWidthCalculator.calculateWidth(node),
    'transition-property':
      'background-color, border-color, line-color, target-arrow-color',
    'transition-duration': 250,
    'transition-timing-function': 'ease-out',
    shape: 'round-rectangle',
  },
};

const focusedNodes: Stylesheet = {
  selector: 'node.focused',
  style: {
    color: NrwlPalette.white,
    'border-color': selectValueByThemeDynamic(
      NrwlPalette.slate_700,
      NrwlPalette.slate_200
    ),
    backgroundColor: selectValueByThemeDynamic(
      NrwlPalette.sky_500,
      NrwlPalette.blue_500
    ),
  },
};

const affectedNodes: Stylesheet = {
  selector: 'node.affected',
  style: {
    color: NrwlPalette.white,
    'border-color': selectValueByThemeDynamic(
      NrwlPalette.fuchsia_800,
      NrwlPalette.pink_500
    ),
    backgroundColor: selectValueByThemeDynamic(
      NrwlPalette.fuchsia_700,
      NrwlPalette.pink_400
    ),
  },
};

const parentNodes: Stylesheet = {
  selector: ':parent',
  style: {
    'background-opacity': selectValueByThemeDynamic(0.5, 0.8),
    backgroundColor: selectValueByThemeDynamic(
      NrwlPalette.slate_700,
      NrwlPalette.slate_50
    ),
    'border-color': selectValueByThemeDynamic(
      NrwlPalette.slate_500,
      NrwlPalette.slate_400
    ),
    'border-style': 'dashed',
    'border-width': 2,
    label: 'data(label)',
    'text-halign': 'center',
    'text-valign': 'top',
    'font-weight': 'bold',
    'font-size': '48px',
  },
};

const highlightedNodes: Stylesheet = {
  selector: 'node.highlight',
  style: {
    color: NrwlPalette.white,
    'border-color': selectValueByThemeDynamic(
      NrwlPalette.sky_600,
      NrwlPalette.blue_600
    ),
    backgroundColor: selectValueByThemeDynamic(
      NrwlPalette.sky_500,
      NrwlPalette.blue_500
    ),
  },
};

const transparentProjectNodes: Stylesheet = {
  selector: 'node.transparent:childless',
  style: { opacity: 0.5 },
};

const transparentParentNodes: Stylesheet = {
  selector: 'node.transparent:parent',
  style: {
    'text-opacity': 0.5,
    'background-opacity': 0.25,
    'border-opacity': 0.5,
  },
};

export const nodeStyles = [
  allNodes,
  focusedNodes,
  affectedNodes,
  parentNodes,
  highlightedNodes,
  transparentProjectNodes,
  transparentParentNodes,
];
