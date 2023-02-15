export function updateJestConfigContent(content: string) {
  return content
    .replace(
      'transform: {',
      "transform: {\n    '^(?!.*\\\\.(js|jsx|ts|tsx|css|json)$)': '@nrwl/react/plugins/jest',"
    )
    .replace(
      `'babel-jest'`,
      `['babel-jest', { presets: ['@nrwl/react/babel'] }]`
    );
}
