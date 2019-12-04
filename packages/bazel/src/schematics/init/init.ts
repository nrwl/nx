import {
  apply,
  chain,
  mergeWith,
  Rule,
  template,
  url
} from '@angular-devkit/schematics';
import {
  addDepsToPackageJson,
  readJsonInTree,
  updateJsonInTree
} from '@nrwl/workspace';
import ignore from 'ignore';
import { bazelVersion, iBazelVersion, patchVersion } from '../utils/versions';
import { noop } from 'rxjs';

function updateGitIgnore(): Rule {
  return host => {
    if (!host.exists('.gitignore')) {
      return;
    }

    const ig = ignore();
    ig.add(host.read('.gitignore').toString());

    if (!ig.ignores('bazel-out')) {
      const content = `${host
        .read('.gitignore')!
        .toString('utf-8')
        .trimRight()}\nbazel-*\n`;
      host.overwrite('.gitignore', content);
    }
  };
}

const addRequiredPackages = addDepsToPackageJson(
  {},
  {
    'patch-package': patchVersion,
    '@bazel/bazel': bazelVersion,
    '@bazel/ibazel': iBazelVersion
  },
  true
);

const addPostInstall = updateJsonInTree('package.json', json => {
  if (!json.scripts) {
    json.scripts = {};
  }

  if (
    json.scripts['postinstall'] &&
    json.scripts['postinstall'].includes('patch-package')
  ) {
    return json;
  }

  if (json.scripts.postinstall) {
    if (!(json.scripts.postinstall as string).includes('patch-package')) {
      json.scripts.postinstall = `patch-package && ${json.script.postinstall}`;
    }
  } else {
    json.scripts.postinstall = 'patch-package';
  }
  return json;
});

function addFiles() {
  return host => {
    if (host.exists('patches/BUILD.bazel')) {
      return noop;
    }
    return mergeWith(
      apply(url('./files/root'), [
        template({
          tmpl: ''
        }),
        () => {
          if (host.exists('BUILD.bazel')) {
            host.delete('BUILD.bazel');
          }
        }
      ])
    );
  };
}

export default (): Rule => {
  return host => {
    const packageJson = readJsonInTree(host, 'package.json');
    return chain([
      updateGitIgnore(),
      !packageJson.devDependencies['@bazel/bazel'] ? addRequiredPackages : noop,
      addPostInstall,
      addFiles()
    ]);
  };
};
