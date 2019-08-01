import { existsSync, writeFileSync } from 'fs';
import { readJsonFile, serializeJson } from '@nrwl/workspace';
import { stripIndents } from '@angular-devkit/core/src/utils/literals';

export default {
  description: `Create nx.json before migrating to Angular CLI 6.`,
  run: () => {
    if (!existsSync('.angular-cli.json') && existsSync('angular.json')) {
      console.warn(stripIndents`
        You have already upgraded to Angular CLI 6.
        We will not be able to recover information about your project's tags for you.
      `);
      return;
    }

    const workspaceJson = readJsonFile('.angular-cli.json');
    const projects = workspaceJson.apps.reduce((projects, app) => {
      if (app.name === '$workspaceRoot') {
        return projects;
      }
      const normalizedName = app.name.replace(new RegExp('/', 'g'), '-');
      projects[normalizedName] = {
        tags: app.tags
      };
      if (app.root.startsWith('apps/')) {
        projects[`${normalizedName}-e2e`] = {
          tags: []
        };
      }

      return projects;
    }, {});
    writeFileSync(
      'nx.json',
      serializeJson({
        npmScope: workspaceJson.project.npmScope,
        projects: projects
      })
    );
  }
};
