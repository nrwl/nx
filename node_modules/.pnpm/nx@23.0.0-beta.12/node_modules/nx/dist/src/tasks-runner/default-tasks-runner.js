"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultTasksRunner = exports.RemoteCacheV2 = void 0;
const task_orchestrator_1 = require("./task-orchestrator");
const cache_directory_1 = require("../utils/cache-directory");
const promises_1 = require("fs/promises");
const path_1 = require("path");
class RemoteCacheV2 {
    static async fromCacheV1(cache) {
        await (0, promises_1.mkdir)((0, path_1.join)(cache_directory_1.cacheDir, 'terminalOutputs'), { recursive: true });
        return {
            retrieve: async (hash, cacheDirectory) => {
                const res = await cache.retrieve(hash, cacheDirectory);
                if (res) {
                    const [terminalOutput, oldTerminalOutput, code] = await Promise.all([
                        (0, promises_1.readFile)((0, path_1.join)(cacheDirectory, hash, 'terminalOutputs'), 'utf-8').catch(() => null),
                        (0, promises_1.readFile)((0, path_1.join)(cache_directory_1.cacheDir, 'terminalOutputs', hash), 'utf-8').catch(() => null),
                        (0, promises_1.readFile)((0, path_1.join)(cacheDirectory, hash, 'code'), 'utf-8').then((s) => +s),
                    ]);
                    return {
                        outputsPath: (0, path_1.join)(cacheDirectory, hash, 'outputs'),
                        terminalOutput: terminalOutput ?? oldTerminalOutput,
                        code,
                    };
                }
                else {
                    return null;
                }
            },
            store: async (hash, cacheDirectory, terminalOutput, code) => {
                // The new db cache places the outputs directly into the cacheDirectory + hash.
                // old instances of Nx Cloud expect these outputs to be in cacheDirectory + hash + outputs
                // this ensures that everything that was in the cache directory is moved to the outputs directory
                const cacheDir = (0, path_1.join)(cacheDirectory, hash);
                const outputDir = (0, path_1.join)(cacheDir, 'outputs');
                await (0, promises_1.mkdir)(outputDir, { recursive: true });
                const files = await (0, promises_1.readdir)(cacheDir);
                await Promise.all(files.map(async (file) => {
                    const filePath = (0, path_1.join)(cacheDir, file);
                    // we don't want to move these files to the outputs directory because they are not artifacts of the task
                    if (filePath === outputDir ||
                        file === 'code' ||
                        file === 'terminalOutput') {
                        return;
                    }
                    await (0, promises_1.rename)(filePath, (0, path_1.join)(outputDir, file));
                }));
                await (0, promises_1.writeFile)((0, path_1.join)(cacheDirectory, hash, 'code'), code.toString());
                await (0, promises_1.writeFile)((0, path_1.join)(cacheDirectory, hash, 'terminalOutput'), terminalOutput);
                return cache.store(hash, cacheDirectory);
            },
        };
    }
}
exports.RemoteCacheV2 = RemoteCacheV2;
const defaultTasksRunner = async (tasks, options, context) => {
    const { total: threadCount } = (0, task_orchestrator_1.getThreadPoolSize)(options, context.taskGraph);
    await options.lifeCycle.startCommand(threadCount);
    try {
        return await runAllTasks(options, context);
    }
    finally {
        await options.lifeCycle.endCommand();
    }
};
exports.defaultTasksRunner = defaultTasksRunner;
async function runAllTasks(options, context) {
    const orchestrator = new task_orchestrator_1.TaskOrchestrator(context.hasher, context.initiatingProject, context.initiatingTasks, context.projectGraph, context.taskGraph, context.nxJson, options, context.nxArgs?.nxBail, context.daemon, context.nxArgs?.outputStyle);
    return orchestrator.run();
}
exports.default = exports.defaultTasksRunner;
