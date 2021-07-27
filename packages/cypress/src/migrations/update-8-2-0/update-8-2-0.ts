import {
  chain,
  Rule,
  SchematicContext,
  Tree,
} from '@angular-devkit/schematics';
import {
  formatFiles,
  getWorkspace,
  readJsonInTree,
  updateJsonInTree,
} from '@nrwl/workspace';
import { stripIndents } from '@angular-devkit/core/src/utils/literals';
import {
  parseConfigFileTextToJson,
  ParseConfigHost,
  parseJsonConfigFileContent,
  transpileModule,
  ModuleKind,
  createSourceFile,
  isBinaryExpression,
  isExpressionStatement,
  isIdentifier,
  isPropertyAccessExpression,
  isFunctionExpression,
  isArrowFunction,
  isBlock,
  ScriptTarget,
} from 'typescript';
import { dirname, join, relative } from 'path';
import { normalize } from '@angular-devkit/core';

async function updateCypressJson(host: Tree, context: SchematicContext) {
  const rules: Rule[] = [];
  const workspace = await getWorkspace(host);

  workspace.projects.forEach((project) => {
    project.targets.forEach((target) => {
      if (target.builder !== '@nrwl/cypress:cypress') {
        return;
      }

      const parseConfigHost: ParseConfigHost = {
        useCaseSensitiveFileNames: true,
        fileExists: (path) => host.exists(path),
        readDirectory: (dir) => host.getDir(dir).subfiles,
        readFile: (path) => host.read(path).toString(),
      };

      const updatedCypressJsons = new Set<string>();
      updatedCypressJsons.add(target.options.cypressConfig as string);

      rules.push(
        updateJsonInTree(target.options.cypressConfig as string, (json) => {
          function getUpdatedPath(path: string) {
            if (typeof path !== 'string') {
              return path;
            }
            return `./${normalize(
              relative(
                dirname(target.options.cypressConfig as string),
                relative(
                  `./${tsConfig.options.outDir}`,
                  join(dirname(target.options.cypressConfig as string), path)
                )
              )
            )}`;
          }

          const tsConfig = parseJsonConfigFileContent(
            parseConfigFileTextToJson(
              target.options.tsConfig as string,
              host.read(target.options.tsConfig as string).toString()
            ).config,
            parseConfigHost,
            dirname(target.options.tsConfig as string)
          );

          json.fileServerFolder = getUpdatedPath(json.fileServerFolder);
          json.fixturesFolder = getUpdatedPath(json.fixturesFolder);
          json.integrationFolder = getUpdatedPath(json.integrationFolder);
          json.pluginsFile = getUpdatedPath(json.pluginsFile);
          json.supportFile = getUpdatedPath(json.supportFile);
          return json;
        })
      );

      Object.values<any>(target.configurations).forEach((config) => {
        if (
          config.cypressConfig &&
          !updatedCypressJsons.has(config.cypressConfig)
        ) {
          rules.push(
            updateJsonInTree(config.cypressConfig as string, (json) => {
              function getUpdatedPath(path: string) {
                if (typeof path !== 'string') {
                  return path;
                }
                return `./${relative(
                  dirname(config.cypressConfig as string),
                  relative(
                    `./${tsConfig.options.outDir}`,
                    join(dirname(config.cypressConfig as string), path)
                  )
                )}`;
              }

              const tsConfig = parseJsonConfigFileContent(
                parseConfigFileTextToJson(
                  config.tsConfig || (target.options.tsConfig as string),
                  host
                    .read(
                      config.tsConfig || (target.options.tsConfig as string)
                    )
                    .toString()
                ).config,
                parseConfigHost,
                dirname(config.tsConfig || (target.options.tsConfig as string))
              );

              json.fileServerFolder = getUpdatedPath(json.fileServerFolder);
              json.fixturesFolder = getUpdatedPath(json.fixturesFolder);
              json.integrationFolder = getUpdatedPath(json.integrationFolder);
              json.pluginsFile = getUpdatedPath(json.pluginsFile);
              json.supportFile = getUpdatedPath(json.supportFile);
              return json;
            })
          );
        }
      });
    });
  });

  return chain(rules);
}

async function updatePlugins(host: Tree, context: SchematicContext) {
  const workspace = await getWorkspace(host);

  workspace.projects.forEach((project) => {
    project.targets.forEach((target) => {
      if (target.builder !== '@nrwl/cypress:cypress') {
        return;
      }

      [target.options, ...Object.values(target.configurations)].forEach(
        (config) => {
          if (!config.cypressConfig) {
            return;
          }

          const cypressConfig = readJsonInTree(
            host,
            config.cypressConfig as string
          );

          if (typeof cypressConfig.pluginsFile !== 'string') {
            return;
          }

          const pluginFile = join(
            dirname(config.cypressConfig as string),
            `${cypressConfig.pluginsFile.replace(/\.js$/, '')}.ts`
          );
          const newPluginFile = pluginFile.replace(/\.ts$/, '.js');

          if (!host.exists(pluginFile)) {
            return;
          }

          const result = transpileModule(host.read(pluginFile).toString(), {
            compilerOptions: {
              module: ModuleKind.CommonJS,
            },
          });
          host.create(newPluginFile, result.outputText);
          host.delete(pluginFile);

          const sourceFile = createSourceFile(
            newPluginFile,
            result.outputText,
            ScriptTarget.Latest
          );

          const recorder = host.beginUpdate(newPluginFile);

          recorder.insertLeft(
            0,
            `const { preprocessTypescript } = require('@nrwl/cypress/plugins/preprocessor');`
          );
          sourceFile.statements.forEach((statement) => {
            if (
              isExpressionStatement(statement) &&
              isBinaryExpression(statement.expression) &&
              isPropertyAccessExpression(statement.expression.left) &&
              isIdentifier(statement.expression.left.expression) &&
              statement.expression.left.expression.escapedText === 'module' &&
              isIdentifier(statement.expression.left.name) &&
              statement.expression.left.name.escapedText === 'exports' &&
              (isFunctionExpression(statement.expression.right) ||
                isArrowFunction(statement.expression.right)) &&
              statement.expression.right.parameters.length >= 2
            ) {
              if (isBlock(statement.expression.right.body)) {
                const onParamName =
                  statement.expression.right.parameters[0].name.getText(
                    sourceFile
                  );
                const configParamName =
                  statement.expression.right.parameters[1].name.getText(
                    sourceFile
                  );

                recorder.insertLeft(
                  statement.expression.right.body.statements.end,
                  stripIndents`
                  ${onParamName}('file:preprocessor', preprocessTypescript(${configParamName}))
                `
                );
              } else {
                context.logger.warn(stripIndents`
                  We could not update ${pluginFile} with our new preprocessor
                `);
              }
            }
          });

          host.commitUpdate(recorder);
        }
      );
    });
  });
}

export default function (): Rule {
  return chain([updateCypressJson, updatePlugins, formatFiles()]);
}
