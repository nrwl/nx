import {
  RunCmdOpts,
  removeFile,
  renameFile,
  uniq,
  updateFile,
  updateJson,
} from '@nx/e2e-utils';

/**
 * Cases shared by the cache suites with and without the daemon: with the
 * daemon, gitignored files are listed from the workspace context's index;
 * without it, they are walked on every run. Both must hash the same way.
 */
type RunCLI = (command: string, opts?: RunCmdOpts) => string;

const CACHE_HIT = 'read the output from the cache';

/** Whether `task` was served from the cache in a multi-task run's output. */
const fromCache = (task: string) =>
  new RegExp(`${task}.*\\[(local cache|remote cache|existing outputs match)`);

function ignoreGenerated(lib: string) {
  updateFile('.gitignore', (c) => `${c}\nlibs/${lib}/generated\n`);
}

export function hashesGitignoredFilesFromAnIncludeIgnoredFileset(
  runCLI: RunCLI
) {
  const lib = uniq('lib');
  runCLI(`generate @nx/js:lib libs/${lib}`);
  ignoreGenerated(lib);
  updateFile(`libs/${lib}/generated/schema.json`, '{"version":1}');
  updateFile(`libs/${lib}/generated/notes.md`, 'ignored by the input');
  updateJson(`libs/${lib}/project.json`, (c) => {
    c.targets['echo'] = {
      command: 'echo generated',
      cache: true,
      inputs: [
        { fileset: '{projectRoot}/generated/**/*.json', includeIgnored: true },
      ],
    };
    return c;
  });

  expect(runCLI(`echo ${lib}`)).not.toContain(CACHE_HIT);
  expect(runCLI(`echo ${lib}`)).toContain(CACHE_HIT);

  // A change to a matched gitignored file misses the cache.
  updateFile(`libs/${lib}/generated/schema.json`, '{"version":2}');
  expect(runCLI(`echo ${lib}`)).not.toContain(CACHE_HIT);

  // A change to a sibling the glob excludes still hits.
  updateFile(`libs/${lib}/generated/notes.md`, 'still ignored');
  expect(runCLI(`echo ${lib}`)).toContain(CACHE_HIT);

  // A new matching file is picked up without a configuration change.
  updateFile(`libs/${lib}/generated/extra.json`, '{}');
  expect(runCLI(`echo ${lib}`)).not.toContain(CACHE_HIT);

  const inputs = JSON.parse(
    runCLI(`show target ${lib}:echo inputs --json`, { silent: true })
  );
  expect(inputs.files).toEqual(
    expect.arrayContaining([
      `libs/${lib}/generated/extra.json`,
      `libs/${lib}/generated/schema.json`,
    ])
  );
  expect(inputs.files).not.toContain(`libs/${lib}/generated/notes.md`);
}

export function hashesAGeneratedInputAfterTheTaskThatWritesIt(runCLI: RunCLI) {
  const lib = uniq('lib');
  runCLI(`generate @nx/js:lib libs/${lib}`);
  ignoreGenerated(lib);
  updateFile(`libs/${lib}/schema.txt`, 'version 1');
  updateFile(
    `libs/${lib}/codegen.js`,
    `const { mkdirSync, readFileSync, writeFileSync } = require('fs');
mkdirSync('libs/${lib}/generated', { recursive: true });
writeFileSync(
  'libs/${lib}/generated/out.json',
  JSON.stringify({ schema: readFileSync('libs/${lib}/schema.txt', 'utf8') })
);
`
  );
  updateJson(`libs/${lib}/project.json`, (c) => {
    c.targets['codegen'] = {
      command: `node libs/${lib}/codegen.js`,
      cache: true,
      inputs: ['{projectRoot}/schema.txt', '{projectRoot}/codegen.js'],
      outputs: ['{projectRoot}/generated'],
    };
    // Reads only what codegen writes, so its hash must be taken after
    // codegen has run in the same invocation.
    c.targets['consume'] = {
      command: 'echo consumed',
      cache: true,
      dependsOn: ['codegen'],
      inputs: [
        { fileset: '{projectRoot}/generated/**/*', includeIgnored: true },
      ],
    };
    return c;
  });
  const consume = `${lib}:consume`;

  runCLI(`run ${consume}`);
  expect(runCLI(`run ${consume}`)).toMatch(fromCache(consume));

  // codegen's own input changes; consume's inputs on disk are still last
  // run's until codegen runs. A hash taken before that would replay a stale
  // result.
  updateFile(`libs/${lib}/schema.txt`, 'version 2');
  expect(runCLI(`run ${consume}`)).not.toMatch(fromCache(consume));
  expect(runCLI(`run ${consume}`)).toMatch(fromCache(consume));
}

export function followsDeletesAndMovesUnderAGitignoredDirectory(
  runCLI: RunCLI
) {
  const lib = uniq('lib');
  runCLI(`generate @nx/js:lib libs/${lib}`);
  ignoreGenerated(lib);
  updateFile(`libs/${lib}/generated/a.json`, '"a"');
  updateFile(`libs/${lib}/generated/sub/b.json`, '"b"');
  updateFile(`libs/${lib}/generated/sub/c.json`, '"c"');
  updateJson(`libs/${lib}/project.json`, (c) => {
    c.targets['echo'] = {
      command: 'echo generated',
      cache: true,
      inputs: [
        { fileset: '{projectRoot}/generated/**/*.json', includeIgnored: true },
      ],
    };
    return c;
  });
  const run = () => runCLI(`echo ${lib}`);

  run();
  expect(run()).toContain(CACHE_HIT);

  // A deleted file leaves the inputs.
  removeFile(`libs/${lib}/generated/a.json`);
  expect(run()).not.toContain(CACHE_HIT);
  expect(run()).toContain(CACHE_HIT);

  // A moved directory's files leave under the old names and arrive under
  // the new ones.
  renameFile(`libs/${lib}/generated/sub`, `libs/${lib}/generated/moved`);
  expect(run()).not.toContain(CACHE_HIT);
  expect(run()).toContain(CACHE_HIT);

  // Moved back, the inputs are exactly what they were before the move, so
  // that run's result is reused.
  renameFile(`libs/${lib}/generated/moved`, `libs/${lib}/generated/sub`);
  expect(run()).toContain(CACHE_HIT);

  // A deleted directory takes every file under it.
  removeFile(`libs/${lib}/generated/sub`);
  expect(run()).not.toContain(CACHE_HIT);
  const inputs = JSON.parse(
    runCLI(`show target ${lib}:echo inputs --json`, { silent: true })
  );
  expect(
    inputs.files.filter((f: string) => f.startsWith(`libs/${lib}/generated/`))
  ).toEqual([]);
}
