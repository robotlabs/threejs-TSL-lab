export type LoadResult = {
  id: string;
  asset: unknown;
  failed: boolean;
};

export interface ImageItem {
  id: string;
  type: "image";
  url: string;
  crossOrigin?: string; // optional if needed
}

export interface JsonItem {
  id: string;
  type: "json";
  url: string;
}

export type ManifestItem = ImageItem | JsonItem;

export interface Manifest {
  items: ManifestItem[];
}

export type Assets = Record<string, unknown>;
