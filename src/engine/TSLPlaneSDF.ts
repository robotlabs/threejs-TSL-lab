// File: @/engine/tsl-plane-sdf.ts
import * as THREE from "three";
// Import TSL nodes
import * as TSL from "three/tsl";
// Import WebGPU materials
import { MeshPhysicalNodeMaterial } from "three/webgpu";

export interface TSLPlaneSDFParams {
  width?: number;
  height?: number;
  widthSegments?: number;
  heightSegments?: number;
  position?: THREE.Vector3;
}

export class TSLPlaneSDF {
  private geometry: THREE.PlaneGeometry;
  private material: MeshPhysicalNodeMaterial | THREE.ShaderMaterial;
  public mesh: THREE.Mesh;

  // SDF Uniforms
  private radiusUniform: any;
  private fadeUniform: any;

  constructor(params: TSLPlaneSDFParams = {}) {
    const {
      width = 4,
      height = 2,
      widthSegments = 64,
      heightSegments = 32,
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
    console.log("🚀 Creating TSL SDF Material");

    try {
      // Create SDF uniforms using TSL
      this.radiusUniform = TSL.uniform(0.25);
      this.fadeUniform = TSL.uniform(1.5);

      // Create TSL material
      this.material = new MeshPhysicalNodeMaterial();

      // Define SDF functions using TSL.Fn
      const Circle = TSL.Fn(([position, radius]) => {
        return TSL.length(position).sub(radius);
      });

      const Ellipse = TSL.Fn(([position, radius, scale, angle]) => {
        const angledPosition = TSL.rotateUV(position, angle, TSL.vec2(0, 0));
        const scaledPosition = angledPosition.mul(scale);
        return TSL.length(scaledPosition).sub(radius);
      });

      const Box = TSL.Fn(([position, dimensions, angle]) => {
        const angledPosition = TSL.rotateUV(position, angle, TSL.vec2(0, 0));
        const distance = TSL.abs(angledPosition).sub(dimensions);
        return TSL.length(TSL.max(distance, 0.0)).add(
          TSL.min(TSL.max(distance.x, distance.y), 0.0)
        );
      });

      const Flower = TSL.Fn(
        ([position, radius, frequency, amplitude, angle]) => {
          const angledPosition = TSL.rotateUV(position, angle, TSL.vec2(0, 0));
          const circleAngle = TSL.atan2(angledPosition.y, angledPosition.x);
          const bumps = TSL.cos(circleAngle.mul(frequency)).mul(amplitude);
          return TSL.length(position).sub(radius).add(bumps);
        }
      );

      const Butterfly = TSL.Fn(([position, radius, frequency, amplitude]) => {
        const circleAngle = TSL.atan2(position.y, position.x);
        const bumps = TSL.cos(circleAngle.mul(frequency)).mul(
          amplitude.mul(TSL.negate(position.y).mul(1.5).oneMinus())
        );
        return TSL.length(position).sub(radius).add(bumps);
      });

      const Moon = TSL.Fn(([position, radius, angle]) => {
        const angledPosition = TSL.rotateUV(position, angle, TSL.vec2(0, 0));
        const innerCircle = TSL.length(
          angledPosition.div(0.8).sub(TSL.vec2(0.15, 0.0))
        ).sub(radius);
        const outerCircle = TSL.length(position).sub(radius);
        return TSL.max(TSL.negate(innerCircle), outerCircle);
      });

      const IntersectedCircleBox = TSL.Fn(([position, radius, angle]) => {
        const circle = TSL.length(position).sub(radius);
        const angledPosition = TSL.rotateUV(position, angle, TSL.vec2(0, 0));
        const box = Box(
          angledPosition,
          TSL.vec2(radius.sub(0.025), radius.sub(0.025)),
          0
        );
        return TSL.max(circle, box);
      });

      const UnionedCircleBox = TSL.Fn(([position, radius, angle]) => {
        const circle = TSL.length(position).sub(radius);
        const angledPosition = TSL.rotateUV(position, angle, TSL.vec2(0, 0));
        const box = Box(
          angledPosition,
          TSL.vec2(radius.sub(0.025), radius.sub(0.025)),
          0
        );
        return TSL.min(circle, box);
      });

      // Main SDF scene function
      const mainSDF = TSL.Fn(() => {
        const p = TSL.positionLocal.xy;
        const t = TSL.time.div(2);

        // Create all SDF shapes
        const circle = Circle(p.sub(TSL.vec2(-0.66, 0.66)), this.radiusUniform);

        const intersectedCircleBox = IntersectedCircleBox(
          p.sub(TSL.vec2(0, 0.66)),
          this.radiusUniform,
          t
        );

        const ellipse = Ellipse(
          p.sub(TSL.vec2(0.66, 0.66)),
          this.radiusUniform,
          TSL.vec2(1, 2),
          t
        );

        const flower = Flower(
          p.sub(TSL.vec2(-0.66, 0)),
          this.radiusUniform,
          8,
          0.1,
          t
        );

        const butterfly = Butterfly(
          TSL.vec2(p.x.div(TSL.sin(TSL.time.mul(2))), p.y),
          this.radiusUniform,
          4,
          0.1
        );

        const moon = Moon(p.sub(TSL.vec2(0.66, 0)), this.radiusUniform, t);

        const box = Box(
          p.sub(TSL.vec2(-0.66, -0.66)),
          TSL.vec2(this.radiusUniform, 0.25),
          TSL.negate(t)
        );

        const unionedCircleBox = UnionedCircleBox(
          p.sub(TSL.vec2(0, -0.66)),
          this.radiusUniform,
          t
        );

        const torus = Circle(p.sub(TSL.vec2(0.66, -0.66)), this.radiusUniform)
          .abs()
          .sub(0.05);

        // Combine all SDFs using min operations
        let sdfScene = TSL.min(circle, intersectedCircleBox);
        sdfScene = TSL.min(sdfScene, ellipse);
        sdfScene = TSL.min(sdfScene, flower);
        sdfScene = TSL.min(sdfScene, butterfly);
        sdfScene = TSL.min(sdfScene, moon);
        sdfScene = TSL.min(sdfScene, box);
        sdfScene = TSL.min(sdfScene, unionedCircleBox);
        sdfScene = TSL.min(sdfScene, torus);

        // Color based on SDF
        const colour = TSL.select(
          sdfScene.lessThan(0),
          TSL.vec3(
            TSL.add(
              0.5,
              TSL.mul(0.5, TSL.cos(TSL.time.add(p).add(TSL.vec3(0, 2, 4))))
            )
          ).mul(sdfScene.mul(this.fadeUniform).oneMinus()),
          TSL.vec3(
            TSL.add(
              0.5,
              TSL.mul(0.5, TSL.cos(TSL.time.add(p).add(TSL.vec3(4, 2, 0))))
            )
          ).mul(TSL.abs(sdfScene.mul(this.fadeUniform)).oneMinus())
        );

        // Final color with wave effect
        const finalColour = TSL.mix(
          TSL.vec3(0),
          colour,
          TSL.abs(TSL.sin(sdfScene.mul(100).add(TSL.time)))
        );

        return finalColour;
      });

      // Apply the SDF fragment shader
      this.material.colorNode = mainSDF();

      // Material properties
      this.material.transparent = true;
      this.material.side = THREE.DoubleSide;

      console.log("✅ TSL SDF Material created successfully!");
    } catch (error) {
      console.error("❌ TSL SDF failed, using fallback:", error);
      this.createFallbackMaterial();
    }
  }

  private createFallbackMaterial(): void {
    console.log("🔄 Using fallback SDF ShaderMaterial");
    this.material = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vPosition;
        
        void main() {
          vUv = uv;
          vPosition = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uRadius;
        uniform float uFade;
        varying vec2 vUv;
        varying vec3 vPosition;
        
        // SDF Functions
        float circle(vec2 p, float r) {
          return length(p) - r;
        }
        
        float box(vec2 p, vec2 b) {
          vec2 d = abs(p) - b;
          return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
        }
        
        mat2 rot(float a) {
          float c = cos(a), s = sin(a);
          return mat2(c, -s, s, c);
        }
        
        void main() {
          vec2 p = vPosition.xy;
          float t = uTime * 0.5;
          
          // Create some basic SDFs
          float c1 = circle(p - vec2(-0.66, 0.66), uRadius);
          float c2 = circle(p - vec2(0.66, 0.66), uRadius);
          float b1 = box((p - vec2(-0.66, -0.66)) * rot(t), vec2(uRadius, 0.25));
          float b2 = box(p - vec2(0.66, -0.66), vec2(uRadius));
          
          // Combine SDFs
          float sdf = min(min(c1, c2), min(b1, b2));
          
          // Color based on SDF
          vec3 color1 = 0.5 + 0.5 * cos(uTime + p.xyx + vec3(0, 2, 4));
          vec3 color2 = 0.5 + 0.5 * cos(uTime + p.xyx + vec3(4, 2, 0));
          
          vec3 color = sdf < 0.0 
            ? color1 * (1.0 - sdf * uFade)
            : color2 * (1.0 - abs(sdf * uFade));
          
          // Add wave effect
          vec3 finalColor = mix(vec3(0.0), color, abs(sin(sdf * 100.0 + uTime)));
          
          gl_FragColor = vec4(finalColor, 1.0);
        }
      `,
      uniforms: {
        uTime: { value: 0.0 },
        uRadius: { value: 0.25 },
        uFade: { value: 1.5 },
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

  // Getters and setters for SDF controls
  get radius(): number {
    if (this.radiusUniform) {
      return this.radiusUniform.value;
    }
    return (
      (this.material as THREE.ShaderMaterial).uniforms?.uRadius?.value ?? 0.25
    );
  }

  set radius(value: number) {
    if (this.radiusUniform) {
      this.radiusUniform.value = value;
    } else if ((this.material as THREE.ShaderMaterial).uniforms?.uRadius) {
      (this.material as THREE.ShaderMaterial).uniforms.uRadius.value = value;
    }
  }

  get fade(): number {
    if (this.fadeUniform) {
      return this.fadeUniform.value;
    }
    return (
      (this.material as THREE.ShaderMaterial).uniforms?.uFade?.value ?? 1.5
    );
  }

  set fade(value: number) {
    if (this.fadeUniform) {
      this.fadeUniform.value = value;
    } else if ((this.material as THREE.ShaderMaterial).uniforms?.uFade) {
      (this.material as THREE.ShaderMaterial).uniforms.uFade.value = value;
    }
  }

  // Update method
  update(time: number): void {
    // TSL handles time automatically with TSL.time
    // For fallback ShaderMaterial, update manually
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
