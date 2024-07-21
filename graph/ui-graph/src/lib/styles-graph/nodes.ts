import { NodeSingular, Stylesheet } from 'cytoscape';
import { FONTS } from './fonts';
import { NrwlPalette } from './palette';
import { LabelWidthCalculator } from './label-width';
import { switchValueByDarkMode } from './dark-mode';

const labelWidthCalculator = new LabelWidthCalculator();

const allNodes: Stylesheet = {
  selector: 'node',
  style: {
    'font-size': '32px',
    'font-family': FONTS,
    backgroundColor: (node) =>
      switchValueByDarkMode(node, NrwlPalette.slate_600, NrwlPalette.slate_200),
    'border-style': 'solid',
    'border-color': (node) =>
      switchValueByDarkMode(node, NrwlPalette.slate_700, NrwlPalette.slate_300),
    'border-width': '1px',
    'text-halign': 'center',
    'text-valign': 'center',
    'padding-left': '16px',
    color: (node: NodeSingular) =>
      switchValueByDarkMode(node, NrwlPalette.slate_200, NrwlPalette.slate_600),
    label: 'data(id)',
    width: (node: NodeSingular) => labelWidthCalculator.calculateWidth(node),
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
    'border-color': (node) =>
      switchValueByDarkMode(node, NrwlPalette.slate_700, NrwlPalette.slate_200),
    backgroundColor: (node) =>
      switchValueByDarkMode(node, NrwlPalette.sky_500, NrwlPalette.blue_500),
    width: (node: NodeSingular) => labelWidthCalculator.calculateWidth(node),
  },
};

const affectedNodes: Stylesheet = {
  selector: 'node.affected',
  style: {
    color: NrwlPalette.white,
    'border-color': (node) =>
      switchValueByDarkMode(
        node,
        NrwlPalette.fuchsia_800,
        NrwlPalette.pink_500
      ),
    backgroundColor: (node) =>
      switchValueByDarkMode(
        node,
        NrwlPalette.fuchsia_700,
        NrwlPalette.pink_400
      ),
  },
};

const parentNodes: Stylesheet = {
  selector: 'node.parentNode',
  style: {
    'background-opacity': (node) => switchValueByDarkMode(node, 0.5, 0.8),
    backgroundColor: (node) =>
      switchValueByDarkMode(node, NrwlPalette.slate_700, NrwlPalette.slate_50),
    'border-color': (node) =>
      switchValueByDarkMode(node, NrwlPalette.slate_500, NrwlPalette.slate_400),
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
    'border-color': (node) =>
      switchValueByDarkMode(node, NrwlPalette.sky_600, NrwlPalette.blue_600),
    backgroundColor: (node) =>
      switchValueByDarkMode(node, NrwlPalette.sky_500, NrwlPalette.blue_500),
  },
};

const taskNodes: Stylesheet = {
  selector: 'node.taskNode',
  style: {
    label: 'data(label)',
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
  taskNodes,
];

const compositeNodes: Stylesheet = {
  selector: 'node.composite',
  style: {
    label: 'data(label)',
    'text-halign': 'center',
    'text-valign': 'center',
    backgroundColor: (node) =>
      switchValueByDarkMode(node, NrwlPalette.slate_700, NrwlPalette.slate_50),
    width:
      labelWidthCalculator.calculateCompositeWidth.bind(labelWidthCalculator),
    height:
      labelWidthCalculator.calculateCompositeWidth.bind(labelWidthCalculator),
    'border-style': 'dashed',
    'border-width': 2,
    'border-color': (node) =>
      switchValueByDarkMode(node, NrwlPalette.slate_500, NrwlPalette.slate_400),
    display: (node: NodeSingular) => (node.data('hidden') ? 'none' : 'element'),
    'min-zoomed-font-size': 12,
    shape: 'ellipse',
  },
};

const expandedCompositeNodes: Stylesheet = {
  selector: 'node.composite.expanded',
  style: {
    label: 'data(label)',
    'text-halign': 'center',
    'text-valign': 'top',
  },
};

const compositeProjectNodes: Stylesheet = {
  selector: 'node.projectNode',
  style: {
    backgroundColor: (node) =>
      switchValueByDarkMode(node, NrwlPalette.slate_600, NrwlPalette.slate_200),
    'border-style': 'solid',
    'text-halign': 'center',
    'text-valign': 'center',
    'padding-left': '16px',
    label: 'data(id)',
    width: (node: NodeSingular) => labelWidthCalculator.calculateWidth(node),
    shape: 'round-rectangle',
    'border-color': (node) =>
      switchValueByDarkMode(node, NrwlPalette.slate_700, NrwlPalette.slate_300),
    'border-width': '1px',
  },
};

const compositeNodeWithinContextStyles: Stylesheet = {
  selector: 'node.composite.withinContext',
  style: {
    'background-color': (node) =>
      switchValueByDarkMode(node, NrwlPalette.slate_600, NrwlPalette.slate_200),
    width: labelWidthCalculator.calculateWidth.bind(labelWidthCalculator),
    height: labelWidthCalculator.calculateWidth.bind(labelWidthCalculator),
    'font-size': 96,
  },
};

const compositeInContextStyles: Stylesheet = {
  selector: 'node.inContextGroup',
  style: {
    backgroundColor: (node) =>
      switchValueByDarkMode(node, NrwlPalette.green_800, NrwlPalette.green_400),
    display: (node) => (node.data('hidden') ? 'none' : 'element'),
    'background-opacity': 0.5,
    width: '100%',
    height: '100%',
    'padding-left': '16px',
    'padding-right': '16px',
    'padding-top': '8px',
    'padding-bottom': '8px',
    shape: 'round-rectangle',
  },
};

const compositeOutContextStyles: Stylesheet = {
  selector: 'node.outContextGroup',
  style: {
    backgroundColor: (node) =>
      switchValueByDarkMode(
        node,
        NrwlPalette.orange_800,
        NrwlPalette.orange_400
      ),
    display: (node) => (node.data('hidden') ? 'none' : 'element'),
    'background-opacity': 0.5,
    width: '100%',
    height: '100%',
    'padding-left': '16px',
    'padding-right': '16px',
    'padding-top': '8px',
    'padding-bottom': '8px',
    shape: 'round-rectangle',
  },
};

const compositeCircularContextStyles: Stylesheet = {
  selector: 'node.circularContextGroup',
  style: {
    backgroundColor: (node) =>
      switchValueByDarkMode(
        node,
        NrwlPalette.purple_800,
        NrwlPalette.purple_400
      ),
    display: (node) => (node.data('hidden') ? 'none' : 'element'),
    'background-opacity': 0.5,
    width: '100%',
    height: '100%',
    'padding-left': '16px',
    'padding-right': '16px',
    'padding-top': '8px',
    'padding-bottom': '8px',
    shape: 'round-rectangle',
  },
};

export const compositeNodeStyles: Stylesheet[] = [
  {
    selector: 'node',
    style: {
      'font-family': FONTS,
      'transition-property':
        'background-color, border-color, line-color, target-arrow-color',
      'transition-duration': 250,
      'transition-timing-function': 'ease-out',
      'font-size': '32px',
      color: (node: NodeSingular) =>
        switchValueByDarkMode(
          node,
          NrwlPalette.slate_200,
          NrwlPalette.slate_600
        ),
    },
  },
  compositeInContextStyles,
  compositeOutContextStyles,
  compositeCircularContextStyles,
  compositeNodes,
  compositeProjectNodes,
  highlightedNodes,
  compositeNodeWithinContextStyles,
  expandedCompositeNodes,
];
