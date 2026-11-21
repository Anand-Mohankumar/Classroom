"use strict";

window.createClassroomDaylight = function createClassroomDaylight(renderer, sun, windows) {
  const T = window.THREE;
  const depth = new T.WebGLRenderTarget(1, 1, {
    depthTexture: new T.DepthTexture(1, 1, T.UnsignedIntType),
    stencilBuffer: false
  });
  const depthOnly = new T.MeshBasicMaterial({ colorWrite: false });
  const lightDirection = sun.target.position.clone().sub(sun.position);
  const slopes = lightDirection.divideScalar(lightDirection.x);
  const screen = new T.Scene();
  const screenCamera = new T.OrthographicCamera(-1, 1, 1, -1, 0, 2);
  screenCamera.position.z = 1;
  const surface = new T.ShaderMaterial({
    transparent: true,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    uniforms: {
      roomDepth: { value: depth.depthTexture },
      worldFromCamera: { value: null },
      cameraFromClip: { value: null },
      eye: { value: null },
      sunlight: { value: slopes },
      windows: { value: new T.Vector3(...windows) },
      hazeColor: { value: new T.Color("#ffdaa0") }
    },
    vertexShader: `
      varying vec2 screenUV;

      void main() {
        screenUV = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 screenUV;
      uniform sampler2D roomDepth;
      uniform mat4 worldFromCamera;
      uniform mat4 cameraFromClip;
      uniform vec3 eye;
      uniform vec3 sunlight;
      uniform vec3 windows;
      uniform vec3 hazeColor;

      const float windowWall = -6.89;

      vec2 interval(float origin, float reciprocal, float low, float high) {
        vec2 crossing = (vec2(low, high) - origin) * reciprocal;
        return vec2(min(crossing.x, crossing.y), max(crossing.x, crossing.y));
      }

      vec2 overlap(vec2 a, vec2 b) {
        return vec2(max(a.x, b.x), min(a.y, b.y));
      }

      float densityAlong(vec2 path, vec3 ray) {
        float lengthInside = max(path.y - path.x, 0.0);
        float roomX = clamp(eye.x + ray.x * (path.x + path.y) * 0.5, windowWall, 5.8);
        return lengthInside * mix(1.0, 0.28, smoothstep(windowWall, 5.8, roomX));
      }

      float panes(vec2 lower, vec2 upper, vec3 origin, vec3 inverseRay, vec3 ray, float feather) {
        float amount = 0.0;
        for (int i = 0; i < 3; i++) {
          float bay = windows[i];
          vec2 leftPane = interval(origin.z, inverseRay.z, bay - 1.26 - feather, bay - 0.058 + feather);
          vec2 rightPane = interval(origin.z, inverseRay.z, bay + 0.058 - feather, bay + 1.26 + feather);
          amount += densityAlong(overlap(lower, leftPane), ray);
          amount += densityAlong(overlap(lower, rightPane), ray);
          amount += densityAlong(overlap(upper, leftPane), ray);
          amount += densityAlong(overlap(upper, rightPane), ray);
        }
        return amount;
      }

      float scatter(vec2 path, vec3 origin, vec3 inverseRay, vec3 ray, vec4 heights, float feather) {
        vec2 firstBand = overlap(path, interval(origin.y, inverseRay.y, heights.x - feather, heights.y + feather));
        vec2 secondBand = overlap(path, interval(origin.y, inverseRay.y, heights.z - feather, heights.w + feather));
        return panes(firstBand, secondBand, origin, inverseRay, ray, feather);
      }

      void main() {
        float depth = texture2D(roomDepth, screenUV).r;
        vec4 view = cameraFromClip * vec4(screenUV * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
        vec3 hit = (worldFromCamera * vec4(view.xyz / view.w, 1.0)).xyz;
        vec3 direction = hit - eye;
        float distanceToSurface = max(length(direction) - 0.035, 0.0);
        vec3 ray = normalize(direction);

        // Moving back along the sun's direction gives the beam's entry point on the window wall.
        vec3 origin = vec3(eye.x, eye.yz - (eye.x - windowWall) * sunlight.yz);
        vec3 beamRay = vec3(ray.x, ray.yz - ray.x * sunlight.yz);
        vec3 inverseRay = sign(beamRay + vec3(0.000001)) / max(abs(beamRay), vec3(0.00001));
        vec2 path = overlap(vec2(0.0, distanceToSurface), interval(origin.x, inverseRay.x, windowWall, 5.8));
        path = overlap(path, interval(eye.y, sign(ray.y + 0.000001) / max(abs(ray.y), 0.00001), 0.02, 4.65));
        path = overlap(path, interval(origin.y, inverseRay.y, 1.31, 4.66));
        path = overlap(path, interval(origin.z, inverseRay.z, windows.x - 1.48, windows.z + 1.48));
        if (path.x >= path.y) discard;

        vec4 glazing = vec4(1.53, 2.49, 2.61, 4.44);
        float core = scatter(path, origin, inverseRay, ray, glazing, -0.018);
        float halo = scatter(path, origin, inverseRay, ray, glazing, 0.14);
        // Brighter shafts come through gaps in the trees beyond the upper panes.
        float sunbreaks = scatter(path, origin, inverseRay, ray, vec4(3.03, 3.36, 3.91, 4.24), 0.022);
        float amount = core * 0.025 + halo * 0.011 + sunbreaks * 0.28;
        float facingTheWindow = 0.82 + 0.18 * max(dot(-ray, normalize(sunlight)), 0.0);
        float opacity = 1.0 - exp(-amount * facingTheWindow);
        gl_FragColor = vec4(hazeColor, opacity);
        #include <colorspace_fragment>
      }
    `
  });
  const geometry = new T.PlaneGeometry(2, 2);
  const quad = new T.Mesh(geometry, surface);
  quad.frustumCulled = false;
  screen.add(quad);

  return {
    resize(width, height) {
      // Depth is sampled at a smaller size to keep the entrance smooth on high-DPI phones.
      depth.setSize(Math.max(1, Math.round(width * .8)), Math.max(1, Math.round(height * .8)));
    },
    render(scene, camera) {
      renderer.render(scene, camera);
      const override = scene.overrideMaterial;
      renderer.setRenderTarget(depth);
      scene.overrideMaterial = depthOnly;
      try {
        renderer.render(scene, camera);
      } finally {
        scene.overrideMaterial = override;
        renderer.setRenderTarget(null);
      }

      surface.uniforms.worldFromCamera.value = camera.matrixWorld;
      surface.uniforms.cameraFromClip.value = camera.projectionMatrixInverse;
      surface.uniforms.eye.value = camera.position;
      const clear = renderer.autoClear;
      renderer.autoClear = false;
      try {
        renderer.render(screen, screenCamera);
      } finally {
        renderer.autoClear = clear;
      }
    },
    dispose() {
      depth.dispose();
      depthOnly.dispose();
      geometry.dispose();
      surface.dispose();
    }
  };
};
