import { JsonObject } from '@angular-devkit/core';

export interface Schema extends JsonObject {
  projectName: string;
  skipFormat: boolean;
  forceRemove: boolean;
}
