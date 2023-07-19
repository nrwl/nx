import {
  cleanupProject,
  newProject,
  runCLI,
  tmpProjPath,
  uniq,
  updateFile,
} from '@nx/e2e/utils';

describe('nx cmd', () => {
  let proj: string;
  const projects: string[] = [
    uniq('zero-'),
    uniq('one-'),
    uniq('two-'),
    uniq('three-'),
    uniq('four-'),
    uniq('five-'),
    uniq('six-'),
    uniq('seven-'),
  ];

  const addDependency = (src: string, dep: string) =>
    updateFile(
      `libs/${src}/src/index.ts`,
      (content) => `import "@${proj}/${dep}";\n${content}`
    );

  beforeAll(() => {
    proj = newProject();

    projects.forEach((proj) => runCLI(`generate @nx/js:lib ${proj}`));

    addDependency(projects[0], projects[1]);
    addDependency(projects[1], projects[2]);
    addDependency(projects[2], projects[0]);

    addDependency(projects[3], projects[4]);
    addDependency(projects[3], projects[5]);
    addDependency(projects[4], projects[6]);
  });
  afterAll(() => cleanupProject());

  describe('with --all', () => {
    it('should run command on all projects, respecting dependencies', () => {
      const output = runCLI(`cmd --all --parallel 1 -- basename "\\$(pwd)"`, {
        env: { ...process.env, NX_DAEMON: 'false' },
      });
      projects.forEach((proj) => expect(output).toContain(proj));

      expect(output.indexOf(projects[6])).toBeLessThan(
        output.indexOf(projects[4])
      );
      expect(output.indexOf(projects[5])).toBeLessThan(
        output.indexOf(projects[3])
      );
      expect(output.indexOf(projects[4])).toBeLessThan(
        output.indexOf(projects[3])
      );
    });

    describe('with --exclude', () => {
      it('should run command on all projects except excluded ones', () => {
        const excluded = [projects[0], projects[4], projects[7]];
        const included = projects.filter((proj) => !excluded.includes(proj));

        const output = runCLI(
          `cmd --all --exclude ${excluded.join(',')} -- basename "\\$(pwd)"`,
          {
            env: { ...process.env, NX_DAEMON: 'false' },
          }
        );

        included.forEach((proj) => expect(output).toContain(proj));
        excluded.forEach((proj) => expect(output).not.toContain(proj));
      });
    });
  });

  describe('with --projects', () => {
    it('should run command on specified projects', () => {
      const included = [projects[1], projects[3], projects[6]];
      const excluded = projects.filter((p) => !included.includes(p));

      const output = runCLI(
        `cmd --projects ${included.join(',')} -- basename "\\$(pwd)"`,
        {
          env: { ...process.env, NX_DAEMON: 'false' },
        }
      );

      included.forEach((proj) => expect(output).toContain(proj));
      excluded.forEach((proj) => expect(output).not.toContain(proj));
    });

    describe('with --exclude', () => {
      it('should run command on all projects except excluded ones', () => {
        const included = [projects[1], projects[3]];
        const excluded = projects.filter((p) => !included.includes(p));

        const output = runCLI(
          `cmd --projects ${[...included, projects[6]].join(',')} --exclude ${
            projects[6]
          } -- basename "\\$(pwd)"`,
          {
            env: { ...process.env, NX_DAEMON: 'false' },
          }
        );

        included.forEach((proj) => expect(output).toContain(proj));
        excluded.forEach((proj) => expect(output).not.toContain(proj));
      });
    });

    it('should run command and replace workspaceRoot, projectRoot, and projectName', () => {
      const included = [projects[2], projects[5], projects[7]];

      const output = runCLI(
        `cmd --projects ${included.join(
          ','
        )} --parallel 1 -- echo "\\$(basename \\$(pwd)) {workspaceRoot} {projectName} {projectRoot}"`,
        {
          env: { ...process.env, NX_DAEMON: 'false' },
        }
      );

      const strippedOutput = output.replace(/private\//g, '');
      expect(strippedOutput).toContain(
        `${projects[2]} ${tmpProjPath()} ${projects[2]} libs/${projects[2]}`
      );
      expect(strippedOutput).toContain(
        `${projects[5]} ${tmpProjPath()} ${projects[5]} libs/${projects[5]}`
      );
      expect(strippedOutput).toContain(
        `${projects[7]} ${tmpProjPath()} ${projects[7]} libs/${projects[7]}`
      );
    });
  });
});
