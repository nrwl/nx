import { VirtualElement } from '@floating-ui/react-dom';
import { ProjectNodeDataDefinition } from './util-cytoscape/project-node';
import { TaskNodeDataDefinition } from './util-cytoscape/task-node';

interface ProjectNodeClickEvent {
  type: 'ProjectNodeClick';
  ref: VirtualElement;
  id: string;
  data: ProjectNodeDataDefinition;
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
  | ProjectNodeClickEvent
  | EdgeClickEvent
  | GraphRegeneratedEvent
  | TaskNodeClickEvent;
