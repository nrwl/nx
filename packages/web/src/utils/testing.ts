import { join } from 'path';
import { SchematicTestRunner } from '@angular-devkit/schematics/testing';
import { Rule, Tree } from '@angular-devkit/schematics';
import {
  BuilderContext,
  Architect,
  Target,
  ScheduleOptions
} from '@angular-devkit/architect';
import {
  TestingArchitectHost,
  TestLogger
} from '@angular-devkit/architect/testing';
import { schema, JsonObject } from '@angular-devkit/core';

const testRunner = new SchematicTestRunner(
  '@nrwl/web',
  join(__dirname, '../../collection.json')
);

export function runSchematic(schematicName: string, options: any, tree: Tree) {
  return testRunner.runSchematicAsync(schematicName, options, tree).toPromise();
}

export function callRule(rule: Rule, tree: Tree) {
  return testRunner.callRule(rule, tree).toPromise();
}

export async function getTestArchitect() {
  const architectHost = new TestingArchitectHost('/root', '/root');
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
