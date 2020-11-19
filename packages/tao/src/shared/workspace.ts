import * as fs from 'fs';
import * as path from 'path';
import '../compat/compat';

export interface WorkspaceDefinition {
  projects: { [projectName: string]: ProjectDefinition };
  defaultProject: string | undefined;
  schematics: { [collectionName: string]: { [schematicName: string]: any } };
  generators: { [collectionName: string]: { [generatorName: string]: any } };
  cli: { defaultCollection: string };
}

export interface ProjectDefinition {
  architect: { [targetName: string]: TargetDefinition };
  root: string;
  prefix?: string;
  sourceRoot?: string;
}

export interface TargetDefinition {
  options?: any;
  configurations?: { [config: string]: any };
  builder: string;
}

export function workspaceConfigName(root: string) {
  try {
    fs.statSync(path.join(root, 'angular.json'));
    return 'angular.json';
  } catch (e) {
    return 'workspace.json';
  }
}

export class Workspaces {
  readWorkspaceConfiguration(root: string): WorkspaceDefinition {
    return JSON.parse(
      fs.readFileSync(path.join(root, workspaceConfigName(root))).toString()
    );
  }

  isNxBuilder(target: TargetDefinition) {
    const schema = this.readBuilder(target).schema;
    return schema['cli'] === 'nx';
  }

  isNxGenerator(collectionName: string, generatorName: string) {
    const schema = this.readGenerator(collectionName, generatorName).schema;
    return schema['cli'] === 'nx';
  }

  readBuilder(target: TargetDefinition) {
    try {
      const { builder, buildersFilePath, buildersJson } = this.readBuildersJson(
        target
      );
      const builderDir = path.dirname(buildersFilePath);
      const buildConfig = buildersJson.builders[builder];
      const schemaPath = path.join(builderDir, buildConfig.schema || '');
      const schema = JSON.parse(fs.readFileSync(schemaPath).toString());
      const module = require(path.join(builderDir, buildConfig.implementation));
      const implementation = module.default;
      return { schema, implementation };
    } catch (e) {
      throw new Error(`Unable to resolve ${target.builder}.\n${e.message}`);
    }
  }

  readGenerator(collectionName: string, generatorName: string) {
    try {
      const {
        generatorsFilePath,
        generatorsJson,
        normalizedGeneratorName,
      } = this.readGeneratorsJson(collectionName, generatorName);
      const generatorsDir = path.dirname(generatorsFilePath);
      const generatorConfig = (generatorsJson.generators ||
        generatorsJson.schematics)[normalizedGeneratorName];
      const schemaPath = path.join(generatorsDir, generatorConfig.schema || '');
      const schema = JSON.parse(fs.readFileSync(schemaPath).toString());
      const module = require(path.join(
        generatorsDir,
        generatorConfig.implementation
          ? generatorConfig.implementation
          : generatorConfig.factory
      ));
      const implementation = module.default;
      return { schema, implementation };
    } catch (e) {
      throw new Error(
        `Unable to resolve ${collectionName}:${generatorName}.\n${e.message}`
      );
    }
  }

  private readBuildersJson(target: TargetDefinition) {
    const [nodeModule, builder] = target.builder.split(':');
    const packageJsonPath = require.resolve(`${nodeModule}/package.json`);
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath).toString());
    const buildersFile = packageJson.builders;
    const buildersFilePath = require.resolve(
      path.join(path.dirname(packageJsonPath), buildersFile)
    );
    const buildersJson = JSON.parse(
      fs.readFileSync(buildersFilePath).toString()
    );
    if (!buildersJson.builders[builder]) {
      throw new Error(
        `Cannot find builder '${builder}' in ${buildersFilePath}.`
      );
    }
    return { builder, buildersFilePath, buildersJson };
  }

  private readGeneratorsJson(collectionName: string, generator: string) {
    let generatorsFilePath;
    if (collectionName.endsWith('.json')) {
      generatorsFilePath = require.resolve(collectionName);
    } else {
      const packageJsonPath = require.resolve(`${collectionName}/package.json`);
      const packageJson = JSON.parse(
        fs.readFileSync(packageJsonPath).toString()
      );
      const generatorsFile = packageJson.generators
        ? packageJson.generators
        : packageJson.schematics;
      generatorsFilePath = require.resolve(
        path.join(path.dirname(packageJsonPath), generatorsFile)
      );
    }
    const generatorsJson = JSON.parse(
      fs.readFileSync(generatorsFilePath).toString()
    );

    let normalizedGeneratorName;
    const gens = generatorsJson.generators || generatorsJson.schematics;
    for (let k of Object.keys(gens)) {
      if (k === generator) {
        normalizedGeneratorName = k;
        break;
      }
      if (gens[k].aliases && gens[k].aliases.indexOf(generator) > -1) {
        normalizedGeneratorName = k;
        break;
      }
    }

    if (!normalizedGeneratorName) {
      for (let parent of generatorsJson.extends || []) {
        try {
          return this.readGeneratorsJson(parent, generator);
        } catch (e) {}
      }

      throw new Error(
        `Cannot find generator '${generator}' in ${generatorsFilePath}.`
      );
    }
    return { generatorsFilePath, generatorsJson, normalizedGeneratorName };
  }
}
