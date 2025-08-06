// File: @/engine/tsl-plane.ts
import * as THREE from "three";
// Import TSL nodes
import * as TSL from "three/tsl";
// Import WebGPU materials
import { MeshPhysicalNodeMaterial } from "three/webgpu";

export interface TSLPlaneParams {
  width?: number;
  height?: number;
  widthSegments?: number;
  heightSegments?: number;
  position?: THREE.Vector3;
}

export class TSLPlane {
  private geometry: THREE.PlaneGeometry;
  private material: MeshPhysicalNodeMaterial | THREE.ShaderMaterial;
  public mesh: THREE.Mesh;

  // Uniforms controllabili
  private timeSpeedUniform: any;
  private amplitudeUniform: any;
  private colorMixUniform: any;
  private waveFrequencyUniform: any;
  private metalnessUniform: any;
  private roughnessUniform: any;

  constructor(params: TSLPlaneParams = {}) {
    const {
      width = 5,
      height = 5,
      widthSegments = 64,
      heightSegments = 64,
      position = new THREE.Vector3(0, 0, 0),
    } = params;

    this.initGeometry(width, height, widthSegments, heightSegments);
    this.initMaterial();
    this.initMesh(position);
  }

  private initGeometry(
    width: number,
    height: number,
    widthSegments: number,
    heightSegments: number
  ): void {
    this.geometry = new THREE.PlaneGeometry(
      width,
      height,
      widthSegments,
      heightSegments
    );
  }

  private initMaterial(): void {
    console.log("🚀 Creating TSL Material");
    console.log(
      "MeshPhysicalNodeMaterial available:",
      !!MeshPhysicalNodeMaterial
    );
    console.log("TSL uniform:", !!TSL.uniform);
    console.log("TSL time:", !!TSL.time);

    try {
      // Create uniforms usando TSL
      this.timeSpeedUniform = TSL.uniform(12.0);
      this.amplitudeUniform = TSL.uniform(0.9);
      this.colorMixUniform = TSL.uniform(1.5);
      this.waveFrequencyUniform = TSL.uniform(3.0);
      this.metalnessUniform = TSL.uniform(0.9);
      this.roughnessUniform = TSL.uniform(0.8);

      // Create TSL material
      this.material = new MeshPhysicalNodeMaterial();

      console.log("✅ TSL Material created successfully!");

      // VERSIONE SEMPLIFICATA - solo colore, no vertex displacement
      console.log("Creating simple TSL material...");

      // Solo colore animato, no displacement per debug
      const timeNode = TSL.mul(TSL.time, this.timeSpeedUniform);
      const color1 = TSL.vec3(1.2, 1.8, 1.0);
      const color2 = TSL.vec3(1.0, 1.3, 1.6);

      // Semplice mix basato su posizione
      const mixFactor = TSL.sin(TSL.add(TSL.positionLocal.x, timeNode));
      const finalColor = TSL.mix(color1, color2, mixFactor);

      this.material.colorNode = finalColor;
      // this.material.metalnessNode = this.metalnessUniform;
      // this.material.roughnessNode = this.roughnessUniform;

      // Material properties
      this.material.transparent = true;
      this.material.side = THREE.DoubleSide;
    } catch (error) {
      console.error("❌ TSL failed, using fallback:", error);
      this.createFallbackMaterial();
    }
  }

  private createFallbackMaterial(): void {
    console.log("🔄 Using fallback ShaderMaterial");
    this.material = new THREE.ShaderMaterial({
      vertexShader: `
        uniform float uTime;
        uniform float uTimeSpeed;
        uniform float uAmplitude;
        uniform float uWaveFreq;
        varying vec2 vUv;
        varying vec3 vPosition;
        varying vec3 vNormal;
        
        void main() {
          vUv = uv;
          vPosition = position;
          vNormal = normal;
          
          vec3 pos = position;
          float time = uTime * uTimeSpeed;
          
          // Wave displacement
          float waveX = sin(pos.x * uWaveFreq + time);
          float waveZ = cos(pos.z * uWaveFreq + time * 0.7);
          float displacement = (waveX + waveZ) * uAmplitude * 0.5;
          
          pos.y += displacement;
          
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uTimeSpeed;
        uniform float uColorMix;
        uniform float uMetalness;
        uniform float uRoughness;
        varying vec2 vUv;
        varying vec3 vPosition;
        varying vec3 vNormal;
        
        void main() {
          float time = uTime * uTimeSpeed;
          
          // Animated colors
          vec3 color1 = vec3(1.0, 0.8, 1.0); // Cyan
          vec3 color2 = vec3(1.0, 1.3, 0.6); // Pink
          vec3 color3 = vec3(0.9, 1.9, 0.2); // Yellow
          
          // Color phases
          float phase1 = sin(length(vPosition.xz) * 1.5 + time);
          float phase2 = cos(vPosition.y * 2.0 + time * 0.5);
          
          // Mix colors
          vec3 mixedColor = mix(color1, color2, smoothstep(-1.0, 1.0, phase1));
          vec3 finalAnimColor = mix(mixedColor, color3, smoothstep(-1.0, 1.0, phase2));
          
          // Base color
          vec3 baseColor = vec3(0.7, 0.7, 0.8);
          vec3 result = mix(baseColor, finalAnimColor, uColorMix);
          
          // Simple lighting
          vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0));
          float diff = max(dot(vNormal, lightDir), 0.0);
          result *= (0.3 + 0.7 * diff);
          
          gl_FragColor = vec4(result, 1.0);
        }
      `,
      uniforms: {
        uTime: { value: 0.0 },
        uTimeSpeed: { value: 1.0 },
        uAmplitude: { value: 2.3 },
        uColorMix: { value: 10.5 },
        uWaveFreq: { value: 2.0 },
        uMetalness: { value: 0.1 },
        uRoughness: { value: 0.8 },
      },
      side: THREE.DoubleSide,
      transparent: true,
    });
  }

  private initMesh(position: THREE.Vector3): void {
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.position.copy(position);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
  }

  // Getters and setters per i controlli GUI
  get timeSpeed(): number {
    if (this.timeSpeedUniform) {
      return this.timeSpeedUniform.value;
    }
    return (
      (this.material as THREE.ShaderMaterial).uniforms?.uTimeSpeed?.value ?? 1.0
    );
  }

  set timeSpeed(value: number) {
    if (this.timeSpeedUniform) {
      this.timeSpeedUniform.value = value;
    } else if ((this.material as THREE.ShaderMaterial).uniforms?.uTimeSpeed) {
      (this.material as THREE.ShaderMaterial).uniforms.uTimeSpeed.value = value;
    }
  }

  get amplitude(): number {
    if (this.amplitudeUniform) {
      return this.amplitudeUniform.value;
    }
    return (
      (this.material as THREE.ShaderMaterial).uniforms?.uAmplitude?.value ?? 0.3
    );
  }

  set amplitude(value: number) {
    if (this.amplitudeUniform) {
      this.amplitudeUniform.value = value;
    } else if ((this.material as THREE.ShaderMaterial).uniforms?.uAmplitude) {
      (this.material as THREE.ShaderMaterial).uniforms.uAmplitude.value = value;
    }
  }

  get colorMix(): number {
    if (this.colorMixUniform) {
      return this.colorMixUniform.value;
    }
    return (
      (this.material as THREE.ShaderMaterial).uniforms?.uColorMix?.value ?? 0.5
    );
  }

  set colorMix(value: number) {
    if (this.colorMixUniform) {
      this.colorMixUniform.value = value;
    } else if ((this.material as THREE.ShaderMaterial).uniforms?.uColorMix) {
      (this.material as THREE.ShaderMaterial).uniforms.uColorMix.value = value;
    }
  }

  get waveFrequency(): number {
    if (this.waveFrequencyUniform) {
      return this.waveFrequencyUniform.value;
    }
    return (
      (this.material as THREE.ShaderMaterial).uniforms?.uWaveFreq?.value ?? 2.0
    );
  }

  set waveFrequency(value: number) {
    if (this.waveFrequencyUniform) {
      this.waveFrequencyUniform.value = value;
    } else if ((this.material as THREE.ShaderMaterial).uniforms?.uWaveFreq) {
      (this.material as THREE.ShaderMaterial).uniforms.uWaveFreq.value = value;
    }
  }

  get metalness(): number {
    if (this.metalnessUniform) {
      return this.metalnessUniform.value;
    }
    return (
      (this.material as THREE.ShaderMaterial).uniforms?.uMetalness?.value ?? 0.1
    );
  }

  set metalness(value: number) {
    if (this.metalnessUniform) {
      this.metalnessUniform.value = value;
    } else if ((this.material as THREE.ShaderMaterial).uniforms?.uMetalness) {
      (this.material as THREE.ShaderMaterial).uniforms.uMetalness.value = value;
    }
  }

  get roughness(): number {
    if (this.roughnessUniform) {
      return this.roughnessUniform.value;
    }
    return (
      (this.material as THREE.ShaderMaterial).uniforms?.uRoughness?.value ?? 0.8
    );
  }

  set roughness(value: number) {
    if (this.roughnessUniform) {
      this.roughnessUniform.value = value;
    } else if ((this.material as THREE.ShaderMaterial).uniforms?.uRoughness) {
      (this.material as THREE.ShaderMaterial).uniforms.uRoughness.value = value;
    }
  }

  // Update method
  update(time: number): void {
    // TSL gestisce il tempo automaticamente con timerLocal()
    // Per il fallback ShaderMaterial, aggiorniamo manualmente
    if ((this.material as THREE.ShaderMaterial).uniforms?.uTime) {
      (this.material as THREE.ShaderMaterial).uniforms.uTime.value = time;
    }
  }

  // Clean up
  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
