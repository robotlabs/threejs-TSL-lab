// simple.vertex.glsl
uniform float uTime;

varying vec2 vUv;
varying vec3 vPosition;

void main() {
    vUv = uv;
    vPosition = position;
    
    // Create a simple wave effect
    vec3 pos = position;
    pos.z += sin(pos.x * 2.0 + uTime) * 0.2;
    pos.z += cos(pos.y * 1.5 + uTime * 0.7) * 0.15;
    
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}