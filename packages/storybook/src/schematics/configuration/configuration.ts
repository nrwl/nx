import {
  chain,
  move,
  noop,
  Rule,
  schematic,
  SchematicContext,
  template,
  Tree,
  url,
} from '@angular-devkit/schematics';
import {
  getProjectConfig,
  offsetFromRoot,
  updateWorkspace,
  updateWorkspaceInTree,
  serializeJson,
  Linter,
} from '@nrwl/workspace';
import { join, normalize } from '@angular-devkit/core';

import {
  applyWithSkipExisting,
  isFramework,
  getTsConfigContent,
} from '../../utils/utils';
import { CypressConfigureSchema } from '../cypress-project/cypress-project';
import { StorybookConfigureSchema } from './schema';
import { toJS } from '@nrwl/workspace/src/utils/rules/to-js';

export default function (rawSchema: StorybookConfigureSchema): Rule {
  const schema = normalizeSchema(rawSchema);
  return chain([
    schematic('ng-add', {
      uiFramework: schema.uiFramework,
    }),
    createRootStorybookDir(schema.name, schema.js),
    createLibStorybookDir(schema.name, schema.uiFramework, schema.js),
    configureTsLibConfig(schema),
    configureTsSolutionConfig(schema),
    updateLintTask(schema),
    addStorybookTask(schema.name, schema.uiFramework),
    schema.configureCypress
      ? schematic<CypressConfigureSchema>('cypress-project', {
          name: schema.name,
          js: schema.js,
          linter: schema.linter,
        })
      : () => {},
  ]);
}

function normalizeSchema(schema: StorybookConfigureSchema) {
  const defaults = {
    linter: Linter.TsLint,
    js: false,
  };
  return {
    ...defaults,
    ...schema,
  };
}

function createRootStorybookDir(projectName: string, js: boolean): Rule {
  return (tree: Tree, context: SchematicContext) => {
    context.logger.debug('adding .storybook folder to lib');

    /**
     * So, here we could check the configuration flag and see if we want to generate
     * a storybook version 5 or version 6
     * (or just look at which version we have installed, I guess)
     * (so, is there a way to "get storybook version"?)
     * 
     * And have two folders, root-files-5 and root-files-6
     * and then choose the correct one for the corresponding version
     * 
     * So, I guess the check should happen automatically (version of storybook)
     * 
     * Use case:
     * A user has a huge app with Storybook v5 configured.
     * User upgrades to Nx 10. All their storybooks are still v5. So, old config files, old stories.
     * 
     * They don't want their Storybook package to upgrade to Storybook v6 just yet, because
     * it will break their builds. And they want the new stories they produce to be
     * in version 5 still, for the same reason.
     * When they have time to manually migrate all instances of Storybook v5 to Storybook v6, 
     * then they will want their Storbook package to upgrade to v6.
     * 
     * All new Storybooks that are added or created should be in v6, if the package.json does
     * not have Storybook.
     */


     /**
      * Notes about manager.js
      * 
      * Potentially, we should add manager.js to the root folder, just an empty file.
      * Let's discuss, but it should just be an empty file, which is then referenced
      * in the lib-files, just to save the users from the trouble of creating
      * that file themselves, in case they need it. 
      * There's a change users will never use it, but some will. So, this 
      * will save those the trouble of manually creating a manager.js file
      * in root-files and then an importing one in all instances of storybook.
      */

      /**
       * Notes about .html files (preview-head.html, preview-body.html, manager-head.html)
       * 
       * These files need to be created in each one separate instance of Storybook.
       * We either do the same as we did with manager.js> just add them there, but most users
       * will never use them, or let the users who want to add them, manually create them when and
       * if they ever need them.
       * 
       * These files cannot be imported or referenced or required. There needs to be a one and 
       * separate .html file in each one of the .storybook directories in the app, if it needs to be used
       */

    return chain([
      applyWithSkipExisting(url('./root-files'), [js ? toJS() : noop()]),
    ])(tree, context);
  };
}

function createLibStorybookDir(
  projectName: string,
  uiFramework: StorybookConfigureSchema['uiFramework'],
  js: boolean
): Rule {
  return (tree: Tree, context: SchematicContext) => {

    /**
     * Here, same as above
     * Check storybook version
     * and use the correct folder
     * lib-files-5 or lib-files-6
     */

    context.logger.debug('adding .storybook folder to lib');
    const projectConfig = getProjectConfig(tree, projectName);
    return chain([
      applyWithSkipExisting(url('./lib-files'), [
        template({
          tmpl: '',
          uiFramework,
          offsetFromRoot: offsetFromRoot(projectConfig.root),
        }),
        move(projectConfig.root),
        js ? toJS() : noop(),
      ]),
    ])(tree, context);
  };
}

function configureTsLibConfig(schema: StorybookConfigureSchema): Rule {
  const { name: projectName } = schema;

  return (tree: Tree) => {
    const projectPath = getProjectConfig(tree, projectName).root;
    const tsConfigPath = join(projectPath, 'tsconfig.lib.json');
    const tsConfigContent = getTsConfigContent(tree, tsConfigPath);

    tsConfigContent.exclude = [
      ...(tsConfigContent.exclude || []),
      '**/*.stories.ts',
      '**/*.stories.js',
      ...(isFramework('react', schema)
        ? ['**/*.stories.jsx', '**/*.stories.tsx']
        : []),
    ];

    tree.overwrite(tsConfigPath, serializeJson(tsConfigContent));

    return tree;
  };
}

function configureTsSolutionConfig(schema: StorybookConfigureSchema): Rule {
  const { name: projectName } = schema;

  return (tree: Tree) => {
    const projectPath = getProjectConfig(tree, projectName).root;
    const tsConfigPath = projectPath + '/tsconfig.json';
    const tsConfigContent = getTsConfigContent(tree, tsConfigPath);

    tsConfigContent.references = [
      ...(tsConfigContent.references || []),
      {
        path: './.storybook/tsconfig.json',
      },
    ];

    tree.overwrite(tsConfigPath, serializeJson(tsConfigContent));

    return tree;
  };
}

function updateLintTask(schema: StorybookConfigureSchema): Rule {
  const { name: projectName } = schema;

  return updateWorkspaceInTree((json) => {
    const projectConfig = json.projects[projectName];
    const lintTarget = projectConfig.architect.lint;

    if (lintTarget) {
      lintTarget.options.tsConfig = [
        ...lintTarget.options.tsConfig,
        `${projectConfig.root}/.storybook/tsconfig.json`,
      ];
    }

    return json;
  });
}

function addStorybookTask(projectName: string, uiFramework: string): Rule {
  return updateWorkspace((workspace) => {
    const projectConfig = workspace.projects.get(projectName);
    if (!projectConfig) {
      return;
    }

    projectConfig.targets.set('storybook', {
      builder: '@nrwl/storybook:storybook',
      options: {
        uiFramework,
        port: 4400,
        config: {
          configFolder: `${projectConfig.root}/.storybook`,
        },
      },
      configurations: {
        ci: {
          quiet: true,
        },
      },
    });
    projectConfig.targets.set('build-storybook', {
      builder: '@nrwl/storybook:build',
      options: {
        uiFramework,
        outputPath: join(
          normalize('dist'),
          normalize('storybook'),
          projectName
        ),
        config: {
          configFolder: `${projectConfig.root}/.storybook`,
        },
      },
      configurations: {
        ci: {
          quiet: true,
        },
      },
    });
  });
}
