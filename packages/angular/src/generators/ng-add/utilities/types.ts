import { ProjectConfiguration } from '@nrwl/devkit';

export type MigrationProjectConfiguration = {
  config: ProjectConfiguration;
  name: string;
};

export type WorkspaceProjects = {
  apps: MigrationProjectConfiguration[];
  libs: MigrationProjectConfiguration[];
};

export type WorkspaceCapabilities = {
  karma: boolean;
  eslint: boolean;
};

export type ValidationError = {
  message?: string;
  messageGroup?: { title: string; messages: string[] };
  hint?: string;
};
export type ValidationResult = ValidationError[] | null;
