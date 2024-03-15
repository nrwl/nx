import { BacklinkDocument } from '@nx/nx-dev/models-document';

export class BacklinksApi {
  private readonly manifest: Record<string, BacklinkDocument[]>;

  constructor(private readonly backlinks: Record<string, BacklinkDocument[]>) {
    if (!backlinks) {
      throw new Error('backlinks property cannot be undefined');
    }

    this.manifest = structuredClone(this.backlinks);
  }

  public getBackLinks(id: string): BacklinkDocument[] {
    return this.manifest[id] || [];
  }
}
