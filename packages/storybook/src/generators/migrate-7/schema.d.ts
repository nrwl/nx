import { UiFramework, UiFramework7 } from '../../utils/models';

export interface Schema {
  autoAcceptAllPrompts?: boolean;
  onlyShowListOfCommands?: boolean;
  noUpgrade?: boolean;
  onlyPrepare?: boolean;
  afterMigration?: boolean;
}
