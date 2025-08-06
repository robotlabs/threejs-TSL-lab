import * as THREE from "three";

export class LightManager {
  private scene: THREE.Scene;
  public ambient: THREE.AmbientLight;
  public keyLight: THREE.DirectionalLight;
  public fillLight: THREE.PointLight;
  public backLight: THREE.PointLight;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.ambient = this.createAmbient();
    this.keyLight = this.createKeyLight();
    this.fillLight = this.createFillLight();
    this.backLight = this.createBackLight();
  }

  private createAmbient(): THREE.AmbientLight {
    const light = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(light);
    return light;
  }

  private createKeyLight(): THREE.DirectionalLight {
    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(5, 10, 7.5);
    light.castShadow = true;
    this.scene.add(light);
    return light;
  }

  private createFillLight(): THREE.PointLight {
    const light = new THREE.PointLight(0xffffff, 0.3);
    light.position.set(-5, 5, -5);
    this.scene.add(light);
    return light;
  }

  private createBackLight(): THREE.PointLight {
    const light = new THREE.PointLight(0xffffff, 0.2);
    light.position.set(0, 5, -10);
    this.scene.add(light);
    return light;
  }
}
