import { Stylesheet } from 'cytoscape';
import { FONTS } from './fonts';
import { NrwlPalette } from './palette';

const allNodes: Stylesheet = {
  selector: 'node',
  style: {
    'font-size': '32px',
    'font-family': FONTS,
    'border-style': 'solid',
    'border-color': NrwlPalette.black,
    'border-width': '1px',
    'text-halign': 'center',
    'text-valign': 'center',
    'padding-left': '16px',
    label: 'data(id)',
    width: 'label',
    backgroundColor: NrwlPalette.white,
  },
};

const appNodes: Stylesheet = {
  selector: 'node[type="app"]',
  style: {
    shape: 'rectangle',
  },
};

const libNodes: Stylesheet = {
  selector: 'node[type="lib"]',
  style: {
    shape: 'ellipse',
  },
};

const e2eNodes: Stylesheet = {
  selector: 'node[type="e2e"]',
  style: {
    shape: 'rectangle',
  },
};

const focusedNodes: Stylesheet = {
  selector: 'node.focused',
  style: {
    color: NrwlPalette.twilight,
    'border-color': NrwlPalette.twilight,
  },
};

const affectedNodes: Stylesheet = {
  selector: 'node.affected',
  style: {
    'border-color': NrwlPalette.red,
  },
};

const parentNodes: Stylesheet = {
  selector: ':parent',
  style: {
    'background-opacity': 0.5,
    'background-color': NrwlPalette.twilight,
    'border-color': NrwlPalette.black,
    label: 'data(label)',
    'text-halign': 'center',
    'text-valign': 'top',
    'font-weight': 'bold',
    'font-size': '48px',
  },
};

export const nodeStyles = [
  allNodes,
  appNodes,
  libNodes,
  e2eNodes,
  focusedNodes,
  affectedNodes,
  parentNodes,
];
