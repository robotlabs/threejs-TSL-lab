import AsyncPreloader from "async-preloader";
import type { Assets, Manifest, ManifestItem } from "@/types/types";

type LoadResult = {
  id: string;
  asset: unknown;
  failed: boolean;
};

export class Preloader {
  private static imageCache = new Map<string, Promise<HTMLImageElement>>();

  static async init(): Promise<Assets> {
    const manifest = await this.loadManifest();
    return this.preload(manifest);
  }

  private static async loadManifest(): Promise<Manifest> {
    try {
      const response = await fetch("/data/manifest.json");
      if (!response.ok) {
        throw new Error(`Manifest fetch failed: ${response.status}`);
      }
      return (await response.json()) as Manifest;
    } catch (e) {
      console.warn("Manifest not found or invalid, using empty manifest", e);
      return { items: [] };
    }
  }

  private static loadImage(
    url: string,
    crossOrigin = "anonymous"
  ): Promise<HTMLImageElement> {
    if (this.imageCache.has(url)) {
      return this.imageCache.get(url)!;
    }
    const p = new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = crossOrigin;
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
      img.src = url;
    });
    this.imageCache.set(url, p);
    return p;
  }

  private static async loadJSON(url: string): Promise<unknown> {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`JSON fetch failed: ${res.status} ${res.statusText}`);
    }
    return res.json();
  }

  private static async preload(
    manifest: Manifest = { items: [] }
  ): Promise<Assets> {
    const { items } = manifest;
    if (!items || items.length === 0) return {};

    const results: LoadResult[] = await Promise.all(
      items.map(async (item): Promise<LoadResult> => {
        try {
          if (item.type === "image") {
            // item is ImageItem here, so crossOrigin may exist
            const img = await this.loadImage(
              item.url,
              (item as any).crossOrigin ?? "anonymous"
            );
            return { id: item.id, asset: img, failed: false };
          }

          if (item.type === "json") {
            const data = await this.loadJSON(item.url);
            return { id: item.id, asset: data, failed: false };
          }

          // fallback for future/unknown types — not expected given current manifest types
          const asset = await AsyncPreloader.loadItem((item as any).url);
          // return { id: item.id, asset, failed: false };
        } catch (err) {
          console.error(`Failed to load "${item.id}" from "${item.url}":`, err);
          return { id: item.id, asset: null, failed: true };
        }
      })
    );

    const assets: Assets = {};
    const failedIds: string[] = [];

    for (const { id, asset, failed } of results) {
      assets[id] = asset;
      if (failed) failedIds.push(id);
    }

    if (failedIds.length) {
      console.warn("Some assets failed to load:", failedIds);
    }

    return assets;
  }
}
