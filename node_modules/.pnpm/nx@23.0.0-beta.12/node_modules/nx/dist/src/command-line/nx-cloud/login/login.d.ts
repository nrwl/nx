export interface LoginArgs {
    nxCloudUrl?: string;
    verbose?: boolean;
}
export declare function loginHandler(args: LoginArgs): Promise<number>;
