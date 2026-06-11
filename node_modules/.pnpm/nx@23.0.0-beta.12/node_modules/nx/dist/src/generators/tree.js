"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FsTree = void 0;
exports.flushChanges = flushChanges;
exports.printChanges = printChanges;
const tslib_1 = require("tslib");
const node_fs_1 = require("node:fs");
const logger_1 = require("../utils/logger");
const output_1 = require("../utils/output");
const path_1 = require("path");
const pc = tslib_1.__importStar(require("picocolors"));
class FsTree {
    constructor(root, isVerbose, logOperationId) {
        this.root = root;
        this.isVerbose = isVerbose;
        this.logOperationId = logOperationId;
        this.recordedChanges = {};
        /**
         * Signifies if operations on the tree instance
         * are allowed. Set to false after changes are written
         * to disk, to prevent someone trying to use the tree to update
         * files when the tree is no longer effective.
         */
        this.locked = false;
    }
    read(filePath, encoding) {
        filePath = this.normalize(filePath);
        try {
            let content;
            if (this.recordedChanges[this.rp(filePath)]) {
                content = this.recordedChanges[this.rp(filePath)].content;
            }
            else {
                content = this.fsReadFile(filePath);
            }
            return encoding ? content.toString(encoding) : content;
        }
        catch (e) {
            if (this.isVerbose) {
                logger_1.logger.error(e);
            }
            return null;
        }
    }
    write(filePath, content, options) {
        this.assertUnlocked();
        filePath = this.normalize(filePath);
        // Remove any recorded changes where a parent directory has been
        // deleted when writing a new file within the directory.
        let parent = (0, path_1.dirname)(this.rp(filePath));
        while (parent !== '.') {
            if (this.recordedChanges[parent]?.isDeleted) {
                delete this.recordedChanges[parent];
            }
            parent = (0, path_1.dirname)(parent);
        }
        if (this.fsExists(this.rp(filePath)) &&
            Buffer.from(content).equals(this.fsReadFile(filePath))) {
            // Remove recorded change because the file has been restored to it's original contents
            delete this.recordedChanges[this.rp(filePath)];
            return;
        }
        try {
            this.recordedChanges[this.rp(filePath)] = {
                content: Buffer.from(content),
                isDeleted: false,
                options,
            };
        }
        catch (e) {
            if (this.isVerbose) {
                logger_1.logger.error(e);
            }
        }
    }
    overwrite(filePath, content, options) {
        filePath = this.normalize(filePath);
        this.write(filePath, content, options);
    }
    delete(filePath) {
        this.assertUnlocked();
        filePath = this.normalize(filePath);
        if (this.filesForDir(this.rp(filePath)).length > 0) {
            this.filesForDir(this.rp(filePath)).forEach((f) => (this.recordedChanges[f] = { content: null, isDeleted: true }));
        }
        this.recordedChanges[this.rp(filePath)] = {
            content: null,
            isDeleted: true,
        };
        // Delete directory when is not root and there are no children
        if (filePath !== '' &&
            this.children((0, path_1.dirname)(this.rp(filePath))).length < 1) {
            this.delete((0, path_1.dirname)(this.rp(filePath)));
        }
    }
    exists(filePath) {
        filePath = this.normalize(filePath);
        try {
            if (this.recordedChanges[this.rp(filePath)]) {
                return !this.recordedChanges[this.rp(filePath)].isDeleted;
            }
            else if (this.filesForDir(this.rp(filePath)).length > 0) {
                return true;
            }
            else {
                return this.fsExists(filePath);
            }
        }
        catch {
            return false;
        }
    }
    rename(from, to) {
        this.assertUnlocked();
        from = this.normalize(from);
        to = this.normalize(to);
        if (from === to) {
            return;
        }
        if (this.isFile(from)) {
            const content = this.read(this.rp(from));
            this.write(this.rp(to), content);
            this.delete(this.rp(from));
        }
        else {
            for (const child of this.children(from)) {
                this.rename((0, path_1.join)(from, child), (0, path_1.join)(to, child));
            }
        }
    }
    isFile(filePath) {
        filePath = this.normalize(filePath);
        try {
            if (this.recordedChanges[this.rp(filePath)]) {
                return !this.recordedChanges[this.rp(filePath)].isDeleted;
            }
            else {
                return this.fsIsFile(filePath);
            }
        }
        catch {
            return false;
        }
    }
    children(dirPath) {
        dirPath = this.normalize(dirPath);
        let res = this.fsReadDir(dirPath);
        res = [...res, ...this.directChildrenOfDir(this.rp(dirPath))];
        res = res.filter((q) => {
            const r = this.recordedChanges[this.normalize((0, path_1.join)(this.rp(dirPath), q))];
            return !r?.isDeleted;
        });
        // Dedupe
        return Array.from(new Set(res));
    }
    listChanges() {
        const res = [];
        Object.keys(this.recordedChanges).forEach((f) => {
            if (this.recordedChanges[f].isDeleted) {
                if (this.fsExists(f)) {
                    res.push({ path: f, type: 'DELETE', content: null });
                }
            }
            else {
                if (this.fsExists(f)) {
                    res.push({
                        path: f,
                        type: 'UPDATE',
                        content: this.recordedChanges[f].content,
                        options: this.recordedChanges[f].options,
                    });
                }
                else {
                    res.push({
                        path: f,
                        type: 'CREATE',
                        content: this.recordedChanges[f].content,
                        options: this.recordedChanges[f].options,
                    });
                }
            }
        });
        return res;
    }
    changePermissions(filePath, mode) {
        this.assertUnlocked();
        filePath = this.normalize(filePath);
        const filePathChangeKey = this.rp(filePath);
        if (this.recordedChanges[filePathChangeKey]) {
            if (this.recordedChanges[filePathChangeKey].isDeleted) {
                throw new Error(`Cannot change permissions of deleted file ${filePath}.`);
            }
            this.recordedChanges[filePathChangeKey].options = { mode };
        }
        else if (!this.fsExists(filePath)) {
            throw new Error(`Cannot change permissions of non-existing file ${filePath}.`);
        }
        else if (!this.fsIsFile(filePath)) {
            // To fully support directories we'd need to change how we store
            // changes to keep a record of directories so we can associate
            // permissions to them.
            throw new Error(`Cannot change permissions of non-file ${filePath}.`);
        }
        else {
            this.recordedChanges[filePathChangeKey] = {
                content: this.fsReadFile(filePath),
                isDeleted: false,
                options: { mode },
            };
        }
    }
    // Marks FsTree as final.
    lock() {
        this.locked = true;
    }
    assertUnlocked() {
        if (this.locked) {
            output_1.output.error({
                title: `File changes have already been written to disk. Further changes were attempted ${this.logOperationId ? ` while running ${this.logOperationId}.` : '.'}`,
                bodyLines: [
                    'The file system can no longer be modified. This commonly happens when a generator attempts to make further changes in its callback, or an asynchronous operation is still running after the generator completes.',
                ],
            });
            throw new Error('Tree changed after commit to disk.');
        }
    }
    normalize(path) {
        return (0, path_1.relative)(this.root, (0, path_1.join)(this.root, path)).split(path_1.sep).join('/');
    }
    fsReadDir(dirPath) {
        try {
            return (0, node_fs_1.readdirSync)((0, path_1.join)(this.root, dirPath));
        }
        catch {
            return [];
        }
    }
    fsIsFile(filePath) {
        const stat = (0, node_fs_1.statSync)((0, path_1.join)(this.root, filePath));
        return stat.isFile();
    }
    fsReadFile(filePath) {
        return (0, node_fs_1.readFileSync)((0, path_1.join)(this.root, filePath));
    }
    fsExists(filePath) {
        try {
            const stat = (0, node_fs_1.statSync)((0, path_1.join)(this.root, filePath));
            return stat.isFile() || stat.isDirectory();
        }
        catch {
            return false;
        }
    }
    filesForDir(path) {
        return Object.keys(this.recordedChanges).filter((f) => f.startsWith(`${path}/`) && !this.recordedChanges[f].isDeleted);
    }
    directChildrenOfDir(path) {
        const res = {};
        if (path === '') {
            return Object.keys(this.recordedChanges).map((file) => file.split('/')[0]);
        }
        Object.keys(this.recordedChanges).forEach((f) => {
            if (f.startsWith(`${path}/`)) {
                // Remove the current folder's path from the directory
                const file = f.substring(path.length + 1);
                // Split the path on segments, and take the first one
                const basePath = file.split('/')[0];
                // Mark it as a child of the current directory
                res[basePath] = true;
            }
        });
        return Object.keys(res);
    }
    rp(pp) {
        return pp.startsWith('/') ? pp.substring(1) : pp;
    }
}
exports.FsTree = FsTree;
function flushChanges(root, fileChanges) {
    fileChanges.forEach((f) => {
        const fpath = (0, path_1.join)(root, f.path);
        if (f.type === 'CREATE') {
            (0, node_fs_1.mkdirSync)((0, path_1.dirname)(fpath), { recursive: true });
            (0, node_fs_1.writeFileSync)(fpath, f.content);
            if (f.options?.mode)
                (0, node_fs_1.chmodSync)(fpath, f.options.mode);
        }
        else if (f.type === 'UPDATE') {
            (0, node_fs_1.writeFileSync)(fpath, f.content);
            if (f.options?.mode)
                (0, node_fs_1.chmodSync)(fpath, f.options.mode);
        }
        else if (f.type === 'DELETE') {
            (0, node_fs_1.rmSync)(fpath, { recursive: true, force: true });
        }
    });
}
function printChanges(fileChanges, indent = '') {
    fileChanges.forEach((f) => {
        if (f.type === 'CREATE') {
            console.log(`${indent}${pc.green('CREATE')} ${f.path}`);
        }
        else if (f.type === 'UPDATE') {
            console.log(`${indent}${pc.white('UPDATE')} ${f.path}`);
        }
        else if (f.type === 'DELETE') {
            console.log(`${indent}${pc.yellow('DELETE')} ${f.path}`);
        }
    });
}
