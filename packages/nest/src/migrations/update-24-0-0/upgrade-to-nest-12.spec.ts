import {
  addProjectConfiguration,
  readJson,
  readProjectConfiguration,
  updateJson,
  type Tree,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { typescriptVersion } from '@nx/js/internal';
import migration from './upgrade-to-nest-12';

const realNodeVersion = process.versions.node;
const setNodeVersion = (version: string) =>
  Object.defineProperty(process.versions, 'node', {
    value: version,
    configurable: true,
  });

const NEST_SPEC = `import { Test } from '@nestjs/testing';
import { AppService } from './app.service';

describe('AppService', () => {
  it('should be defined', async () => {
    const app = await Test.createTestingModule({ providers: [AppService] }).compile();
    expect(app.get(AppService)).toBeDefined();
  });
});
`;

describe('upgrade-to-nest-12 migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    setNodeVersion('24.11.0');
    updateJson(tree, 'package.json', (json) => ({
      ...json,
      dependencies: {
        '@nestjs/common': '^11.0.0',
        '@nestjs/core': '^11.0.0',
        '@nestjs/platform-express': '^11.0.0',
      },
      devDependencies: {
        ...json.devDependencies,
        '@nestjs/schematics': '^11.0.0',
        '@nestjs/testing': '^11.0.0',
        typescript: '~6.0.3',
      },
    }));
  });

  afterEach(() => setNodeVersion(realNodeVersion));

  function addNestProject(name: string, testRunner: 'jest' | 'vitest') {
    addProjectConfiguration(tree, name, { root: `apps/${name}` });
    tree.write(`apps/${name}/src/app/app.service.spec.ts`, NEST_SPEC);
    tree.write(
      testRunner === 'jest'
        ? `apps/${name}/jest.config.cts`
        : `apps/${name}/vitest.config.mts`,
      'export default {};\n'
    );
  }

  it('should bump the declared Nest packages to 12', async () => {
    addNestProject('api', 'vitest');

    const result = await migration(tree);

    const { dependencies, devDependencies } = readJson(tree, 'package.json');
    expect(dependencies).toEqual({
      '@nestjs/common': '^12.0.1',
      '@nestjs/core': '^12.0.1',
      '@nestjs/platform-express': '^12.0.1',
    });
    expect(devDependencies['@nestjs/schematics']).toBe('^12.0.1');
    expect(devDependencies['@nestjs/testing']).toBe('^12.0.1');
    expect(devDependencies['@nestjs/platform-fastify']).toBeUndefined();
    expect(result.skipAgentic).toBeUndefined();
    expect(result.agentContext).toContain(
      'No project tests Nest code with Jest'
    );
  });

  it('should upgrade typescript 5 for @nestjs/schematics 12', async () => {
    updateJson(tree, 'package.json', (json) => {
      json.devDependencies.typescript = '~5.9.2';
      return json;
    });

    await migration(tree);

    expect(readJson(tree, 'package.json').devDependencies.typescript).toBe(
      typescriptVersion
    );
  });

  it('should keep Nest 11 when Jest tests Nest code on Node below 24.9', async () => {
    setNodeVersion('22.12.0');
    addNestProject('api', 'jest');
    addNestProject('web-api', 'vitest');

    const result = await migration(tree);

    expect(readJson(tree, 'package.json').dependencies['@nestjs/core']).toBe(
      '^11.0.0'
    );
    expect(result.skipAgentic).toBe(true);
    expect(result.nextSteps[0]).toContain('Kept NestJS 11');
    expect(result.nextSteps[0]).toContain('Node.js 22.12.0');
    expect(result.nextSteps[0]).toContain('with Jest: api.');
    expect(result.nextSteps[0]).toContain(
      'npx nx migrate --run-migration=@nx/nest:upgrade-to-nest-12'
    );
  });

  it('should keep Nest 11 when .nvmrc pins Node below 24.9', async () => {
    tree.write('.nvmrc', 'v22\n');
    addNestProject('api', 'jest');

    const result = await migration(tree);

    expect(readJson(tree, 'package.json').dependencies['@nestjs/core']).toBe(
      '^11.0.0'
    );
    expect(result.nextSteps[0]).toContain('`.nvmrc` pins Node.js 22.0.0');
  });

  it('should keep Nest 11 when engines.node allows Node below 24.9', async () => {
    updateJson(tree, 'package.json', (json) => ({
      ...json,
      engines: { node: '>=20.19.0' },
    }));
    addNestProject('api', 'jest');

    const result = await migration(tree);

    expect(result.nextSteps[0]).toContain(
      '`engines.node` allows Node.js 20.19.0'
    );
  });

  it('should set up Jest for Nest 12 when Jest tests Nest code on Node 24.9+', async () => {
    updateJson(tree, 'package.json', (json) => {
      json.devDependencies.jest = '~30.3.0';
      return json;
    });
    addNestProject('api', 'jest');

    const result = await migration(tree);

    const { dependencies, devDependencies } = readJson(tree, 'package.json');
    expect(dependencies['@nestjs/core']).toBe('^12.0.1');
    expect(devDependencies.jest).toBe('^30.5.0');
    expect(
      readProjectConfiguration(tree, 'api').targets.test.options.env
    ).toEqual({ '...': true, NODE_OPTIONS: '--experimental-vm-modules' });
    expect(result.agentContext[1]).toContain(': api');
  });

  it('should bump when old Node only runs Jest for non-Nest projects', async () => {
    setNodeVersion('22.12.0');
    addProjectConfiguration(tree, 'ui', { root: 'libs/ui' });
    tree.write('libs/ui/jest.config.cts', 'export default {};\n');
    tree.write('libs/ui/src/index.ts', "export const ui = 'ui';\n");

    await migration(tree);

    expect(readJson(tree, 'package.json').dependencies['@nestjs/core']).toBe(
      '^12.0.1'
    );
  });
});
