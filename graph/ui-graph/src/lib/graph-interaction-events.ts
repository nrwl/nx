import { VirtualElement } from '@popperjs/core';
import { NodeDataDefinition } from './util-cytoscape/project-node';
import { EdgeDataDefinition } from './util-cytoscape/project-edge';

interface NodeClickEvent {
  type: 'NodeClick';
  ref: VirtualElement;
  id: string;
  data: NodeDataDefinition;
}

interface EdgeClickEvent {
  type: 'EdgeClick';
  ref: VirtualElement;
  id: string;
  data: {
    type: string;
    source: string;
    target: string;
    fileDependencies: { fileName: string; target: string }[];
  };
}

interface GraphRegeneratedEvent {
  type: 'GraphRegenerated';
}

export type GraphInteractionEvents =
  | NodeClickEvent
  | EdgeClickEvent
  | GraphRegeneratedEvent;
