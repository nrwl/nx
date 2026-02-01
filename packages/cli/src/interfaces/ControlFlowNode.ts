import type { BreakNode } from './BreakNode.js';
import type { ForNode } from './ForNode.js';
import type { IfNode } from './IfNode.js';
import type { SwitchNode } from './SwitchNode.js';

export type ControlFlowNode = IfNode | ForNode | SwitchNode | BreakNode;
