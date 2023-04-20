import type { Node } from 'typescript';

export function isAlreadyCommented(node: Node) {
  return node.getFullText().includes('TODO(@nrwl/cypress)');
}

export const BANNED_COMMANDS = [
  'as',
  'children',
  'closest',
  'contains',
  'debug',
  'document',
  'eq',
  'filter',
  'find',
  'first',
  'focused',
  'get',
  'hash',
  'its',
  'last',
  'location',
  'next',
  'nextAll',
  'not',
  'parent',
  'parents',
  'parentsUntil',
  'prev',
  'prevUntil',
  'root',
  'shadow',
  'siblings',
  'title',
  'url',
  'window',
];
