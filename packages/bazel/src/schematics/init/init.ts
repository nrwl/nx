import {
  apply,
  chain,
  mergeWith,
  Rule,
  template,
  url,
} from '@angular-devkit/schematics';
import { addDepsToPackageJson, readJsonInTree } from '@nrwl/workspace';
import ignore from 'ignore';
import { bazelVersion, iBazelVersion } from '../utils/versions';
import { noop } from 'rxjs';

function updateGitIgnore(): Rule {
  return (host) => {
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

const updateDependencies = addDepsToPackageJson(
  {},
  {
    '@bazel/bazel': bazelVersion,
    '@bazel/ibazel': iBazelVersion,
  },
  true
);

function addFiles() {
  return (host) => {
    if (host.exists('/.bazelrc')) {
      return noop;
    }
    return mergeWith(
      apply(url('./files/root'), [
        template({
          tmpl: '',
        }),
      ])
    );
  };
}

export default (): Rule => {
  return (host) => {
    const packageJson = readJsonInTree(host, 'package.json');
    return chain([
      updateGitIgnore(),
      !packageJson.devDependencies['@bazel/bazel'] ? updateDependencies : noop,
      addFiles(),
    ]);
  };
};
