import {
  checkFilesExist,
  cleanupProject,
  newProject,
  removeFile,
  runCLI,
  runCommand,
  tmpProjPath,
  updateFile,
  updateJson,
} from '@nx/e2e-utils';
import { existsSync } from 'fs';

import { createDotNetProject } from './utils/create-dotnet-project';

/**
 * End-to-end coverage for splitting a .NET test target.
 *
 * Everything here is asserted against a real MSBuild evaluation and a real
 * Microsoft.Testing.Platform run, which is the only place three things are
 * actually exercised: that the emitted filters select what we think they do,
 * that a newly added test class shows up without clearing the cache, and that
 * Nx refuses to run split tasks without Nx Cloud.
 */
describe('.NET Plugin - Test Atomizer', () => {
  const project = 'Acme.IntegrationTests';
  // `dotnet new` creates the project in a folder named after it at the
  // workspace root, so the project root and the project name coincide.
  const projectRoot = project;

  /** `nx show project` for the split project. */
  const showProject = () =>
    JSON.parse(
      runCLI(`show project ${project} --json`, { silenceError: true })
    );

  const ciTargets = () =>
    Object.keys(showProject().targets)
      .filter((name) => name.startsWith('test-ci--'))
      .sort();

  beforeAll(() => {
    newProject({ packages: [] });
    runCLI(`add @nx/dotnet`);

    createDotNetProject({ name: project, type: 'mstest' });

    // Patch the generated project rather than replacing it, so the target
    // framework and MSTest version stay whatever the installed SDK's template
    // produces. Only the platform opt-in is added.
    updateFile(`${projectRoot}/${project}.csproj`, (content) =>
      content.replace(
        '</PropertyGroup>',
        `  <OutputType>Exe</OutputType>
    <EnableMSTestRunner>true</EnableMSTestRunner>
    <TestingPlatformDotnetTestSupport>true</TestingPlatformDotnetTestSupport>
  </PropertyGroup>`
      )
    );

    // The template ships a sample test class, which would show up as another
    // split target and make the expected target lists depend on the SDK version.
    for (const sample of ['UnitTest1.cs', 'Test1.cs']) {
      if (existsSync(tmpProjPath(`${projectRoot}/${sample}`))) {
        removeFile(`${projectRoot}/${sample}`);
      }
    }

    updateFile(
      `${projectRoot}/LoginTests.cs`,
      `using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace Acme.Integration;

[TestClass]
public class LoginTests
{
    [TestMethod] public void Succeeds() { Assert.IsTrue(true); }
    [TestMethod] public void SucceedsWithMfa() { Assert.IsTrue(true); }
}
`
    );

    // Guards the preprocessor handling: `#if !DEBUG` reads as active when the
    // parse has no symbols, so this class would get a target that the Debug
    // build never produces, failing that task on every run.
    updateFile(
      `${projectRoot}/ReleaseOnlyTests.cs`,
      `using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace Acme.Integration;

#if !DEBUG
[TestClass]
public class ReleaseOnlyTests
{
    [TestMethod] public void NotCompiledInDebug() { Assert.IsTrue(true); }
}
#endif
`
    );

    updateFile(
      `${projectRoot}/CheckoutTests.cs`,
      `using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace Acme.Integration;

[TestClass]
public class CheckoutTests
{
    [TestMethod] public void Completes() { Assert.IsTrue(true); }
}
`
    );

    // The project was restored by `dotnet new` before OutputType changed, so
    // restore again to keep the assets file in step with the edited project.
    // Without this, the `--no-build` split tasks fail on stale assets.
    runCommand('dotnet restore', { cwd: tmpProjPath(projectRoot) });

    // A second registration scoped by `include` is how a single project opts in
    // without changing behavior for every other .NET project in the workspace.
    updateJson('nx.json', (json) => {
      json.plugins.push({
        plugin: '@nx/dotnet',
        include: [`${projectRoot}/**`],
        options: { test: { ciTargetName: 'test-ci' } },
      });
      return json;
    });
  });

  afterAll(() => cleanupProject());

  describe('generated targets', () => {
    it('should create one target per test class plus a parent', () => {
      // ReleaseOnlyTests is absent: it sits under `#if !DEBUG`, which the
      // project's own DefineConstants resolve as excluded.
      expect(ciTargets()).toEqual([
        'test-ci--Acme.Integration.CheckoutTests',
        'test-ci--Acme.Integration.LoginTests',
      ]);

      const parent = showProject().targets['test-ci'];
      expect(parent.executor).toEqual('nx:noop');
      expect(parent.metadata.nonAtomizedTarget).toEqual('test');
    });

    it('should group the targets with the parent listed first', () => {
      const groups = showProject().metadata.targetGroups;

      expect(groups['TEST (CI)'][0]).toEqual('test-ci');
      expect(groups['TEST (CI)']).toHaveLength(3);
    });

    it('should leave other .NET projects unsplit', () => {
      createDotNetProject({ name: 'Acme.UnitTests', type: 'mstest' });

      const targets = Object.keys(
        JSON.parse(runCLI(`show project Acme.UnitTests --json`)).targets
      );

      // The `include` on the second registration is what scopes splitting to
      // one project; without it every test project would split.
      expect(targets.filter((name) => name.startsWith('test-ci'))).toEqual([]);
    });
  });

  describe('cache invalidation', () => {
    it('should pick up a new test class without clearing the cache', () => {
      // The regression this guards: split targets are derived from C# sources,
      // but the analyzer's cache is keyed on project files, which a new test
      // class does not change. Deliberately no `nx reset` here.
      expect(ciTargets()).not.toContain(
        'test-ci--Acme.Integration.SearchTests'
      );

      updateFile(
        `${projectRoot}/SearchTests.cs`,
        `using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace Acme.Integration;

[TestClass]
public class SearchTests
{
    [TestMethod] public void Finds() { Assert.IsTrue(true); }
}
`
      );

      expect(ciTargets()).toContain('test-ci--Acme.Integration.SearchTests');
    });
  });

  describe('running a split task', () => {
    it('should run only its own class and write its own results', () => {
      const output = runCLI(
        `run ${project}:"test-ci--Acme.Integration.CheckoutTests"`
      );

      expect(output).toContain('Successfully ran target');

      // Its own subdirectory, so replaying one task from cache cannot restore
      // another's results. No reporter is enabled by the plugin, so this only
      // asserts the directory is the one the task was pointed at.
      checkFilesExist(
        `${projectRoot}/TestResults/Acme.Integration.CheckoutTests`
      );

      // The other class's directory is untouched by this task.
      expect(
        existsSync(
          tmpProjPath(`${projectRoot}/TestResults/Acme.Integration.LoginTests`)
        )
      ).toBe(false);
    });
  });

  describe('Nx Cloud requirement', () => {
    it('should refuse to run the parent without Nx Cloud', () => {
      // Splitting a suite across a single machine is slower than not splitting
      // it, so Nx core hard-exits rather than letting it run.
      const output = runCLI(`run ${project}:test-ci`, { silenceError: true });

      expect(output).toContain(
        `The ${project}:test-ci task should only be run with Nx Cloud.`
      );
    });

    it('should run the parent when the check is bypassed', () => {
      const output = runCommand(`npx nx run ${project}:test-ci`, {
        env: { ...process.env, NX_SKIP_ATOMIZER_VALIDATION: 'true' },
      });

      expect(output).toContain('Successfully ran target');
    });
  });
});
