export declare function parseChangelogMarkdown(contents: string): {
    releases: {
        version?: string;
        body: string;
    }[];
};
