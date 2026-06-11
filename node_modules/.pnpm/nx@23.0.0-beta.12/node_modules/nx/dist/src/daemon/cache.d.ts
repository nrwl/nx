export interface DaemonProcessJson {
    processId: number;
    socketPath: string;
    nxVersion: string;
}
export declare const serverProcessJsonPath: string;
export declare function readDaemonProcessJsonCache(): DaemonProcessJson | null;
export declare function deleteDaemonJsonProcessCache(): void;
export declare function writeDaemonJsonProcessCache(daemonJson: DaemonProcessJson): Promise<void>;
export declare function getDaemonProcessIdSync(): number | null;
