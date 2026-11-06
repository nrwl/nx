import {
  addDependenciesToPackageJson,
  applyChangesToString,
  ChangeType,
  formatFiles,
  generateFiles,
  GeneratorCallback,
  joinPathFragments,
  logger,
  runTasksInSerial,
  Tree,
} from '@nx/devkit';
import { join } from 'path';
import type * as ts from 'typescript';
import {
  camelize,
  ensureTypescript,
  type TypescriptAst,
} from '@nx/devkit/internal';
import { workspaceLintPluginDir } from '../../utils/workspace-lint-rules';
import { lintWorkspaceRulesProjectGenerator } from '../workspace-rules-project/workspace-rules-project';
import { assertSupportedEslintVersion } from '../../utils/assert-supported-eslint-version';
import { versions } from '../../utils/versions';

let tsModule: TypescriptAst;

export interface LintWorkspaceRuleGeneratorOptions {
  name: string;
  directory: string;
}

export async function lintWorkspaceRuleGenerator(
  tree: Tree,
  options: LintWorkspaceRuleGeneratorOptions
) {
  tsModule ??= ensureTypescript();
  assertSupportedEslintVersion(tree);

  const tasks: GeneratorCallback[] = [];

  // ESLint v9 dropped the eslintrc-style `RuleTester` API. typescript-eslint's
  // recommended replacement is the separate `@typescript-eslint/rule-tester`
  // package, whose flat-style API works for both flat and eslintrc workspaces.
  const { typescriptESLintVersion } = versions(tree);

  // Ensure that the workspace rules project has been created
  tasks.push(
    await lintWorkspaceRulesProjectGenerator(tree, {
      skipFormat: true,
    })
  );

  tasks.push(
    addDependenciesToPackageJson(
      tree,
      {},
      { '@typescript-eslint/rule-tester': typescriptESLintVersion },
      undefined,
      true
    )
  );

  const ruleDir = joinPathFragments(
    workspaceLintPluginDir,
    options.directory ?? ''
  );

  // Generate the required files for the new rule
  generateFiles(tree, join(__dirname, 'files'), ruleDir, {
    tmpl: '',
    name: options.name,
  });

  const nameCamelCase = camelize(options.name);

  /**
   * Import the new rule into the workspace plugin index.ts and
   * register it ready for use in lint configs.
   */
  const pluginIndexPath = joinPathFragments(workspaceLintPluginDir, 'index.ts');
  const existingPluginIndexContents = tree.read(pluginIndexPath, 'utf-8');
  const pluginIndexSourceFile = tsModule.createSourceFile(
    pluginIndexPath,
    existingPluginIndexContents,
    tsModule.ScriptTarget.Latest,
    true
  );

  function findRulesObject(node: ts.Node): ts.ObjectLiteralExpression {
    if (
      tsModule.isPropertyAssignment(node) &&
      tsModule.isIdentifier(node.name) &&
      node.name.text === 'rules' &&
      tsModule.isObjectLiteralExpression(node.initializer)
    ) {
      return node.initializer;
    }

    return node.forEachChild(findRulesObject);
  }

  const rulesObject = pluginIndexSourceFile.forEachChild((node) =>
    findRulesObject(node)
  );
  if (rulesObject) {
    const ruleNameSymbol = `${nameCamelCase}Name`;
    const ruleConfigSymbol = nameCamelCase;

    /**
     * If the rules object already has entries, we need to make sure our insertion
     * takes commas into account.
     */
    let leadingComma = '';
    if (rulesObject.properties.length > 0) {
      if (!rulesObject.properties.hasTrailingComma) {
        leadingComma = ',';
      }
    }

    const newContents = applyChangesToString(existingPluginIndexContents, [
      {
        type: ChangeType.Insert,
        index: 0,
        text: `import { RULE_NAME as ${ruleNameSymbol}, rule as ${ruleConfigSymbol} } from './${
          options.directory ? `${options.directory}/` : ''
        }${options.name}';\n`,
      },
      {
        type: ChangeType.Insert,
        index: rulesObject.getEnd() - 1,
        text: `${leadingComma}[${ruleNameSymbol}]: ${ruleConfigSymbol}\n`,
      },
    ]);

    tree.write(pluginIndexPath, newContents);
  }

  await formatFiles(tree);

  logger.info(`NX Reminder: Once you have finished writing your rule logic, you need to actually enable the rule within an appropriate ESLint config in your workspace, for example:

       "rules": {
         "@nx/workspace-${options.name}": "error"
       }
`);

  return runTasksInSerial(...tasks);
}
