import * as fs from 'fs';
import * as path from 'path';

export interface WorkspaceDefinition {
  projects: { [projectName: string]: ProjectDefinition };
  defaultProject: string | undefined;
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

  readBuilderSchema(target: TargetDefinition) {
    try {
      const { builder, buildersFilePath, buildersJson } = this.readBuildersJson(
        target
      );
      const schemaPath = path.join(
        path.dirname(buildersFilePath),
        buildersJson.builders[builder].schema || ''
      );
      return JSON.parse(
        fs.readFileSync(require.resolve(schemaPath)).toString()
      );
    } catch (e) {
      throw new Error(`Unable to resolve ${target.builder}.\n${e.message}`);
    }
  }

  readBuilderFunction(target: TargetDefinition) {
    try {
      const { builder, buildersFilePath, buildersJson } = this.readBuildersJson(
        target
      );
      const module = require(path.join(
        path.dirname(buildersFilePath),
        buildersJson.builders[builder].implementation
      ));
      return module.default;
    } catch (e) {
      throw new Error(`Unable to resolve ${target.builder}.\n${e.message}`);
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
}
