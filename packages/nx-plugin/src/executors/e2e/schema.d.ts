import { JsonObject } from '@angular-devkit/core';

export interface Schema extends JsonObject {
  target: string;
  jestConfig: string;
}
