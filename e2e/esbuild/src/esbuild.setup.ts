import {
  cleanupProject,
  newProject,
  runCLI,
  uniq,
} from '@nx/e2e-utils';

export function setupEsbuildSuite() {
  let proj: string;

  beforeEach(() => {
    proj = newProject();
  });

  afterEach(() => cleanupProject());

  return () => proj;
}

export function generateEsbuildLib(name: string) {
  runCLI(
    `generate @nx/js:lib ${name} --directory=libs/${name} --bundler=esbuild`
  );
}

export function resetFile(path: string, content: string) {
  updateFile(path, content);
}

export function runNodeInDist(path: string) {
  return runCommand(`node ${path}`);
}

