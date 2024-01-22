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
