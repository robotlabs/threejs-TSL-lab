// File: @/engine/tsl-plane-desert-tank.ts
import * as THREE from "three";
// Import TSL nodes
import * as TSL from "three/tsl";
// Import WebGPU materials
import { MeshPhysicalNodeMaterial } from "three/webgpu";

export interface TSLPlaneDesertTankParams {
  width?: number;
  height?: number;
  widthSegments?: number;
  heightSegments?: number;
  position?: THREE.Vector3;
}

export class TSLPlaneDesertTank {
  private geometry: THREE.PlaneGeometry;
  private material: MeshPhysicalNodeMaterial | THREE.ShaderMaterial;
  public mesh: THREE.Mesh;

  // Game state uniforms
  private wheelOffsetUniform: any;
  private bulletOffsetUniform: any;
  private shellOffsetUniform: any;

  // Game state
  private canJump: boolean = true;
  private canShoot: boolean = true;
  private keyMap: { [key: string]: boolean } = {};

  constructor(params: TSLPlaneDesertTankParams = {}) {
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
    this.initControls();
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
    console.log("🚀 Creating TSL Desert Tank Material");

    try {
      // Create game state uniforms using TSL
      this.wheelOffsetUniform = TSL.uniform(new THREE.Vector2(-10, 0));
      this.bulletOffsetUniform = TSL.uniform(20);
      this.shellOffsetUniform = TSL.uniform(25);

      // Create TSL material
      this.material = new MeshPhysicalNodeMaterial();

      // Define SDF and scene functions using TSL.Fn
      const groundLayer = TSL.Fn(([position]) => {
        return position.y.sub(TSL.mx_noise_float(position.x));
      });

      const sunRays = TSL.Fn(([position]) => {
        const angle = TSL.atan2(position.y, position.x);
        const frequency = 20.0;
        const amplitude = 0.5;

        const rays = TSL.sin(angle.mul(frequency).add(TSL.time))
          .mul(amplitude)
          .add(TSL.sin(TSL.time.mul(2)));

        return TSL.length(position).sub(0.5).add(rays);
      });

      const Sphere = TSL.Fn(([position, offset, radius]) => {
        const distance = TSL.length(position.sub(offset)).sub(radius);
        return distance;
      });

      const Ellipse = TSL.Fn(([position, radius, scale]) => {
        const scaledPosition = position.mul(scale);
        return TSL.length(scaledPosition).sub(radius);
      });

      const Box = TSL.Fn(([position, dimensions]) => {
        const distance = TSL.abs(position).sub(dimensions);
        return TSL.length(TSL.max(distance, 0.0)).add(
          TSL.min(TSL.max(distance.x, distance.y), 0.0)
        );
      });

      const Sky = TSL.Fn(([position]) => {
        const topColor = TSL.vec3(0.1, 0.2, 0.5);
        const midColor = TSL.vec3(1.0, 0.4, 0.2);
        const bottomColor = TSL.vec3(0.9, 0.6, 0.3);

        return TSL.mix(
          TSL.mix(bottomColor, midColor, position.y.div(5)),
          topColor,
          position.y.div(5)
        );
      });

      const Tank = TSL.Fn(([position, offset]) => {
        const a = Ellipse(position.sub(offset), 5, TSL.vec2(1, 2));
        const b = Box(
          position.sub(offset).sub(TSL.vec2(0, -1.5)),
          TSL.vec2(4.5, 1)
        );
        const c = Box(
          position.sub(offset).sub(TSL.vec2(0, 2.5)),
          TSL.vec2(2, 1)
        ); // canopy
        const d = Box(
          position.sub(offset).sub(TSL.vec2(2, 2.7)),
          TSL.vec2(4, 0.2)
        ); // turret
        const e = Box(
          position.sub(offset).sub(TSL.vec2(-3.5, 2.8)),
          TSL.vec2(0.1, 2)
        ); // gun
        const f = Box(
          position.sub(offset).sub(TSL.vec2(0.5, 2.8)),
          TSL.vec2(1, 0.5)
        ); // window

        let sdf = TSL.max(a, TSL.negate(b));
        sdf = TSL.min(sdf, c);
        sdf = TSL.min(sdf, d);
        sdf = TSL.min(sdf, e);
        sdf = TSL.max(sdf, TSL.negate(f));

        return TSL.smoothstep(0.01, 0, sdf);
      });

      const Camouflage = TSL.Fn(([position]) => {
        const n = TSL.mx_noise_float(position);
        let colour = TSL.vec3(0.4, 0.7, 0.3); // Light Green

        // Simplified camouflage pattern using mix instead of If statements
        const darkGreen = TSL.vec3(0.1, 0.3, 0.1);
        const mediumGreen = TSL.vec3(0.2, 0.5, 0.2);

        colour = TSL.mix(colour, darkGreen, TSL.smoothstep(-0.1, 0.2, n));
        colour = TSL.mix(colour, mediumGreen, TSL.smoothstep(-0.4, -0.3, n));

        return colour;
      });

      // Main scene function
      const mainDesertTank = TSL.Fn(() => {
        const p = TSL.positionLocal.xy.mul(20);
        const t = TSL.time.div(2);

        let finalColour = Sky(p);

        // Sun rays
        finalColour = TSL.mix(
          finalColour,
          TSL.vec3(1, 0.75, 0),
          TSL.smoothstep(10, 0, sunRays(p.sub(TSL.vec2(7, 7))))
        );

        // Parallax layers
        const mountains = groundLayer(
          p.add(TSL.vec2(t, -1)).div(TSL.vec2(10, 10))
        );
        finalColour = TSL.mix(
          finalColour,
          TSL.vec3(0.1, 0.1, 0.1),
          TSL.smoothstep(0.01, 0.0, mountains)
        );

        const hills = groundLayer(
          p.add(TSL.vec2(t.mul(2), 1)).div(TSL.vec2(5, 5))
        );
        finalColour = TSL.mix(
          finalColour,
          TSL.vec3(0.2, 0.2, 0.1),
          TSL.smoothstep(0.01, 0.0, hills)
        );

        const mounds = groundLayer(
          p.add(TSL.vec2(t.mul(4), 3)).div(TSL.vec2(2.5, 2.5))
        );
        finalColour = TSL.mix(
          finalColour,
          TSL.vec3(0.3, 0.3, 0.1),
          TSL.smoothstep(0.01, 0.0, mounds)
        );

        const bumps = groundLayer(
          p.add(TSL.vec2(t.mul(8), 6)).div(TSL.vec2(4, 1))
        );
        finalColour = TSL.mix(
          finalColour,
          TSL.vec3(0.4, 0.4, 0.1),
          TSL.smoothstep(0.01, 0.0, bumps)
        );

        const foreground = groundLayer(
          p.add(TSL.vec2(t.mul(16), 8.5)).div(TSL.vec2(5, 1))
        );
        finalColour = TSL.mix(
          finalColour,
          TSL.vec3(0.5, 0.4, 0.1),
          TSL.smoothstep(0.01, 0.0, foreground)
        );

        // Wheels (simplified - TSL doesn't support loops the same way)
        const wheelOffsetX = this.wheelOffsetUniform.x;
        for (let i = 0; i < 4; i++) {
          const offset = wheelOffsetX.add(i * 2.25);
          const wheel = Sphere(
            p,
            TSL.vec2(
              offset,
              TSL.mx_noise_float(t.mul(2).add(offset.div(4)))
                .sub(4.95)
                .add(this.wheelOffsetUniform.y)
            ),
            1
          );
          finalColour = TSL.mix(
            finalColour,
            TSL.vec3(0.025, 0.025, 0.025),
            TSL.smoothstep(0.01, 0, wheel)
          );
        }

        // Tank
        const tankOffset = wheelOffsetX.sub(0.55);
        const tank = Tank(
          p,
          TSL.vec2(
            tankOffset,
            TSL.mx_noise_float(t.mul(2).add(tankOffset.div(4)))
              .sub(4.5)
              .add(this.wheelOffsetUniform.y)
          )
        );

        finalColour = TSL.mix(
          finalColour,
          Camouflage(
            TSL.vec2(
              p.x.sub(tankOffset),
              p.y
                .sub(this.wheelOffsetUniform.y)
                .add(
                  TSL.negate(
                    TSL.mx_noise_float(t.mul(2).add(tankOffset.div(4)))
                  )
                )
            )
          ),
          tank
        );

        // Bullet
        const bulletOffset = tankOffset.sub(9);
        const bullet = Sphere(
          p,
          TSL.vec2(
            bulletOffset.sub(4.05),
            TSL.mx_noise_float(t.mul(2).add(bulletOffset.div(4))).add(
              this.bulletOffsetUniform
            )
          ),
          0.1
        );
        finalColour = TSL.mix(
          finalColour,
          TSL.vec3(0.5, 0, 0),
          TSL.smoothstep(0.01, 0, bullet)
        );

        // Shell
        const shell = Sphere(
          p,
          TSL.vec2(
            bulletOffset.add(5).add(this.shellOffsetUniform),
            TSL.mx_noise_float(t.mul(2).add(bulletOffset.div(4))).sub(1.8)
          ),
          0.2
        );
        finalColour = TSL.mix(
          finalColour,
          TSL.vec3(0.5, 0, 0),
          TSL.smoothstep(0.01, 0, shell)
        );

        return finalColour;
      });

      // Apply the desert tank fragment shader
      this.material.colorNode = mainDesertTank();

      // Material properties
      this.material.transparent = true;
      this.material.side = THREE.DoubleSide;

      console.log("✅ TSL Desert Tank Material created successfully!");
    } catch (error) {
      console.error("❌ TSL Desert Tank failed, using fallback:", error);
      this.createFallbackMaterial();
    }
  }

  private createFallbackMaterial(): void {
    console.log("🔄 Using fallback Desert Tank ShaderMaterial");
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
        uniform vec2 uWheelOffset;
        uniform float uBulletOffset;
        uniform float uShellOffset;
        varying vec2 vUv;
        varying vec3 vPosition;
        
        // Simple noise function
        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
        }
        
        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
                     mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
        }
        
        // SDF functions
        float circle(vec2 p, float r) {
          return length(p) - r;
        }
        
        float box(vec2 p, vec2 b) {
          vec2 d = abs(p) - b;
          return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
        }
        
        // Ground layer
        float groundLayer(vec2 p) {
          return p.y - noise(p.x);
        }
        
        // Sky gradient
        vec3 sky(vec2 p) {
          vec3 topColor = vec3(0.1, 0.2, 0.5);
          vec3 midColor = vec3(1.0, 0.4, 0.2);
          vec3 bottomColor = vec3(0.9, 0.6, 0.3);
          
          float t = p.y / 5.0;
          return mix(mix(bottomColor, midColor, t), topColor, t);
        }
        
        void main() {
          vec2 p = vPosition.xy * 20.0;
          float t = uTime * 0.5;
          
          // Sky
          vec3 color = sky(p);
          
          // Simple parallax layers
          float mountains = groundLayer((p + vec2(t, -1.0)) / vec2(10.0, 10.0));
          color = mix(color, vec3(0.1), smoothstep(0.01, 0.0, mountains));
          
          float hills = groundLayer((p + vec2(t * 2.0, 1.0)) / vec2(5.0, 5.0));
          color = mix(color, vec3(0.2, 0.2, 0.1), smoothstep(0.01, 0.0, hills));
          
          // Tank body (simplified)
          vec2 tankPos = vec2(uWheelOffset.x - 0.55, uWheelOffset.y - 4.5);
          float tankBody = box(p - tankPos, vec2(4.0, 2.0));
          color = mix(color, vec3(0.3, 0.5, 0.2), smoothstep(0.01, 0.0, tankBody));
          
          // Wheels
          for(int i = 0; i < 4; i++) {
            float offset = uWheelOffset.x + float(i) * 2.25;
            vec2 wheelPos = vec2(offset, uWheelOffset.y - 4.95);
            float wheel = circle(p - wheelPos, 1.0);
            color = mix(color, vec3(0.025), smoothstep(0.01, 0.0, wheel));
          }
          
          // Bullet
          vec2 bulletPos = vec2(uWheelOffset.x - 4.0, uBulletOffset);
          float bullet = circle(p - bulletPos, 0.1);
          color = mix(color, vec3(0.5, 0.0, 0.0), smoothstep(0.01, 0.0, bullet));
          
          gl_FragColor = vec4(color, 1.0);
        }
      `,
      uniforms: {
        uTime: { value: 0.0 },
        uWheelOffset: { value: new THREE.Vector2(-10, 0) },
        uBulletOffset: { value: 20 },
        uShellOffset: { value: 25 },
      },
      side: THREE.DoubleSide,
      transparent: true,
    });
  }

  private initMesh(position: THREE.Vector3): void {
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.position.copy(position);
  }

  private initControls(): void {
    const onDocumentKey = (e: KeyboardEvent) => {
      this.keyMap[e.code] = e.type === "keydown";
      return false;
    };
    document.addEventListener("keydown", onDocumentKey);
    document.addEventListener("keyup", onDocumentKey);
  }

  // Game mechanics
  public jump(): void {
    if (!this.canJump) return;
    this.canJump = false;

    // Simple jump animation (you'll need to implement your own tweening)
    const startY = this.wheelOffset.y;
    const jumpHeight = 5;
    const jumpDuration = 500; // ms

    let startTime = performance.now();
    const animateJump = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / jumpDuration, 1);

      if (progress < 0.5) {
        // Going up
        const upProgress = progress * 2;
        this.wheelOffset = new THREE.Vector2(
          this.wheelOffset.x,
          startY + jumpHeight * Math.sin(upProgress * Math.PI * 0.5)
        );
      } else {
        // Going down with bounce
        const downProgress = (progress - 0.5) * 2;
        this.wheelOffset = new THREE.Vector2(
          this.wheelOffset.x,
          startY + jumpHeight * Math.cos(downProgress * Math.PI * 0.5)
        );
      }

      if (progress < 1) {
        requestAnimationFrame(animateJump);
      } else {
        this.wheelOffset = new THREE.Vector2(this.wheelOffset.x, startY);
        this.canJump = true;
      }
    };
    requestAnimationFrame(animateJump);
  }

  public shoot(): void {
    if (!this.canShoot) return;
    this.canShoot = false;

    // Simple shoot animation
    this.bulletOffset = 0;
    this.shellOffset = 0;

    const startTime = performance.now();
    const shootDuration = 500;

    const animateShoot = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / shootDuration, 1);

      this.bulletOffset = 20 * progress;
      this.shellOffset = 25 * progress;

      if (progress < 1) {
        requestAnimationFrame(animateShoot);
      } else {
        this.canShoot = true;
      }
    };
    requestAnimationFrame(animateShoot);
  }

  // Getters and setters
  get wheelOffset(): THREE.Vector2 {
    if (this.wheelOffsetUniform) {
      return this.wheelOffsetUniform.value;
    }
    return (
      (this.material as THREE.ShaderMaterial).uniforms?.uWheelOffset?.value ??
      new THREE.Vector2(-10, 0)
    );
  }

  set wheelOffset(value: THREE.Vector2) {
    if (this.wheelOffsetUniform) {
      this.wheelOffsetUniform.value = value;
    } else if ((this.material as THREE.ShaderMaterial).uniforms?.uWheelOffset) {
      (this.material as THREE.ShaderMaterial).uniforms.uWheelOffset.value =
        value;
    }
  }

  get bulletOffset(): number {
    if (this.bulletOffsetUniform) {
      return this.bulletOffsetUniform.value;
    }
    return (
      (this.material as THREE.ShaderMaterial).uniforms?.uBulletOffset?.value ??
      20
    );
  }

  set bulletOffset(value: number) {
    if (this.bulletOffsetUniform) {
      this.bulletOffsetUniform.value = value;
    } else if (
      (this.material as THREE.ShaderMaterial).uniforms?.uBulletOffset
    ) {
      (this.material as THREE.ShaderMaterial).uniforms.uBulletOffset.value =
        value;
    }
  }

  get shellOffset(): number {
    if (this.shellOffsetUniform) {
      return this.shellOffsetUniform.value;
    }
    return (
      (this.material as THREE.ShaderMaterial).uniforms?.uShellOffset?.value ??
      25
    );
  }

  set shellOffset(value: number) {
    if (this.shellOffsetUniform) {
      this.shellOffsetUniform.value = value;
    } else if ((this.material as THREE.ShaderMaterial).uniforms?.uShellOffset) {
      (this.material as THREE.ShaderMaterial).uniforms.uShellOffset.value =
        value;
    }
  }

  // Update method with controls
  update(deltaTime: number): void {
    // Handle input
    if (this.keyMap["KeyW"] || this.keyMap["ArrowUp"]) {
      this.canJump && this.jump();
    }
    if (this.keyMap["KeyA"] || this.keyMap["ArrowLeft"]) {
      const currentOffset = this.wheelOffset;
      this.wheelOffset = new THREE.Vector2(
        currentOffset.x - 4 * deltaTime,
        currentOffset.y
      );
    }
    if (this.keyMap["KeyD"] || this.keyMap["ArrowRight"]) {
      const currentOffset = this.wheelOffset;
      this.wheelOffset = new THREE.Vector2(
        currentOffset.x + 4 * deltaTime,
        currentOffset.y
      );
    }
    if (this.keyMap["Space"]) {
      this.canShoot && this.shoot();
    }

    // Update fallback material time
    if ((this.material as THREE.ShaderMaterial).uniforms?.uTime) {
      (this.material as THREE.ShaderMaterial).uniforms.uTime.value += deltaTime;
    }
  }

  // Clean up
  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
    // Remove event listeners
    document.removeEventListener("keydown", this.initControls);
    document.removeEventListener("keyup", this.initControls);
  }
}
