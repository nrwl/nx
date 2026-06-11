"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OverwriteStrategy = void 0;
exports.generateFiles = generateFiles;
const tslib_1 = require("tslib");
const fs_1 = require("fs");
const path = tslib_1.__importStar(require("path"));
const binary_extensions_1 = require("../../utils/binary-extensions");
const logger_1 = require("../../utils/logger");
/**
 * Specify what should be done when a file is generated but already exists on the system
 */
var OverwriteStrategy;
(function (OverwriteStrategy) {
    OverwriteStrategy["Overwrite"] = "overwrite";
    OverwriteStrategy["KeepExisting"] = "keepExisting";
    OverwriteStrategy["ThrowIfExisting"] = "throwIfExisting";
})(OverwriteStrategy || (exports.OverwriteStrategy = OverwriteStrategy = {}));
/**
 * Generates a folder of files based on provided templates.
 *
 * While doing so it performs two substitutions:
 * - Substitutes segments of file names surrounded by __
 * - Uses ejs to substitute values in templates
 *
 * Examples:
 * ```typescript
 * generateFiles(tree, path.join(__dirname , 'files'), './tools/scripts', {tmpl: '', name: 'myscript'})
 * ```
 * This command will take all the files from the `files` directory next to the place where the command is invoked from.
 * It will replace all `__tmpl__` with '' and all `__name__` with 'myscript' in the file names, and will replace all
 * `<%= name %>` with `myscript` in the files themselves.
 * `tmpl: ''` is a common pattern. With it you can name files like this: `index.ts__tmpl__`, so your editor
 * doesn't get confused about incorrect TypeScript files.
 *
 * @param tree - the file system tree
 * @param srcFolder - the source folder of files (absolute path)
 * @param target - the target folder (relative to the tree root)
 * @param substitutions - an object of key-value pairs
 * @param options - See {@link GenerateFilesOptions}
 */
function generateFiles(tree, srcFolder, target, substitutions, options = {
    overwriteStrategy: OverwriteStrategy.Overwrite,
}) {
    options ??= {};
    options.overwriteStrategy ??= OverwriteStrategy.Overwrite;
    const ejs = require('ejs');
    const files = allFilesInDir(srcFolder);
    if (files.length === 0) {
        throw new Error(`generateFiles: No files found in "${srcFolder}". Are you sure you specified the correct path?`);
    }
    else {
        files.forEach((filePath) => {
            let newContent;
            const computedPath = computePath(srcFolder, target, filePath, substitutions);
            if (tree.exists(computedPath)) {
                if (options.overwriteStrategy === OverwriteStrategy.KeepExisting) {
                    return;
                }
                else if (options.overwriteStrategy === OverwriteStrategy.ThrowIfExisting) {
                    throw new Error(`Generated file already exists, not allowed by overwrite strategy in generator (${computedPath})`);
                }
                // else: file should be overwritten, so just fall through to file generation
            }
            if ((0, binary_extensions_1.isBinaryPath)(filePath)) {
                newContent = (0, fs_1.readFileSync)(filePath);
            }
            else {
                const template = (0, fs_1.readFileSync)(filePath, 'utf-8');
                try {
                    newContent = ejs.render(template, substitutions, {
                        filename: filePath,
                    });
                }
                catch (e) {
                    logger_1.logger.error(`Error in ${filePath.replace(`${tree.root}/`, '')}:`);
                    throw e;
                }
            }
            tree.write(computedPath, newContent);
        });
    }
}
function computePath(srcFolder, target, filePath, substitutions) {
    const relativeFromSrcFolder = path.relative(srcFolder, filePath);
    let computedPath = path.join(target, relativeFromSrcFolder);
    if (computedPath.endsWith('.template')) {
        computedPath = computedPath.substring(0, computedPath.length - 9);
    }
    Object.entries(substitutions).forEach(([propertyName, value]) => {
        computedPath = computedPath.split(`__${propertyName}__`).join(value);
    });
    return computedPath;
}
function allFilesInDir(parent) {
    let res = [];
    try {
        (0, fs_1.readdirSync)(parent).forEach((c) => {
            const child = path.join(parent, c);
            try {
                const s = (0, fs_1.statSync)(child);
                if (!s.isDirectory()) {
                    res.push(child);
                }
                else if (s.isDirectory()) {
                    res = [...res, ...allFilesInDir(child)];
                }
            }
            catch { }
        });
    }
    catch { }
    return res;
}
