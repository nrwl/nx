export type ChangedFile = {
    path: string;
    type: 'create' | 'update' | 'delete';
};
export declare function getProjectsAndGlobalChanges(createdFiles: string[] | null, updatedFiles: string[] | null, deletedFiles: string[] | null): {
    projects: {
        [changedProject: string]: ChangedFile[];
    };
    globalFiles: ChangedFile[];
};
