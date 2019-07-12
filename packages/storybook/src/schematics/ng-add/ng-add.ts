import { chain, Rule } from '@angular-devkit/schematics';
import { addDepsToPackageJson } from '@nrwl/workspace';
import {
  babelCoreVersion,
  babelLoaderVersion,
  storybookAddonKnobsVersion,
  storybookAngularVersion
} from '../../utils/versions';
import { Schema } from './schema';

export default function(schema: Schema) {
  return chain([updateDependencies()]);
}

function updateDependencies(): Rule {
  return addDepsToPackageJson(
    {},
    {
      '@storybook/angular': storybookAngularVersion,
      '@storybook/addon-knobs': storybookAddonKnobsVersion,
      '@types/storybook__addon-knobs': storybookAddonKnobsVersion,
      'babel-loader': babelLoaderVersion,
      '@babel/core': babelCoreVersion
    },
    true
  );
}
