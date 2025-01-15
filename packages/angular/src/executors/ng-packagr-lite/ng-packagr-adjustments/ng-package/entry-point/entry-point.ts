import {
  type DestinationFiles,
  NgEntryPoint as NgEntryPointBase,
} from 'ng-packagr/lib/ng-package/entry-point/entry-point';
import { dirname } from 'node:path';

export class NgEntryPoint extends NgEntryPointBase {
  /**
   * Point the FESM2022 files to the ESM2022 files.
   */
  public override get destinationFiles(): DestinationFiles {
    const result = super.destinationFiles;
    result.fesm2022 = result.esm2022;
    result.fesm2022Dir = dirname(result.esm2022);

    return result;
  }
}
