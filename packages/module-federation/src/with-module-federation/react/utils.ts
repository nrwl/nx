import type { SharedLibraryConfig } from '../../utils';

export function applyDefaultEagerPackages(
  sharedConfig: Record<string, SharedLibraryConfig>
) {
  const DEFAULT_REACT_PACKAGES_TO_LOAD_EAGERLY = [
    'react',
    'react-dom',
    'react-router-dom',
    'react-router',
  ];

  for (const pkg of DEFAULT_REACT_PACKAGES_TO_LOAD_EAGERLY) {
    if (!sharedConfig[pkg]) {
      continue;
    }
    sharedConfig[pkg] = { ...sharedConfig[pkg], eager: true };
  }
}
