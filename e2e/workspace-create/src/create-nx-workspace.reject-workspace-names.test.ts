import { runCreateWorkspace } from '@nx/e2e-utils';

import {
  packageManager,
  registerCreateNxWorkspaceCleanup,
} from './create-nx-workspace.setup';

describe('create-nx-workspace', () => {
  registerCreateNxWorkspaceCleanup();

  it('should reject workspace names starting with numbers', () => {
    expect(() => {
      runCreateWorkspace('4invalidname', {
        preset: 'apps',
        packageManager,
      });
    }).toThrow();
  });
});

