"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatChangedFilesWithPrettierIfAvailable = formatChangedFilesWithPrettierIfAvailable;
exports.formatFilesWithPrettierIfAvailable = formatFilesWithPrettierIfAvailable;
const tslib_1 = require("tslib");
const path = tslib_1.__importStar(require("path"));
const is_using_prettier_1 = require("../../utils/is-using-prettier");
const installation_directory_1 = require("../../utils/installation-directory");
/**
 * Formats all the created or updated files using Prettier
 * @param tree - the file system tree
 *
 * @remarks
 * Set the environment variable `NX_SKIP_FORMAT` to `true` to skip Prettier
 * formatting. This is useful for repositories that use alternative formatters
 * like Biome, dprint, or have custom formatting requirements.
 */
async function formatChangedFilesWithPrettierIfAvailable(tree, options) {
    if (process.env.NX_SKIP_FORMAT === 'true') {
        return;
    }
    const files = new Set(tree.listChanges().filter((file) => file.type !== 'DELETE'));
    const results = await formatFilesWithPrettierIfAvailable(Array.from(files), tree.root, options);
    for (const [path, content] of results) {
        tree.write(path, content);
    }
}
async function formatFilesWithPrettierIfAvailable(files, root, options) {
    const results = new Map();
    // Check here as well for direct callers of this function
    if (process.env.NX_SKIP_FORMAT === 'true') {
        return results;
    }
    let prettier;
    try {
        const prettierPath = require.resolve('prettier', {
            paths: [...(0, installation_directory_1.getNxRequirePaths)(root), __dirname],
        });
        prettier = require(prettierPath);
        /**
         * Even after we discovered prettier in node_modules, we need to be sure that the user is intentionally using prettier
         * before proceeding to format with it.
         */
        if (!(0, is_using_prettier_1.isUsingPrettier)(root)) {
            return results;
        }
    }
    catch { }
    if (!prettier) {
        return results;
    }
    await Promise.all(Array.from(files).map(async (file) => {
        try {
            const systemPath = path.join(root, file.path);
            let options = {
                filepath: systemPath,
            };
            const resolvedOptions = await prettier.resolveConfig(systemPath, {
                editorconfig: true,
            });
            if (!resolvedOptions) {
                return;
            }
            options = {
                ...options,
                ...resolvedOptions,
            };
            const support = await prettier.getFileInfo(systemPath, options);
            if (support.ignored || !support.inferredParser) {
                return;
            }
            results.set(file.path, await prettier.format(file.content.toString('utf-8'), options));
        }
        catch (e) {
            if (!options?.silent) {
                console.warn(`Could not format ${file.path}. Error: "${e.message}"`);
            }
        }
    }));
    return results;
}
