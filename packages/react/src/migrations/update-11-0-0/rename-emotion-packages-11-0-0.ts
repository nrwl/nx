import { chain, Rule } from '@angular-devkit/schematics';
import {
  formatFiles,
  addDepsToPackageJson,
  updateJsonInTree,
} from '@nrwl/workspace';
import { emotionReactVersion } from '../../utils/versions';

export default function update(): Rule {
  let hadEmotionCore = false;

  return chain([
    updateJsonInTree('package.json', (json) => {
      if (json.dependencies && '@emotion/core' in json.dependencies) {
        delete json.dependencies['@emotion/core'];
        hadEmotionCore = true;
      }
      if (json.devDependencies && '@emotion/core' in json.devDependencies) {
        delete json.devDependencies['@emotion/core'];
        hadEmotionCore = true;
      }
      return json;
    }),
    () =>
      addDepsToPackageJson(
        hadEmotionCore ? { '@emotion/react': emotionReactVersion } : {},
        {}
      ),
    formatFiles(),
  ]);
}
