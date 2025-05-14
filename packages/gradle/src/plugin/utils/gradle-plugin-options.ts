export interface GradlePluginOptions {
  testTargetName?: string;
  ciTestTargetName?: string;
  ciIntTestTargetName?: string;
  [taskTargetName: string]: string | undefined | boolean;
}

export function normalizeOptions(
  options: GradlePluginOptions
): GradlePluginOptions {
  options ??= {};
  options.testTargetName ??= 'test';
  return options;
}
