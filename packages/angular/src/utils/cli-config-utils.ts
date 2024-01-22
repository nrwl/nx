export function replaceAppNameWithPath(
  node: string | string[] | object | unknown,
  appName: string,
  root: string
): any {
  if (typeof node === 'string') {
    const matchPattern = new RegExp(
      `([^a-z0-9]*(${appName}))|((${appName})[^a-z0-9:]*)`,
      'gi'
    );
    if (
      !!node.match(matchPattern) &&
      node !== 'application' &&
      node !== 'library'
    ) {
      const r = node.replace(appName, root);
      return r.startsWith('/apps') || r.startsWith('/libs')
        ? r.substring(1)
        : r;
    } else {
      return node;
    }
  } else if (Array.isArray(node)) {
    return node.map((j) => replaceAppNameWithPath(j, appName, root));
  } else if (typeof node === 'object' && node) {
    const forbiddenPropertyList: string[] = [
      'prefix',
      'builder',
      'executor',
      'browserTarget',
      'tags',
      'defaultConfiguration',
      'maximumError',
      'name',
      'type',
      'outputHashing',
      'buildTarget',
    ]; // Some of the properties should not be renamed
    return Object.keys(node).reduce(
      (m, c) => (
        (m[c] = !forbiddenPropertyList.includes(c)
          ? replaceAppNameWithPath(node[c], appName, root)
          : node[c]),
        m
      ),
      {} as any
    );
  } else {
    return node;
  }
}
