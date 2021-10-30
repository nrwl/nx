import {
  addDependenciesToPackageJson,
  GeneratorCallback,
  readJson,
  Tree,
} from '@nrwl/devkit';
import { minVersion, satisfies } from 'semver';
import {
  nestJsSchematicsVersion8,
  nestJsVersion8,
  rxjsVersion7,
} from '../../utils/versions';

const { Confirm } = require('enquirer');

export async function update(tree: Tree) {
  const packageJson = readJson(tree, 'package.json');
  let task: undefined | GeneratorCallback = undefined;

  if (packageJson.dependencies['@angular/common']) {
    const rxjs = minVersion(packageJson.dependencies['rxjs']).version;
    if (satisfies(rxjs, rxjsVersion7)) {
      task = replaceInPackageJson(tree, packageJson);
    } else {
      const prompt = new Confirm({
        name: 'question',
        message: 'Do you want to update to RxJS 7 + Nest 8?',
        initial: true,
      });

      const response = await prompt.run();

      if (response) {
        task = replaceInPackageJson(tree, packageJson);
      }
    }
  } else {
    task = replaceInPackageJson(tree, packageJson);
  }

  return task;
}

function replaceInPackageJson(tree: Tree, packageJson: Record<string, string>) {
  let dependencies: Record<string, string> = {
    '@nestjs/common': nestJsVersion8,
    '@nestjs/core': nestJsVersion8,
    '@nestjs/schematics': nestJsSchematicsVersion8,
    '@nestjs/testing': nestJsVersion8,
  };

  if (packageJson.dependencies['@nestjs/platform-express']) {
    dependencies = {
      ...dependencies,
      '@nestjs/platform-express': nestJsVersion8,
    };
  }

  if (packageJson.dependencies['@nestjs/platform-fastify']) {
    dependencies = {
      ...dependencies,
      '@nestjs/platform-fastify': nestJsVersion8,
    };
  }

  return addDependenciesToPackageJson(tree, dependencies, {});
}
