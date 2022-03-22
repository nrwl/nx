import { formatFiles, logger, readJson, Tree, updateJson } from '@nrwl/devkit';
import { sortObjectByKeys } from 'nx/src/utils/object-sort';
import { checkAndCleanWithSemver } from '@nrwl/workspace';
import { satisfies } from 'semver';
import {
  nestJsSchematicsVersion,
  nestJsVersion8,
  rxjsVersion7,
} from '../../utils/versions';

export default async function update(tree: Tree) {
  const shouldUpdate = await isUpdatable(tree);

  if (!shouldUpdate) {
    return;
  }

  updateVersion(tree);

  await formatFiles(tree);

  return (): void => {
    logger.info(
      'Please make sure to run npm install or yarn install to get the latest packages added by this migration'
    );
  };
}

async function isUpdatable(tree: Tree) {
  const json = readJson(tree, 'package.json');

  if (json.dependencies['@angular/core']) {
    const rxjs = checkAndCleanWithSemver('rxjs', json.dependencies['rxjs']);
    if (satisfies(rxjs, rxjsVersion7)) {
      return true;
    }

    const { Confirm } = require('enquirer');
    const prompt = new Confirm({
      name: 'question',
      message: 'Do you want to update to RxJS 7 + Nest 8?',
      initial: true,
    });

    return await prompt.run();
  }

  return true;
}

function updateVersion(tree: Tree) {
  updateJson(tree, 'package.json', (json) => {
    json.dependencies = json.dependencies || {};
    json.devDependencies = json.devDependencies || {};

    const rxjs = checkAndCleanWithSemver('rxjs', json.dependencies['rxjs']);

    json.dependencies = {
      ...json.dependencies,
      '@nestjs/common': nestJsVersion8,
      '@nestjs/core': nestJsVersion8,
      rxjs: satisfies(rxjs, rxjsVersion7)
        ? json.dependencies['rxjs']
        : rxjsVersion7,
    };

    if (json.dependencies['@nestjs/platform-express']) {
      json.dependencies['@nestjs/platform-express'] = nestJsVersion8;
    }

    if (json.dependencies['@nestjs/platform-fastify']) {
      json.dependencies['@nestjs/platform-fastify'] = nestJsVersion8;
    }

    json.devDependencies = {
      ...json.devDependencies,
      '@nestjs/schematics': nestJsSchematicsVersion,
      '@nestjs/testing': nestJsVersion8,
    };

    if (json.devDependencies['jasmine-marbles']) {
      json.devDependencies['jasmine-marbles'] = '~0.9.1';
    }

    json.dependencies = sortObjectByKeys(json.dependencies);
    json.devDependencies = sortObjectByKeys(json.devDependencies);

    return json;
  });
}
