import { updateBuilderConfig, updateJsonInTree } from '@nrwl/workspace';
import { chain } from '@angular-devkit/schematics';

function updateNgPackagrBuilder() {
  let skipInstall = true;
  return chain([
    updateBuilderConfig((_, target) => {
      target.builder = '@angular-devkit/build-angular:ng-packagr';
      return _;
    }, '@angular-devkit/build-ng-packagr:build'),
    updateJsonInTree('package.json', (json) => {
      if (
        json.dependencies &&
        json.dependencies['@angular-devkit/build-ng-packagr']
      ) {
        skipInstall = false;
        delete json.dependencies['@angular-devkit/build-ng-packagr'];
      }
      if (
        json.devDependencies &&
        json.devDependencies['@angular-devkit/build-ng-packagr']
      ) {
        skipInstall = false;
        delete json.devDependencies['@angular-devkit/build-ng-packagr'];
      }
      return json;
    }),
  ]);
}

function updateLazyConfiguration(entry) {
  if (typeof entry === 'string') {
    return entry;
  }

  let objectEntry = entry as { lazy?: boolean };

  if ('lazy' in objectEntry) {
    return {
      ...objectEntry,
      inject: !objectEntry.lazy,
      lazy: undefined,
    };
  } else {
    return entry;
  }
}

const removeDeprecatedOptions = updateBuilderConfig((options) => {
  delete options.environment;
  delete options.extractCss;
  delete options.tsconfigFileName;
  delete options.rebaseRootRelativeCssUrls;

  if (options.styles && Array.isArray(options.styles)) {
    options.styles = options.styles.map(updateLazyConfiguration);
  }
  if (options.scripts && Array.isArray(options.scripts)) {
    options.scripts = options.scripts.map(updateLazyConfiguration);
  }

  return options;
}, '@angular-devkit/build-angular:browser');

export default () => {
  return chain([removeDeprecatedOptions, updateNgPackagrBuilder()]);
};
