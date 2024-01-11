import { UiFramework } from '../../utils/models';

export interface Schema {
  uiFramework: UiFramework;
  skipFormat?: boolean;
  skipPackageJson?: boolean;
}
