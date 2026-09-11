// Synthetic fixture and native workspace-query benchmark. No real workspace data.
const fs = require('node:fs');
const path = require('node:path');
const { performance } = require('node:perf_hooks');
const { createHash } = require('node:crypto');
const [mode, ...args] = process.argv.slice(2);
if (mode === 'fixture') {
  const [directory, projectsArg = '100', filesArg = '1000'] = args;
  const projects = Number(projectsArg),
    files = Number(filesArg);
  if (!directory || fs.existsSync(directory))
    throw Error('Use a new fixture directory');
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, '.gitignore'), 'node_modules/\n.nx/\n');
  fs.writeFileSync(
    path.join(directory, 'package.json'),
    JSON.stringify({ name: 'synthetic-workspace', private: true })
  );
  fs.writeFileSync(path.join(directory, 'lockfile.json'), '{"version":1}\n');
  for (let i = 0; i < projects; i++) {
    const folder = path.join(directory, `packages/project-${i}/src`);
    fs.mkdirSync(folder, { recursive: true });
    for (let j = 0; j < files; j++)
      fs.writeFileSync(
        path.join(folder, `file-${j}.${j % 10 === 0 ? 'spec.' : ''}ts`),
        `export const value = ${i * files + j};\n`
      );
  }
  fs.writeFileSync(
    path.join(directory, 'fixture.json'),
    JSON.stringify({ projects, files })
  );
  console.log(
    JSON.stringify({
      projects,
      filesPerProject: files,
      generatedFiles: projects * files + 4,
    })
  );
} else if (mode === 'measure') {
  const [bindingArg, directory, cache, operation = 'single'] = args;
  const binding = fs.realpathSync(bindingArg);
  const { WorkspaceContext } = require(binding);
  const { projects } = JSON.parse(
    fs.readFileSync(path.join(directory, 'fixture.json'), 'utf8')
  );
  const groups = Array.from({ length: projects }, (_, i) => [
    `packages/project-${i}/**/*`,
    'lockfile.json',
  ]);
  const context = new WorkspaceContext(
    fs.realpathSync(directory),
    path.resolve(cache)
  );
  (async () => {
    await context.ready();
    global.gc?.();
    const cpu = process.cpuUsage(),
      start = performance.now();
    let output;
    if (operation === 'single')
      output = groups.map((globs) => context.hashFilesMatchingGlob(globs));
    else if (operation === 'batch')
      output = context.hashFilesMatchingGlobs(groups);
    else if (operation === 'glob')
      output = groups.map((globs) => context.glob(globs, ['**/*.spec.ts']));
    else if (operation === 'multi')
      output = context.multiGlob(
        groups.map((g) => g[0]),
        ['**/*.spec.ts']
      );
    else if (operation === 'broad')
      output = context.hashFilesMatchingGlob(['**/*']);
    else throw Error('Unknown operation');
    const elapsedMs = performance.now() - start,
      used = process.cpuUsage(cpu),
      peakRssMiB = process.resourceUsage().maxRSS / 1024;
    const digest = createHash('sha256')
      .update(JSON.stringify(output))
      .digest('hex');
    const nativeSha256 = createHash('sha256')
      .update(fs.readFileSync(binding))
      .digest('hex');
    console.log(
      JSON.stringify({
        operation,
        projects,
        elapsedMs,
        cpuMs: (used.user + used.system) / 1000,
        peakRssMiB,
        digest,
        nativeSha256,
      })
    );
  })().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
} else {
  throw Error(
    'Usage: fixture <new-directory> [projects] [files-per-project] | measure <binding.node> <fixture> <cache> <single|batch|glob|multi|broad>'
  );
}
