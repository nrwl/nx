export function serializeTarget(
  project: string,
  target: string,
  configuration?: string
) {
  return [project, target, configuration].filter((part) => !!part).join(':');
}
