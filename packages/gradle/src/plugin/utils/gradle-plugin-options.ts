export interface GradlePluginOptions {
  testTargetName?: string;
  buildTargetName?: string;
  ciTestTargetName?: string;
  gradleExecutableDirectory?: string;
  targetNamePrefix?: string;
  [taskTargetName: string]: string | undefined | boolean;
}

export function normalizeOptions(
  options: GradlePluginOptions
): GradlePluginOptions {
  options ??= {};
  options.testTargetName ??= 'test';
  return options;
}
