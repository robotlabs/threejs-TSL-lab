import * as THREE from "three";
import * as WEBGPU from "three/webgpu";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type App from "@/app/app";
import { LightManager } from "./light-manager";
import GUIView, { PlaneType } from "@/gui/guiView";

import plane1VertexShader from "@/shaders/plane1.vertex.glsl";
import plane1FragmentShader from "@/shaders/plane1.fragment.glsl";

import planeSimpleVertexShader from "@/shaders/planeSimple.vertex.glsl";
import planeSimpleFragmentShader from "@/shaders/planeSimple.fragment.glsl";

import gsap from "gsap";
import { TSLPlane } from "./TSLPlane";
import { TSLPlaneSDF } from "./TSLPlaneSDF";
import { TSLPlaneDesertTank } from "./TSLPlaneDesertTank";
import { TSLPlaneRaymarching } from "./TSLPlaneRaymarching";

export default class ThreeEngine {
  // Static variable to force renderer type
  private forceRenderer: "webgpu" | "webgl2" | "webgl" | null = "webgpu";

  private app: App;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer | WEBGPU.WebGPURenderer;
  private controls: OrbitControls;
  private cube: THREE.Mesh;
  private lights: LightManager;
  private gui: GUIView;

  private shaderPlane: THREE.Mesh;
  private shaderMaterial: THREE.ShaderMaterial;
  private shaderMaterialSimple: THREE.ShaderMaterial;

  // TSL Planes - only one active at a time
  private tslPlane: TSLPlane | null = null;
  private tslPlaneSDF: TSLPlaneSDF | null = null;
  private tslDesertTank: TSLPlaneDesertTank | null = null;
  private raymarchPlane: TSLPlaneRaymarching | null = null;
  private currentActivePlane: PlaneType = "none";

  constructor(app: App) {
    this.app = app;

    this.forceRenderer = "webgpu";
    this.initThree();
    this.initLights();
    this.initGrid();
    // this.initTestObject();
    // this.initTestPlaneTexture();
    // this.initTestPlaneShader();
    // this.initSimpleShaderPlane();
    this.initControls();
    this.initGUI();

    // Start with wave plane
    this.switchToPlane("raymarching");
  }

  private initThree(): void {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x222222);

    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.camera.position.set(0, 5, 10);

    const canvas = document.createElement("canvas");
    document.body.appendChild(canvas);

    const forceRenderer = this.forceRenderer;

    // WebGPU path - try WebGPU -> WebGL2 -> WebGL
    if (forceRenderer === "webgpu") {
      console.log("Forcing WebGPU with fallbacks...");

      // Try WebGPU first
      if (navigator.gpu) {
        try {
          this.renderer = new WEBGPU.WebGPURenderer({
            canvas: canvas,
            antialias: true,
          });
          console.log("✅ Using WebGPURenderer");
          return;
        } catch (err) {
          console.warn("❌ WebGPU failed:", err);
        }
      } else {
        console.warn("❌ No WebGPU support in browser");
      }

      // Fallback to WebGL2
      const gl2 = canvas.getContext("webgl2");
      if (gl2) {
        try {
          this.renderer = new THREE.WebGLRenderer({
            canvas: canvas,
            context: gl2,
            antialias: true,
            alpha: true,
          });
          console.log("✅ Using WebGL2 fallback");
          return;
        } catch (err) {
          console.warn("❌ WebGL2 fallback failed:", err);
        }
      } else {
        console.warn("❌ No WebGL2 support");
      }

      // Final fallback to WebGL
      this.renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        antialias: true,
        alpha: true,
      });
      console.log("✅ Using WebGL final fallback");
    }

    // WebGL2 path - try WebGL2 -> WebGL
    else if (forceRenderer === "webgl2") {
      console.log("Forcing WebGL2 with fallback...");

      const gl2 = canvas.getContext("webgl2");
      if (gl2) {
        try {
          this.renderer = new THREE.WebGLRenderer({
            canvas: canvas,
            context: gl2,
            antialias: true,
            alpha: true,
          });
          console.log("✅ Using WebGL2Renderer");
          return;
        } catch (err) {
          console.warn("❌ WebGL2 failed:", err);
        }
      } else {
        console.warn("❌ No WebGL2 support");
      }

      // Fallback to WebGL
      this.renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        antialias: true,
        alpha: true,
      });
      console.log("✅ Using WebGL fallback");
    }

    // WebGL path - direct WebGL
    else {
      console.log("Using WebGL directly...");
      this.renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        antialias: true,
        alpha: true,
      });
      console.log("✅ Using WebGLRenderer");
    }

    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setClearColor(0x222222);
  }

  private initLights(): void {
    this.lights = new LightManager(this.scene);
  }

  private initControls(): void {
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enabled = true;
  }

  private initGUI(): void {
    console.log("xxxxxx this", this);
    this.gui = new GUIView(this.app, this);
  }

  onPlaneChange(planeType: PlaneType) {
    this.switchToPlane(planeType);
  }

  private initGrid(): void {
    const helper = new THREE.GridHelper(5000, 20);
    helper.position.y = -100;
    helper.material.opacity = 0.8;
    helper.material.transparent = true;
    this.scene.add(helper);
  }

  private switchToPlane(planeType: PlaneType): void {
    console.log(`🔄 Switching to plane: ${planeType}`);

    // Clean up current plane
    this.cleanupCurrentPlane();

    // Create and add new plane
    switch (planeType) {
      case "wave":
        this.createWavePlane();
        break;
      case "sdf":
        this.createSDFPlane();
        break;
      case "desert-tank":
        this.createDesertTankPlane();
        break;
      case "raymarching":
        this.createRayMarchingPlane();
        break;
      case "none":
        // Just cleanup, no new plane
        break;
      default:
        console.warn(`Unknown plane type: ${planeType}`);
        return;
    }

    this.currentActivePlane = planeType;
    console.log(`✅ Successfully switched to: ${planeType}`);
  }

  private cleanupCurrentPlane(): void {
    // Remove and dispose current planes
    if (this.tslPlane) {
      this.scene.remove(this.tslPlane.mesh);
      this.tslPlane.dispose();
      this.tslPlane = null;
    }

    if (this.tslPlaneSDF) {
      this.scene.remove(this.tslPlaneSDF.mesh);
      this.tslPlaneSDF.dispose();
      this.tslPlaneSDF = null;
    }

    if (this.tslDesertTank) {
      this.scene.remove(this.tslDesertTank.mesh);
      this.tslDesertTank.dispose();
      this.tslDesertTank = null;
    }

    if (this.raymarchPlane) {
      this.scene.remove(this.raymarchPlane.mesh);
      this.raymarchPlane.dispose();
      this.raymarchPlane = null;
    }
  }

  private createWavePlane(): void {
    try {
      this.tslPlane = new TSLPlane({
        width: 8,
        height: 8,
        widthSegments: 128,
        heightSegments: 128,
        position: new THREE.Vector3(0, 0, 0),
      });
      this.scene.add(this.tslPlane.mesh);
      console.log("✅ Wave plane created");
    } catch (error) {
      console.error("❌ Failed to create wave plane:", error);
    }
  }

  private createSDFPlane(): void {
    try {
      this.tslPlaneSDF = new TSLPlaneSDF({
        width: 8,
        height: 4,
        position: new THREE.Vector3(0, 0, 0),
      });

      // Configure SDF parameters
      this.tslPlaneSDF.radius = 0.3;
      this.tslPlaneSDF.fade = 2.0;

      this.scene.add(this.tslPlaneSDF.mesh);
      console.log("✅ SDF plane created");
    } catch (error) {
      console.error("❌ Failed to create SDF plane:", error);
    }
  }

  private createDesertTankPlane(): void {
    try {
      this.tslDesertTank = new TSLPlaneDesertTank({
        width: 4,
        height: 3,
        position: new THREE.Vector3(0, 0, 0),
      });

      this.scene.add(this.tslDesertTank.mesh);
      console.log("✅ Desert tank plane created");
    } catch (error) {
      console.error("❌ Failed to create desert tank plane:", error);
    }
  }

  private createRayMarchingPlane(): void {
    // Create the raymarching plane
    const raymarchPlane = new TSLPlaneRaymarching({
      width: 8,
      height: 8,
      position: new THREE.Vector3(0, 0, 0),
    });

    // Add to scene
    this.scene.add(raymarchPlane.mesh);

    // Setup mouse interaction (important!)
    raymarchPlane.setupMouseInteraction(this.camera, this.renderer.domElement);

    // Control raymarching parameters
    raymarchPlane.radius = 0.2;
    raymarchPlane.maxSteps = 25;
    raymarchPlane.surfaceDistance = 0.0001;
    raymarchPlane.timeMultiplier = 0.5;

    this.raymarchPlane = raymarchPlane;
  }

  private initTestObject(): void {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshStandardMaterial({
      color: 0xe6b400,
      roughness: 0.5,
      metalness: 0.1,
    });

    for (let i = 0; i < 5000; i++) {
      const cube = new THREE.Mesh(geometry, material);

      // Enable shadows
      cube.castShadow = true;
      cube.receiveShadow = true;

      this.scene.add(cube);

      // Set initial position
      cube.position.set(
        (Math.random() - 0.5) * 8,
        (Math.random() - 0.5) * 8,
        (Math.random() - 0.5) * 8 - 5
      );

      // Set initial rotation
      cube.rotation.set(
        (Math.random() - 0.5) * 8,
        (Math.random() - 0.5) * 8,
        (Math.random() - 0.5) * 8
      );

      // Set initial scale
      cube.scale.set(
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2
      );

      // Animate position
      gsap.to(cube.position, {
        x: (Math.random() - 0.5) * 8,
        y: (Math.random() - 0.5) * 8,
        z: (Math.random() - 0.5) * 8 - 5,
        duration: 4,
        repeat: -1,
        yoyo: true,
        ease: "power4.inOut",
      });

      // Animate rotation
      gsap.to(cube.rotation, {
        x: (Math.random() - 0.5) * 8,
        y: (Math.random() - 0.5) * 8,
        z: (Math.random() - 0.5) * 8,
        duration: 4,
        repeat: -1,
        yoyo: true,
        ease: "power4.inOut",
      });

      // Animate scale
      gsap.to(cube.scale, {
        x: (Math.random() - 0.5) * 4,
        y: (Math.random() - 0.5) * 4,
        z: (Math.random() - 0.5) * 4,
        duration: 4,
        repeat: -1,
        yoyo: true,
        ease: "power4.inOut",
      });
    }

    // Keep reference to last cube for update method
    this.cube = new THREE.Mesh(geometry, material);
    this.cube.castShadow = true;
    this.cube.receiveShadow = true;
    this.scene.add(this.cube);
  }

  private initTestPlaneTexture(): void {
    const geometry = new THREE.PlaneGeometry(5, 5);

    const texture = new THREE.Texture(this.app.assets["test-image-local"]);
    texture.needsUpdate = true;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;

    const material = new THREE.MeshStandardMaterial({
      map: texture,
      side: THREE.DoubleSide,
      transparent: true,
    });

    const plane = new THREE.Mesh(geometry, material);
    plane.position.set(0, 0, 0);
    plane.castShadow = true;
    plane.receiveShadow = true;

    this.scene.add(plane);
  }

  private initTestPlaneShader(): void {
    const geometry = new THREE.PlaneGeometry(5, 5, 32, 32);

    const texture = new THREE.Texture(this.app.assets["test-image-local"]);
    texture.needsUpdate = true;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;

    this.shaderMaterial = new THREE.ShaderMaterial({
      vertexShader: plane1VertexShader,
      fragmentShader: plane1FragmentShader,
      uniforms: {
        uTime: { value: 0.0 },
        uResolution: {
          value: new THREE.Vector2(window.innerWidth, window.innerHeight),
        },
        uTexture: { value: texture },
      },
      side: THREE.DoubleSide,
      transparent: true,
    });

    this.shaderPlane = new THREE.Mesh(geometry, this.shaderMaterial);
    this.shaderPlane.position.set(4, 0, 1);

    this.scene.add(this.shaderPlane);
  }

  private initSimpleShaderPlane(): void {
    const geometry = new THREE.PlaneGeometry(4, 4, 64, 64);

    this.shaderMaterialSimple = new THREE.ShaderMaterial({
      vertexShader: planeSimpleVertexShader,
      fragmentShader: planeSimpleFragmentShader,
      uniforms: {
        uTime: { value: 0.0 },
        uResolution: {
          value: new THREE.Vector2(window.innerWidth, window.innerHeight),
        },
      },
      side: THREE.DoubleSide,
      wireframe: false,
    });

    const simpleShaderPlane = new THREE.Mesh(
      geometry,
      this.shaderMaterialSimple
    );
    simpleShaderPlane.position.set(-4, 0, 2);

    this.scene.add(simpleShaderPlane);
  }

  update(): void {
    if (this.controls) this.controls.update();

    if (this.cube) {
      this.cube.rotation.x += 0.01;
      this.cube.rotation.y += 0.01;
    }

    if (this.shaderMaterial) {
      this.shaderMaterial.uniforms.uTime.value = performance.now() * 0.01;
    }

    if (this.shaderMaterialSimple) {
      this.shaderMaterialSimple.uniforms.uTime.value = performance.now() * 0.01;
    }

    // Update only the currently active plane
    const currentTime = performance.now() * 0.001; // Convert to seconds
    const deltaTime = 1 / 60; // Approximate 60fps delta

    switch (this.currentActivePlane) {
      case "wave":
        if (this.tslPlane) {
          this.tslPlane.update(currentTime);
        }
        break;
      case "sdf":
        if (this.tslPlaneSDF) {
          this.tslPlaneSDF.update(currentTime);
        }
        break;
      case "desert-tank":
        if (this.tslDesertTank) {
          this.tslDesertTank.update(deltaTime);
        }
        break;
      case "raymarching":
        if (this.raymarchPlane) {
          this.raymarchPlane.update(deltaTime);
        }
        break;
    }
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  resize(vw: number, vh: number): void {
    if (!this.renderer) return;

    this.camera.aspect = vw / vh;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(vw, vh, true);

    // Update shader uniforms with new resolution
    if (this.shaderMaterial) {
      this.shaderMaterial.uniforms.uResolution.value.set(vw, vh);
    }
    if (this.shaderMaterialSimple) {
      this.shaderMaterialSimple.uniforms.uResolution.value.set(vw, vh);
    }
  }

  public dispose(): void {
    this.cleanupCurrentPlane();
    if (this.gui) {
      this.gui.dispose();
    }
  }
}
