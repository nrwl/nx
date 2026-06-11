import { NxJsonConfiguration } from '../../config/nx-json';
import { PackageJson } from '../../utils/package-json';
import { Agent } from '../../ai/utils';
export interface InitArgs {
    interactive: boolean;
    nxCloud?: boolean;
    useDotNxInstallation?: boolean;
    integrated?: boolean;
    verbose?: boolean;
    aiAgents?: Agent[];
    plugins?: string;
    cacheable?: string[];
}
export declare function initHandler(options: InitArgs, inner?: boolean): Promise<void>;
/**
 * Generate a reason for why a plugin was detected.
 * Used for AI `needs_input` output.
 */
export declare function getPluginReason(plugin: string): string;
export declare function detectPlugins(nxJson: NxJsonConfiguration, packageJson: PackageJson | null, interactive: boolean, includeAngularCli?: boolean): Promise<{
    plugins: string[];
    updatePackageScripts: boolean;
}>;
