export interface DocumentData {
  filePath: string;
  data: { [key: string]: any };
  content: string;
  excerpt?: string;
}

export interface VersionData {
  name: string;
  id: string;
  release: string;
  path: string;
  default: boolean;
}

export interface Item {
  name: string;
  id: string;
  file?: string;
  itemList?: Item[];
}
