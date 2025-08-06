import type App from "@/app/app";
import ThreeEngine from "@/engine/three-engine";

export type PlaneType = "wave" | "sdf" | "desert-tank" | "raymarching" | "none";

interface GUIParams {
  activePlane: PlaneType;
}

export default class GUIView {
  private app: App;
  private threeEngine: ThreeEngine;
  private params: GUIParams;
  private gui: HTMLDivElement;
  private buttons: { [key in PlaneType]: HTMLButtonElement } = {} as any;

  // Callback for when plane type changes

  constructor(app: App, threeEngine: ThreeEngine) {
    console.log(threeEngine);
    this.app = app;
    this.threeEngine = threeEngine;
    this.params = {
      activePlane: "wave",
    };

    this.initGUI();
  }

  private initGUI(): void {
    this.gui = document.createElement("div");
    this.gui.style.position = "fixed";
    this.gui.style.top = "10px";
    this.gui.style.right = "10px";
    this.gui.style.background = "rgba(0,0,0,0.9)";
    this.gui.style.color = "white";
    this.gui.style.padding = "15px";
    this.gui.style.fontFamily = "Arial, sans-serif";
    this.gui.style.borderRadius = "8px";
    this.gui.style.border = "1px solid rgba(255,255,255,0.2)";
    this.gui.style.minWidth = "200px";

    const title = document.createElement("div");
    title.textContent = "TSL Plane Demos";
    title.style.fontSize = "13px";
    title.style.fontWeight = "bold";
    title.style.marginBottom = "5px";
    title.style.textAlign = "center";
    this.gui.appendChild(title);

    // Create buttons for each plane type
    const planeTypes: {
      type: PlaneType;
      label: string;
    }[] = [
      {
        type: "wave",
        label: "Wave Plane",
      },
      {
        type: "sdf",
        label: "SDF Shapes",
      },
      {
        type: "desert-tank",
        label: "Desert Tank",
      },
      {
        type: "raymarching",
        label: "Raymarching",
      },
      { type: "none", label: "Clear Scene" },
    ];

    planeTypes.forEach(({ type, label }) => {
      const buttonContainer = document.createElement("div");
      buttonContainer.style.marginBottom = "2px";

      const button = document.createElement("button");
      button.textContent = label;
      button.style.width = "100%";
      button.style.padding = "2px";
      button.style.border = "2px solid rgba(255,255,255,0.3)";
      button.style.background = "rgba(255,255,255,0.1)";
      button.style.color = "white";
      button.style.cursor = "pointer";
      button.style.borderRadius = "5px";
      button.style.fontSize = "14px";
      button.style.transition = "all 0.3s ease";

      // Hover effects
      button.addEventListener("mouseenter", () => {
        button.style.background = "rgba(255,255,255,0.2)";
        button.style.borderColor = "rgba(255,255,255,0.5)";
      });

      button.addEventListener("mouseleave", () => {
        if (this.params.activePlane !== type) {
          button.style.background = "rgba(255,255,255,0.1)";
          button.style.borderColor = "rgba(255,255,255,0.3)";
        }
      });

      // Click handler
      button.addEventListener("click", () => {
        this.setActivePlane(type);
      });

      buttonContainer.appendChild(button);
      this.gui.appendChild(buttonContainer);

      this.buttons[type] = button;
    });

    // Add controls info
    const controlsInfo = document.createElement("div");
    controlsInfo.style.marginTop = "15px";
    controlsInfo.style.padding = "10px";
    controlsInfo.style.background = "rgba(255,255,255,0.05)";
    controlsInfo.style.borderRadius = "5px";
    controlsInfo.style.fontSize = "11px";
    controlsInfo.style.lineHeight = "1.4";

    this.gui.appendChild(controlsInfo);

    document.body.appendChild(this.gui);

    // Set initial active plane
    this.setActivePlane(this.params.activePlane);
  }

  private setActivePlane(planeType: PlaneType): void {
    // Update visual state of buttons
    Object.entries(this.buttons).forEach(([type, button]) => {
      if (type === planeType) {
        button.style.background = "rgba(100,200,255,0.3)";
        button.style.borderColor = "rgba(100,200,255,0.8)";
        button.style.color = "rgba(100,200,255,1)";
      } else {
        button.style.background = "rgba(255,255,255,0.1)";
        button.style.borderColor = "rgba(255,255,255,0.3)";
        button.style.color = "white";
      }
    });

    // Update params
    this.params.activePlane = planeType;

    // Trigger callback
    // if (this.onPlaneTypeChange) {
    //   console.log("xxx");
    //   this.onPlaneTypeChange(planeType);
    // }
    console.log(this.threeEngine);
    this.threeEngine.onPlaneChange(planeType);
    console.log(`🎮 Switched to plane: ${planeType}`);
  }

  public getCurrentPlaneType(): PlaneType {
    return this.params.activePlane;
  }

  public dispose(): void {
    if (this.gui && this.gui.parentNode) {
      this.gui.parentNode.removeChild(this.gui);
    }
  }
}
