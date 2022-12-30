import { Tree, writeJson, readJson } from '@nrwl/devkit';
import updateAngularEslintRules from './update-angular-eslint-rules';
import { createTree } from '@nrwl/devkit/testing';
import type { Linter } from 'eslint';

describe('12.3.1 - updateAngularEslintRules', () => {
  let tree: Tree;
  let eslintConfig: Linter.Config;

  beforeEach(() => {
    tree = createTree();
    eslintConfig = {
      rules: {
        'existing-rule': 'error',
        '@angular-eslint/template/accessibility-label-for': 'error',
      },
      overrides: [
        {
          files: '**/*.ts',
          rules: {
            'existing-rule': 'error',
            '@angular-eslint/template/accessibility-label-for': 'error',
          },
        },
      ],
    };
  });

  it('should migrate @angular-eslint/template/accessibility-label-for => @angular-eslint/template/accessibility-label-has-associated-control', async () => {
    writeJson(tree, '.eslintrc.json', eslintConfig);

    await updateAngularEslintRules(tree);
    const updatedEslint = tree.read('.eslintrc.json').toString();
    expect(updatedEslint).toMatchSnapshot();
  });

  it('should migrate to new @angular-eslint/template/accessibility-label-has-associated-control label-components config', async () => {
    eslintConfig.overrides[0].rules[
      '@angular-eslint/template/accessibility-label-for'
    ] = [
      'error',
      {
        controlComponents: 'control-component',
        labelComponents: ['label-component'],
        labelAttributes: ['label-attr'],
      },
    ];
    writeJson(tree, '.eslintrc.json', eslintConfig);

    await updateAngularEslintRules(tree);
    const updatedEslint = tree.read('.eslintrc.json').toString();
    expect(updatedEslint).toMatchSnapshot();
  });

  it('should add @angular-eslint/template/eqeqeq if @angular-eslint/template/no-negated-async is there', async () => {
    eslintConfig.rules['@angular-eslint/template/no-negated-async'] = 'error';
    eslintConfig.overrides[0].rules[
      '@angular-eslint/template/no-negated-async'
    ] = 'error';
    writeJson(tree, '.eslintrc.json', eslintConfig);

    await updateAngularEslintRules(tree);
    const updatedEslint = tree.read('.eslintrc.json').toString();
    expect(updatedEslint).toMatchSnapshot();
  });
});
