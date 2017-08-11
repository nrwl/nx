import {apply, branchAndMerge, chain, mergeWith, Rule, template, Tree, url} from '@angular-devkit/schematics';
import { names } from "../name-utils";

export default function (options: any): Rule {

  const templateSource = apply(url('./files'), [
    template({...options,  tmpl: '', ...names('some')})
  ]);

  return chain([
    branchAndMerge(chain([
      mergeWith(templateSource)
    ])),
  ]);
}
