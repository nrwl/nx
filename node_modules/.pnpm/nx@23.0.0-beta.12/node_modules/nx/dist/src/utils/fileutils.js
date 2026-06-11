"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readJsonFile = readJsonFile;
exports.readYamlFile = readYamlFile;
exports.writeJsonFile = writeJsonFile;
exports.writeJsonFileAsync = writeJsonFileAsync;
exports.directoryExists = directoryExists;
exports.fileExists = fileExists;
exports.createDirectory = createDirectory;
exports.isRelativePath = isRelativePath;
exports.extractFileFromTarball = extractFileFromTarball;
exports.readFileIfExisting = readFileIfExisting;
const tslib_1 = require("tslib");
const json_1 = require("./json");
const node_fs_1 = require("node:fs");
const promises_1 = require("node:fs/promises");
const path_1 = require("path");
const tar = tslib_1.__importStar(require("tar-stream"));
const zlib_1 = require("zlib");
/**
 * Reads a JSON file and returns the object the JSON content represents.
 *
 * @param path A path to a file.
 * @param options JSON parse options
 * @returns Object the JSON content of the file represents
 */
function readJsonFile(path, options) {
    const content = (0, node_fs_1.readFileSync)(path, 'utf-8');
    if (options) {
        options.endsWithNewline = content.charCodeAt(content.length - 1) === 10;
    }
    try {
        return (0, json_1.parseJson)(content, options);
    }
    catch (e) {
        e.message = e.message.replace('JSON', path);
        throw e;
    }
}
/**
 * Reads a YAML file and returns the object the YAML content represents.
 *
 * @param path A path to a file.
 * @returns
 */
function readYamlFile(path, options) {
    const content = (0, node_fs_1.readFileSync)(path, 'utf-8');
    const { load } = require('@zkochan/js-yaml');
    return load(content, { ...options, filename: path });
}
/**
 * Serializes the given data to JSON and writes it to a file.
 *
 * @param path A path to a file.
 * @param data data which should be serialized to JSON and written to the file
 * @param options JSON serialize options
 */
function writeJsonFile(path, data, options) {
    (0, node_fs_1.mkdirSync)((0, path_1.dirname)(path), { recursive: true });
    const serializedJson = (0, json_1.serializeJson)(data, options);
    const content = options?.appendNewLine
        ? `${serializedJson}\n`
        : serializedJson;
    (0, node_fs_1.writeFileSync)(path, content, { encoding: 'utf-8' });
}
/**
 * Serializes the given data to JSON and writes it to a file asynchronously.
 *
 * @param path A path to a file.
 * @param data data which should be serialized to JSON and written to the file
 * @param options JSON serialize options
 */
async function writeJsonFileAsync(path, data, options) {
    await (0, promises_1.mkdir)((0, path_1.dirname)(path), { recursive: true });
    const serializedJson = (0, json_1.serializeJson)(data, options);
    const content = options?.appendNewLine
        ? `${serializedJson}\n`
        : serializedJson;
    await (0, promises_1.writeFile)(path, content, { encoding: 'utf-8' });
}
/**
 * Check if a directory exists
 * @param path Path to directory
 */
function directoryExists(path) {
    try {
        return (0, node_fs_1.statSync)(path).isDirectory();
    }
    catch {
        return false;
    }
}
/**
 * Check if a file exists.
 * @param path Path to file
 */
function fileExists(path) {
    try {
        return (0, node_fs_1.statSync)(path).isFile();
    }
    catch {
        return false;
    }
}
function createDirectory(path) {
    (0, node_fs_1.mkdirSync)(path, { recursive: true });
}
function isRelativePath(path) {
    return (path === '.' ||
        path === '..' ||
        path.startsWith('./') ||
        path.startsWith('../'));
}
/**
 * Extracts a file from a given tarball to the specified destination.
 * @param tarballPath The path to the tarball from where the file should be extracted.
 * @param file The path to the file inside the tarball.
 * @param destinationFilePath The destination file path.
 * @returns True if the file was extracted successfully, false otherwise.
 */
async function extractFileFromTarball(tarballPath, file, destinationFilePath) {
    return new Promise((resolve, reject) => {
        (0, node_fs_1.mkdirSync)((0, path_1.dirname)(destinationFilePath), { recursive: true });
        var tarExtractStream = tar.extract();
        const destinationFileStream = (0, node_fs_1.createWriteStream)(destinationFilePath);
        let isFileExtracted = false;
        tarExtractStream.on('entry', function (header, stream, next) {
            if (header.name === file) {
                stream.pipe(destinationFileStream);
                stream.on('end', () => {
                    isFileExtracted = true;
                });
                destinationFileStream.on('close', () => {
                    resolve(destinationFilePath);
                });
            }
            stream.on('end', function () {
                next();
            });
            stream.resume();
        });
        tarExtractStream.on('finish', function () {
            if (!isFileExtracted) {
                reject();
            }
        });
        (0, node_fs_1.createReadStream)(tarballPath).pipe((0, zlib_1.createGunzip)()).pipe(tarExtractStream);
    });
}
function readFileIfExisting(path) {
    return (0, node_fs_1.existsSync)(path) ? (0, node_fs_1.readFileSync)(path, 'utf-8') : '';
}
