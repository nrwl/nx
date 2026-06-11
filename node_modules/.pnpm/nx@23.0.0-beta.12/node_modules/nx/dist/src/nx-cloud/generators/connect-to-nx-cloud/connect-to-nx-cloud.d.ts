import { Tree } from '../../../generators/tree';
import { NxJsonConfiguration } from '../../../config/nx-json';
export declare function printSuccessMessage(token: string | undefined, installationSource: string): Promise<string>;
export interface ConnectToNxCloudOptions {
    analytics?: boolean;
    installationSource?: string;
    hideFormatLogs?: boolean;
    github?: boolean;
    directory?: string;
    generateToken?: boolean;
}
export declare function connectToNxCloud(tree: Tree, schema: ConnectToNxCloudOptions, nxJson?: NxJsonConfiguration<string[] | "*">): Promise<string | null>;
declare function connectToNxCloudGenerator(tree: Tree, options: ConnectToNxCloudOptions): Promise<void>;
export default connectToNxCloudGenerator;
