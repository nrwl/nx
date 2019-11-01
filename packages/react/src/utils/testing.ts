import { join } from 'path';
import { SchematicTestRunner } from '@angular-devkit/schematics/testing';
import { Rule, Tree } from '@angular-devkit/schematics';
import { names } from '@nrwl/workspace/src/utils/name-utils';
import { updateWorkspace } from '@nrwl/workspace/src/utils/workspace';

const testRunner = new SchematicTestRunner(
  '@nrwl/react',
  join(__dirname, '../../collection.json')
);

export function runSchematic<SchemaOptions = any>(
  schematicName: string,
  options: SchemaOptions,
  tree: Tree
) {
  return testRunner.runSchematicAsync(schematicName, options, tree).toPromise();
}

export function runExternalSchematic<SchemaOptions = any>(
  collectionName: string,
  schematicName: string,
  options: SchemaOptions,
  tree: Tree
) {
  return testRunner
    .runExternalSchematicAsync(collectionName, schematicName, options, tree)
    .toPromise();
}

export function callRule(rule: Rule, tree: Tree) {
  return testRunner.callRule(rule, tree).toPromise();
}

export function createApp(tree: Tree, appName: string): Promise<Tree> {
  const { fileName } = names(appName);

  return callRule(
    updateWorkspace(workspace => {
      workspace.projects.add({
        name: fileName,
        root: `apps/${fileName}`,
        projectType: 'application',
        sourceRoot: `apps/${fileName}/src`,
        targets: {}
      });
    }),
    tree
  );
}

export function createLib(tree: Tree, libName: string): Promise<Tree> {
  const { fileName } = names(libName);

  tree.create(`/libs/${fileName}/src/index.ts`, `\n`);

  return callRule(
    updateWorkspace(workspace => {
      workspace.projects.add({
        name: fileName,
        root: `libs/${fileName}`,
        projectType: 'library',
        sourceRoot: `libs/${fileName}/src`,
        targets: {}
      });
    }),
    tree
  );
}
