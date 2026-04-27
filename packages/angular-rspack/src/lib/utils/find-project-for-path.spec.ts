import { beforeEach, describe, expect, it } from 'vitest';
import {
  createProjectRootMappings,
  findProjectForPath,
} from './find-project-for-path';

describe('findProjectForPath', () => {
  const nodes = {
    'demo-app': {
      name: 'demo-app',
      type: 'app' as const,
      data: {
        root: 'apps/demo-app',
      },
    },
    ui: {
      name: 'ui',
      type: 'lib' as const,
      data: {
        root: 'libs/ui',
      },
    },
  };

  let projectRootMappings: Map<string, string>;

  beforeEach(() => {
    projectRootMappings = createProjectRootMappings(nodes as any);
  });

  it('should find the project given a POSIX-style path', () => {
    expect(
      findProjectForPath('apps/demo-app/src/main.ts', projectRootMappings)
    ).toEqual('demo-app');
  });

  it('should find the project given a Windows-style backslash path', () => {
    expect(
      findProjectForPath('apps\\demo-app\\src\\main.ts', projectRootMappings)
    ).toEqual('demo-app');
  });

  it('should find the project given a mixed separator path', () => {
    expect(
      findProjectForPath('apps\\demo-app/src\\main.ts', projectRootMappings)
    ).toEqual('demo-app');
  });

  it('should return undefined for a path not in any project', () => {
    expect(
      findProjectForPath('other\\path\\file.ts', projectRootMappings)
    ).toBeUndefined();
  });
});
