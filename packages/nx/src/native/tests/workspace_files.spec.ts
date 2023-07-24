import { getProjectConfigurations, getWorkspaceFilesNative } from '../index';
import { TempFs } from '../../utils/testing/temp-fs';
import { NxJsonConfiguration } from '../../config/nx-json';
import { dirname, join } from 'path';
import { readJsonFile } from '../../utils/fileutils';

describe('workspace files', () => {
  function createParseConfigurationsFunction(tempDir: string) {
    return (filenames: string[]) => {
      const res = {};
      for (const filename of filenames) {
        const json = readJsonFile(join(tempDir, filename));
        res[json.name] = {
          ...json,
          root: dirname(filename),
        };
      }
      return {
        projectNodes: res,
        externalNodes: {}
      };
    };
  }

  it('should gather workspace file information', async () => {
    const fs = new TempFs('workspace-files');
    const nxJson: NxJsonConfiguration = {};
    await fs.createFiles({
      './nx.json': JSON.stringify(nxJson),
      './package.json': JSON.stringify({
        name: 'repo-name',
        version: '0.0.0',
        dependencies: {},
      }),
      './libs/project1/project.json': JSON.stringify({
        name: 'project1',
      }),
      './libs/project1/index.js': '',
      './libs/project2/project.json': JSON.stringify({
        name: 'project2',
      }),
      './libs/project2/index.js': '',
      './libs/project3/project.json': JSON.stringify({
        name: 'project3',
      }),
      './libs/project3/index.js': '',
      './libs/nested/project/project.json': JSON.stringify({
        name: 'nested-project',
      }),
      './libs/nested/project/index.js': '',
      './libs/package-project/package.json': JSON.stringify({
        name: 'package-project',
      }),
      './libs/package-project/index.js': '',
      './nested/non-project/file.txt': '',
    });

    let globs = ['project.json', '**/project.json', 'libs/*/package.json'];
    let { projectFileMap, projectConfigurations, globalFiles } =
      getWorkspaceFilesNative(
        fs.tempDir,
        globs,
        createParseConfigurationsFunction(fs.tempDir)
      );

    let sortedConfigs = Object.values(projectConfigurations).sort((a, b) =>
      a['name'].localeCompare(b['name'])
    );

    expect(projectFileMap).toMatchInlineSnapshot(`
      {
        "nested-project": [
          {
            "file": "libs/nested/project/index.js",
            "hash": "3244421341483603138",
          },
          {
            "file": "libs/nested/project/project.json",
            "hash": "2709826705451517790",
          },
        ],
        "package-project": [
          {
            "file": "libs/package-project/index.js",
            "hash": "3244421341483603138",
          },
          {
            "file": "libs/package-project/package.json",
            "hash": "1637510190365604632",
          },
        ],
        "project1": [
          {
            "file": "libs/project1/index.js",
            "hash": "3244421341483603138",
          },
          {
            "file": "libs/project1/project.json",
            "hash": "13466615737813422520",
          },
        ],
        "project2": [
          {
            "file": "libs/project2/index.js",
            "hash": "3244421341483603138",
          },
          {
            "file": "libs/project2/project.json",
            "hash": "1088730393343835373",
          },
        ],
        "project3": [
          {
            "file": "libs/project3/index.js",
            "hash": "3244421341483603138",
          },
          {
            "file": "libs/project3/project.json",
            "hash": "4575237344652189098",
          },
        ],
      }
    `);
    expect(sortedConfigs).toMatchInlineSnapshot(`
      [
        {
          "name": "nested-project",
          "root": "libs/nested/project",
        },
        {
          "name": "package-project",
          "root": "libs/package-project",
        },
        {
          "name": "project1",
          "root": "libs/project1",
        },
        {
          "name": "project2",
          "root": "libs/project2",
        },
        {
          "name": "project3",
          "root": "libs/project3",
        },
      ]
    `);
    expect(globalFiles).toMatchInlineSnapshot(`
      [
        {
          "file": "nested/non-project/file.txt",
          "hash": "3244421341483603138",
        },
        {
          "file": "nx.json",
          "hash": "1389868326933519382",
        },
        {
          "file": "package.json",
          "hash": "14409636362330144230",
        },
      ]
    `);
  });

  it('should assign files to the root project if it exists', async () => {
    const fs = new TempFs('workspace-files');
    const nxJson: NxJsonConfiguration = {};
    await fs.createFiles({
      './nx.json': JSON.stringify(nxJson),
      './package.json': JSON.stringify({
        name: 'repo-name',
        version: '0.0.0',
        dependencies: {},
      }),
      './project.json': JSON.stringify({
        name: 'repo-name',
      }),
      './src/index.js': '',
      './jest.config.js': '',
    });
    const globs = ['project.json', '**/project.json', '**/package.json'];
    const { globalFiles, projectFileMap } = getWorkspaceFilesNative(
      fs.tempDir,
      globs,
      createParseConfigurationsFunction(fs.tempDir)
    );

    expect(globalFiles).toEqual([]);
    expect(projectFileMap['repo-name']).toMatchInlineSnapshot(`
      [
        {
          "file": "jest.config.js",
          "hash": "3244421341483603138",
        },
        {
          "file": "nx.json",
          "hash": "1389868326933519382",
        },
        {
          "file": "package.json",
          "hash": "14409636362330144230",
        },
        {
          "file": "project.json",
          "hash": "4357927788053707201",
        },
        {
          "file": "src/index.js",
          "hash": "3244421341483603138",
        },
      ]
    `);
  });

  it('should dedupe configuration files', async () => {
    const fs = new TempFs('workspace-files');
    const nxJson: NxJsonConfiguration = {};
    await fs.createFiles({
      './nx.json': JSON.stringify(nxJson),
      './package.json': JSON.stringify({
        name: 'repo-name',
        version: '0.0.0',
        dependencies: {},
      }),
      './project.json': JSON.stringify({
        name: 'repo-name',
      }),
      './libs/project1/project.json': JSON.stringify({
        name: 'project1',
      }),
      './libs/project1/package.json': JSON.stringify({
        name: 'project1',
      }),
      './libs/project1/index.js': '',
    });

    let globs = ['project.json', '**/project.json', '**/package.json'];

    let nodes = getProjectConfigurations(
      fs.tempDir,
      globs,
      (filenames) => {
        const res = {};
        for (const filename of filenames) {
          const json = readJsonFile(join(fs.tempDir, filename));
          res[json.name] = {
            ...json,
            root: dirname(filename),
          };
        }
        return {
          externalNodes: {}, projectNodes: res
        };
      }
    );
    expect(nodes.projectNodes).toMatchInlineSnapshot(`
      {
        "project1": {
          "name": "project1",
          "root": "libs/project1",
        },
        "repo-name": {
          "name": "repo-name",
          "root": ".",
        },
      }
    `);
  });

  // describe('errors', () => {
  //   it('it should infer names of configuration files without a name', async () => {
  //     const fs = new TempFs('workspace-files');
  //     const nxJson: NxJsonConfiguration = {};
  //     await fs.createFiles({
  //       './nx.json': JSON.stringify(nxJson),
  //       './package.json': JSON.stringify({
  //         name: 'repo-name',
  //         version: '0.0.0',
  //         dependencies: {},
  //       }),
  //       './libs/project1/project.json': JSON.stringify({
  //         name: 'project1',
  //       }),
  //       './libs/project1/index.js': '',
  //       './libs/project2/project.json': JSON.stringify({}),
  //     });
  //
  //     let globs = ['project.json', '**/project.json', 'libs/*/package.json'];
  //     expect(getWorkspaceFilesNative(fs.tempDir, globs).projectFileMap)
  //       .toMatchInlineSnapshot(`
  //       {
  //         "libs/project1": [
  //           {
  //             "file": "libs/project1/index.js",
  //             "hash": "3244421341483603138",
  //           },
  //           {
  //             "file": "libs/project1/project.json",
  //             "hash": "13466615737813422520",
  //           },
  //         ],
  //         "libs/project2": [
  //           {
  //             "file": "libs/project2/project.json",
  //             "hash": "1389868326933519382",
  //           },
  //         ],
  //       }
  //     `);
  //   });
  //
  //   it('handles comments', async () => {
  //     const fs = new TempFs('workspace-files');
  //     const nxJson: NxJsonConfiguration = {};
  //     await fs.createFiles({
  //       './nx.json': JSON.stringify(nxJson),
  //       './package.json': JSON.stringify({
  //         name: 'repo-name',
  //         version: '0.0.0',
  //         dependencies: {},
  //       }),
  //       './libs/project1/project.json': `{
  //       "name": "temp"
  //       // this should not fail
  //       }`,
  //       './libs/project1/index.js': '',
  //     });
  //
  //     let globs = ['project.json', '**/project.json', 'libs/*/package.json'];
  //     expect(() => getWorkspaceFilesNative(fs.tempDir, globs)).not.toThrow();
  //   });
  //
  //   it('handles extra comma', async () => {
  //     const fs = new TempFs('workspace-files');
  //     const nxJson: NxJsonConfiguration = {};
  //     await fs.createFiles({
  //       './nx.json': JSON.stringify(nxJson),
  //       './package.json': JSON.stringify({
  //         name: 'repo-name',
  //         version: '0.0.0',
  //         dependencies: {},
  //       }),
  //       './libs/project1/project.json': `{
  //       "name": "temp",
  //       }`,
  //       './libs/project1/index.js': '',
  //     });
  //
  //     let globs = ['**/project.json'];
  //     expect(() => getWorkspaceFilesNative(fs.tempDir, globs)).not.toThrow();
  //   });
  // });
});
