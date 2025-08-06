// File: @/engine/tsl-plane-raymarching.ts
import * as THREE from "three";
// Import TSL nodes
import * as TSL from "three/tsl";
// Import WebGPU materials
import { MeshPhysicalNodeMaterial } from "three/webgpu";

export interface TSLPlaneRaymarchingParams {
  width?: number;
  height?: number;
  widthSegments?: number;
  heightSegments?: number;
  position?: THREE.Vector3;
}

export class TSLPlaneRaymarching {
  private geometry: THREE.PlaneGeometry;
  private material: MeshPhysicalNodeMaterial | THREE.ShaderMaterial;
  public mesh: THREE.Mesh;

  // Raymarching uniforms
  private radiusUniform: any;
  private fadeUniform: any;
  private rayFromUniform: any;
  private rayToUniform: any;
  private maxStepsUniform: any;
  private surfaceDistanceUniform: any;
  private maxDistanceUniform: any;
  private timeMultiplierUniform: any;

  // Mouse interaction
  private raycaster: THREE.Raycaster;
  private pointer: THREE.Vector2;
  private camera: THREE.Camera | null = null;

  constructor(params: TSLPlaneRaymarchingParams = {}) {
    const {
      width = 2,
      height = 2,
      widthSegments = 64,
      heightSegments = 64,
      position = new THREE.Vector3(0, 0, 0),
    } = params;

    this.initGeometry(width, height, widthSegments, heightSegments);
    this.initMaterial();
    this.initMesh(position);
    this.initInteraction();
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
    console.log("🚀 Creating TSL Raymarching Material");

    try {
      // Create raymarching uniforms using TSL
      this.radiusUniform = TSL.uniform(0.15);
      this.fadeUniform = TSL.uniform(1);
      this.rayFromUniform = TSL.uniform(new THREE.Vector2(0.5, 0.5));
      this.rayToUniform = TSL.uniform(new THREE.Vector2(1, 1));
      this.maxStepsUniform = TSL.uniform(20);
      this.surfaceDistanceUniform = TSL.uniform(0.0001);
      this.maxDistanceUniform = TSL.uniform(5.0);
      this.timeMultiplierUniform = TSL.uniform(1);

      // Create TSL material
      this.material = new MeshPhysicalNodeMaterial();

      // Define SDF functions using TSL.Fn
      const Circle = TSL.Fn(([position, radius]) => {
        return TSL.length(position).sub(radius);
      });

      const Ellipse = TSL.Fn(([position, scale, angle]) => {
        const angledPosition = TSL.rotateUV(position, angle, TSL.vec2(0, 0));
        const scaledPosition = angledPosition.div(scale);
        return TSL.length(scaledPosition).sub(1).mul(TSL.min(scale.x, scale.y));
      });

      const Box = TSL.Fn(([position, dimensions, angle]) => {
        const angledPosition = TSL.rotateUV(position, angle, TSL.vec2(0, 0));
        const distance = TSL.abs(angledPosition).sub(dimensions);
        return TSL.length(TSL.max(distance, 0.0)).add(
          TSL.min(TSL.max(distance.x, distance.y), 0.0)
        );
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

      const SubtractedCircleBox = TSL.Fn(([position, radius, angle]) => {
        const circle = TSL.length(position).sub(radius);
        const angledPosition = TSL.rotateUV(position, angle, TSL.vec2(0, 0));
        const box = Box(
          angledPosition,
          TSL.vec2(radius.sub(0.025), radius.sub(0.025)),
          0
        );
        return TSL.max(TSL.negate(circle), box);
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

      const Line = TSL.Fn(([position, start, end]) => {
        const lineDirection = end.sub(start);
        const positionDirection = position.sub(start);
        const projection = TSL.dot(positionDirection, lineDirection).div(
          TSL.dot(lineDirection, lineDirection)
        );
        const clampedProjection = TSL.clamp(projection, 0.0, 1.0);
        const closestPoint = start.add(clampedProjection.mul(lineDirection));
        return TSL.length(position.sub(closestPoint));
      });

      const DirectionLine = TSL.Fn(([position, direction, len, thickness]) => {
        const projection = TSL.dot(position, direction);
        const closestPoint = TSL.clamp(projection, 0, len).mul(direction);
        const distanceToClosestPoint = TSL.length(position.sub(closestPoint));
        return distanceToClosestPoint;
      });

      // Main SDF scene function
      const sdfScene = TSL.Fn(([p]) => {
        const t = TSL.time.mul(this.timeMultiplierUniform);

        const circle = Circle(p.sub(TSL.vec2(-0.66, 0.33)), this.radiusUniform);

        const intersectedCircleBox = IntersectedCircleBox(
          p.sub(TSL.vec2(0, 0.66)),
          this.radiusUniform,
          t
        );

        const subtractedCircleBox = SubtractedCircleBox(
          p.sub(TSL.vec2(0.66, 0.33)),
          this.radiusUniform,
          t
        );

        const moon = Moon(p.sub(TSL.vec2(0.66, -0.33)), this.radiusUniform, t);

        const box = Box(
          p.sub(TSL.vec2(-0.66, -0.33)),
          TSL.vec2(this.radiusUniform, 0.25),
          TSL.negate(t)
        );

        const unionedCircleBox = UnionedCircleBox(
          p.sub(TSL.vec2(0, -0.66)),
          this.radiusUniform,
          t
        );

        let distance = TSL.min(circle, intersectedCircleBox);
        distance = TSL.min(distance, subtractedCircleBox);
        distance = TSL.min(distance, moon);
        distance = TSL.min(distance, box);
        distance = TSL.min(distance, unionedCircleBox);

        return distance;
      });

      // Get normal function (simplified)
      const getNormal = TSL.Fn(([p]) => {
        // Simplified normal calculation to avoid infinite recursion
        const eps = 0.01;
        return TSL.normalize(TSL.vec2(eps, eps)); // Placeholder
      });

      // Simplified main function without complex raymarching
      const mainRaymarching = TSL.Fn(() => {
        const p = TSL.positionLocal.xy.mul(1.5);

        const sceneDistance = sdfScene(p);

        // Basic SDF visualization
        const sdfColour = TSL.select(
          sceneDistance.lessThan(0),
          TSL.sin(sceneDistance.mul(250)).mul(0.75).oneMinus(),
          TSL.sin(sceneDistance.mul(150))
            .mul(0.025)
            .mul(TSL.min(sceneDistance.mul(this.fadeUniform), 1).oneMinus())
        );

        let finalColour = TSL.min(TSL.vec3(1), sdfColour);

        const rayOrigin = this.rayFromUniform.mul(3).sub(1.5);
        const lookAt = this.rayToUniform.mul(3).sub(1.5);

        // Ray origin marker
        const rayOriginCircle = TSL.length(p.sub(rayOrigin))
          .sub(0.025)
          .smoothstep(0.0, 0.01)
          .oneMinus();
        finalColour = TSL.mix(finalColour, TSL.vec3(1, 0, 0), rayOriginCircle);

        // Look at target marker
        const lookAtCircle = TSL.length(p.sub(lookAt))
          .sub(0.025)
          .smoothstep(0.0, 0.01)
          .oneMinus();
        finalColour = TSL.mix(finalColour, TSL.vec3(1, 0, 0), lookAtCircle);

        // Simple ray line visualization
        const rayLine = Line(p, rayOrigin, lookAt)
          .smoothstep(0.0, 0.01)
          .oneMinus();
        finalColour = TSL.mix(
          finalColour,
          TSL.vec3(1.0, 0.05, 0.3),
          rayLine.mul(0.3)
        );

        return finalColour;
      });

      // Apply the raymarching fragment shader
      this.material.colorNode = mainRaymarching();

      // Material properties
      this.material.transparent = true;
      this.material.side = THREE.DoubleSide;

      console.log("✅ TSL Raymarching Material created successfully!");
    } catch (error) {
      console.error("❌ TSL Raymarching failed, using fallback:", error);
      this.createFallbackMaterial();
    }
  }

  private createFallbackMaterial(): void {
    console.log("🔄 Using fallback Raymarching ShaderMaterial");
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
        uniform vec2 uRayFrom;
        uniform vec2 uRayTo;
        uniform int uMaxSteps;
        uniform float uSurfaceDistance;
        uniform float uMaxDistance;
        uniform float uTimeMultiplier;
        varying vec2 vUv;
        varying vec3 vPosition;
        
        // Simple SDF functions
        float circle(vec2 p, float r) {
          return length(p) - r;
        }
        
        float box(vec2 p, vec2 b) {
          vec2 d = abs(p) - b;
          return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
        }
        
        // Simple scene
        float sdfScene(vec2 p) {
          float t = uTime * uTimeMultiplier;
          float c1 = circle(p - vec2(-0.66, 0.33), uRadius);
          float c2 = circle(p - vec2(0.66, 0.33), uRadius);
          float b1 = box(p - vec2(0.0, -0.33), vec2(uRadius));
          return min(min(c1, c2), b1);
        }
        
        vec3 raymarch(vec2 rayOrigin, vec2 rayDir, vec2 fragCoord) {
          float totalDist = 0.0;
          vec3 color = vec3(0.0);
          
          for(int i = 0; i < 10; i++) {
            vec2 pos = rayOrigin + rayDir * totalDist;
            float dist = sdfScene(pos);
            
            if(dist < uSurfaceDistance || totalDist > uMaxDistance) break;
            
            totalDist += dist;
            
            // Visualize march steps
            float checkpoint = 1.0 - smoothstep(0.0, 0.02, length(fragCoord - pos));
            color += vec3(0.2, 1.0, 0.2) * checkpoint * 0.3;
          }
          
          return color;
        }
        
        void main() {
          vec2 p = vPosition.xy * 1.5;
          
          // Basic SDF visualization
          float dist = sdfScene(p);
          vec3 sdfColor = dist < 0.0 
            ? vec3(1.0 - sin(dist * 250.0) * 0.75)
            : vec3(sin(dist * 150.0) * 0.025 * (1.0 - min(dist * uFade, 1.0)));
          
          vec3 color = min(vec3(1.0), sdfColor);
          
          // Ray visualization
          vec2 rayOrigin = uRayFrom * 3.0 - 1.5;
          vec2 lookAt = uRayTo * 3.0 - 1.5;
          vec2 rayDir = normalize(lookAt - rayOrigin);
          
          // Add raymarching visualization
          color += raymarch(rayOrigin, rayDir, p);
          
          // Ray origin and target markers
          float rayOriginMarker = 1.0 - smoothstep(0.0, 0.02, length(p - rayOrigin) - 0.025);
          color = mix(color, vec3(1.0, 0.0, 0.0), rayOriginMarker);
          
          float targetMarker = 1.0 - smoothstep(0.0, 0.02, length(p - lookAt) - 0.025);
          color = mix(color, vec3(1.0, 0.0, 0.0), targetMarker);
          
          gl_FragColor = vec4(color, 1.0);
        }
      `,
      uniforms: {
        uTime: { value: 0.0 },
        uRadius: { value: 0.15 },
        uFade: { value: 1.0 },
        uRayFrom: { value: new THREE.Vector2(0.5, 0.5) },
        uRayTo: { value: new THREE.Vector2(1, 1) },
        uMaxSteps: { value: 20 },
        uSurfaceDistance: { value: 0.0001 },
        uMaxDistance: { value: 5.0 },
        uTimeMultiplier: { value: 1.0 },
      },
      side: THREE.DoubleSide,
      transparent: true,
    });
  }

  private initMesh(position: THREE.Vector3): void {
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.position.copy(position);
  }

  private initInteraction(): void {
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
  }

  // Set up mouse interaction (call this after adding to scene)
  public setupMouseInteraction(
    camera: THREE.Camera,
    domElement: HTMLElement
  ): void {
    this.camera = camera;

    const onPointerMove = (event: PointerEvent) => {
      this.pointer.set(
        (event.clientX / window.innerWidth) * 2 - 1,
        -(event.clientY / window.innerHeight) * 2 + 1
      );

      this.raycaster.setFromCamera(this.pointer, camera);
      const intersects = this.raycaster.intersectObject(this.mesh);

      if (intersects.length > 0) {
        this.rayTo = intersects[0].uv || new THREE.Vector2(1, 1);
      }
    };

    const onPointerDown = (event: PointerEvent) => {
      this.rayFrom = new THREE.Vector2().copy(this.rayTo);
    };

    domElement.addEventListener("pointermove", onPointerMove);
    domElement.addEventListener("pointerdown", onPointerDown);
  }

  // Getters and setters for raymarching controls
  get radius(): number {
    if (this.radiusUniform) {
      return this.radiusUniform.value;
    }
    return (
      (this.material as THREE.ShaderMaterial).uniforms?.uRadius?.value ?? 0.15
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
      (this.material as THREE.ShaderMaterial).uniforms?.uFade?.value ?? 1.0
    );
  }

  set fade(value: number) {
    if (this.fadeUniform) {
      this.fadeUniform.value = value;
    } else if ((this.material as THREE.ShaderMaterial).uniforms?.uFade) {
      (this.material as THREE.ShaderMaterial).uniforms.uFade.value = value;
    }
  }

  get maxSteps(): number {
    if (this.maxStepsUniform) {
      return this.maxStepsUniform.value;
    }
    return (
      (this.material as THREE.ShaderMaterial).uniforms?.uMaxSteps?.value ?? 20
    );
  }

  set maxSteps(value: number) {
    if (this.maxStepsUniform) {
      this.maxStepsUniform.value = value;
    } else if ((this.material as THREE.ShaderMaterial).uniforms?.uMaxSteps) {
      (this.material as THREE.ShaderMaterial).uniforms.uMaxSteps.value = value;
    }
  }

  get surfaceDistance(): number {
    if (this.surfaceDistanceUniform) {
      return this.surfaceDistanceUniform.value;
    }
    return (
      (this.material as THREE.ShaderMaterial).uniforms?.uSurfaceDistance
        ?.value ?? 0.0001
    );
  }

  set surfaceDistance(value: number) {
    if (this.surfaceDistanceUniform) {
      this.surfaceDistanceUniform.value = value;
    } else if (
      (this.material as THREE.ShaderMaterial).uniforms?.uSurfaceDistance
    ) {
      (this.material as THREE.ShaderMaterial).uniforms.uSurfaceDistance.value =
        value;
    }
  }

  get maxDistance(): number {
    if (this.maxDistanceUniform) {
      return this.maxDistanceUniform.value;
    }
    return (
      (this.material as THREE.ShaderMaterial).uniforms?.uMaxDistance?.value ??
      5.0
    );
  }

  set maxDistance(value: number) {
    if (this.maxDistanceUniform) {
      this.maxDistanceUniform.value = value;
    } else if ((this.material as THREE.ShaderMaterial).uniforms?.uMaxDistance) {
      (this.material as THREE.ShaderMaterial).uniforms.uMaxDistance.value =
        value;
    }
  }

  get timeMultiplier(): number {
    if (this.timeMultiplierUniform) {
      return this.timeMultiplierUniform.value;
    }
    return (
      (this.material as THREE.ShaderMaterial).uniforms?.uTimeMultiplier
        ?.value ?? 1.0
    );
  }

  set timeMultiplier(value: number) {
    if (this.timeMultiplierUniform) {
      this.timeMultiplierUniform.value = value;
    } else if (
      (this.material as THREE.ShaderMaterial).uniforms?.uTimeMultiplier
    ) {
      (this.material as THREE.ShaderMaterial).uniforms.uTimeMultiplier.value =
        value;
    }
  }

  get rayFrom(): THREE.Vector2 {
    if (this.rayFromUniform) {
      return this.rayFromUniform.value;
    }
    return (
      (this.material as THREE.ShaderMaterial).uniforms?.uRayFrom?.value ??
      new THREE.Vector2(0.5, 0.5)
    );
  }

  set rayFrom(value: THREE.Vector2) {
    if (this.rayFromUniform) {
      this.rayFromUniform.value.copy(value);
    } else if ((this.material as THREE.ShaderMaterial).uniforms?.uRayFrom) {
      (this.material as THREE.ShaderMaterial).uniforms.uRayFrom.value.copy(
        value
      );
    }
  }

  get rayTo(): THREE.Vector2 {
    if (this.rayToUniform) {
      return this.rayToUniform.value;
    }
    return (
      (this.material as THREE.ShaderMaterial).uniforms?.uRayTo?.value ??
      new THREE.Vector2(1, 1)
    );
  }

  set rayTo(value: THREE.Vector2) {
    if (this.rayToUniform) {
      this.rayToUniform.value.copy(value);
    } else if ((this.material as THREE.ShaderMaterial).uniforms?.uRayTo) {
      (this.material as THREE.ShaderMaterial).uniforms.uRayTo.value.copy(value);
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
