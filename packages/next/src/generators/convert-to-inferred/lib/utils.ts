export function findNextConfigPath(tree, projectRoot) {
  const validExtensions = ['js', 'cjs'];

  for (const extension of validExtensions) {
    const path = `${projectRoot}/next.config.${extension}`;
    if (tree.exists(path)) {
      return path;
    }
  }
}
