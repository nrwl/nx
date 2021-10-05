import {
  checkFilesExist,
  exists,
  newProject,
  readFile,
  readJson,
  runCLI,
  uniq,
  updateFile,
  workspaceConfigName,
} from '@nrwl/e2e/utils';

describe('workspace-generator', () => {
  let custom: string;
  let failing: string;
  let proj;

  beforeAll(() => {
    proj = newProject();
  });

  beforeEach(() => {
    custom = uniq('custom');
    failing = uniq('custom-failing');
    runCLI(`g workspace-generator ${custom} --no-interactive`);
    runCLI(`g workspace-generator ${failing} --no-interactive`);

    checkFilesExist(
      `tools/generators/${custom}/index.ts`,
      `tools/generators/${custom}/schema.json`
    );
    checkFilesExist(
      `tools/generators/${failing}/index.ts`,
      `tools/generators/${failing}/schema.json`
    );
  });

  it('should compile only generator files with dependencies', () => {
    const workspace = uniq('workspace');

    updateFile(
      'tools/utils/utils.ts',
      `
        export const noop = () => {}
        `
    );
    updateFile(
      'tools/utils/logger.ts',
      `
        export const log = (...args: any[]) => console.log(...args)
        `
    );
    updateFile(
      `tools/generators/utils.ts`,
      `
        export const noop = ()=>{}
        `
    );
    updateFile(`tools/generators/${custom}/index.ts`, (content) => {
      return `
          import { log } from '../../utils/logger'; \n
          ${content}
        `;
    });

    runCLI(`workspace-generator ${custom} ${workspace} --no-interactive -d`);

    expect(() =>
      checkFilesExist(
        `dist/out-tsc/tools/generators/${custom}/index.js`,
        `dist/out-tsc/tools/generators/utils.js`,
        `dist/out-tsc/tools/utils/logger.js`
      )
    ).not.toThrow();
    expect(() =>
      checkFilesExist(`dist/out-tsc/tools/utils/utils.js`)
    ).toThrow();
  });

  it('should support workspace-specific generators', async () => {
    const json = readJson(`tools/generators/${custom}/schema.json`);
    json.properties['directory'] = {
      type: 'string',
      description: 'lib directory',
    };
    json.properties['skipTsConfig'] = {
      type: 'boolean',
      description: 'skip changes to tsconfig',
    };
    updateFile(`tools/generators/${custom}/schema.json`, JSON.stringify(json));

    const indexFile = readFile(`tools/generators/${custom}/index.ts`);
    updateFile(
      `tools/generators/${custom}/index.ts`,
      indexFile.replace(
        'name: schema.name',
        'name: schema.name, directory: schema.directory, skipTsConfig: schema.skipTsConfig'
      )
    );

    const workspace = uniq('workspace');
    const dryRunOutput = runCLI(
      `workspace-generator ${custom} ${workspace} --no-interactive --directory=dir --skipTsConfig=true -d`
    );
    expect(exists(`libs/dir/${workspace}/src/index.ts`)).toEqual(false);
    expect(dryRunOutput).toContain(`UPDATE ${workspaceConfigName()}`);
    expect(dryRunOutput).toContain('UPDATE nx.json');

    const output = runCLI(
      `workspace-generator ${custom} ${workspace} --no-interactive --directory=dir`
    );
    checkFilesExist(`libs/dir/${workspace}/src/index.ts`);
    expect(output).toContain(`UPDATE ${workspaceConfigName()}`);
    expect(output).toContain('UPDATE nx.json');

    const jsonFailing = readJson(`tools/generators/${failing}/schema.json`);
    jsonFailing.properties = {};
    jsonFailing.required = [];
    updateFile(
      `tools/generators/${failing}/schema.json`,
      JSON.stringify(jsonFailing)
    );

    updateFile(
      `tools/generators/${failing}/index.ts`,
      `
          export default function() {
            throw new Error();
          }
        `
    );

    try {
      await runCLI(`workspace-generator ${failing} --no-interactive`);
      fail(`Should exit 1 for a workspace-generator that throws an error`);
    } catch (e) {}

    const listOutput = runCLI('workspace-generator --list-generators');
    expect(listOutput).toContain(custom);
    expect(listOutput).toContain(failing);
  }, 1000000);

  it('should support angular devkit schematics', () => {
    const angularDevkitSchematic = uniq('angular-devkit-schematic');
    runCLI(`g workspace-generator ${angularDevkitSchematic} --no-interactive`);

    const json = readJson(
      `tools/generators/${angularDevkitSchematic}/schema.json`
    );
    json.properties = {};
    json.required = [];
    delete json.cli;
    updateFile(
      `tools/generators/${angularDevkitSchematic}/schema.json`,
      JSON.stringify(json)
    );

    updateFile(
      `tools/generators/${angularDevkitSchematic}/index.ts`,
      `
          export default function() {
            return (tree) => tree;
          }
        `
    );

    runCLI(`workspace-generator ${angularDevkitSchematic} --no-interactive`);
  });
});
