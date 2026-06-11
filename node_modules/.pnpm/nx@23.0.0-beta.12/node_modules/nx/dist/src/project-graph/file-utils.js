"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TEN_MEGABYTES = exports.DeletedFileChange = exports.WholeFileChange = void 0;
exports.isWholeFileChange = isWholeFileChange;
exports.isDeletedFileChange = isDeletedFileChange;
exports.calculateFileChanges = calculateFileChanges;
exports.defaultFileRead = defaultFileRead;
exports.readPackageJson = readPackageJson;
const child_process_1 = require("child_process");
const fs_1 = require("fs");
const path_1 = require("path");
const fileutils_1 = require("../utils/fileutils");
const ignore_1 = require("../utils/ignore");
const json_diff_1 = require("../utils/json-diff");
const workspace_root_1 = require("../utils/workspace-root");
class WholeFileChange {
    constructor() {
        this.type = 'WholeFileChange';
    }
}
exports.WholeFileChange = WholeFileChange;
class DeletedFileChange {
    constructor() {
        this.type = 'WholeFileDeleted';
    }
}
exports.DeletedFileChange = DeletedFileChange;
function isWholeFileChange(change) {
    return change.type === 'WholeFileChange';
}
function isDeletedFileChange(change) {
    return change.type === 'WholeFileDeleted';
}
function calculateFileChanges(files, nxArgs, readFileAtRevision = defaultReadFileAtRevision, ignore = (0, ignore_1.getIgnoreObject)()) {
    files = files.filter((f) => !ignore.ignores(f));
    return files.map((f) => {
        const ext = (0, path_1.extname)(f);
        return {
            file: f,
            getChanges: () => {
                if (!(0, fs_1.existsSync)((0, path_1.join)(workspace_root_1.workspaceRoot, f))) {
                    return [new DeletedFileChange()];
                }
                if (!nxArgs) {
                    return [new WholeFileChange()];
                }
                if (nxArgs.files && nxArgs.files.includes(f)) {
                    return [new WholeFileChange()];
                }
                switch (ext) {
                    case '.json':
                        try {
                            const atBase = readFileAtRevision(f, nxArgs.base);
                            const atHead = readFileAtRevision(f, nxArgs.head);
                            return (0, json_diff_1.jsonDiff)(JSON.parse(atBase), JSON.parse(atHead));
                        }
                        catch (e) {
                            return [new WholeFileChange()];
                        }
                    case '.yml':
                    case '.yaml':
                        const { load } = require('@zkochan/js-yaml');
                        try {
                            const atBase = readFileAtRevision(f, nxArgs.base);
                            const atHead = readFileAtRevision(f, nxArgs.head);
                            return (0, json_diff_1.jsonDiff)(load(atBase), load(atHead));
                        }
                        catch (e) {
                            return [new WholeFileChange()];
                        }
                    default:
                        return [new WholeFileChange()];
                }
            },
        };
    });
}
exports.TEN_MEGABYTES = 1024 * 10000;
function defaultReadFileAtRevision(file, revision) {
    try {
        const fileFullPath = `${workspace_root_1.workspaceRoot}${path_1.sep}${file}`;
        const gitRepositoryPath = (0, child_process_1.execSync)('git rev-parse --show-toplevel', {
            windowsHide: true,
        })
            .toString()
            .trim();
        const filePathInGitRepository = (0, path_1.relative)(gitRepositoryPath, fileFullPath)
            .split(path_1.sep)
            .join('/');
        return !revision
            ? (0, fs_1.readFileSync)(file, 'utf-8')
            : (0, child_process_1.execSync)(`git show ${revision}:${filePathInGitRepository}`, {
                maxBuffer: exports.TEN_MEGABYTES,
                stdio: ['pipe', 'pipe', 'ignore'],
                windowsHide: true,
            })
                .toString()
                .trim();
    }
    catch {
        return '';
    }
}
function defaultFileRead(filePath) {
    return (0, fs_1.readFileSync)((0, path_1.join)(workspace_root_1.workspaceRoot, filePath), 'utf-8');
}
function readPackageJson(root = workspace_root_1.workspaceRoot) {
    try {
        return (0, fileutils_1.readJsonFile)(`${root}/package.json`);
    }
    catch {
        return {}; // if package.json doesn't exist
    }
}
