"use client";

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { EffectComposer, EffectPass, RenderPass, Effect } from 'postprocessing';

type PixelBlastVariant = 'square' | 'circle' | 'triangle' | 'diamond';

type PixelBlastProps = {
  variant?: PixelBlastVariant;
  pixelSize?: number;
  color?: string;
  className?: string;
  style?: React.CSSProperties;
  antialias?: boolean;
  patternScale?: number;
  patternDensity?: number;
  liquid?: boolean;
  liquidStrength?: number;
  liquidRadius?: number;
  pixelSizeJitter?: number;
  enableRipples?: boolean;
  rippleIntensityScale?: number;
  rippleThickness?: number;
  rippleSpeed?: number;
  liquidWobbleSpeed?: number;
  autoPauseOffscreen?: boolean;
  speed?: number;
  transparent?: boolean;
  edgeFade?: number;
  noiseAmount?: number;
};

const createTouchTexture = () => {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D context not available');
  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const texture = new THREE.Texture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  const trail: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    force: number;
    age: number;
  }[] = [];
  let last: { x: number; y: number } | null = null;
  const maxAge = 64;
  let radius = 0.1 * size;
  const speed = 1 / maxAge;
  const clear = () => {
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };
  const drawPoint = (p: { x: number; y: number; vx: number; vy: number; force: number; age: number }) => {
    const pos = { x: p.x * size, y: (1 - p.y) * size };
    let intensity = 1;
    const easeOutSine = (t: number) => Math.sin((t * Math.PI) / 2);
    const easeOutQuad = (t: number) => -t * (t - 2);
    if (p.age < maxAge * 0.3) intensity = easeOutSine(p.age / (maxAge * 0.3));
    else intensity = easeOutQuad(1 - (p.age - maxAge * 0.3) / (maxAge * 0.7)) || 0;
    intensity *= p.force;
    const color = `${((p.vx + 1) / 2) * 255}, ${((p.vy + 1) / 2) * 255}, ${intensity * 255}`;
    const offset = size * 5;
    ctx.shadowOffsetX = offset;
    ctx.shadowOffsetY = offset;
    ctx.shadowBlur = radius;
    ctx.shadowColor = `rgba(${color},${0.22 * intensity})`;
    ctx.beginPath();
    ctx.fillStyle = 'rgba(255,0,0,1)';
    ctx.arc(pos.x - offset, pos.y - offset, radius, 0, Math.PI * 2);
    ctx.fill();
  };
  const addTouch = (norm: { x: number; y: number }) => {
    let force = 0;
    let vx = 0;
    let vy = 0;
    if (last) {
      const dx = norm.x - last.x;
      const dy = norm.y - last.y;
      if (dx === 0 && dy === 0) return;
      const dd = dx * dx + dy * dy;
      const d = Math.sqrt(dd);
      vx = dx / (d || 1);
      vy = dy / (d || 1);
      force = Math.min(dd * 10000, 1);
    }
    last = { x: norm.x, y: norm.y };
    trail.push({ x: norm.x, y: norm.y, age: 0, force, vx, vy });
  };
  const update = () => {
    clear();
    for (let i = trail.length - 1; i >= 0; i--) {
      const point = trail[i];
      const f = point.force * speed * (1 - point.age / maxAge);
      point.x += point.vx * f;
      point.y += point.vy * f;
      point.age++;
      if (point.age > maxAge) trail.splice(i, 1);
    }
    for (let i = 0; i < trail.length; i++) drawPoint(trail[i]);
    texture.needsUpdate = true;
  };
  return {
    canvas,
    texture,
    addTouch,
    update,
    set radiusScale(v: number) {
      radius = 0.1 * size * v;
    },
    get radiusScale() {
      return radius / (0.1 * size);
    },
    size
  };
};

const createLiquidEffect = (texture: THREE.Texture, opts?: { strength?: number; freq?: number }) => {
  const fragment = `
    uniform sampler2D uTexture;
    uniform float uStrength;
    uniform float uTime;
    uniform float uFreq;

    void mainUv(inout vec2 uv) {
      vec4 tex = texture2D(uTexture, uv);
      float vx = tex.r * 2.0 - 1.0;
      float vy = tex.g * 2.0 - 1.0;
      float intensity = tex.b;

      float wave = 0.5 + 0.5 * sin(uTime * uFreq + intensity * 6.2831853);

      float amt = uStrength * intensity * wave;

      uv += vec2(vx, vy) * amt;
    }
    `;
  return new Effect('LiquidEffect', fragment, {
    uniforms: new Map<string, THREE.Uniform>([
      ['uTexture', new THREE.Uniform(texture)],
      ['uStrength', new THREE.Uniform(opts?.strength ?? 0.025)],
      ['uTime', new THREE.Uniform(0)],
      ['uFreq', new THREE.Uniform(opts?.freq ?? 4.5)]
    ])
  });
};

const SHAPE_MAP: Record<PixelBlastVariant, number> = {
  square: 0,
  circle: 1,
  triangle: 2,
  diamond: 3
};

const VERTEX_SRC = `
void main() {
  gl_Position = vec4(position, 1.0);
}
`;
const FRAGMENT_SRC = `
precision highp float;

uniform vec3  uColor;
uniform vec2  uResolution;
uniform float uTime;
uniform float uPixelSize;
uniform float uScale;
uniform float uDensity;
uniform float uPixelJitter;
uniform int   uEnableRipples;
uniform float uRippleSpeed;
uniform float uRippleThickness;
uniform float uRippleIntensity;
uniform float uEdgeFade;

uniform int   uShapeType;
const int SHAPE_SQUARE   = 0;
const int SHAPE_CIRCLE   = 1;
const int SHAPE_TRIANGLE = 2;
const int SHAPE_DIAMOND  = 3;

const int   MAX_CLICKS = 10;

uniform vec2  uClickPos  [MAX_CLICKS];
uniform float uClickTimes[MAX_CLICKS];

float Bayer2(vec2 a) {
  a = floor(a);
  return fract(a.x / 2. + a.y * a.y * .75);
}
#define Bayer4(a) (Bayer2(.5*(a))*0.25 + Bayer2(a))
#define Bayer8(a) (Bayer4(.5*(a))*0.25 + Bayer2(a))

#define FBM_OCTAVES     5
#define FBM_LACUNARITY  1.25
#define FBM_GAIN        1.0

float hash11(float n){ return fract(sin(n)*43758.5453); }

float vnoise(vec3 p){
  vec3 ip = floor(p);
  vec3 fp = fract(p);
  float n000 = hash11(dot(ip + vec3(0.0,0.0,0.0), vec3(1.0,57.0,113.0)));
  float n100 = hash11(dot(ip + vec3(1.0,0.0,0.0), vec3(1.0,57.0,113.0)));
  float n010 = hash11(dot(ip + vec3(0.0,1.0,0.0), vec3(1.0,57.0,113.0)));
  float n110 = hash11(dot(ip + vec3(1.0,1.0,0.0), vec3(1.0,57.0,113.0)));
  float n001 = hash11(dot(ip + vec3(0.0,0.0,1.0), vec3(1.0,57.0,113.0)));
  float n101 = hash11(dot(ip + vec3(1.0,0.0,1.0), vec3(1.0,57.0,113.0)));
  float n011 = hash11(dot(ip + vec3(0.0,1.0,1.0), vec3(1.0,57.0,113.0)));
  float n111 = hash11(dot(ip + vec3(1.0,1.0,1.0), vec3(1.0,57.0,113.0)));
  vec3 w = fp*fp*fp*(fp*(fp*6.0-15.0)+10.0);
  float x00 = mix(n000, n100, w.x);
  float x10 = mix(n010, n110, w.x);
  float x01 = mix(n001, n101, w.x);
  float x11 = mix(n011, n111, w.x);
  float y0  = mix(x00, x10, w.y);
  float y1  = mix(x01, x11, w.y);
  return mix(y0, y1, w.z) * 2.0 - 1.0;
}

float fbm2(vec2 uv, float t){
  vec3 p = vec3(uv * uScale, t);
  float amp = 1.0;
  float freq = 1.0;
  float sum = 1.0;
  for (int i = 0; i < FBM_OCTAVES; ++i){
    sum  += amp * vnoise(p * freq);
    freq *= FBM_LACUNARITY;
    amp  *= FBM_GAIN;
  }
  return sum * 0.5 + 0.5;
}

float maskCircle(vec2 p, float cov){
  float r = sqrt(cov) * .25;
  float d = length(p - 0.5) - r;
  float aa = 0.5 * fwidth(d);
  return cov * (1.0 - smoothstep(-aa, aa, d * 2.0));
}

float maskTriangle(vec2 p, vec2 id, float cov){
  bool flip = mod(id.x + id.y, 2.0) > 0.5;
  if (flip) p.x = 1.0 - p.x;
  float r = sqrt(cov);
  float d  = p.y - r*(1.0 - p.x);
  float aa = fwidth(d);
  return cov * clamp(0.5 - d/aa, 0.0, 1.0);
}

float maskDiamond(vec2 p, float cov){
  float r = sqrt(cov) * 0.564;
  return step(abs(p.x - 0.49) + abs(p.y - 0.49), r);
}

void main(){
  float pixelSize = uPixelSize;
  vec2 fragCoord = gl_FragCoord.xy - uResolution * .5;
  float aspectRatio = uResolution.x / uResolution.y;

  vec2 pixelId = floor(fragCoord / pixelSize);
  vec2 pixelUV = fract(fragCoord / pixelSize);

  float cellPixelSize = 8.0 * pixelSize;
  vec2 cellId = floor(fragCoord / cellPixelSize);
  vec2 cellCoord = cellId * cellPixelSize;
  vec2 uv = cellCoord / uResolution * vec2(aspectRatio, 1.0);

  float base = fbm2(uv, uTime * 0.05);
  base = base * 0.5 - 0.65;

  float feed = base + (uDensity - 0.5) * 0.3;

  float speed     = uRippleSpeed;
  float thickness = uRippleThickness;
  const float dampT     = 1.0;
  const float dampR     = 10.0;

  if (uEnableRipples == 1) {
    for (int i = 0; i < MAX_CLICKS; ++i){
      vec2 pos = uClickPos[i];
      if (pos.x < 0.0) continue;
      float cellPixelSize = 8.0 * pixelSize;
      vec2 cuv = (((pos - uResolution * .5 - cellPixelSize * .5) / (uResolution))) * vec2(aspectRatio, 1.0);
      float t = max(uTime - uClickTimes[i], 0.0);
      float r = distance(uv, cuv);
      float waveR = speed * t;
      float ring  = exp(-pow((r - waveR) / thickness, 2.0));
      float atten = exp(-dampT * t) * exp(-dampR * r);
      feed = max(feed, ring * atten * uRippleIntensity);
    }
  }

  float bayer = Bayer8(fragCoord / uPixelSize) - 0.5;
  float bw = step(0.5, feed + bayer);

  float h = fract(sin(dot(floor(fragCoord / uPixelSize), vec2(127.1, 311.7))) * 43758.5453);
  float jitterScale = 1.0 + (h - 0.5) * uPixelJitter;
  float coverage = bw * jitterScale;
  float M;
  if      (uShapeType == SHAPE_CIRCLE)   M = maskCircle (pixelUV, coverage);
  else if (uShapeType == SHAPE_TRIANGLE) M = maskTriangle(pixelUV, pixelId, coverage);
  else if (uShapeType == SHAPE_DIAMOND)  M = maskDiamond(pixelUV, coverage);
  else                                   M = coverage;

  if (uEdgeFade > 0.0) {
    vec2 norm = gl_FragCoord.xy / uResolution;
    float edge = min(min(norm.x, norm.y), min(1.0 - norm.x, 1.0 - norm.y));
    float fade = smoothstep(0.0, uEdgeFade, edge);
    M *= fade;
  }

  vec3 color = uColor;
  gl_FragColor = vec4(color, M);
}
`;

const MAX_CLICKS = 10;

const PixelBlast: React.FC<PixelBlastProps> = ({
  variant = 'square',
  pixelSize = 3,
  color = '#B19EEF',
  className,
  style,
  antialias = true,
  patternScale = 2,
  patternDensity = 1,
  liquid = false,
  liquidStrength = 0.1,
  liquidRadius = 1,
  pixelSizeJitter = 0,
  enableRipples = true,
  rippleIntensityScale = 1,
  rippleThickness = 0.1,
  rippleSpeed = 0.3,
  liquidWobbleSpeed = 4.5,
  autoPauseOffscreen = true,
  speed = 0.5,
  transparent = true,
  edgeFade = 0.5,
  noiseAmount = 0
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const visibilityRef = useRef({ visible: true });
  const speedRef = useRef(speed);

  const threeRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.OrthographicCamera;
    material: THREE.ShaderMaterial;
    clock: THREE.Clock;
    clickIx: number;
    uniforms: {
      uResolution: { value: THREE.Vector2 };
      uTime: { value: number };
      uColor: { value: THREE.Color };
      uClickPos: { value: THREE.Vector2[] };
      uClickTimes: { value: Float32Array };
      uShapeType: { value: number };
      uPixelSize: { value: number };
      uScale: { value: number };
      uDensity: { value: number };
      uPixelJitter: { value: number };
      uEnableRipples: { value: number };
      uRippleSpeed: { value: number };
      uRippleThickness: { value: number };
      uRippleIntensity: { value: number };
      uEdgeFade: { value: number };
    };
    resizeObserver?: ResizeObserver;
    raf?: number;
    quad?: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
    timeOffset?: number;
    composer?: EffectComposer;
    touch?: ReturnType<typeof createTouchTexture>;
    liquidEffect?: Effect;
  } | null>(null);
  const prevConfigRef = useRef<any>(null);
  useEffect(() => {
    console.log('[PixelBlast] useEffect started');
    const container = containerRef.current;
    if (!container) {
      console.error('[PixelBlast] Container ref is null!');
      return;
    }
    
    console.log('[PixelBlast] Container found:', {
      clientWidth: container.clientWidth,
      clientHeight: container.clientHeight,
      offsetWidth: container.offsetWidth,
      offsetHeight: container.offsetHeight,
      getBoundingClientRect: container.getBoundingClientRect()
    });
    
    speedRef.current = speed;
    const needsReinitKeys = ['antialias', 'liquid', 'noiseAmount'];
    const cfg = { antialias, liquid, noiseAmount };
    let mustReinit = false;
    if (!threeRef.current) {
      mustReinit = true;
      console.log('[PixelBlast] No Three.js instance, must reinit');
    } else if (prevConfigRef.current) {
      for (const k of needsReinitKeys)
        if (prevConfigRef.current[k] !== (cfg as any)[k]) {
          mustReinit = true;
          console.log('[PixelBlast] Config changed, must reinit');
          break;
        }
    }
    
    let dimensionCheckCount = 0;
    // Wait for container to have dimensions before initializing
    const init = () => {
      dimensionCheckCount++;
      const w = container.clientWidth;
      const h = container.clientHeight;
      
      if (w === 0 || h === 0) {
        if (dimensionCheckCount < 100) { // Prevent infinite loop
          console.log(`[PixelBlast] Waiting for dimensions... (attempt ${dimensionCheckCount})`, { w, h });
          requestAnimationFrame(init);
        } else {
          console.error('[PixelBlast] Container dimensions still 0 after 100 attempts!', {
            clientWidth: w,
            clientHeight: h,
            offsetWidth: container.offsetWidth,
            offsetHeight: container.offsetHeight,
            computedStyle: window.getComputedStyle(container)
          });
        }
        return;
      }
      
      console.log('[PixelBlast] Container has dimensions, initializing Three.js:', { w, h });
      initializeThree();
    };
    
    const initializeThree = () => {
      // TEMPORARY TEST FLAG: Set to true to use solid red material (bypasses shader/composer)
      const USE_TEST_MATERIAL = false; // Changed back to false to use shader
      
      console.log('[PixelBlast] initializeThree called, mustReinit:', mustReinit);
      try {
        if (mustReinit) {
          if (threeRef.current) {
            console.log('[PixelBlast] Cleaning up existing Three.js instance');
            const t = threeRef.current;
            t.resizeObserver?.disconnect();
            cancelAnimationFrame(t.raf!);
            t.quad?.geometry.dispose();
            t.material.dispose();
            t.composer?.dispose();
            t.renderer.dispose();
            if (t.renderer.domElement.parentElement === container) container.removeChild(t.renderer.domElement);
            threeRef.current = null;
          }
          
          console.log('[PixelBlast] Creating WebGL renderer...');
          const canvas = document.createElement('canvas');
          const renderer = new THREE.WebGLRenderer({
            canvas,
            antialias,
            alpha: true,
            powerPreference: 'high-performance'
          });
          
          console.log('[PixelBlast] WebGL renderer created:', {
            canvas: renderer.domElement,
            webglContext: renderer.getContext(),
            pixelRatio: renderer.getPixelRatio()
          });
          
          renderer.domElement.style.width = '100%';
          renderer.domElement.style.height = '100%';
          renderer.domElement.style.display = 'block';
          renderer.domElement.style.position = 'absolute';
          renderer.domElement.style.top = '0';
          renderer.domElement.style.left = '0';
          renderer.domElement.style.zIndex = '1'; // Above container background
          renderer.domElement.style.pointerEvents = 'auto';
          renderer.domElement.style.opacity = '1';
          renderer.domElement.style.visibility = 'visible';
          renderer.domElement.style.backgroundColor = 'transparent';
          
          // Force visibility with !important via setAttribute
          renderer.domElement.setAttribute('style', 
            renderer.domElement.getAttribute('style') + 
            ' !important; display: block !important; visibility: visible !important; opacity: 1 !important;'
          );
          renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
          
          console.log('[PixelBlast] Appending canvas to container');
          container.appendChild(renderer.domElement);
          
          // Force a reflow to ensure styles are applied
          void renderer.domElement.offsetHeight;
          
          // Set background based on mode
          // For shader to be visible, we need a non-transparent background
          if (USE_TEST_MATERIAL) {
            renderer.setClearColor(0x000000, 1); // Black background for contrast
            console.log('[PixelBlast] Renderer set to black background (TEST MODE)');
          } else {
            // Even with transparent=true, use a dark background so shader is visible
            renderer.setClearColor(0x000000, 1);
            console.log('[PixelBlast] Renderer set to black background (shader needs visible background)');
          }
          
          // TEMPORARY TEST DISABLED - was causing red flash on reload
          /*
          setTimeout(() => {
            const gl = renderer.getContext();
            const testCanvas = document.createElement('canvas');
            testCanvas.width = 100;
            testCanvas.height = 100;
            const ctx = testCanvas.getContext('2d');
            if (ctx) {
              ctx.fillStyle = 'red';
              ctx.fillRect(0, 0, 100, 100);
              console.log('[PixelBlast] TEST: Created red test canvas');
              
              // Check if our WebGL canvas is actually in DOM and visible
              const canvasRect = renderer.domElement.getBoundingClientRect();
              const containerRect = container.getBoundingClientRect();
              const canvasComputedStyle = window.getComputedStyle(renderer.domElement);
              const containerComputedStyle = window.getComputedStyle(container);
              console.log('[PixelBlast] TEST: Canvas visibility check:', {
                canvasInDOM: document.body.contains(renderer.domElement) || container.contains(renderer.domElement),
                canvasRect: {
                  x: canvasRect.x,
                  y: canvasRect.y,
                  width: canvasRect.width,
                  height: canvasRect.height,
                  top: canvasRect.top,
                  left: canvasRect.left
                },
                containerRect: {
                  x: containerRect.x,
                  y: containerRect.y,
                  width: containerRect.width,
                  height: containerRect.height,
                  top: containerRect.top,
                  left: containerRect.left
                },
                canvasStyles: {
                  display: canvasComputedStyle.display,
                  visibility: canvasComputedStyle.visibility,
                  opacity: canvasComputedStyle.opacity,
                  zIndex: canvasComputedStyle.zIndex,
                  position: canvasComputedStyle.position,
                  width: canvasComputedStyle.width,
                  height: canvasComputedStyle.height
                },
                containerStyles: {
                  zIndex: containerComputedStyle.zIndex,
                  position: containerComputedStyle.position,
                  overflow: containerComputedStyle.overflow
                },
                canvasParent: renderer.domElement.parentElement?.tagName,
                canvasSiblings: Array.from(renderer.domElement.parentElement?.children || []).map(el => ({
                  tag: el.tagName,
                  zIndex: window.getComputedStyle(el).zIndex,
                  display: window.getComputedStyle(el).display
                }))
              });
              
              // Try drawing directly to WebGL to see if it renders (bypass composer)
              console.log('[PixelBlast] TEST: Attempting direct render bypass...');
              
              // First test: simple red clear
              gl.clearColor(1, 0, 0, 1); // Red
              gl.clear(gl.COLOR_BUFFER_BIT);
              console.log('[PixelBlast] TEST: Red clear applied');
              
              // Second test: render without composer
              renderer.render(scene, camera);
              console.log('[PixelBlast] TEST: Direct renderer.render() called');
              
              // Third test: check what's actually on the canvas
              const buffer = new Uint8Array(100 * 100 * 4);
              gl.readPixels(0, 0, Math.min(100, renderer.domElement.width), Math.min(100, renderer.domElement.height), gl.RGBA, gl.UNSIGNED_BYTE, buffer);
              const imageData = Array.from(buffer);
              const hasNonTransparentPixels = imageData.some((val, idx) => idx % 4 === 3 && val > 0); // Check alpha channel
              console.log('[PixelBlast] TEST: Canvas pixel data check:', {
                hasNonTransparentPixels,
                sampleAlphaValues: imageData.filter((_, i) => i % 4 === 3).slice(0, 20),
                firstPixelRGBA: imageData.slice(0, 4),
                nonZeroAlphaCount: imageData.filter((val, idx) => idx % 4 === 3 && val > 0).length
              });
              
              // Fourth test: temporarily disable composer and render directly
              if (composer) {
                console.log('[PixelBlast] TEST: Temporarily bypassing composer...');
                renderer.render(scene, camera);
              }
            }
          }, 500);
          */
      const uniforms = {
        uResolution: { value: new THREE.Vector2(0, 0) },
        uTime: { value: 0 },
        uColor: { value: new THREE.Color(color) },
        uClickPos: {
          value: Array.from({ length: MAX_CLICKS }, () => new THREE.Vector2(-1, -1))
        },
        uClickTimes: { value: new Float32Array(MAX_CLICKS) },
        uShapeType: { value: SHAPE_MAP[variant] ?? 0 },
        uPixelSize: { value: pixelSize * renderer.getPixelRatio() },
        uScale: { value: patternScale },
        uDensity: { value: patternDensity },
        uPixelJitter: { value: pixelSizeJitter },
        uEnableRipples: { value: enableRipples ? 1 : 0 },
        uRippleSpeed: { value: rippleSpeed },
        uRippleThickness: { value: rippleThickness },
        uRippleIntensity: { value: rippleIntensityScale },
        uEdgeFade: { value: edgeFade }
      };
      
      console.log('[PixelBlast] Uniforms initialized:', {
        uColor: `#${uniforms.uColor.value.getHexString()}`,
        uPixelSize: uniforms.uPixelSize.value,
        uScale: uniforms.uScale.value,
        uDensity: uniforms.uDensity.value,
        uShapeType: uniforms.uShapeType.value,
        uPixelJitter: uniforms.uPixelJitter.value,
        uEdgeFade: uniforms.uEdgeFade.value,
        uEnableRipples: uniforms.uEnableRipples.value
      });
      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      
      // TEMPORARY: Use a simple solid color material to test visibility
      const testMaterial = new THREE.MeshBasicMaterial({
        color: 0xff0000, // Bright red
        transparent: false
      });
      
      const material = new THREE.ShaderMaterial({
        vertexShader: VERTEX_SRC,
        fragmentShader: FRAGMENT_SRC,
        uniforms,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        blending: THREE.NormalBlending,
        premultipliedAlpha: false
      });
      
      console.log('[PixelBlast] Shader material config:', {
        transparent: material.transparent,
        blending: material.blending,
        premultipliedAlpha: material.premultipliedAlpha
      });
      
      // Check for shader compilation errors
      material.onBeforeCompile = () => {
        console.log('[PixelBlast] Shader compiling...');
      };
      
      // Add error checking after first render
      const checkShaderErrors = () => {
        const gl = renderer.getContext();
        const program = material.shaderProgram;
        if (program) {
          if (!(program as any).linkStatus) {
            console.error('[PixelBlast] Shader program link error:', gl.getProgramInfoLog(program));
          }
          const vertexShader = gl.createShader(gl.VERTEX_SHADER) || 0;
          if (vertexShader && !(vertexShader as any).compileStatus) {
            console.error('[PixelBlast] Vertex shader error:', gl.getShaderInfoLog(vertexShader));
          }
        }
      };
      
      console.log('[PixelBlast] Shader material created:', {
        hasVertexShader: !!material.vertexShader,
        hasFragmentShader: !!material.fragmentShader,
        transparent: material.transparent,
        uniforms: Object.keys(uniforms),
        color: uniforms.uColor.value,
        uColorHex: `#${uniforms.uColor.value.getHexString()}`
      });
      
      // Check for errors after a short delay
      setTimeout(checkShaderErrors, 100);
      
      const quadGeom = new THREE.PlaneGeometry(2, 2);
      
      // TEMPORARY TEST: Use solid color material first to verify canvas visibility
      const quad = new THREE.Mesh(quadGeom, USE_TEST_MATERIAL ? testMaterial : material);
      scene.add(quad);
      console.log('[PixelBlast] Quad mesh added to scene:', { 
        sceneChildren: scene.children.length,
        usingTestMaterial: USE_TEST_MATERIAL,
        materialType: USE_TEST_MATERIAL ? 'MeshBasicMaterial (RED)' : 'ShaderMaterial'
      });
      const clock = new THREE.Clock();
      const setSize = () => {
        const w = container.clientWidth || 1;
        const h = container.clientHeight || 1;
        console.log('[PixelBlast] setSize called:', { w, h, canvasWidth: renderer.domElement.width, canvasHeight: renderer.domElement.height });
        renderer.setSize(w, h, false);
        const finalW = renderer.domElement.width;
        const finalH = renderer.domElement.height;
        uniforms.uResolution.value.set(finalW, finalH);
        console.log('[PixelBlast] Renderer size set:', { finalW, finalH, resolution: uniforms.uResolution.value });
        if (threeRef.current?.composer)
          threeRef.current.composer.setSize(finalW, finalH);
        uniforms.uPixelSize.value = pixelSize * renderer.getPixelRatio();
      };
      setSize();
      const ro = new ResizeObserver(setSize);
      ro.observe(container);
      const randomFloat = () => {
        if (typeof window !== 'undefined' && (window as any).crypto?.getRandomValues !== undefined) {
          const u32 = new Uint32Array(1);
          window.crypto.getRandomValues(u32);
          return u32[0] / 0xffffffff;
        }
        return Math.random();
      };
      const timeOffset = randomFloat() * 1000;
      let composer: EffectComposer | undefined;
      let touch: ReturnType<typeof createTouchTexture> | undefined;
      let liquidEffect: Effect | undefined;
      if (liquid) {
        touch = createTouchTexture();
        touch.radiusScale = liquidRadius;
        composer = new EffectComposer(renderer);
        const renderPass = new RenderPass(scene, camera);
        renderPass.renderToScreen = false; // Don't render to screen, go through effect pass
        liquidEffect = createLiquidEffect(touch.texture, {
          strength: liquidStrength,
          freq: liquidWobbleSpeed
        });
        const effectPass = new EffectPass(camera, liquidEffect);
        effectPass.renderToScreen = true; // This should render to screen
        composer.addPass(renderPass);
        composer.addPass(effectPass);
        
        console.log('[PixelBlast] Composer setup:', {
          passes: composer.passes.length,
          renderPassRenderToScreen: renderPass.renderToScreen,
          effectPassRenderToScreen: effectPass.renderToScreen
        });
      }
      if (noiseAmount > 0) {
        if (!composer) {
          composer = new EffectComposer(renderer);
          composer.addPass(new RenderPass(scene, camera));
        }
        const noiseEffect = new Effect(
          'NoiseEffect',
          `uniform float uTime; uniform float uAmount; float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453);} void mainUv(inout vec2 uv){} void mainImage(const in vec4 inputColor,const in vec2 uv,out vec4 outputColor){ float n=hash(floor(uv*vec2(1920.0,1080.0))+floor(uTime*60.0)); float g=(n-0.5)*uAmount; outputColor=inputColor+vec4(vec3(g),0.0);} `,
          {
            uniforms: new Map<string, THREE.Uniform>([
              ['uTime', new THREE.Uniform(0)],
              ['uAmount', new THREE.Uniform(noiseAmount)]
            ])
          }
        );
        const noisePass = new EffectPass(camera, noiseEffect);
        noisePass.renderToScreen = true;
        if (composer && composer.passes.length > 0) composer.passes.forEach((p: any) => ((p).renderToScreen = false));
        composer.addPass(noisePass);
      }
      if (composer) composer.setSize(renderer.domElement.width, renderer.domElement.height);
      const mapToPixels = (e: PointerEvent) => {
        const rect = renderer.domElement.getBoundingClientRect();
        const scaleX = renderer.domElement.width / rect.width;
        const scaleY = renderer.domElement.height / rect.height;
        const fx = (e.clientX - rect.left) * scaleX;
        const fy = (rect.height - (e.clientY - rect.top)) * scaleY;
        return {
          fx,
          fy,
          w: renderer.domElement.width,
          h: renderer.domElement.height
        };
      };
      const onPointerDown = (e: PointerEvent) => {
        const { fx, fy } = mapToPixels(e);
        const ix = threeRef.current?.clickIx ?? 0;
        uniforms.uClickPos.value[ix].set(fx, fy);
        uniforms.uClickTimes.value[ix] = uniforms.uTime.value;
        if (threeRef.current) threeRef.current.clickIx = (ix + 1) % MAX_CLICKS;
      };
      const onPointerMove = (e: PointerEvent) => {
        if (!touch) return;
        const { fx, fy, w, h } = mapToPixels(e);
        touch.addTouch({ x: fx / w, y: fy / h });
      };
      renderer.domElement.addEventListener('pointerdown', onPointerDown, {
        passive: true
      });
      renderer.domElement.addEventListener('pointermove', onPointerMove, {
        passive: true
      });
      let raf = 0;
      let frameCount = 0;
      const animate = () => {
        if (autoPauseOffscreen && !visibilityRef.current.visible) {
          raf = requestAnimationFrame(animate);
          return;
        }
        frameCount++;
        if (frameCount === 1) {
          console.log('[PixelBlast] First animation frame rendered!', {
            time: uniforms.uTime.value,
            resolution: { x: uniforms.uResolution.value.x, y: uniforms.uResolution.value.y },
            color: {
              r: uniforms.uColor.value.r,
              g: uniforms.uColor.value.g,
              b: uniforms.uColor.value.b,
              hex: `#${uniforms.uColor.value.getHexString()}`
            },
            uniforms: {
              uPixelSize: uniforms.uPixelSize.value,
              uScale: uniforms.uScale.value,
              uDensity: uniforms.uDensity.value,
              uPixelJitter: uniforms.uPixelJitter.value,
              uShapeType: uniforms.uShapeType.value,
              uEdgeFade: uniforms.uEdgeFade.value,
              uEnableRipples: uniforms.uEnableRipples.value
            },
            canvasVisible: renderer.domElement.offsetWidth > 0 && renderer.domElement.offsetHeight > 0
          });
          
          // Check pixel AFTER rendering (whether composer or direct)
          requestAnimationFrame(() => {
            const gl = renderer.getContext();
            const buffer = new Uint8Array(4);
            // Sample multiple points across the canvas
            const samples = [
              { x: Math.floor(uniforms.uResolution.value.x / 2), y: Math.floor(uniforms.uResolution.value.y / 2) },
              { x: Math.floor(uniforms.uResolution.value.x / 4), y: Math.floor(uniforms.uResolution.value.y / 4) },
              { x: Math.floor(uniforms.uResolution.value.x * 3 / 4), y: Math.floor(uniforms.uResolution.value.y * 3 / 4) }
            ];
            
            const results = samples.map(sample => {
              const buf = new Uint8Array(4);
              gl.readPixels(sample.x, sample.y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, buf);
              return { pos: sample, rgba: Array.from(buf), alpha: buf[3] };
            });
            
            const hasVisiblePixels = results.some(r => r.alpha > 0);
            console.log('[PixelBlast] Pixel samples after render:', {
              hasVisiblePixels,
              samples: results,
              avgAlpha: results.reduce((sum, r) => sum + r.alpha, 0) / results.length
            });
            
            if (!hasVisiblePixels) {
              console.warn('[PixelBlast] ⚠️ All sampled pixels are transparent! Shader may need higher density.');
              console.warn('[PixelBlast] 💡 Try increasing patternDensity. Current value:', uniforms.uDensity.value);
            }
          });
        }
        if (frameCount === 60) {
          console.log('[PixelBlast] 60 frames rendered successfully', {
            time: uniforms.uTime.value,
            usingComposer: !!composer,
            rendererInfo: {
              width: renderer.domElement.width,
              height: renderer.domElement.height,
              visible: renderer.domElement.offsetWidth > 0
            }
          });
        }
        uniforms.uTime.value = timeOffset + clock.getElapsedTime() * speedRef.current;
        if (liquidEffect) ((liquidEffect as any).uniforms as any).get('uTime').value = uniforms.uTime.value;
        
        // TEMPORARY: Bypass composer to test if shader renders directly
        const BYPASS_COMPOSER_FOR_TEST = true; // Set to false to re-enable composer
        if (USE_TEST_MATERIAL) {
          // Skip composer for test material
          renderer.render(scene, camera);
        } else if (BYPASS_COMPOSER_FOR_TEST && composer) {
          // Bypass composer and render shader directly to test
          if (frameCount === 1 || frameCount === 10) {
            console.log('[PixelBlast] TEST: Bypassing composer, rendering shader directly');
          }
          renderer.render(scene, camera);
        } else if (composer) {
          if (touch) touch.update();
          composer.passes.forEach((p: any)    => {
            const effs = (p as any).effects as any[] | undefined;
            if (effs)
              effs.forEach((eff: any) => {
                const u = (eff.uniforms as any)?.get('uTime');
                if (u) u.value = uniforms.uTime.value;
              });
          });
          
          // DEBUG: Check if composer is actually rendering
          if (frameCount === 1 || frameCount === 10) {
            console.log('[PixelBlast] DEBUG: Using composer.render()', {
              frameCount,
              composerPasses: composer.passes.length,
              hasRenderPass: composer.passes.some((p: any) => p instanceof RenderPass),
              hasEffectPass: composer.passes.some((p: any) => p instanceof EffectPass),
              renderToScreen: composer.passes.map((p: any) => p.renderToScreen),
              rendererSize: { width: renderer.domElement.width, height: renderer.domElement.height }
            });
          }
          
          composer.render();
        } else {
          if (frameCount === 1) {
            console.log('[PixelBlast] DEBUG: Using direct renderer.render()');
          }
          renderer.render(scene, camera);
        }
        raf = requestAnimationFrame(animate);
      };
      console.log('[PixelBlast] Starting animation loop');
      raf = requestAnimationFrame(animate);
      threeRef.current = {
        renderer,
        scene,
        camera,
        material,
        clock,
        clickIx: 0,
        uniforms,
        resizeObserver: ro,
        raf,
        quad,
        timeOffset,
        composer,
        touch,
        liquidEffect
      };
      
      // Wait a frame for styles to apply, then check visibility
      requestAnimationFrame(() => {
        const canvasStyle = window.getComputedStyle(renderer.domElement);
        const containerStyle = window.getComputedStyle(container);
        const canvasRect = renderer.domElement.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        
        console.log('[PixelBlast] 🔍 DETAILED VISIBILITY CHECK:', {
          canvasInDOM: container.contains(renderer.domElement),
          canvasVisibleInViewport: canvasRect.width > 0 && canvasRect.height > 0,
          canvasDimensions: {
            width: renderer.domElement.width,
            height: renderer.domElement.height,
            clientWidth: renderer.domElement.clientWidth,
            clientHeight: renderer.domElement.clientHeight,
            offsetWidth: renderer.domElement.offsetWidth,
            offsetHeight: renderer.domElement.offsetHeight
          },
          canvasRect: {
            x: canvasRect.x,
            y: canvasRect.y,
            width: canvasRect.width,
            height: canvasRect.height,
            top: canvasRect.top,
            left: canvasRect.left,
            bottom: canvasRect.bottom,
            right: canvasRect.right
          },
          containerRect: {
            x: containerRect.x,
            y: containerRect.y,
            width: containerRect.width,
            height: containerRect.height
          },
          canvasStyles: {
            display: canvasStyle.display,
            position: canvasStyle.position,
            zIndex: canvasStyle.zIndex,
            opacity: canvasStyle.opacity,
            visibility: canvasStyle.visibility,
            width: canvasStyle.width,
            height: canvasStyle.height,
            top: canvasStyle.top,
            left: canvasStyle.left,
            backgroundColor: canvasStyle.backgroundColor
          },
          containerStyles: {
            position: containerStyle.position,
            zIndex: containerStyle.zIndex,
            overflow: containerStyle.overflow,
            width: containerStyle.width,
            height: containerStyle.height,
            backgroundColor: containerStyle.backgroundColor
          },
          canvasParent: {
            tag: renderer.domElement.parentElement?.tagName,
            classes: renderer.domElement.parentElement?.className,
            styles: renderer.domElement.parentElement ? window.getComputedStyle(renderer.domElement.parentElement) : null
          },
          allChildren: Array.from(container.children).map((el, idx) => ({
            index: idx,
            tag: el.tagName,
            classes: el.className,
            zIndex: window.getComputedStyle(el).zIndex,
            display: window.getComputedStyle(el).display,
            opacity: window.getComputedStyle(el).opacity,
            visibility: window.getComputedStyle(el).visibility
          }))
        });
      });
    } else {
      console.log('[PixelBlast] Updating existing Three.js instance');
      const t = threeRef.current!;
      t.uniforms.uShapeType.value = SHAPE_MAP[variant] ?? 0;
      t.uniforms.uPixelSize.value = pixelSize * t.renderer.getPixelRatio();
      t.uniforms.uColor.value.set(color);
      t.uniforms.uScale.value = patternScale;
      t.uniforms.uDensity.value = patternDensity;
      t.uniforms.uPixelJitter.value = pixelSizeJitter;
      t.uniforms.uEnableRipples.value = enableRipples ? 1 : 0;
      t.uniforms.uRippleIntensity.value = rippleIntensityScale;
      t.uniforms.uRippleThickness.value = rippleThickness;
      t.uniforms.uRippleSpeed.value = rippleSpeed;
      t.uniforms.uEdgeFade.value = edgeFade;
      if (transparent) t.renderer.setClearAlpha(0);
      else t.renderer.setClearColor(0x000000, 1);
      if (t.liquidEffect) {
        const uStrength = (t.liquidEffect as any).uniforms.get('uStrength');
        if (uStrength) uStrength.value = liquidStrength;
        const uFreq = (t.liquidEffect as any).uniforms.get('uFreq');
        if (uFreq) uFreq.value = liquidWobbleSpeed;
      }
      if (t.touch) t.touch.radiusScale = liquidRadius;
    }
      
      console.log('[PixelBlast] initializeThree completed');
    } catch (error) {
      console.error('[PixelBlast] Error in initializeThree:', error);
    }
    };
    
    if (!threeRef.current) {
      console.log('[PixelBlast] No existing instance, calling init()');
      init();
    } else {
      console.log('[PixelBlast] Existing instance found, calling initializeThree()');
      initializeThree();
    }
    
    prevConfigRef.current = cfg;
    return () => {
      if (threeRef.current && mustReinit) return;
      if (!threeRef.current) return;
      const t = threeRef.current;
      t.resizeObserver?.disconnect();
      cancelAnimationFrame(t.raf!);
      t.quad?.geometry.dispose();
      t.material.dispose();
      t.composer?.dispose();
      t.renderer.dispose();
      if (t.renderer.domElement.parentElement === container) container.removeChild(t.renderer.domElement);
      threeRef.current = null;
    };
  }, [
    antialias,
    liquid,
    noiseAmount,
    pixelSize,
    patternScale,
    patternDensity,
    enableRipples,
    rippleIntensityScale,
    rippleThickness,
    rippleSpeed,
    pixelSizeJitter,
    edgeFade,
    transparent,
    liquidStrength,
    liquidRadius,
    liquidWobbleSpeed,
    autoPauseOffscreen,
    variant,
    color,
    speed
  ]);

  console.log('[PixelBlast] Component render, containerRef:', containerRef.current);
  
  return (
    <div
      ref={(el) => {
        containerRef.current = el;
        if (el) {
          console.log('[PixelBlast] Container ref set:', {
            element: el,
            clientWidth: el.clientWidth,
            clientHeight: el.clientHeight,
            style: window.getComputedStyle(el)
          });
        }
      }}
      className={`w-full h-full relative overflow-hidden ${className ?? ''}`}
      style={{ width: '100%', height: '100%', ...style }}
      aria-label="PixelBlast interactive background"
    />
  );
};

export default PixelBlast;
