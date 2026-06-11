"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = escapeDollarSignEnvVariables;
const logger_1 = require("../../utils/logger");
const project_configuration_1 = require("../../generators/utils/project-configuration");
/**
 * This function escapes dollar sign in env variables
 * It will go through:
 * - '.env', '.local.env', '.env.local'
 * - .env.[target-name], .[target-name].env
 * - .env.[target-name].[configuration-name], .[target-name].[configuration-name].env
 * - .env.[configuration-name], .[configuration-name].env
 * at each project root and workspace root
 * @param tree
 */
function escapeDollarSignEnvVariables(tree) {
    const envFiles = ['.env', '.local.env', '.env.local'];
    for (const [_, configuration] of (0, project_configuration_1.getProjects)(tree).entries()) {
        envFiles.push(`${configuration.root}/.env`, `${configuration.root}/.local.env`, `${configuration.root}/.env.local`);
        for (const targetName in configuration.targets) {
            const task = configuration.targets[targetName];
            envFiles.push(`.env.${targetName}`, `.${targetName}.env`, `${configuration.root}/.env.${targetName}`, `${configuration.root}/.${targetName}.env`);
            if (task.configurations) {
                for (const configurationName in task.configurations) {
                    envFiles.push(`.env.${targetName}.${configurationName}`, `.${targetName}.${configurationName}.env`, `.env.${configurationName}`, `.${configurationName}.env`, `${configuration.root}/.env.${targetName}.${configurationName}`, `${configuration.root}/.${targetName}.${configurationName}.env`, `${configuration.root}/.env.${configurationName}`, `${configuration.root}/.${configurationName}.env`);
                }
            }
        }
    }
    for (const envFile of new Set(envFiles)) {
        parseEnvFile(tree, envFile);
    }
}
/**
 * This function parse the env file and escape dollar sign
 * @param tree
 * @param envFilePath
 * @returns
 */
function parseEnvFile(tree, envFilePath) {
    if (!tree.exists(envFilePath)) {
        return;
    }
    let envFileContent = tree.read(envFilePath, 'utf-8');
    if (!envFileContent) {
        // envFileContent is null if we fail to read the file for any reason
        // e.g. the file is not utf-8 encoded
        logger_1.logger.info(`Unable to update ${envFilePath}. Nx interpolates environment variables in the form of $VAR_NAME. To escape the dollar sign, use \\$VAR_NAME.`);
        return;
    }
    envFileContent = envFileContent
        .split('\n')
        .map((line) => {
        line = line.trim();
        if (!line || !line.includes('$')) {
            return line;
        }
        const declarations = line.split('=');
        if (declarations[1].includes('$') && !declarations[1].includes(`\\$`)) {
            declarations[1] = declarations[1].replace('$', `\\$`);
            line = declarations.join('=');
        }
        return line;
    })
        .join('\n');
    tree.write(envFilePath, envFileContent);
}
