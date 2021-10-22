import { Stylesheet } from 'cytoscape';
import { FONTS } from './fonts';
import { NrwlPalette } from './palette';

const allNodes: Stylesheet = {
  selector: 'node',
  style: {
    'font-size': '32px',
    'font-family': FONTS,
    'border-style': 'solid',
    'border-color': NrwlPalette.darkGray,
    'border-width': '1px',
    'text-halign': 'center',
    'text-valign': 'center',
    'padding-left': '16px',
    color: NrwlPalette.black,
    label: 'data(id)',
    width: 'label',
    backgroundColor: NrwlPalette.white,
    'transition-property':
      'background-color, border-color, line-color, target-arrow-color',
    'transition-duration': 250,
    'transition-timing-function': 'ease-out',
  },
};

const appNodes: Stylesheet = {
  selector: 'node[type="app"]',
  style: {
    shape: 'round-rectangle',
  },
};

const libNodes: Stylesheet = {
  selector: 'node[type="lib"]',
  style: {
    shape: 'round-rectangle',
  },
};

const e2eNodes: Stylesheet = {
  selector: 'node[type="e2e"]',
  style: {
    shape: 'round-rectangle',
  },
};

const focusedNodes: Stylesheet = {
  selector: 'node.focused',
  style: {
    color: NrwlPalette.white,
    'border-color': NrwlPalette.gray,
    backgroundColor: NrwlPalette.green,
  },
};

const affectedNodes: Stylesheet = {
  selector: 'node.affected',
  style: {
    color: NrwlPalette.white,
    'border-color': NrwlPalette.gray,
    backgroundColor: NrwlPalette.red,
  },
};

const parentNodes: Stylesheet = {
  selector: ':parent',
  style: {
    'background-opacity': 0.5,
    'background-color': NrwlPalette.gray,
    'border-color': NrwlPalette.darkGray,
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
    'border-color': NrwlPalette.gray,
    backgroundColor: NrwlPalette.blue,
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

const highlightedEdges: Stylesheet = {
  selector: 'edge.highlight',
  style: { 'mid-target-arrow-color': NrwlPalette.blue },
};

const transparentEdges: Stylesheet = {
  selector: 'edge.transparent',
  style: { opacity: 0.2 },
};

export const nodeStyles = [
  allNodes,
  appNodes,
  libNodes,
  e2eNodes,
  focusedNodes,
  affectedNodes,
  parentNodes,
  highlightedNodes,
  transparentProjectNodes,
  transparentParentNodes,
  highlightedEdges,
  transparentEdges,
];
