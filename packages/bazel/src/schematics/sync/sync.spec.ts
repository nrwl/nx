import { chain, Tree } from '@angular-devkit/schematics';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';
import { callRule, runSchematic } from '../utils/testing';
import { stripIndents } from '@angular-devkit/core/src/utils/literals';
import { updateJsonInTree } from '@nrwl/workspace/src/utils/ast-utils';
import { updateWorkspace } from '@nrwl/workspace/src/utils/workspace';
import { rulesNodeJSSha, rulesNodeJSVersion } from '../utils/versions';
import { NxJson } from '@nrwl/workspace/src/core/shared-interfaces';

describe('@nrwl/bazel:sync', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = Tree.empty();
    tree = createEmptyWorkspace(tree);
    tree.create('tools/schematics/custom/index.ts', '');
  });

  describe('WORKSPACE', () => {
    it('should be created', async () => {
      const result = await runSchematic('sync', {}, tree);

      expect(result.exists('WORKSPACE')).toEqual(true);
    });

    it('should name the workspace validly', async () => {
      const result = await runSchematic('sync', {}, tree);

      const contents = stripIndents`${result.readContent('WORKSPACE')}`;

      expect(contents).toContain('name = "test_name"');
    });

    it('should import nodejs bazel rules', async () => {
      const result = await runSchematic('sync', {}, tree);

      const contents = stripIndents`${result.readContent('WORKSPACE')}`;

      expect(contents).toContain(stripIndents`
        load("@bazel_tools//tools/build_defs/repo:http.bzl", "http_archive")
        http_archive(
          name = "build_bazel_rules_nodejs",
          sha256 = "${rulesNodeJSSha}",
          urls = ["https://github.com/bazelbuild/rules_nodejs/releases/download/${rulesNodeJSVersion}/rules_nodejs-${rulesNodeJSVersion}.tar.gz"],
        )
      `);
    });

    it('should import yarn bazel rules and install', async () => {
      const result = await runSchematic('sync', {}, tree);

      const contents = stripIndents`${result.readContent('WORKSPACE')}`;

      expect(contents).toContain(stripIndents`
        load("@build_bazel_rules_nodejs//:index.bzl", "yarn_install")
        
        yarn_install(
          # Name this npm so that Bazel Label references look like @npm//package
          name = "npm",
          package_json = "//:package.json",
          yarn_lock = "//:yarn.lock",
        )
        
        # Install any Bazel rules which were extracted earlier by the yarn_install rule.
        load("@npm//:install_bazel_dependencies.bzl", "install_bazel_dependencies")
        
        install_bazel_dependencies()
      `);
    });
  });

  describe('root BUILD.bazel', () => {
    it('should be created', async () => {
      const result = await runSchematic('sync', {}, tree);
      expect(result.exists('BUILD.bazel')).toEqual(true);
    });

    it('should export root files', async () => {
      const result = await runSchematic('sync', {}, tree);

      const contents = stripIndents`${result.readContent('BUILD.bazel')}`;

      expect(contents).toContain(stripIndents`filegroup(
        name = "root-files",
        srcs = [
           # Root Files
           "workspace.json",
           "package.json",
           "nx.json",
           "tsconfig.base.json",
           "tslint.json",
           
        ],
        visibility = ["//:__subpackages__"],
      )

      `);
    });
  });

  describe('Project BUILD files', () => {
    beforeEach(async () => {
      tree = await callRule(
        chain([
          updateWorkspace((workspace) => {
            workspace.projects.add({
              name: 'proj',
              root: 'proj',
              targets: {
                build: {
                  builder: '@nrwl/web:build',
                  options: {},
                  configurations: {
                    production: {},
                  },
                },
                serve: {
                  builder: '@nrwl/web:dev-server',
                  options: {},
                  configurations: {
                    production: {},
                  },
                },
                test: {
                  builder: '@nrwl/jest:jest',
                  options: {},
                },
              },
            });
            workspace.projects.add({
              name: 'proj2',
              root: 'proj2',
              targets: {
                build: {
                  builder: '@angular-devkit/build-angular:browser',
                  options: {},
                  configurations: {
                    production: {},
                  },
                },
                serve: {
                  builder: '@angular-devkit/build-angular:dev-server',
                  options: {},
                  configurations: {
                    production: {},
                  },
                },
                test: {
                  builder: '@angular-devkit/build-angular:karma',
                  options: {},
                },
              },
            });
          }),
          updateJsonInTree<NxJson>('nx.json', (json) => {
            json.projects['proj'] = {};
            json.projects['proj2'] = {};
            return json;
          }),
        ]),
        tree
      );
    });

    it('should be generated', async () => {
      const result = await runSchematic('sync', {}, tree);

      expect(result.exists('proj/BUILD.bazel')).toEqual(true);
      expect(result.exists('proj2/BUILD.bazel')).toEqual(true);
    });

    it('should generate build bazel targets', async () => {
      const result = await runSchematic('sync', {}, tree);

      const proj1BuildContents = stripIndents`${result.readContent(
        'proj/BUILD.bazel'
      )}`;

      expect(proj1BuildContents).toContain(stripIndents`
        nx(
            name = "build",
            args = [
                "run",
                "proj:build",
                "--outputPath=$(@D)",
            ],
            data = [
                ":proj",
                # Root Files
                "//:root-files",
                # Node Modules
                "@npm//:node_modules"
            ],
            output_dir = True,
        )
      `);
      expect(proj1BuildContents).toContain(stripIndents`
        nx(
            name = "build__production",
            args = [
                "run",
                "proj:build:production",
                "--outputPath=$(@D)",
            ],
            data = [
                ":proj",
                # Root Files
                "//:root-files",
                # Node Modules
                "@npm//:node_modules"
            ],
            output_dir = True,
        )
      `);
    });

    it('should generate non-build, non-test bazel targets', async () => {
      const result = await runSchematic('sync', {}, tree);

      const proj1BuildContents = stripIndents`${result.readContent(
        'proj/BUILD.bazel'
      )}`;

      expect(proj1BuildContents).toContain(stripIndents`
        nx(
            name = "serve",
            args = [
                "run",
                "proj:serve",
            ],
            data = [
                ":proj",
                # Root Files
                "//:root-files",
                # Node Modules
                "@npm//:node_modules"
            ],
        )
      `);
      expect(proj1BuildContents).toContain(stripIndents`
        nx(
            name = "serve__production",
            args = [
                "run",
                "proj:serve:production",
            ],
            data = [
                ":proj",
                # Root Files
                "//:root-files",
                # Node Modules
                "@npm//:node_modules"
            ],
        )
      `);
    });

    it('should generate test bazel targets', async () => {
      const result = await runSchematic('sync', {}, tree);

      const proj1BuildContents = stripIndents`${result.readContent(
        'proj/BUILD.bazel'
      )}`;

      expect(proj1BuildContents).toContain(stripIndents`
        nx_test(
            name = "test",
            args = [
                "run",
                "proj:test",
            ],
            data = [
                ":proj",
                # Root Files
                "//:root-files",
                # Node Modules
                "@npm//:node_modules"
            ],
        )
      `);
    });
  });
});
