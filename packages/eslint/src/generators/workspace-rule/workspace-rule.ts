import { camelize } from '@nx/devkit/internal';
import {
  addDependenciesToPackageJson,
  applyChangesToString,
  ChangeType,
  formatFiles,
  generateFiles,
  GeneratorCallback,
  joinPathFragments,
  logger,
  readNxJson,
  runTasksInSerial,
  Tree,
} from '@nx/devkit';
import { join } from 'path';
import { coerce, major } from 'semver';
import * as ts from 'typescript';
import { workspaceLintPluginDir } from '../../utils/workspace-lint-rules';
import { lintWorkspaceRulesProjectGenerator } from '../workspace-rules-project/workspace-rules-project';
import { assertSupportedEslintVersion } from '../../utils/assert-supported-eslint-version';
import { useFlatConfig } from '../../utils/flat-config';
import { versions } from '../../utils/versions';

export interface LintWorkspaceRuleGeneratorOptions {
  name: string;
  directory: string;
}

export async function lintWorkspaceRuleGenerator(
  tree: Tree,
  options: LintWorkspaceRuleGeneratorOptions
) {
  assertSupportedEslintVersion(tree);

  const tasks: GeneratorCallback[] = [];

  const flatConfig = useFlatConfig(tree);
  // ESLint v9 dropped the eslintrc-style `RuleTester` class even when running
  // in eslintrc mode, so any workspace ending up on v9+ needs the flat-style
  // `@typescript-eslint/rule-tester` template regardless of the config-file
  // shape. We resolve the effective major from `versions(tree)` to cover both
  // declared workspaces and fresh installs that will be bumped to v9.
  const { eslintVersion, typescriptESLintVersion } = versions(tree);
  const effectiveEslintMajor = major(coerce(eslintVersion));
  const useFlatRuleTester = flatConfig || effectiveEslintMajor >= 9;

  const nxJson = readNxJson(tree);
  // Ensure that the workspace rules project has been created
  tasks.push(
    await lintWorkspaceRulesProjectGenerator(tree, {
      skipFormat: true,
      addPlugin:
        process.env.NX_ADD_PLUGINS !== 'false' &&
        nxJson.useInferencePlugins !== false,
    })
  );

  if (useFlatRuleTester) {
    tasks.push(
      addDependenciesToPackageJson(
        tree,
        {},
        { '@typescript-eslint/rule-tester': typescriptESLintVersion },
        undefined,
        true
      )
    );
  }

  const ruleDir = joinPathFragments(
    workspaceLintPluginDir,
    options.directory ?? ''
  );

  // Generate the required files for the new rule
  generateFiles(tree, join(__dirname, 'files'), ruleDir, {
    tmpl: '',
    name: options.name,
    useFlatRuleTester,
  });

  const nameCamelCase = camelize(options.name);

  /**
   * Import the new rule into the workspace plugin index.ts and
   * register it ready for use in lint configs.
   */
  const pluginIndexPath = joinPathFragments(workspaceLintPluginDir, 'index.ts');
  const existingPluginIndexContents = tree.read(pluginIndexPath, 'utf-8');
  const pluginIndexSourceFile = ts.createSourceFile(
    pluginIndexPath,
    existingPluginIndexContents,
    ts.ScriptTarget.Latest,
    true
  );

  function findRulesObject(node: ts.Node): ts.ObjectLiteralExpression {
    if (
      ts.isPropertyAssignment(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === 'rules' &&
      ts.isObjectLiteralExpression(node.initializer)
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
