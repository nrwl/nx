import { HandlerResult } from './server';
export declare function handleProcessInBackground(payload: {
    type: string;
    requirePath: string;
    data: any;
}): Promise<HandlerResult>;
