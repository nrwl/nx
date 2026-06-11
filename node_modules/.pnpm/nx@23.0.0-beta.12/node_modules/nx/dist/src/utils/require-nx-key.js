"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireNxKey = requireNxKey;
const child_process_1 = require("child_process");
const package_manager_1 = require("./package-manager");
const handle_import_1 = require("./handle-import");
async function requireNxKey() {
    // @ts-ignore
    return (0, handle_import_1.handleImport)('@nx/key').catch(async (e) => {
        if ('code' in e && e.code === 'MODULE_NOT_FOUND') {
            try {
                (0, child_process_1.execSync)(`${(0, package_manager_1.getPackageManagerCommand)().addDev} @nx/key@latest`, {
                    windowsHide: true,
                });
                // @ts-ignore
                return await (0, handle_import_1.handleImport)('@nx/key');
            }
            catch (e) {
                throw new Error('Failed to install @nx/key. Please install @nx/key and try again.');
            }
        }
    });
}
