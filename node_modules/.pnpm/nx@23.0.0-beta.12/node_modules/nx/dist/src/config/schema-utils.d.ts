import type { ProjectConfiguration } from './workspace-json-project-json';
/**
 * This function is used to get the implementation factory of an executor or generator.
 * @param implementation path to the implementation
 * @param directory path to the directory
 * @returns a function that returns the implementation
 */
export declare function getImplementationFactory<T>(implementation: string, directory: string, packageName: string, projects: Record<string, ProjectConfiguration>): () => T;
/**
 * This function is used to resolve the implementation of an executor or generator.
 * @param implementationModulePath
 * @param directory
 * @returns path to the implementation
 */
export declare function resolveImplementation(implementationModulePath: string, directory: string, packageName: string, projects: Record<string, ProjectConfiguration>): string;
export declare function resolveSchema(schemaPath: string, directory: string, packageName: string, projects: Record<string, ProjectConfiguration>): string;
