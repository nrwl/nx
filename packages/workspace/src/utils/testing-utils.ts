import { _test_addWorkspaceFile } from '@angular-devkit/core/src/workspace/core';
import { Architect, BuilderContext, Target } from '@angular-devkit/architect';
import { TestingArchitectHost } from '@angular-devkit/architect/testing';
import { json, JsonObject } from '@angular-devkit/core';
import { ScheduleOptions } from '@angular-devkit/architect/src/api';
import { LoggerApi, LogLevel } from '@angular-devkit/core/src/logger';

class NoopLogger implements LoggerApi {
  private _log = '';

  createChild(name: string) {
    return new NoopLogger() as any;
  }

  includes(substr: string) {
    return this._log.includes(substr);
  }

  debug(message: string, metadata?: JsonObject): void {
    this._log += message;
  }

  error(message: string, metadata?: JsonObject): void {
    this._log += message;
  }

  fatal(message: string, metadata?: JsonObject): void {
    this._log += message;
  }

  info(message: string, metadata?: JsonObject): void {
    this._log += message;
  }

  log(level: LogLevel, message: string, metadata?: JsonObject): void {
    this._log += message;
  }

  warn(message: string, metadata?: JsonObject): void {
    this._log += message;
  }
}

/**
 * Mock context which makes testing builders easier
 * @deprecated This will be removed in v17. Prefer writing Nx Generators with @nx/devkit.
 */
export class MockBuilderContext implements BuilderContext {
  id: 0;

  builder: any = {};
  analytics = null;

  target: Target = {
    project: null,
    target: null,
  };

  logger = new NoopLogger();

  get currentDirectory() {
    return this.architectHost.currentDirectory;
  }

  get workspaceRoot() {
    return this.architectHost.workspaceRoot;
  }

  constructor(
    private architect: Architect,
    private architectHost: TestingArchitectHost
  ) {}

  async addBuilderFromPackage(path: string) {
    return await this.architectHost.addBuilderFromPackage(path);
  }

  async addTarget(target: Target, builderName: string) {
    return this.architectHost.addTarget(target, builderName);
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

  getTargetOptions(target: Target): Promise<JsonObject> {
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

  async getProjectMetadata(
    target: Target | string
  ): Promise<json.JsonObject | null> {
    return (
      this.architectHost &&
      this.architectHost.getProjectMetadata(target as string)
    );
  }
}
