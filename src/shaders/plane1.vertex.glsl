// vertex.glsl
uniform float uTime;
uniform vec2 uResolution;

varying vec2 vUv;
varying vec3 vPosition;

void main() {
    vUv = uv;
    vPosition = position;
    
    // Simple wave animation
    vec3 pos = position;
    pos.z += sin(pos.x * 3.0 + uTime) * 0.1;
    pos.z += cos(pos.y * 2.0 + uTime * 0.5) * 0.05;
    
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}