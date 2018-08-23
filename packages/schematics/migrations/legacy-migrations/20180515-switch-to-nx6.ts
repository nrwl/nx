import { existsSync } from 'fs';
import { readJsonFile, updateJsonFile } from '../../src/utils/fileutils';
import { stripIndents } from '@angular-devkit/core/src/utils/literals';
import { execSync } from 'child_process';
import { join } from 'path';

export default {
  description: `Switch to Nx 6.0`,
  run: () => {
    if (!existsSync('.angular-cli.json') && existsSync('angular.json')) {
      console.warn(stripIndents`
        You have already upgraded to Angular CLI 6.
        We will not be able to recover information about your project's tags for you.
      `);
      return;
    }

    updateJsonFile('package.json', json => {
      json.devDependencies['@angular/cli'] = '6.1.2';
    });

    updateJsonFile('package.json', json => {
      delete json.scripts.postinstall;
    });

    try {
      if (existsSync('yarn.lock')) {
        execSync('yarn install', { stdio: [0, 1, 2] });
      } else {
        execSync('npm install', { stdio: [0, 1, 2] });
      }

      execSync(
        'ng update @angular/cli --from 1.7.4 --to 6.0.1 --migrate-only',
        {
          stdio: [0, 1, 2]
        }
      );

      const currentVersion = readJsonFile(join(__dirname, '../../package.json'))
        .version;
      execSync(
        `ng generate @schematics/update:migrate --package @nrwl/schematics --collection @nrwl/schematics/migrations/migrations.json --from 1.0.3 --to ${currentVersion}`,
        {
          stdio: [0, 1, 2]
        }
      );
    } catch (e) {
      console.warn(stripIndents`
        The automatic upgrade to Nx 6 has failed with the following error: ${e}.
        
        You can upgrade it manually by running:
        
        * yarn install or npm install
        * ng update @angular/cli@6.0.1
        * ng update @nrwl/schematics@6.0.0
        
        The upgrade process creates a test target for every library. If you have a library
        that does not have specs, either set failOnEmptyTestSuite to false in karma.conf.js of the library, 
        or remove the test target in angular.json.
      `);
      throw e;
    }

    console.log(stripIndents`
        The upgrade process creates a test target for every library. If you have a library
        that does not have specs, either set failOnEmptyTestSuite to false in karma.conf.js of the library, 
        or remove the test target in angular.json.
    `);
  }
};
