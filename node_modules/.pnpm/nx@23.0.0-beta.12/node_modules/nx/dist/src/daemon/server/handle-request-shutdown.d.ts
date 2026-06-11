import { Server } from 'net';
export declare function handleRequestShutdown(server: Server, numberOfConnections: number): Promise<{
    description: string;
    response: string;
}>;
