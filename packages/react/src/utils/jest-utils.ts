export function updateJestConfigContent(content: string) {
  return content.replace(
    'transform: {',
    "transform: {\n    '^(?!.*\\\\.(js|jsx|ts|tsx|css|json)$)': '@nrwl/react/plugins/jest',"
  );
}
