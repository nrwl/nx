import { TouchedProjectLocator } from '../../../../project-graph/affected/affected-project-graph-models';
import { WholeFileChange } from '../../../../project-graph/file-utils';
import { JsonChange } from '../../../../utils/json-diff';
export declare const PNPM_LOCK_FILES: string[];
export declare const getTouchedProjectsFromLockFile: TouchedProjectLocator<WholeFileChange | JsonChange>;
