import ThreeEngine from "@/engine/three-engine";
import GUIView from "@/gui/guiView";
import Stats from "stats.js";

export default class App {
  private stats!: Stats;
  private el: HTMLElement;
  private threeEngine: ThreeEngine | null = null;
  private gui: GUIView | null = null;
  public assets: Record<string, any> = {};
  private handlerAnimate: () => void;
  private raf: number;

  constructor() {}

  init(container: HTMLElement, assets: Record<string, any> = {}): void {
    this.el = container;
    this.assets = assets;
    console.log(this.assets);
    this.initStats();

    this.initThreeEngine();
    this.initGUI();
    this.addListeners();
    this.animate();
    this.resize();
  }

  private initThreeEngine(): void {
    this.threeEngine = new ThreeEngine(this);
    this.el.appendChild(this.threeEngine.renderer.domElement);
  }

  private initGUI(): void {
    this.gui = new GUIView(this);
  }

  private initStats(): void {
    this.stats = new Stats();
    this.stats.showPanel(0);

    const dom = this.stats.dom;
    dom.style.position = "fixed";
    dom.style.top = "0px";
    dom.style.left = "0px";
    dom.style.zIndex = "9999999";

    document.body.appendChild(this.stats.dom);
  }

  private addListeners(): void {
    this.handlerAnimate = this.animate.bind(this);
    window.addEventListener("resize", this.resize.bind(this));
  }

  animate(): void {
    this.stats.begin();
    this.update();
    this.render();
    this.raf = requestAnimationFrame(this.handlerAnimate);
    this.stats.end();
  }

  private update(): void {
    if (this.threeEngine) this.threeEngine.update();
  }

  private render(): void {
    if (this.threeEngine) this.threeEngine.render();
  }

  private resize(): void {
    const vw = this.el?.offsetWidth || window.innerWidth;
    console.log(vw);
    const vh = this.el?.offsetHeight || window.innerHeight;
    if (this.threeEngine) this.threeEngine.resize(vw, vh);
  }
}
