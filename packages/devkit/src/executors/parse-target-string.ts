export function parseTargetString(targetString: string) {
  const [project, target, configuration] = targetString.split(':');
  if (!project || !target) {
    throw new Error(`Invalid Target String: ${targetString}`);
  }
  return {
    project,
    target,
    configuration,
  };
}
