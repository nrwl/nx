export function maybeJs(
  options: { js?: boolean; useJsx?: boolean },
  path: string
): string {
  return options.js && (path.endsWith('.ts') || path.endsWith('.tsx'))
    ? path.replace(/\.tsx?$/, options.useJsx ? '.jsx' : '.js')
    : path;
}
