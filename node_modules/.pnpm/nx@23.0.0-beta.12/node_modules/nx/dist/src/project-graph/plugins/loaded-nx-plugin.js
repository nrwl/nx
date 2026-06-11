"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoadedNxPlugin = void 0;
const analytics_1 = require("../../analytics");
const error_types_1 = require("../error-types");
const enabled_1 = require("./isolation/enabled");
const client_1 = require("../../daemon/client/client");
/**
 * NOTE: Avoid using `import type` with this class. It causes issues with
 * jest's module resolution when running tests in projects that import
 * the devkit-internals
 */
class LoadedNxPlugin {
    constructor(plugin, pluginDefinition, index) {
        this.index = index;
        this.name = plugin.name;
        if (typeof pluginDefinition !== 'string') {
            this.options = pluginDefinition.options;
            this.include = pluginDefinition.include;
            this.exclude = pluginDefinition.exclude;
        }
        const createNodesV2Impl = plugin.createNodesV2 ?? plugin.createNodes;
        if (createNodesV2Impl) {
            this.createNodes = [
                createNodesV2Impl[0],
                async (configFiles, context) => {
                    const result = await createNodesV2Impl[1](configFiles, this.options, context);
                    return result.map((r) => [this.name, r[0], r[1]]);
                },
            ];
        }
        /**
         * Wraps the plugin-provided createNodes function to provide performance
         * measurement and error handling.
         */
        if (this.createNodes) {
            const inner = this.createNodes[1];
            this.createNodes[1] = async (...args) => {
                performance.mark(`${plugin.name}:createNodes - start`);
                let projectCount = 0;
                try {
                    const result = await inner(...args);
                    for (const [, , r] of result) {
                        projectCount += Object.keys(r.projects ?? {}).length;
                    }
                    return result;
                }
                catch (e) {
                    if ((0, error_types_1.isAggregateCreateNodesError)(e)) {
                        throw e;
                    }
                    // The underlying plugin errored out. We can't know any partial results.
                    throw new error_types_1.AggregateCreateNodesError([[null, e]], []);
                }
                finally {
                    performance.mark(`${plugin.name}:createNodes - end`);
                    performance.measure(`${plugin.name}:createNodes`, {
                        start: `${plugin.name}:createNodes - start`,
                        end: `${plugin.name}:createNodes - end`,
                        detail: {
                            track: true,
                            ...(analytics_1.customDimensions && {
                                [analytics_1.customDimensions.projectCount]: projectCount,
                            }),
                        },
                    });
                }
            };
        }
        if (plugin.createDependencies) {
            this.createDependencies = async (context) => plugin.createDependencies(this.options, context);
        }
        if (plugin.createMetadata) {
            this.createMetadata = async (graph, context) => plugin.createMetadata(graph, this.options, context);
        }
        if (plugin.preTasksExecution) {
            this.preTasksExecution = async (context) => {
                const updates = {};
                let originalEnv = process.env;
                if ((0, enabled_1.isIsolationEnabled)() || (0, client_1.isDaemonEnabled)()) {
                    process.env = new Proxy(originalEnv, {
                        set: (target, key, value) => {
                            target[key] = value;
                            updates[key] = value;
                            return true;
                        },
                    });
                }
                await plugin.preTasksExecution(this.options, context);
                // This doesn't revert env changes, as the proxy still updates
                // originalEnv, rather it removes the proxy.
                process.env = originalEnv;
                return updates;
            };
        }
        if (plugin.postTasksExecution) {
            this.postTasksExecution = async (context) => plugin.postTasksExecution(this.options, context);
        }
    }
}
exports.LoadedNxPlugin = LoadedNxPlugin;
