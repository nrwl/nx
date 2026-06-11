import { HandlerResult } from './server';
export declare function handleRecordOutputsHashBatch(payload: {
    type: string;
    data: {
        outputs: string[];
        hash: string;
    }[];
}): Promise<HandlerResult>;
export declare function handleOutputsHashesMatchBatch(payload: {
    type: string;
    data: {
        outputs: string[];
        hash: string;
    }[];
}): Promise<HandlerResult>;
