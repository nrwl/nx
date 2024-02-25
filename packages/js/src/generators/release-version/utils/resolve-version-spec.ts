import * as npa from 'npm-package-arg';
import { normalizePath } from '@nx/devkit';

export function resolveVersionSpec(
  name: string,
  version: string,
  spec: string,
  location?: string
): string {
  // yarn classic uses link instead of file, normalize to match what npm expects
  spec = spec.replace(/^link:/, 'file:');

  // Support workspace: protocol for pnpm and yarn 2+ (https://pnpm.io/workspaces#workspace-protocol-workspace)
  const isWorkspaceSpec = /^workspace:/.test(spec);
  if (isWorkspaceSpec) {
    spec = spec.replace(/^workspace:/, '');
    // replace aliases (https://pnpm.io/workspaces#referencing-workspace-packages-through-aliases)
    if (spec === '*' || spec === '^' || spec === '~') {
      if (version) {
        const prefix = spec === '*' ? '' : spec;
        spec = `${prefix}${version}`;
      } else {
        spec = '*';
      }
    }
  }

  const npaResult = npa.resolve(name, spec, location);

  return npaResult.fetchSpec.includes('\\')
    ? normalizePath(npaResult.fetchSpec)
    : npaResult.fetchSpec;
}
