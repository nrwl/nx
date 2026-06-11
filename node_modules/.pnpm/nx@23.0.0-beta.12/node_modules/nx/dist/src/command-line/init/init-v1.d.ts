export interface InitArgs {
    integrated: boolean;
    interactive: boolean;
    nxCloud?: boolean;
    cacheable?: string[];
    useDotNxInstallation?: boolean;
}
export declare function initHandler(options: InitArgs): Promise<void>;
