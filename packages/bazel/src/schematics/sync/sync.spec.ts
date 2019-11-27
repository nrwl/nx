import { Tree } from '@angular-devkit/schematics';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';
import { runSchematic } from '../utils/testing';
import { stripIndents } from '@angular-devkit/core/src/utils/literals';

describe('@nrwl/bazel:sync', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = Tree.empty();
    tree = createEmptyWorkspace(tree);
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
          sha256 = "c612d6b76eaa17540e8b8c806e02701ed38891460f9ba3303f4424615437887a",
          urls = ["https://github.com/bazelbuild/rules_nodejs/releases/download/0.42.1/rules_nodejs-0.42.1.tar.gz"],
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
          data = ["//patches"],
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

      expect(contents).toContain(stripIndents`exports_files(
           [
             "workspace.json",
             "package.json",
             "nx.json",
             "tsconfig.json",
             "tslint.json",
             
           ],
           visibility = ["//:__subpackages__"],
         )
      `);
    });
  });
});
