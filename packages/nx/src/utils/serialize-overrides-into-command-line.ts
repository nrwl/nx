export function serializeOverridesIntoCommandLine(args: {
  [k: string]: any;
}): string[] {
  const r = args['_'] ? [...args['_']] : [];
  Object.keys(args).forEach((a) => {
    if (a !== '_') {
      r.push(
        typeof args[a] === 'string' && args[a].includes(' ')
          ? `--${a}="${args[a].replace(/"/g, '"')}"`
          : `--${a}=${args[a]}`
      );
    }
  });
  return r;
}
