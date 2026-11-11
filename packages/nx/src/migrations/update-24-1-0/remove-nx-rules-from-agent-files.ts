import { removeNxRulesBlocks } from '../../ai/set-up-ai-agents/remove-nx-rules-blocks';
import { Tree } from '../../generators/tree';

export default async function removeNxRulesFromAgentFiles(tree: Tree) {
  removeNxRulesBlocks(tree, '.');
}
