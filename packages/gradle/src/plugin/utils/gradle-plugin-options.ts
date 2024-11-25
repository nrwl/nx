import { isCI } from 'nx/src/devkit-internals';

export interface GradlePluginOptions {
  testTargetName?: string;
  ciTargetName?: string;
  [taskTargetName: string]: string | undefined | boolean;
}

export function normalizeOptions(
  options: GradlePluginOptions
): GradlePluginOptions {
  options ??= {};
  options.testTargetName ??= 'test';
  return options;
}
