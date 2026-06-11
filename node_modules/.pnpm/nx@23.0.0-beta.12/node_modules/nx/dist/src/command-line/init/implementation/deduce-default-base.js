"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deduceDefaultBase = deduceDefaultBase;
const node_child_process_1 = require("node:child_process");
const default_base_1 = require("../../../utils/default-base");
function deduceDefaultBase() {
    try {
        (0, node_child_process_1.execSync)(`git rev-parse --verify main`, {
            stdio: ['ignore', 'ignore', 'ignore'],
            windowsHide: true,
        });
        return 'main';
    }
    catch {
        try {
            (0, node_child_process_1.execSync)(`git rev-parse --verify dev`, {
                stdio: ['ignore', 'ignore', 'ignore'],
                windowsHide: true,
            });
            return 'dev';
        }
        catch {
            try {
                (0, node_child_process_1.execSync)(`git rev-parse --verify develop`, {
                    stdio: ['ignore', 'ignore', 'ignore'],
                    windowsHide: true,
                });
                return 'develop';
            }
            catch {
                try {
                    (0, node_child_process_1.execSync)(`git rev-parse --verify next`, {
                        stdio: ['ignore', 'ignore', 'ignore'],
                        windowsHide: true,
                    });
                    return 'next';
                }
                catch {
                    try {
                        (0, node_child_process_1.execSync)(`git rev-parse --verify master`, {
                            stdio: ['ignore', 'ignore', 'ignore'],
                            windowsHide: true,
                        });
                        return 'master';
                    }
                    catch {
                        return (0, default_base_1.deduceDefaultBase)();
                    }
                }
            }
        }
    }
}
