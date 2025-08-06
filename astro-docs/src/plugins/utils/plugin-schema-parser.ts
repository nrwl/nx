import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import type { Schema } from 'nx/src/utils/params';

export type PluginSchemaWithExamples = Schema & {
  examplesFile?: string;
};

export function getPropertyType(property: any): string {
  if (property.type) {
    if (Array.isArray(property.type)) {
      return property.type.join(' | ');
    }
    return property.type;
  }

  if (property.oneOf) {
    return 'string';
  }

  return 'any';
}

export function getPropertyDefault(property: any): string {
  if (property.default !== undefined) {
    return `\`${JSON.stringify(property.default)}\``;
  }

  if (property.$default) {
    if (
      property.$default.$source === 'argv' &&
      property.$default.index !== undefined
    ) {
      return 'From command line';
    }
  }

  return '';
}

export type PluginItem = {
  config: Record<string, any>;
  schema: PluginSchemaWithExamples;
  schemaPath: string;
};

export function parseGenerators(
  pluginPath: string
): Map<string, PluginItem> | null {
  const generatorsJsonPath = join(pluginPath, 'generators.json');

  if (!existsSync(generatorsJsonPath)) {
    return null; // Plugin might not have generators
  }

  const generatorsJson = JSON.parse(readFileSync(generatorsJsonPath, 'utf-8'));
  const generators = new Map();

  for (const [name, config] of Object.entries(
    generatorsJson.generators || {}
  ) as [string, any][]) {
    // Skip hidden generators
    if (config.hidden) {
      continue;
    }

    const schemaPath = join(pluginPath, config.schema);

    if (existsSync(schemaPath)) {
      const schema = JSON.parse(readFileSync(schemaPath, 'utf-8'));
      generators.set(name, { config, schema, schemaPath });
    }
  }

  return generators;
}

export function parseExecutors(
  pluginPath: string
): Map<string, PluginItem> | null {
  const executorsJsonPath = join(pluginPath, 'executors.json');

  if (!existsSync(executorsJsonPath)) {
    return null; // Plugin might not have executors
  }

  const executorsJson = JSON.parse(readFileSync(executorsJsonPath, 'utf-8'));
  const executors = new Map();

  for (const [name, config] of Object.entries(
    executorsJson.executors || {}
  ) as [string, any][]) {
    // Skip hidden executors
    if (config.hidden) {
      continue;
    }

    const schemaPath = join(pluginPath, config.schema);

    if (existsSync(schemaPath)) {
      const schema = JSON.parse(readFileSync(schemaPath, 'utf-8'));
      executors.set(name, { config, schema, schemaPath });
    }
  }

  return executors;
}

export type PluginMigrationItem = {
  config: Record<string, any>;
  type: 'packageJsonUpdate' | 'generator';
};
export function parseMigrations(pluginPath: string): Map<string, any> | null {
  const migrationsJsonPath = join(pluginPath, 'migrations.json');

  if (!existsSync(migrationsJsonPath)) {
    return null; // Plugin might not have migrations
  }

  const migrationsJson = JSON.parse(readFileSync(migrationsJsonPath, 'utf-8'));
  const migrations = new Map();

  // Parse generators (migrations)
  for (const [name, config] of Object.entries(
    migrationsJson.generators || {}
  ) as [string, any][]) {
    migrations.set(name, { config, type: 'generator' });
  }

  // Parse packageJsonUpdates
  for (const [version, config] of Object.entries(
    migrationsJson.packageJsonUpdates || {}
  ) as [string, any][]) {
    migrations.set(`packageJsonUpdates-${version}`, {
      config: { ...config, name: version },
      type: 'packageJsonUpdate',
    });
  }

  return migrations;
}
