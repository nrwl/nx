import { join, sep } from 'path';
import { SchematicTestRunner } from '@angular-devkit/schematics/testing';
import {
  Tree,
  Rule,
  externalSchematic,
  apply,
  source
} from '@angular-devkit/schematics';
import { createEmptyWorkspace } from '@nrwl/workspace/src/utils/testing-utils';
import {
  BuilderContext,
  Target,
  Architect,
  ScheduleOptions
} from '@angular-devkit/architect';
import {
  TestLogger,
  TestingArchitectHost
} from '@angular-devkit/architect/testing';
import { JsonObject, json, schema } from '@angular-devkit/core';
import { tmpdir } from 'os';
import { mkdtempSync } from 'fs';

const testRunner = new SchematicTestRunner(
  '@nrwl/storybook',
  join(__dirname, '../../collection.json')
);

const migrationRunner = new SchematicTestRunner(
  '@nrwl/storybook/migrations',
  join(__dirname, '../../migrations.json')
);

export function runSchematic<SchemaOptions = any>(
  schematicName: string,
  options: SchemaOptions,
  tree: Tree
) {
  return testRunner.runSchematicAsync(schematicName, options, tree).toPromise();
}

export function callRule(rule: Rule, tree: Tree) {
  return testRunner.callRule(rule, tree).toPromise();
}

export function runMigration(migrationName: string, options: any, tree: Tree) {
  return migrationRunner
    .runSchematicAsync(migrationName, options, tree)
    .toPromise();
}

export async function createTestUILib(libName: string): Promise<Tree> {
  let appTree = Tree.empty();
  appTree = createEmptyWorkspace(appTree);
  appTree = await callRule(
    externalSchematic('@nrwl/angular', 'library', {
      name: libName
    }),
    appTree
  );
  appTree = await callRule(
    externalSchematic('@nrwl/angular', 'component', {
      name: 'test-button',
      project: libName
    }),
    appTree
  );
  appTree.overwrite(
    `libs/${libName}/src/lib/test-button/test-button.component.ts`,
    `
import { Component, OnInit, Input } from '@angular/core';
import { tmpdir } from 'os';
import { mkdtempSync } from 'fs';

export type ButtonStyle = 'default' | 'primary' | 'accent';

@Component({
  selector: 'proj-test-button',
  templateUrl: './test-button.component.html',
  styleUrls: ['./test-button.component.css']
})
export class TestButtonComponent implements OnInit {
  @Input('buttonType') type = 'button';
  @Input() style: ButtonStyle = 'default';
  @Input() age: number;
  @Input() isOn = false;

  constructor() { }

  ngOnInit() {
  }

}
`
  );
  appTree.overwrite(
    `libs/${libName}/src/lib/test-button/test-button.component.html`,
    `<button [attr.type]="type" [ngClass]="style"></button>`
  );
  appTree = await callRule(
    externalSchematic('@nrwl/angular', 'component', {
      name: 'test-other',
      project: libName
    }),
    appTree
  );
  return appTree;
}

function getTempDir() {
  const tmpDir = tmpdir();
  const tmpFolder = `${tmpDir}${sep}`;
  return mkdtempSync(tmpFolder);
}

export async function getTestArchitect() {
  const tmpDir = getTempDir();
  const architectHost = new TestingArchitectHost(tmpDir, tmpDir);
  const registry = new schema.CoreSchemaRegistry();
  registry.addPostTransform(schema.transforms.addUndefinedDefaults);

  const architect = new Architect(architectHost, registry);

  await architectHost.addBuilderFromPackage(join(__dirname, '../..'));

  return [architect, architectHost] as [Architect, TestingArchitectHost];
}

export async function getMockContext() {
  const [architect, architectHost] = await getTestArchitect();

  const context = new MockBuilderContext(architect, architectHost);
  await context.addBuilderFromPackage(join(__dirname, '../..'));
  return context;
}

export class MockBuilderContext implements BuilderContext {
  id: 0;

  builder: any = {};
  analytics = null;

  target: Target = {
    project: null,
    target: null
  };

  get currentDirectory() {
    return this.architectHost.currentDirectory;
  }
  get workspaceRoot() {
    return this.architectHost.workspaceRoot;
  }
  logger = new TestLogger('test');
  constructor(
    private architect: Architect,
    private architectHost: TestingArchitectHost
  ) {}

  async addBuilderFromPackage(path: string) {
    return await this.architectHost.addBuilderFromPackage(path);
  }

  async addTarget(target: Target, builderName: string) {
    return await this.architectHost.addTarget(target, builderName);
  }

  getBuilderNameForTarget(target: Target) {
    return this.architectHost.getBuilderNameForTarget(target);
  }

  scheduleTarget(
    target: Target,
    overrides?: JsonObject,
    scheduleOptions?: ScheduleOptions
  ) {
    return this.architect.scheduleTarget(target, overrides, scheduleOptions);
  }

  scheduleBuilder(
    name: string,
    overrides?: JsonObject,
    scheduleOptions?: ScheduleOptions
  ) {
    return this.architect.scheduleBuilder(name, overrides, scheduleOptions);
  }

  getTargetOptions(target: Target) {
    return this.architectHost.getOptionsForTarget(target);
  }

  validateOptions<T extends JsonObject = JsonObject>(
    options: JsonObject,
    builderName: string
  ): Promise<T> {
    return Promise.resolve<T>(options as T);
  }

  reportRunning() {}

  reportStatus(status: string) {}

  reportProgress(current: number, total?: number, status?: string) {}

  addTeardown(teardown: () => Promise<void> | void) {}
}
