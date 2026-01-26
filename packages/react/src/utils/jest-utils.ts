import { joinPathFragments, type Tree } from '@nx/devkit';

export function updateJestConfigContent(content: string) {
  return content
    .replace(
      'transform: {',
      "transform: {\n    '^(?!.*\\\\.(js|jsx|ts|tsx|css|json)$)': '@nx/react/plugins/jest',"
    )
    .replace(
      `'babel-jest'`,
      `['babel-jest', { presets: ['@nx/react/babel'] }]`
    );
}

export function findProjectJestConfig(
  tree: Tree,
  projectRoot: string
): string | null {
  const extensions = ['js', 'ts', 'cts'];

  for (const ext of extensions) {
    const configPath = joinPathFragments(projectRoot, `jest.config.${ext}`);
    if (tree.exists(configPath)) {
      return configPath;
    }
  }

  return null;
}
