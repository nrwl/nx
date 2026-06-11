"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeExecutorSchema = normalizeExecutorSchema;
exports.parseExecutor = parseExecutor;
exports.getExecutorInformation = getExecutorInformation;
const path_1 = require("path");
const plugins_1 = require("../../project-graph/plugins");
const fileutils_1 = require("../../utils/fileutils");
const schema_utils_1 = require("../../config/schema-utils");
const installation_directory_1 = require("../../utils/installation-directory");
function normalizeExecutorSchema(schema) {
    const version = (schema.version ??= 1);
    return {
        version,
        outputCapture: (schema.outputCapture ?? version < 2) ? 'direct-nodejs' : 'pipe',
        continuous: schema.continuous ?? false,
        properties: !schema.properties || typeof schema.properties !== 'object'
            ? {}
            : schema.properties,
        ...schema,
    };
}
function cacheKey(nodeModule, executor, root) {
    return `${root}:${nodeModule}:${executor}`;
}
function parseExecutor(executorString) {
    return executorString.split(':');
}
const cachedExecutorInformation = {};
function getExecutorInformation(nodeModule, executor, root, 
/**
 * A map of projects keyed by project name
 */
projects) {
    try {
        const key = cacheKey(nodeModule, executor, root);
        if (cachedExecutorInformation[key])
            return cachedExecutorInformation[key];
        const { executorsFilePath, executorConfig, isNgCompat } = readExecutorJson(nodeModule, executor, root, projects);
        const executorsDir = (0, path_1.dirname)(executorsFilePath);
        const schemaPath = (0, schema_utils_1.resolveSchema)(executorConfig.schema, executorsDir, nodeModule, projects);
        const schema = normalizeExecutorSchema((0, fileutils_1.readJsonFile)(schemaPath));
        const implementationFactory = (0, schema_utils_1.getImplementationFactory)(executorConfig.implementation, executorsDir, nodeModule, projects);
        const batchImplementationFactory = executorConfig.batchImplementation
            ? (0, schema_utils_1.getImplementationFactory)(executorConfig.batchImplementation, executorsDir, nodeModule, projects)
            : null;
        const hasherFactory = executorConfig.hasher
            ? (0, schema_utils_1.getImplementationFactory)(executorConfig.hasher, executorsDir, nodeModule, projects)
            : null;
        const res = {
            schema,
            implementationFactory,
            batchImplementationFactory,
            preferBatch: executorConfig.preferBatch,
            hasherFactory,
            isNgCompat,
            isNxExecutor: !isNgCompat,
        };
        cachedExecutorInformation[key] = res;
        return res;
    }
    catch (e) {
        throw new Error(`Unable to resolve ${nodeModule}:${executor}.\n${e.message}`);
    }
}
function readExecutorJson(nodeModule, executor, root, projects, extraRequirePaths = []) {
    const { json: packageJson, path: packageJsonPath } = (0, plugins_1.readPluginPackageJson)(nodeModule, projects, root
        ? [
            root,
            __dirname,
            process.cwd(),
            ...(0, installation_directory_1.getNxRequirePaths)(),
            ...extraRequirePaths,
        ]
        : [__dirname, process.cwd(), ...(0, installation_directory_1.getNxRequirePaths)(), ...extraRequirePaths]);
    const executorsFile = packageJson.executors ?? packageJson.builders;
    if (!executorsFile) {
        throw new Error(`The "${nodeModule}" package does not support Nx executors.`);
    }
    const basePath = (0, path_1.dirname)(packageJsonPath);
    const executorsFilePath = require.resolve((0, path_1.join)(basePath, executorsFile));
    const executorsJson = (0, fileutils_1.readJsonFile)(executorsFilePath);
    const executorConfig = executorsJson.executors?.[executor] || executorsJson.builders?.[executor];
    if (!executorConfig) {
        throw new Error(`Cannot find executor '${executor}' in ${executorsFilePath}.`);
    }
    if (typeof executorConfig === 'string') {
        // Angular CLI can have a builder pointing to another package:builder
        const [packageName, executorName] = executorConfig.split(':');
        return readExecutorJson(packageName, executorName, root, projects, [
            basePath,
        ]);
    }
    const isNgCompat = !executorsJson.executors?.[executor];
    return { executorsFilePath, executorConfig, isNgCompat };
}
