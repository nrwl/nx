import { Tree } from '../../generators/tree';
/**
 * This function escapes dollar sign in env variables
 * It will go through:
 * - '.env', '.local.env', '.env.local'
 * - .env.[target-name], .[target-name].env
 * - .env.[target-name].[configuration-name], .[target-name].[configuration-name].env
 * - .env.[configuration-name], .[configuration-name].env
 * at each project root and workspace root
 * @param tree
 */
export default function escapeDollarSignEnvVariables(tree: Tree): void;
