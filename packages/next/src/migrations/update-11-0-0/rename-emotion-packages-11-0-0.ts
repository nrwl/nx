import { chain, Rule } from '@angular-devkit/schematics';
import {
  formatFiles,
  addDepsToPackageJson,
  updateJsonInTree,
} from '@nrwl/workspace';
import { emotionServerVersion } from '../../utils/versions';

export default function update(): Rule {
  let hadEmotionServer = false;

  return chain([
    updateJsonInTree('package.json', (json) => {
      if (json.dependencies && 'emotion-server' in json.dependencies) {
        delete json.dependencies['emotion-server'];
        hadEmotionServer = true;
      }
      if (json.devDependencies && 'emotion-server' in json.devDependencies) {
        delete json.devDependencies['emotion-server'];
        hadEmotionServer = true;
      }
      return json;
    }),
    () =>
      addDepsToPackageJson(
        {},
        hadEmotionServer ? { '@emotion/server': emotionServerVersion } : {}
      ),
    formatFiles(),
  ]);
}
