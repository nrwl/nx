export interface GradlePluginOptions {
  testTargetName?: string;
  ciTestTargetName?: string;
  ciIntTestTargetName?: string;
  [taskTargetName: string]: string | undefined | boolean;
  projectDirectory?: string;
}

export function normalizeOptions(
  options: GradlePluginOptions
): GradlePluginOptions {
  options ??= {};
  options.testTargetName ??= 'test';
  return options;
}
