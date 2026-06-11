export declare class ProjectLogger {
    private projectName;
    private logs;
    private color;
    constructor(projectName: string);
    buffer(msg: string): void;
    flush(): void;
}
