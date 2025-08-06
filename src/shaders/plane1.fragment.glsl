// fragment.glsl
uniform float uTime;
uniform vec2 uResolution;
uniform sampler2D uTexture;

varying vec2 vUv;
varying vec3 vPosition;

void main() {
    // Get the texture color
    vec4 textureColor = texture2D(uTexture, vUv);
    
    // Add some color animation
    vec3 color = textureColor.rgb;
    
    // Add a pulsing effect
    float pulse = sin(uTime * 2.0) * 0.5 + 0.5;
    color *= 0.8 + pulse * 0.4;
    
    // Add some gradient based on UV
    color += vec3(vUv.x * 0.2, vUv.y * 0.1, 0.3) * pulse;
    
    gl_FragColor = vec4(color, textureColor.a);
}