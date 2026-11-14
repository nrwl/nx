import { formatFiles, generateFiles, Tree } from '@nx/devkit';
import { join } from 'node:path';

interface Schema {
  name: string;
  directory: string;
  category: 'consistency' | 'maintainability' | 'reliability' | 'security';
  description?: string;
}

export async function createRuleGenerator(tree: Tree, options: Schema) {
  const ruleDirectory = join(options.directory, options.name);

  generateFiles(tree, join(__dirname, 'files'), ruleDirectory, {
    ruleName: options.name,
    category: options.category,
    description: options.description ?? '',
    tmpl: '',
  });

  await formatFiles(tree, { sortRootTsconfigPaths: false });
}

export default createRuleGenerator;
