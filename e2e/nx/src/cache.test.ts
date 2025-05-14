import {
  cleanupProject,
  directoryExists,
  fileExists,
  listFiles,
  newProject,
  readFile,
  removeFile,
  rmDist,
  runCLI,
  tmpProjPath,
  uniq,
  updateFile,
  updateJson,
} from '@nx/e2e/utils';
import { fork } from 'child_process';

import { readdir, stat } from 'fs/promises';

import { join } from 'path';

describe('cache', () => {
  beforeEach(() => newProject({ packages: ['@nx/web', '@nx/js'] }));

  afterEach(() => cleanupProject());

  // TODO(@Cammisuli): This test is flaky and needs to be investigated
  xit('should cache command execution', async () => {
    const myapp1 = uniq('myapp1');
    const myapp2 = uniq('myapp2');
    runCLI(`generate @nx/web:app ${myapp1}`);
    runCLI(`generate @nx/web:app ${myapp2}`);

    // run build with caching
    // --------------------------------------------
    const buildAppsCommand = `run-many --target build --projects ${[
      myapp1,
      myapp2,
    ].join()}`;
    const outputThatPutsDataIntoCache = runCLI(buildAppsCommand);
    const filesApp1 = listFiles(`dist/apps/${myapp1}`);
    const filesApp2 = listFiles(`dist/apps/${myapp2}`);
    // now the data is in cache
    expect(outputThatPutsDataIntoCache).not.toContain(
      'read the output from the cache'
    );

    rmDist();

    const outputWithBothBuildTasksCached = runCLI(buildAppsCommand);
    expect(outputWithBothBuildTasksCached).toContain(
      'read the output from the cache'
    );
    expectCached(outputWithBothBuildTasksCached, [myapp1, myapp2]);
    expect(listFiles(`dist/apps/${myapp1}`)).toEqual(filesApp1);
    expect(listFiles(`dist/apps/${myapp2}`)).toEqual(filesApp2);

    // run with skipping cache
    const outputWithBothBuildTasksCachedButSkipped = runCLI(
      buildAppsCommand + ' --skip-nx-cache'
    );
    expect(outputWithBothBuildTasksCachedButSkipped).not.toContain(
      `read the output from the cache`
    );

    // touch myapp1
    // --------------------------------------------
    updateFile(`apps/${myapp1}/src/main.ts`, (c) => {
      return `${c}\n//some comment`;
    });
    const outputWithBuildApp2Cached = runCLI(buildAppsCommand);
    expect(outputWithBuildApp2Cached).toContain(
      'read the output from the cache'
    );

    expectCached(outputWithBuildApp2Cached, [myapp2]);

    // touch package.json
    // --------------------------------------------
    updateFile(`nx.json`, (c) => {
      const r = JSON.parse(c);
      r.affected = { defaultBase: 'different' };
      return JSON.stringify(r);
    });
    const outputWithNoBuildCached = runCLI(buildAppsCommand);
    expect(outputWithNoBuildCached).not.toContain(
      'read the output from the cache'
    );

    // build individual project with caching
    const individualBuildWithCache = runCLI(`build ${myapp1}`);
    expect(individualBuildWithCache).toContain('local cache');

    // skip caching when building individual projects
    const individualBuildWithSkippedCache = runCLI(
      `build ${myapp1} --skip-nx-cache`
    );
    expect(individualBuildWithSkippedCache).not.toContain('local cache');

    // run lint with caching
    // --------------------------------------------
    let lintAppsCommand = `run-many --target lint --projects ${[
      myapp1,
      myapp2,
      `${myapp1}-e2e`,
      `${myapp2}-e2e`,
    ].join()}`;
    const outputWithNoLintCached = runCLI(lintAppsCommand);
    expect(outputWithNoLintCached).not.toContain(
      'read the output from the cache'
    );

    const outputWithBothLintTasksCached = runCLI(lintAppsCommand);
    expect(outputWithBothLintTasksCached).toContain(
      'read the output from the cache'
    );
    expectMatchedOutput(outputWithBothLintTasksCached, [
      myapp1,
      myapp2,
      `${myapp1}-e2e`,
      `${myapp2}-e2e`,
    ]);

    // run without caching
    // --------------------------------------------

    // disable caching
    // --------------------------------------------
    const originalNxJson = readFile('nx.json');
    updateFile('nx.json', (c) => {
      const nxJson = JSON.parse(c);
      nxJson.targetDefaults = {
        build: {
          cache: false,
        },
      };
      return JSON.stringify(nxJson, null, 2);
    });

    const outputWithoutCachingEnabled1 = runCLI(buildAppsCommand);

    expect(outputWithoutCachingEnabled1).not.toContain(
      'read the output from the cache'
    );

    const outputWithoutCachingEnabled2 = runCLI(buildAppsCommand);
    expect(outputWithoutCachingEnabled2).not.toContain(
      'read the output from the cache'
    );

    // re-enable caching after test
    // --------------------------------------------
    updateFile('nx.json', (c) => originalNxJson);
  }, 120000);

  it('should support using globs as outputs', async () => {
    const mylib = uniq('mylib');
    runCLI(`generate @nx/js:library ${mylib} --directory=libs/${mylib}`);
    updateJson(join('libs', mylib, 'project.json'), (c) => {
      c.targets.build = {
        cache: true,
        executor: 'nx:run-commands',
        outputs: ['{workspaceRoot}/dist/!(.next)/**/!(z|x).(txt|md)'],
        options: {
          commands: [
            'rm -rf dist',
            'mkdir dist',
            'mkdir dist/apps',
            'mkdir dist/.next',
            'echo a > dist/apps/a.txt',
            'echo b > dist/apps/b.txt',
            'echo c > dist/apps/c.txt',
            'echo d > dist/apps/d.txt',
            'echo e > dist/apps/e.txt',
            'echo f > dist/apps/f.md',
            'echo g > dist/apps/g.html',
            'echo h > dist/.next/h.txt',
            'echo x > dist/apps/x.txt',
            'echo z > dist/apps/z.md',
          ],
          parallel: false,
        },
      };
      return c;
    });

    // Run without cache
    const runWithoutCache = runCLI(`build ${mylib}`);
    expect(runWithoutCache).not.toContain('read the output from the cache');

    // Rerun without touching anything
    const rerunWithUntouchedOutputs = runCLI(`build ${mylib}`);
    expect(rerunWithUntouchedOutputs).toContain('local cache');
    const outputsWithUntouchedOutputs = [
      ...listFiles('dist/apps'),
      ...listFiles('dist/.next').map((f) => `.next/${f}`),
    ];
    expect(outputsWithUntouchedOutputs).toContain('a.txt');
    expect(outputsWithUntouchedOutputs).toContain('b.txt');
    expect(outputsWithUntouchedOutputs).toContain('c.txt');
    expect(outputsWithUntouchedOutputs).toContain('d.txt');
    expect(outputsWithUntouchedOutputs).toContain('e.txt');
    expect(outputsWithUntouchedOutputs).toContain('f.md');
    expect(outputsWithUntouchedOutputs).toContain('g.html');
    expect(outputsWithUntouchedOutputs).toContain('.next/h.txt');
    expect(outputsWithUntouchedOutputs).toContain('x.txt');
    expect(outputsWithUntouchedOutputs).toContain('z.md');

    // Create a file in the dist that does not match output glob
    updateFile('dist/apps/c.ts', '');

    // Rerun
    const rerunWithNewUnrelatedFile = runCLI(`build ${mylib}`);
    expect(rerunWithNewUnrelatedFile).toContain('local cache');
    const outputsAfterAddingUntouchedFileAndRerunning = [
      ...listFiles('dist/apps'),
      ...listFiles('dist/.next').map((f) => `.next/${f}`),
    ];
    expect(outputsAfterAddingUntouchedFileAndRerunning).toContain('a.txt');
    expect(outputsAfterAddingUntouchedFileAndRerunning).toContain('b.txt');
    expect(outputsAfterAddingUntouchedFileAndRerunning).toContain('c.txt');
    expect(outputsAfterAddingUntouchedFileAndRerunning).toContain('d.txt');
    expect(outputsAfterAddingUntouchedFileAndRerunning).toContain('e.txt');
    expect(outputsAfterAddingUntouchedFileAndRerunning).toContain('f.md');
    expect(outputsAfterAddingUntouchedFileAndRerunning).toContain('g.html');
    expect(outputsAfterAddingUntouchedFileAndRerunning).toContain(
      '.next/h.txt'
    );
    expect(outputsAfterAddingUntouchedFileAndRerunning).toContain('x.txt');
    expect(outputsAfterAddingUntouchedFileAndRerunning).toContain('z.md');
    expect(outputsAfterAddingUntouchedFileAndRerunning).toContain('c.ts');

    // Clear Dist
    rmDist();

    // Rerun
    const rerunWithoutOutputs = runCLI(`build ${mylib}`);
    expect(rerunWithoutOutputs).toContain('read the output from the cache');
    const outputsWithoutOutputs = listFiles('dist/apps');
    expect(directoryExists(`${tmpProjPath()}/dist/.next`)).toBe(false);
    expect(outputsWithoutOutputs).toContain('a.txt');
    expect(outputsWithoutOutputs).toContain('b.txt');
    expect(outputsWithoutOutputs).toContain('c.txt');
    expect(outputsWithoutOutputs).toContain('d.txt');
    expect(outputsWithoutOutputs).toContain('e.txt');
    expect(outputsWithoutOutputs).toContain('f.md');
    expect(outputsWithoutOutputs).not.toContain('c.ts');
    expect(outputsWithoutOutputs).not.toContain('g.html');
    expect(outputsWithoutOutputs).not.toContain('x.txt');
    expect(outputsWithoutOutputs).not.toContain('z.md');
  });

  it('should use consider filesets when hashing', async () => {
    const parent = uniq('parent');
    const child1 = uniq('child1');
    const child2 = uniq('child2');
    runCLI(`generate @nx/js:lib libs/${parent}`);
    runCLI(`generate @nx/js:lib libs/${child1}`);
    runCLI(`generate @nx/js:lib libs/${child2}`);
    updateJson(`nx.json`, (c) => {
      c.namedInputs = {
        default: ['{projectRoot}/**/*'],
        prod: ['!{projectRoot}/**/*.spec.ts'],
      };
      c.targetDefaults = {
        test: {
          inputs: ['default', '^prod'],
          cache: true,
        },
      };
      return c;
    });

    updateJson(`libs/${parent}/project.json`, (c) => {
      c.implicitDependencies = [child1, child2];
      return c;
    });

    updateJson(`libs/${child1}/project.json`, (c) => {
      c.namedInputs = { prod: ['{projectRoot}/**/*.ts'] };
      return c;
    });

    const firstRun = runCLI(`test ${parent}`);
    expect(firstRun).not.toContain('read the output from the cache');

    // -----------------------------------------
    // change child2 spec
    updateFile(`libs/${child2}/src/lib/${child2}.spec.ts`, (c) => {
      return c + '\n// some change';
    });
    const child2RunSpecChange = runCLI(`test ${child2}`);
    expect(child2RunSpecChange).not.toContain('read the output from the cache');

    const parentRunSpecChange = runCLI(`test ${parent}`);
    expect(parentRunSpecChange).toContain('read the output from the cache');

    // -----------------------------------------
    // change child2 prod
    updateFile(`libs/${child2}/src/lib/${child2}.ts`, (c) => {
      return c + '\n// some change';
    });
    const child2RunProdChange = runCLI(`test ${child2}`);
    expect(child2RunProdChange).not.toContain('read the output from the cache');

    const parentRunProdChange = runCLI(`test ${parent}`);
    expect(parentRunProdChange).not.toContain('read the output from the cache');

    // -----------------------------------------
    // change child1 spec
    updateFile(`libs/${child1}/src/lib/${child1}.spec.ts`, (c) => {
      return c + '\n// some change';
    });

    // this is a miss cause child1 redefined "prod" to include all files
    const parentRunSpecChangeChild1 = runCLI(`test ${parent}`);
    expect(parentRunSpecChangeChild1).not.toContain(
      'read the output from the cache'
    );
  }, 120000);

  it('should support ENV as an input', () => {
    const lib = uniq('lib');
    runCLI(`generate @nx/js:lib libs/${lib}`);
    updateJson(`nx.json`, (c) => {
      c.targetDefaults = {
        echo: {
          cache: true,
          inputs: [
            {
              env: 'NAME',
            },
          ],
        },
      };

      return c;
    });

    updateJson(`libs/${lib}/project.json`, (c) => {
      c.targets = {
        echo: {
          command: 'echo $NAME',
        },
      };
      return c;
    });

    const firstRun = runCLI(`echo ${lib}`, {
      env: { NAME: 'e2e' },
    });
    expect(firstRun).not.toContain('read the output from the cache');

    const secondRun = runCLI(`echo ${lib}`, {
      env: { NAME: 'e2e' },
    });
    expect(secondRun).toContain('read the output from the cache');

    const thirdRun = runCLI(`echo ${lib}`, {
      env: { NAME: 'change' },
    });
    expect(thirdRun).not.toContain('read the output from the cache');

    const fourthRun = runCLI(`echo ${lib}`, {
      env: { NAME: 'change' },
    });
    expect(fourthRun).toContain('read the output from the cache');
  }, 120000);

  it('should evict cache if larger than max cache size', async () => {
    runCLI('reset');
    updateJson(`nx.json`, (c) => {
      c.maxCacheSize = '500KB';
      return c;
    });

    const lib = uniq('cache-size');

    updateFile(
      `tools/copy.js`,
      'require("fs").cpSync(process.argv[2], process.argv[3], { recursive: true, force: true });'
    );
    updateFile(
      `libs/${lib}/project.json`,
      JSON.stringify({
        name: lib,
        targets: {
          write: {
            cache: true,
            command: 'node tools/copy.js {projectRoot}/src dist/{projectRoot}',
            inputs: ['{projectRoot}/hash.txt'],
            outputs: ['{workspaceRoot}/dist/{projectRoot}'],
          },
        },
      })
    );
    // 100KB file
    updateFile(`libs/${lib}/src/data.txt`, 'a'.repeat(100 * 1024));
    for (let i = 0; i < 10; ++i) {
      updateFile(`libs/${lib}/hash.txt`, i.toString());
      runCLI(`write ${lib}`);
    }

    // Expect that size of cache artifacts in cacheDir is less than 1MB
    const cacheDir = tmpProjPath('.nx/cache');
    const cacheFiles = listFiles('.nx/cache');
    let cacheEntries = 0;
    let cacheEntriesSize = 0;
    for (const file of cacheFiles) {
      if (file.match(/^[0-9]+$/)) {
        cacheEntries += 1;
        cacheEntriesSize += await dirSize(join(cacheDir, file));
        console.log(
          'Checked cache entry',
          file,
          'size',
          cacheEntriesSize,
          'total entries',
          cacheEntries
        );
      }
    }
    console.log('Cache entries:', cacheEntries);
    console.log('Cache size:', cacheEntriesSize);
    expect(cacheEntries).toBeGreaterThan(1);
    expect(cacheEntries).toBeLessThan(10);
    expect(cacheEntriesSize).toBeLessThanOrEqual(500 * 1024);
  });

  describe('http remote cache', () => {
    let cacheServer: any;
    beforeAll(() => {
      cacheServer = fork(join(__dirname, '__fixtures__', 'remote-cache.js'), {
        stdio: 'inherit',
      });
    });

    afterAll(() => {
      cacheServer.kill();
    });

    it('should PUT and GET cache from remote cache', async () => {
      const projectName = uniq('myapp');
      const outputFilePath = `dist/${projectName}/output.txt`;
      updateFile(
        `projects/${projectName}/project.json`,
        JSON.stringify({
          name: projectName,
          targets: {
            build: {
              command: `node -e 'const {mkdirSync, writeFileSync} = require("fs"); mkdirSync("dist/${projectName}", {recursive: true}); writeFileSync("${outputFilePath}", "Hello World")'`,
              outputs: ['{workspaceRoot}/dist/{projectName}'],
              cache: true,
            },
          },
        })
      );
      runCLI(`build ${projectName}`, {
        env: {
          NX_SELF_HOSTED_REMOTE_CACHE_SERVER: 'http://localhost:3000',
          NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN: 'test-token',
        },
      });
      // removing the file should not affect the cache retrieval,
      // but we can check that the file exists to ensure the cache is
      // being used.
      removeFile(outputFilePath);
      runCLI(`reset`);
      const output = runCLI(`build ${projectName}`, {
        env: {
          NX_SELF_HOSTED_REMOTE_CACHE_SERVER: 'http://localhost:3000',
          NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN: 'test-token',
        },
      });
      expectProjectMatchTaskCacheStatus(output, [projectName], 'remote cache');
      expect(fileExists(tmpProjPath(outputFilePath))).toBe(true);
    });

    it('should handle 401 without ACCESS_TOKEN appropriately', async () => {
      const projectName = uniq('myapp');
      const outputFilePath = `dist/${projectName}/output.txt`;
      updateFile(
        `projects/${projectName}/project.json`,
        JSON.stringify({
          name: projectName,
          targets: {
            build: {
              command: `node -e 'const {mkdirSync, writeFileSync} = require("fs"); mkdirSync("dist/${projectName}", {recursive: true}); writeFileSync("${outputFilePath}", "Hello World")'`,
              outputs: ['{workspaceRoot}/dist/{projectName}'],
              cache: true,
            },
          },
        })
      );
      const output = runCLI(`build ${projectName}`, {
        env: {
          NX_SELF_HOSTED_REMOTE_CACHE_SERVER: 'http://localhost:3000',
        },
        silenceError: true,
      });

      expect(output).toContain(
        'Unauthorized: Missing or invalid token. Set NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN to proceed.'
      );
    });

    it('should error if server is not running', async () => {
      const projectName = uniq('myapp');
      const outputFilePath = `dist/${projectName}/output.txt`;
      updateFile(
        `projects/${projectName}/project.json`,
        JSON.stringify({
          name: projectName,
          targets: {
            build: {
              command: `node -e 'const {mkdirSync, writeFileSync} = require("fs"); mkdirSync("dist/${projectName}", {recursive: true}); writeFileSync("${outputFilePath}", "Hello World")'`,
              outputs: ['{workspaceRoot}/dist/{projectName}'],
              cache: true,
            },
          },
        })
      );
      const output = runCLI(`build ${projectName}`, {
        env: {
          NX_SELF_HOSTED_REMOTE_CACHE_SERVER: 'http://localhost:3001',
          NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN: 'test-token',
        },
        silenceError: true,
      });

      expect(output).toContain('http://localhost:3001');
    });
  });

  function expectCached(
    actualOutput: string,
    expectedCachedProjects: string[]
  ) {
    expectProjectMatchTaskCacheStatus(actualOutput, expectedCachedProjects);
  }

  function expectMatchedOutput(
    actualOutput: string,
    expectedMatchedOutputProjects: string[]
  ) {
    expectProjectMatchTaskCacheStatus(
      actualOutput,
      expectedMatchedOutputProjects,
      'existing outputs match the cache'
    );
  }

  function expectProjectMatchTaskCacheStatus(
    actualOutput: string,
    expectedProjects: string[],
    cacheStatus: string = 'local cache'
  ) {
    const matchingProjects = [];
    const lines = actualOutput.split('\n');
    lines.forEach((s) => {
      if (s.trimStart().startsWith(`> nx run`)) {
        const projectName = s
          .trimStart()
          .split(`> nx run `)[1]
          .split(':')[0]
          .trim();
        if (s.indexOf(cacheStatus) > -1) {
          matchingProjects.push(projectName);
        }
      }
    });

    matchingProjects.sort((a, b) => a.localeCompare(b));
    expectedProjects.sort((a, b) => a.localeCompare(b));
    expect(matchingProjects).toEqual(expectedProjects);
  }
});

const dirSize = async (dir) => {
  const files = await readdir(dir, { withFileTypes: true });

  const paths = files.map(async (file) => {
    const path = join(dir, file.name);

    if (file.isDirectory()) return await dirSize(path);

    if (file.isFile()) {
      const { size } = await stat(path);

      return size;
    }

    console.log('Unknown file type', path);

    return 0;
  });

  return (await Promise.all(paths))
    .flat(Infinity)
    .reduce((i, size) => i + size, 0);
};
