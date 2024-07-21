import { VirtualElement } from '@floating-ui/react';
import { ProjectNodeDataDefinition } from './util-cytoscape/project-node';
import { TaskNodeDataDefinition } from './util-cytoscape/task-node';
import { ProjectEdgeDataDefinition } from './util-cytoscape';
import { CompositeNodeDataDefinition } from './util-cytoscape/composite/composite-node';

interface ProjectNodeClickEvent {
  type: 'ProjectNodeClick';
  ref: VirtualElement;
  id: string;
  data: ProjectNodeDataDefinition;
}

interface CompositeNodeClickEvent {
  type: 'CompositeNodeClick';
  ref: VirtualElement;
  id: string;
  data: CompositeNodeDataDefinition;
}

interface TaskNodeClickEvent {
  type: 'TaskNodeClick';
  ref: VirtualElement;
  id: string;
  data: TaskNodeDataDefinition;
}

interface EdgeClickEvent {
  type: 'EdgeClick';
  ref: VirtualElement;
  id: string;
  data: ProjectEdgeDataDefinition;
}

interface GraphRegeneratedEvent {
  type: 'GraphRegenerated';
}

interface BackgroundClickEvent {
  type: 'BackgroundClick';
}

export type GraphInteractionEvents =
  | ProjectNodeClickEvent
  | CompositeNodeClickEvent
  | EdgeClickEvent
  | GraphRegeneratedEvent
  | TaskNodeClickEvent
  | BackgroundClickEvent;
