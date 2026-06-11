import type { ExecutorContext } from '../../config/misc-interfaces';
export interface RunScriptOptions {
    script: string;
    __unparsed__: string[];
}
export default function (options: RunScriptOptions, context: ExecutorContext): Promise<{
    success: boolean;
}>;
