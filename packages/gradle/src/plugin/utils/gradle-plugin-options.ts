export interface GradlePluginOptions {
  testTargetName?: string;
  ciTestTargetName?: string;
  [taskTargetName: string]: string | undefined | boolean;
  gradleProjectRoot?: string;
}

export function normalizeOptions(
  options: GradlePluginOptions
): GradlePluginOptions {
  options ??= {};
  options.testTargetName ??= 'test';
  return options;
}
