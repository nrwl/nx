import { Rule } from '@angular-devkit/schematics';
import { updateJsonInTree } from '@nrwl/workspace';
import { apolloServerExpressVersion, nestJsGraphQLVersion } from './versions';

export function addGraphQLToPackageJson(): Rule {
  return updateJsonInTree('package.json', (packageJson) => {
    if (!packageJson['dependencies']) {
      packageJson['dependencies'] = {};
    }

    if (!packageJson['dependencies']['@nestjs/graphql']) {
      packageJson['dependencies']['@nestjs/graphql'] = nestJsGraphQLVersion;
    }
    if (!packageJson['dependencies']['apollo-server-express']) {
      packageJson['dependencies'][
        'apollo-server-express'
      ] = apolloServerExpressVersion;
    }
    return packageJson;
  });
}
