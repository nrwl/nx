import type { CommentNode } from './CommentNode.js';
import type { ControlFlowNode } from './ControlFlowNode.js';
import type { ElementNode } from './ElementNode.js';
import type { InterpolationNode } from './InterpolationNode.js';
import type { TextNode } from './TextNode.js';

export type TemplateNode = ControlFlowNode | ElementNode | TextNode | InterpolationNode | CommentNode;
