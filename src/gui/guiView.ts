import type App from "@/app/app";

interface GUIParams {
  rotationSpeed: number;
}

export default class GUIView {
  private app: App;
  private params: GUIParams;
  private gui: HTMLDivElement;

  constructor(app: App) {
    this.app = app;
    this.params = {
      rotationSpeed: 0.01,
    };

    this.initGUI();
  }

  private initGUI(): void {
    this.gui = document.createElement("div");
    this.gui.style.position = "fixed";
    this.gui.style.top = "10px";
    this.gui.style.right = "10px";
    this.gui.style.background = "rgba(0,0,0,0.8)";
    this.gui.style.color = "white";
    this.gui.style.padding = "10px";
    this.gui.style.fontFamily = "Arial";

    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = "0";
    slider.max = "0.1";
    slider.step = "0.001";
    slider.value = this.params.rotationSpeed.toString();

    slider.addEventListener("input", (e: Event) => {
      const target = e.target as HTMLInputElement;
      this.params.rotationSpeed = parseFloat(target.value);
    });

    const label = document.createElement("div");
    label.textContent = "Rotation Speed";

    this.gui.appendChild(label);
    this.gui.appendChild(slider);

    document.body.appendChild(this.gui);
  }
}
