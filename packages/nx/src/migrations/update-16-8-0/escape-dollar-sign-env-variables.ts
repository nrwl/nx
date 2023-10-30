import { updateDotenvFiles } from '../../generators/internal-utils/update-dotenv-files';
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
export default function escapeDollarSignEnvVariables(tree: Tree) {
  updateDotenvFiles(tree, (contents, path) => {
    console.log('Updating: ' + path);
    return parseEnvFile(contents);
  });
}

/**
 * This function parse the env file and escape dollar sign
 * @param tree
 * @param envFilePath
 * @returns
 */
function parseEnvFile(envFileContent: string) {
  envFileContent = envFileContent
    .split('\n')
    .map((line) => {
      line = line.trim();

      if (!line.includes('$')) {
        return line;
      }

      const declarations = line.split('=');
      if (declarations[1].includes('$') && !declarations[1].includes(`\\$`)) {
        declarations[1] = declarations[1].replace('$', `\\$`);
        line = declarations.join('=');
      }
      return line;
    })
    .join('\n');
  return envFileContent;
}
