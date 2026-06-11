import { Server } from 'net';
export declare function handleForceShutdown(server: Server): Promise<{
    description: string;
    response: string;
}>;
