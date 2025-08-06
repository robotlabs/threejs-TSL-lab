import type { Assets } from "@/types/types";

function isImageAsset(a: unknown): a is HTMLImageElement {
  return a instanceof HTMLImageElement;
}

export default class App {
  constructor() {
    console.log("App created");
  }

  init(container: HTMLElement, assets: Assets = {}) {
    console.log("App initialized with assets:", assets);

    // Append any image assets you expect
    const imageIds = ["test-image-local", "test-image-remote"];
    imageIds.forEach((id) => {
      const asset = assets[id];
      if (isImageAsset(asset)) {
        asset.style.maxWidth = "400px";
        asset.style.border = "2px solid #ccc";
        asset.style.margin = "20px";
        document.body.appendChild(asset);
        console.log(`Appended image asset "${id}" to DOM.`);
      }
    });

    // Example: remote image used for Three.js
    const remoteImage = assets["test-image-remote"];
    if (isImageAsset(remoteImage)) {
      console.log("Remote image ready for Three.js:", remoteImage.src);
      // e.g.
      // const texture = new THREE.Texture(remoteImage);
      // texture.needsUpdate = true;
    }

    // Access config
    const config = assets["config"];
    if (config && typeof config === "object") {
      console.log("Config loaded:", config);
    }
  }
}
