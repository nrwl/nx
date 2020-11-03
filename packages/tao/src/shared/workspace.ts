import * as fs from 'fs';
import * as path from 'path';

export interface WorkspaceDefinition {
  projects: { [projectName: string]: ProjectDefinition };
  defaultProject: string | undefined;
  schematics: { [collectionName: string]: { [schematicName: string]: any } };
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

export class Workspaces {
  readWorkspaceConfiguration(root: string): Promise<WorkspaceDefinition> {
    try {
      fs.statSync(path.join(root, 'angular.json'));
      return JSON.parse(
        fs.readFileSync(path.join(root, 'angular.json')).toString()
      );
    } catch (e) {
      return JSON.parse(
        fs.readFileSync(path.join(root, 'workspace.json')).toString()
      );
    }
  }

  isNxBuilder(target: TargetDefinition) {
    const { buildersJson } = this.readBuildersJson(target);
    return buildersJson['$schema'] === '@nrwl/tao/src/builders-schema.json';
  }

  isNxSchematic(collectionName: string, schematicName: string) {
    const schema = this.readSchematic(collectionName, schematicName).schema;
    return schema['$schema'] === '@nrwl/tao/src/schematic-schema.json';
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

  readSchematic(collectionName: string, schematicName: string) {
    try {
      const {
        schematicsFilePath,
        schematicsJson,
        normalizedSchematicName,
      } = this.readSchematicsJson(collectionName, schematicName);
      const schematicsDir = path.dirname(schematicsFilePath);
      const schematicConfig =
        schematicsJson.schematics[normalizedSchematicName];
      const schemaPath = path.join(schematicsDir, schematicConfig.schema || '');
      const schema = JSON.parse(fs.readFileSync(schemaPath).toString());
      const module = require(path.join(
        schematicsDir,
        schematicConfig.implementation
          ? schematicConfig.implementation
          : schematicConfig.factory
      ));
      const implementation = module.default;
      return { schema, implementation };
    } catch (e) {
      throw new Error(
        `Unable to resolve ${collectionName}:${schematicName}.\n${e.message}`
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

  private readSchematicsJson(collectionName: string, schematic: string) {
    const packageJsonPath = require.resolve(`${collectionName}/package.json`);
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath).toString());
    const schematicsFile = packageJson.schematics;
    const schematicsFilePath = require.resolve(
      path.join(path.dirname(packageJsonPath), schematicsFile)
    );
    const schematicsJson = JSON.parse(
      fs.readFileSync(schematicsFilePath).toString()
    );

    let normalizedSchematicName;
    for (let k of Object.keys(schematicsJson.schematics)) {
      if (k === schematic) {
        normalizedSchematicName = k;
        break;
      }
      if (
        schematicsJson.schematics[k].aliases &&
        schematicsJson.schematics[k].aliases.indexOf(schematic) > -1
      ) {
        normalizedSchematicName = k;
        break;
      }
    }

    if (!normalizedSchematicName) {
      for (let parent of schematicsJson.extends || []) {
        try {
          return this.readSchematicsJson(parent, schematic);
        } catch (e) {}
      }

      throw new Error(
        `Cannot find schematic '${schematic}' in ${schematicsFilePath}.`
      );
    }
    return { schematicsFilePath, schematicsJson, normalizedSchematicName };
  }
}
