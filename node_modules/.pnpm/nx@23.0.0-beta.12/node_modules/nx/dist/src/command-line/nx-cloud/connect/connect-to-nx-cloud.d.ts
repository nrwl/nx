import { ConnectToNxCloudOptions } from '../../../nx-cloud/generators/connect-to-nx-cloud/connect-to-nx-cloud';
import { NxJsonConfiguration } from '../../../config/nx-json';
import { NxArgs } from '../../../utils/command-line-utils';
import { MessageKey, MessageOptionKey } from '../../../utils/ab-testing';
export declare function onlyDefaultRunnerIsUsed(nxJson: NxJsonConfiguration): boolean;
export declare function connectToNxCloudIfExplicitlyAsked(opts: NxArgs): Promise<void>;
export declare function connectWorkspaceToCloud(options: ConnectToNxCloudOptions, directory?: string): Promise<string>;
export declare function connectToNxCloudCommand(options: {
    generateToken?: boolean;
    checkRemote?: boolean;
}, command?: string): Promise<boolean>;
export declare function connectExistingRepoToNxCloudPrompt(command?: string, key?: MessageKey): Promise<MessageOptionKey>;
export declare function connectToNxCloudWithPrompt(command: string): Promise<void>;
