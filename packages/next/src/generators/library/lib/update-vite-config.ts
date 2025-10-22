import { Tree } from '@nx/devkit';

/**
 * Updates a Vite config to support multiple entry points for Next.js libraries.
 * Transforms:
 * 1. entry: 'src/index.ts' -> entry: { index: 'src/index.ts', server: 'src/server.ts' }
 * 2. fileName: 'index' -> fileName: (format, entryName) => `${entryName}.js`
 *
 * Note: We know the shape of the vite config that is being generated, therefore string manipulation is fine
 *
 * @param tree - The file system tree
 * @param viteConfigPath - Path to the vite.config.ts file
 * @returns true if the config was updated, false otherwise
 */
export function updateViteConfigForServerEntry(
  tree: Tree,
  viteConfigPath: string
): boolean {
  if (!tree.exists(viteConfigPath)) {
    return false;
  }

  const viteConfigContent = tree.read(viteConfigPath, 'utf-8');

  // Replace single entry string with multiple entry object
  const updatedViteConfig = viteConfigContent
    .replace(
      /entry:\s*['"]src\/index\.ts['"]/,
      `entry: {
        index: 'src/index.ts',
        server: 'src/server.ts',
      }`
    )
    .replace(
      /fileName:\s*['"]index['"]/,
      `fileName: (format, entryName) => \`\${entryName}.js\``
    );

  // Only write if changes were made
  if (updatedViteConfig !== viteConfigContent) {
    tree.write(viteConfigPath, updatedViteConfig);
    return true;
  }

  return false;
}
