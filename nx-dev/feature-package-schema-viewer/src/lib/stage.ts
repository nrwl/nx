import { JsonSchema } from '@nrwl/nx-dev/models-package';

export type Stage = 'read' | 'write' | 'both';

export function shouldShowInStage(stage: Stage, schema: JsonSchema): boolean {
  if (typeof schema === 'boolean') {
    return true;
  }

  if (stage === 'both') {
    return true;
  }

  const readOnly = !!schema.readOnly;
  const writeOnly = !!schema.writeOnly;

  if (readOnly === writeOnly) {
    return true;
  }

  if (stage === 'read' && readOnly) {
    return true;
  }

  if (stage === 'write' && writeOnly) {
    return true;
  }

  return false;
}
