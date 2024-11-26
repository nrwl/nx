export function serializeTarget(project, target, configuration) {
  return [project, target, configuration].filter((part) => !!part).join(':');
}
