export function removeChildrenFromContainer(container: HTMLElement) {
  Array.from(container.children).forEach((child) =>
    container.removeChild(child)
  );
}

export function trimBackSlash(value: string): string {
  return value.replace(/\/$/, '');
}

export function parseParentDirectoriesFromPilePath(
  path: string,
  workspaceRoot: string
) {
  const root = trimBackSlash(path);

  // split the source root on directory separator
  const split: string[] = root.split('/');

  // check the first part for libs or apps, depending on workspaceLayout
  if (split[0] === trimBackSlash(workspaceRoot)) {
    split.shift();
  }

  // pop off the last element, which should be the lib name
  split.pop();

  return split;
}
