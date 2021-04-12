export interface DocumentData {
  filePath: string;
  data: { [key: string]: any };
  content: string;
  excerpt?: string;
}

export interface ArchiveVersionData {
  name: string;
  id: string;
  release: string;
  path: string;
  default: boolean;
}

export interface DocumentMapItem {
  name: string;
  id: string;
  file?: string;
  itemList?: DocumentMapItem[];
}
