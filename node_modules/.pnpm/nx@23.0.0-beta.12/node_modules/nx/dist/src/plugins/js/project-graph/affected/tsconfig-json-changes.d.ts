import { WholeFileChange } from '../../../../project-graph/file-utils';
import { JsonChange } from '../../../../utils/json-diff';
import { TouchedProjectLocator } from '../../../../project-graph/affected/affected-project-graph-models';
export declare const getTouchedProjectsFromTsConfig: TouchedProjectLocator<WholeFileChange | JsonChange>;
