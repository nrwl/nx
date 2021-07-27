export interface DocumentData {
  filePath: string;
  data: { [key: string]: any };
  content: string;
  excerpt?: string;
}

export interface VersionMetadata {
  name: string;
  id: string;
  release: string;
  path: string;
  default?: boolean;
  hidden?: boolean;
}

export interface DocumentMetadata {
  id: string;
  name?: string;
  file?: string;
  searchResultsName?: string;
  itemList?: DocumentMetadata[];
}
