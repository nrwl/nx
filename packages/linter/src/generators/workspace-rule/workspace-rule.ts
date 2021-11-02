import {
  applyChangesToString,
  ChangeType,
  convertNxGenerator,
  formatFiles,
  generateFiles,
  joinPathFragments,
  logger,
  Tree,
} from '@nrwl/devkit';
import { camelize } from '@nrwl/workspace/src/utils/strings';
import { join } from 'path';
import * as ts from 'typescript';
import { workspaceLintPluginDir } from '../../utils/workspace-lint-rules';
import { lintWorkspaceRulesProjectGenerator } from '../workspace-rules-project/workspace-rules-project';

export interface LintWorkspaceRuleGeneratorOptions {
  name: string;
  directory: string;
}

export async function lintWorkspaceRuleGenerator(
  tree: Tree,
  options: LintWorkspaceRuleGeneratorOptions
) {
  // Ensure that the workspace rules project has been created
  const projectGeneratorCallback = await lintWorkspaceRulesProjectGenerator(
    tree
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
   * register it ready for use in .eslintrc.json configs.
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

  logger.info(`NX Reminder: Once you have finished writing your rule logic, you need to actually enable the rule within an appropriate .eslintrc.json in your workspace, for example:

       "rules": {
         "@nrwl/nx/workspace/${options.name}": "error"
       }
`);

  return projectGeneratorCallback;
}

export const lintWorkspaceRuleSchematic = convertNxGenerator(
  lintWorkspaceRuleGenerator
);
