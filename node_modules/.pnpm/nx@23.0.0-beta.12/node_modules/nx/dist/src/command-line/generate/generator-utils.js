"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getGeneratorInformation = getGeneratorInformation;
exports.readGeneratorsJson = readGeneratorsJson;
const path_1 = require("path");
const schema_utils_1 = require("../../config/schema-utils");
const fileutils_1 = require("../../utils/fileutils");
const plugins_1 = require("../../project-graph/plugins");
const installation_directory_1 = require("../../utils/installation-directory");
function getGeneratorInformation(collectionName, generatorName, root, projects) {
    try {
        const { generatorsFilePath, generatorsJson, resolvedCollectionName, normalizedGeneratorName, } = readGeneratorsJson(collectionName, generatorName, root, projects);
        const generatorsDir = (0, path_1.dirname)(generatorsFilePath);
        const generatorConfig = generatorsJson.generators?.[normalizedGeneratorName] ||
            generatorsJson.schematics?.[normalizedGeneratorName];
        const isNgCompat = !generatorsJson.generators?.[normalizedGeneratorName];
        const schemaPath = (0, schema_utils_1.resolveSchema)(generatorConfig.schema, generatorsDir, collectionName, projects);
        const schema = (0, fileutils_1.readJsonFile)(schemaPath);
        if (!schema.properties || typeof schema.properties !== 'object') {
            schema.properties = {};
        }
        generatorConfig.implementation =
            generatorConfig.implementation || generatorConfig.factory;
        const implementationFactory = (0, schema_utils_1.getImplementationFactory)(generatorConfig.implementation, generatorsDir, collectionName, projects);
        const normalizedGeneratorConfiguration = {
            ...generatorConfig,
            aliases: generatorConfig.aliases ?? [],
            hidden: !!generatorConfig.hidden,
        };
        return {
            resolvedCollectionName,
            normalizedGeneratorName,
            schema,
            implementationFactory,
            isNgCompat,
            isNxGenerator: !isNgCompat,
            generatorConfiguration: normalizedGeneratorConfiguration,
        };
    }
    catch (e) {
        throw new Error(`Unable to resolve ${collectionName}:${generatorName}.\n${process.env.NX_VERBOSE_LOGGING === 'true' ? e.stack : e.message}`);
    }
}
function readGeneratorsJson(collectionName, generator, root, projects) {
    let generatorsFilePath;
    if (collectionName.endsWith('.json')) {
        generatorsFilePath = require.resolve(collectionName, {
            paths: root
                ? [...(0, installation_directory_1.getNxRequirePaths)(root), __dirname]
                : [...(0, installation_directory_1.getNxRequirePaths)(), __dirname],
        });
    }
    else {
        const { json: packageJson, path: packageJsonPath } = (0, plugins_1.readPluginPackageJson)(collectionName, projects, root
            ? [...(0, installation_directory_1.getNxRequirePaths)(root), __dirname]
            : [...(0, installation_directory_1.getNxRequirePaths)(), __dirname]);
        const generatorsFile = packageJson.generators ?? packageJson.schematics;
        if (!generatorsFile) {
            throw new Error(`The "${collectionName}" package does not support Nx generators.`);
        }
        generatorsFilePath = require.resolve((0, path_1.join)((0, path_1.dirname)(packageJsonPath), generatorsFile));
    }
    const generatorsJson = (0, fileutils_1.readJsonFile)(generatorsFilePath);
    let normalizedGeneratorName = findFullGeneratorName(generator, generatorsJson.generators) ||
        findFullGeneratorName(generator, generatorsJson.schematics);
    if (!normalizedGeneratorName) {
        for (let parent of generatorsJson.extends || []) {
            try {
                return readGeneratorsJson(parent, generator, root, projects);
            }
            catch (e) { }
        }
        throw new Error(`Cannot find generator '${generator}' in ${generatorsFilePath}.`);
    }
    return {
        generatorsFilePath,
        generatorsJson,
        normalizedGeneratorName,
        resolvedCollectionName: collectionName,
    };
}
function findFullGeneratorName(name, generators) {
    if (generators) {
        for (let [key, data] of Object.entries(generators)) {
            if (key === name ||
                (data.aliases && data.aliases.includes(name))) {
                return key;
            }
        }
    }
}
