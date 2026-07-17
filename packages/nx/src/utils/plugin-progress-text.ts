export function formatPluginProgressText(
  action: string,
  inProgressPlugins: ReadonlySet<string>
): string {
  if (inProgressPlugins.size === 0) {
    return '';
  }

  if (inProgressPlugins.size === 1) {
    return `${action} with ${inProgressPlugins.values().next().value}`;
  }

  return [
    `${action} with ${inProgressPlugins.size} plugins`,
    ...Array.from(inProgressPlugins, (p) => `  - ${p}`),
  ].join('\n');
}
