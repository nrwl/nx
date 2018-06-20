import {
  Rule,
  SchematicContext,
  chain,
  template,
  apply,
  mergeWith,
  url
} from '@angular-devkit/schematics';
import { stripIndents } from '@angular-devkit/core/src/utils/literals';

function displayInformation(_, context: SchematicContext) {
  context.logger.info(stripIndents`
    A global base karma config has been added at karma.conf.ts
    
    This file exports a karma config to be extended in each project

    This new file is not being used yet!

    Generate a new project to see an example of how it might be used.
  `);
}

function addGlobalKarmaConf() {
  const templateSource = apply(url('./files'), [
    template({
      tmpl: ''
    })
  ]);
  return mergeWith(templateSource);
}

export default function(): Rule {
  return chain([displayInformation, addGlobalKarmaConf()]);
}
