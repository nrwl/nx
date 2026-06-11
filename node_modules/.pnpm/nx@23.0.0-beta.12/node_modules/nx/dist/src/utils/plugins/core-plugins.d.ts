export interface CorePlugin {
    name: string;
    capabilities: 'executors' | 'generators' | 'executors,generators' | 'graph';
    link?: string;
}
export declare const CORE_PLUGINS: CorePlugin[];
