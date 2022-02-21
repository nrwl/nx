import * as devkit from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { karmaGenerator } from './karma';

describe('karma', () => {
  let tree: devkit.Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should do nothing when karma is already installed', () => {
    jest.spyOn(devkit, 'generateFiles');
    jest.spyOn(devkit, 'addDependenciesToPackageJson');
    devkit.updateJson(tree, 'package.json', (json) => {
      json.devDependencies = { karma: '~5.0.0' };
      return json;
    });

    karmaGenerator(tree, {});

    expect(devkit.generateFiles).not.toHaveBeenCalled();
    expect(devkit.addDependenciesToPackageJson).not.toHaveBeenCalled();
  });

  it('should add karma dependencies', () => {
    karmaGenerator(tree, {});

    const { devDependencies } = devkit.readJson(tree, 'package.json');
    expect(devDependencies['karma']).toBeDefined();
    expect(devDependencies['karma-chrome-launcher']).toBeDefined();
    expect(devDependencies['karma-coverage']).toBeDefined();
    expect(devDependencies['karma-jasmine']).toBeDefined();
    expect(devDependencies['karma-jasmine-html-reporter']).toBeDefined();
    expect(devDependencies['jasmine-core']).toBeDefined();
    expect(devDependencies['jasmine-spec-reporter']).toBeDefined();
    expect(devDependencies['@types/jasmine']).toBeDefined();
  });

  it('should add karma configuration', () => {
    karmaGenerator(tree, {});

    expect(tree.exists('karma.conf.js')).toBeTruthy();
  });
});
