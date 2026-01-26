import { resolve } from 'path';

/**
 * Load a module with fallback to loading from cwd
 * This allows preprocessors like sass, less, stylus to be loaded from
 * either the plugin's node_modules or the project's node_modules
 */
export function loadModule<T = unknown>(moduleId: string): T | undefined {
  try {
    // First try to load from the plugin's node_modules
    return require(moduleId) as T;
  } catch {
    // If that fails, try to load from the current working directory
    try {
      const modulePath = resolve(process.cwd(), 'node_modules', moduleId);
      return require(modulePath) as T;
    } catch {
      return undefined;
    }
  }
}

/**
 * Load a module and throw an error if it's not found
 */
export function requireModule<T = unknown>(
  moduleId: string,
  feature: string
): T {
  const module = loadModule<T>(moduleId);
  if (!module) {
    throw new Error(
      `You need to install "${moduleId}" package in order to process ${feature} files.`
    );
  }
  return module;
}
