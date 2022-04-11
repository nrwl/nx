import {
  joinPathFragments,
  ProjectConfiguration,
  Tree,
  visitNotIgnoredFiles,
} from '@nrwl/devkit';
import { basename } from 'path';
import { GeneratorOptions } from '../schema';
import { Logger } from './logger';
import { MigrationProjectConfiguration, ValidationResult } from './types';

export abstract class ProjectMigrator {
  protected projectConfig: ProjectConfiguration;
  protected project: {
    name: string;
    oldRoot: string;
    oldSourceRoot: string;
    newRoot: string;
    newSourceRoot: string;
  };
  protected logger: Logger;

  constructor(
    protected readonly tree: Tree,
    protected readonly options: GeneratorOptions,
    project: MigrationProjectConfiguration,
    rootDir: string
  ) {
    this.projectConfig = project.config;
    this.project = {
      name: project.name,
      oldRoot: this.projectConfig.root ?? '',
      oldSourceRoot:
        this.projectConfig.sourceRoot ?? this.projectConfig.root ?? '',
      newRoot: `${rootDir}/${project.name}`,
      newSourceRoot: `${rootDir}/${project.name}/src`,
    };

    this.logger = new Logger(this.project.name);
  }

  abstract migrate(): Promise<void>;
  abstract validate(): ValidationResult;

  protected moveProjectRootFile(filePath: string, isRequired = true): void {
    if (!filePath) {
      return;
    }

    const filename = !!filePath ? basename(filePath) : '';
    const from = filePath;
    const to = joinPathFragments(this.project.newRoot, filename);
    this.moveFile(from, to, isRequired);
  }

  protected moveDir(from: string, to: string): void {
    visitNotIgnoredFiles(this.tree, from, (file) => {
      this.moveFile(file, file.replace(from, to), true);
    });
  }

  protected moveFile(from: string, to: string, required: boolean = true): void {
    if (!this.tree.exists(from)) {
      if (required) {
        console.warn(`Path: ${from} does not exist`);
      }
    } else if (this.tree.exists(to)) {
      if (required) {
        console.warn(`Path: ${to} already exists`);
      }
    } else {
      const contents = this.tree.read(from);
      this.tree.write(to, contents);
      this.tree.delete(from);
    }
  }
}
