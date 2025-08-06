// simple.fragment.glsl
uniform float uTime;
uniform vec2 uResolution;

varying vec2 vUv;
varying vec3 vPosition;

void main() {
    // Create a gradient based on UV coordinates
    vec3 color = vec3(0.0);
    
    // Horizontal gradient
    color.r = vUv.x;
    
    // Vertical gradient  
    color.g = vUv.y;
    
    // Animated blue component
    color.b = sin(uTime + vUv.x * 3.14159) * 0.5 + 0.5;
    
    // Add some animated stripes
    float stripes = sin(vUv.y * 20.0 + uTime * 2.0) * 0.1 + 0.9;
    color *= stripes;
    
    // Add a pulsing center circle
    vec2 center = vec2(0.5, 0.5);
    float dist = distance(vUv, center);
    float circle = 1.0 - smoothstep(0.2, 0.3, dist);
    float pulse = sin(uTime * 3.0) * 0.5 + 0.5;
    color += vec3(circle * pulse * 0.5);
    
    gl_FragColor = vec4(color, 1.0);
}