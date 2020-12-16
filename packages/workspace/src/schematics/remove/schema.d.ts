import { json } from '@angular-devkit/core';

export interface Schema extends json.JsonObject {
  projectName: string;
  skipFormat: boolean;
  forceRemove: boolean;
}
