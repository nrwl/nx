import {
  cleanupProject,
  createFile,
  newProject,
  runCLI,
  tmpProjPath,
  uniq,
  updateFile,
} from '@nx/e2e-utils';
import { readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

import { createGradleProject } from './utils/create-gradle-project';

/**
 * Every one of these declares the SAME edge — a dependency on `:list:jar`. Gradle accepts all of
 * them, and each reaches the plugin's dependsOn handling by a different route. A form the plugin
 * fails to see through loses the edge, `list.jar` never becomes an input, and the dependent
 * replays a cached output after its dependency changed: a false cache hit.
 */
const DEPENDS_ON_FORMS = [
  // The #36668 shape: resolving this through Gradle's build-scoped resolver deadlocks.
  { task: 'pkgQualifiedPath', decl: 'dependsOn(":list:jar")' },
  // A list is stored as ONE element of the dependsOn set, so its paths are invisible to a flat scan.
  { task: 'pkgNestedList', decl: 'dependsOn(listOf(":list:jar"))' },
  // Gradle resolves a Callable by calling it; so must the plugin, or the edge is never seen.
  {
    task: 'pkgCallable',
    decl: 'dependsOn(Callable { ":list:jar" })',
  },
  // A Provider hides the path one level deeper than the flattening looks.
  { task: 'pkgProvider', decl: 'dependsOn(provider { ":list:jar" })' },
  // The path sits inside a FileCollection's builtBy, whose own resolver is the deadlocking one.
  {
    task: 'pkgBuiltBy',
    decl: 'dependsOn(files("extra-input.txt").builtBy(":list:jar"))',
  },
  // The edge comes from the inputs half of getTaskDependencies(), not from dependsOn at all;
  // the unrelated qualified path only forces the bypass.
  {
    task: 'pkgInputWired',
    decl: 'dependsOn(":utilities:jar")\n    inputs.files(files("extra-input.txt").builtBy(":list:jar"))',
  },
  // Nothing qualified in dependsOn at all: the path hides under the inputs, and the plugin must
  // find it there or hand the string to the deadlocking resolver.
  {
    task: 'pkgInputsOnly',
    decl: 'inputs.files(files("extra-input.txt").builtBy(":list:jar"))',
  },
  // A bare Buildable: Gradle's walker visits its dependencies without going through the hook
  // that swaps in the safe resolver.
  {
    task: 'pkgBuildable',
    decl: 'dependsOn(object : Buildable { override fun getBuildDependencies() = files("extra-input.txt").builtBy(":list:jar").buildDependencies })',
  },
];

const taskKotlin = (name: string, decl: string) => `
tasks.register("${name}") {
    ${decl}
    outputs.file(layout.buildDirectory.file("${name}.txt"))
    doLast {
        val marker = outputs.files.singleFile
        marker.parentFile.mkdirs()
        marker.writeText("${name}\\n")
    }
}
`;

// `gradle init --split-project` generates no root build file, so adding one that configures a
// subproject owning no build file of its own reproduces the shape Kafka's build has.
describe('Gradle task dependency resolution', () => {
  const gradleProjectName = uniq('my-gradle-project');

  beforeAll(() => {
    newProject({ packages: [] });
    createGradleProject(gradleProjectName, 'kotlin');

    // `core` is in the build but owns no build file — it exists only as a block in the root build
    // file. Its task takes the same `:list:jar` edge, so it is held to the same cache rules.
    createFile('core/README.md', 'Configured from the root build file.\n');
    updateFile(
      'settings.gradle.kts',
      (content) => `${content}\ninclude("core")\n`
    );
    createFile(
      'build.gradle.kts',
      `project(":core") {
${taskKotlin('coreReport', 'dependsOn(":list:jar")')}
}
`
    );

    createFile('app/extra-input.txt', 'a plain input file\n');
    updateFile('app/build.gradle.kts', (content) =>
      [
        // Written as a bare name: inside a script `java` is the extension, not the package.
        `import java.util.concurrent.Callable\nimport org.gradle.api.Buildable\n${content}`,
        ...DEPENDS_ON_FORMS.map(({ task, decl }) => taskKotlin(task, decl)),
        // No task at this path, so the dependency set is knowably short. Never run: Gradle
        // itself rejects the path when planning it.
        taskKotlin(
          'pkgLostPath',
          'dependsOn(":list:jar")\n    dependsOn(":nowhere:jar")'
        ),
      ].join('\n')
    );

    runCLI(`add @nx/gradle`);
  });
  afterAll(() => cleanupProject());

  // A cache hit renders as "[local cache]", "[remote cache]", or, when the outputs on disk already
  // match, "[existing outputs match the cache]".
  const fromCache = (task: string) =>
    new RegExp(`${task}.*\\[(local cache|remote cache|existing outputs match)`);

  const dependents = [
    ...DEPENDS_ON_FORMS.map(({ task }) => `app:${task}`),
    'core:coreReport',
  ];
  const runAll = () =>
    runCLI(
      `run-many -p app,core -t ${dependents
        .map((id) => id.split(':')[1])
        .join(',')}`,
      { verbose: true }
    );

  it('should put a project configured from an ancestor build file into the graph', () => {
    const projects = runCLI('show projects');
    expect(projects).toContain('core');
    // The projects that do own a build file must survive the pairing too.
    expect(projects).toContain('app');
    expect(projects).toContain('list');
    expect(projects).toContain('utilities');

    // The node is only useful if it carries the task the ancestor registered on it.
    const core = JSON.parse(runCLI('show project core --json'));
    expect(Object.keys(core.targets)).toContain('coreReport');
  });

  it('should resolve every dependsOn form into a real edge', () => {
    // Reaching this at all means resolution did not deadlock: the report is generated inside a
    // task action, where resolving `:list:jar` through Gradle's build-scoped resolver blocks
    // forever on the build-lifecycle state lock.
    // Same-target edges are merged into one entry, so match on membership.
    const listJar = expect.objectContaining({
      target: 'jar',
      projects: expect.arrayContaining([expect.stringMatching(/list$/)]),
    });
    const app = JSON.parse(runCLI('show project app --json'));
    for (const { task } of DEPENDS_ON_FORMS) {
      expect(app.targets[task].dependsOn).toContainEqual(listJar);
    }
    const core = JSON.parse(runCLI('show project core --json'));
    expect(core.targets.coreReport.dependsOn).toContainEqual(listJar);
  });

  it('should not serve a cache hit after the dependency changes', () => {
    // Warm, then prove these actually cache — otherwise the assertion below passes for the wrong
    // reason, and a task that never caches can never expose a false hit.
    runAll();
    let output = runAll();
    for (const dependent of dependents) {
      expect(output).toMatch(fromCache(dependent));
    }

    // One change to the dependency's source. Every dependent declares `list.jar` as an input only
    // because its edge was resolved, so any form whose edge was lost replays a stale output here.
    const sourceFile = findFirstFile(
      join(tmpProjPath(), 'list/src/main/kotlin'),
      '.kt'
    );
    updateFile(
      relative(tmpProjPath(), sourceFile),
      (content) => `${content}\nfun dependsOnProbe(): Int = 7\n`
    );

    output = runAll();
    for (const dependent of dependents) {
      expect(output).not.toMatch(fromCache(dependent));
    }
  });

  it('should still hit cache when an unrelated file changes', () => {
    // The control for the test above: without it, inputs that over-declare to `**/*` would make
    // everything rebuild always, and "no false hit" would hold vacuously.
    runAll();
    createFile('list/notes.md', 'not an input\n');
    const output = runAll();
    for (const dependent of dependents) {
      expect(output).toMatch(fromCache(dependent));
    }
  });

  it('should fail open, not uncache, a target whose dependency set is short', () => {
    // Cacheability is Gradle's verdict; the plugin's blind spot is covered by over-declaring.
    const catchAll = { dependentTasksOutputFiles: '**/*', transitive: true };
    const app = JSON.parse(runCLI('show project app --json'));
    expect(app.targets.pkgLostPath.cache).toBe(true);
    expect(app.targets.pkgLostPath.inputs).toContainEqual(catchAll);
    // The resolved siblings are the control: fail-open must not become the default.
    for (const { task } of DEPENDS_ON_FORMS) {
      expect(app.targets[task].cache).toBe(true);
      expect(app.targets[task].inputs).not.toContainEqual(catchAll);
    }
  });
});

function findFirstFile(dir: string, extension: string): string {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      const found = findFirstFile(full, extension);
      if (found) {
        return found;
      }
    } else if (entry.endsWith(extension)) {
      return full;
    }
  }
  return '';
}
