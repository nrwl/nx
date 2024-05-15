"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startLocalRegistry = void 0;
const child_process_1 = require("child_process");
/**
 * This function is used to start a local registry for testing purposes.
 * @param localRegistryTarget the target to run to start the local registry e.g. workspace:local-registry
 * @param storage the storage location for the local registry
 * @param verbose whether to log verbose output
 */
function startLocalRegistry({ localRegistryTarget, storage, verbose, }) {
    if (!localRegistryTarget) {
        throw new Error(`localRegistryTarget is required`);
    }
    return new Promise((resolve, reject) => {
        const childProcess = (0, child_process_1.fork)(require.resolve('nx'), [
            ...`run ${localRegistryTarget} --location none --clear false`.split(' '),
            ...(storage ? [`--storage`, storage] : []),
        ], { stdio: 'pipe' });
        const listener = (data) => {
            if (verbose) {
                process.stdout.write(data);
            }
            if (data.toString().includes('http://localhost:')) {
                const port = parseInt(data.toString().match(/localhost:(?<port>\d+)/)?.groups?.port);
                console.log('Local registry started on port ' + port);
                const registry = `http://localhost:${port}`;
                process.env.npm_config_registry = registry;
                (0, child_process_1.execSync)(`npm config set //localhost:${port}/:_authToken "secretVerdaccioToken"`);
                // yarnv1
                process.env.YARN_REGISTRY = registry;
                // yarnv2
                process.env.YARN_NPM_REGISTRY_SERVER = registry;
                process.env.YARN_UNSAFE_HTTP_WHITELIST = 'localhost';
                console.log('Set npm and yarn config registry to ' + registry);
                resolve(() => {
                    childProcess.kill();
                    (0, child_process_1.execSync)(`npm config delete //localhost:${port}/:_authToken`);
                });
                childProcess?.stdout?.off('data', listener);
            }
        };
        childProcess?.stdout?.on('data', listener);
        childProcess?.stderr?.on('data', (data) => {
            process.stderr.write(data);
        });
        childProcess.on('error', (err) => {
            console.log('local registry error', err);
            reject(err);
        });
        childProcess.on('exit', (code) => {
            console.log('local registry exit', code);
            if (code !== 0) {
                reject(code);
            }
            else {
                resolve(() => { });
            }
        });
    });
}
exports.startLocalRegistry = startLocalRegistry;
exports.default = startLocalRegistry;
