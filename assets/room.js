"use strict";

window.createClassroomRoom = function createClassroomRoom(stage, canvas, board, deskLink) {
  const T = window.THREE;
  const renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;

  const scene = new T.Scene();
  scene.background = new T.Color("#afa181");
  scene.fog = new T.Fog("#b8a98c", 18, 35);
  const camera = new T.PerspectiveCamera(51, 1, .055, 65);
  const ease = T.MathUtils.smoothstep;
  const target = new T.Vector3();
  const roomWidth = 14;
  const roomDepth = 17;
  const roomHeight = 6.25;
  const boardWidth = 7.5;
  const boardHeight = 3.08;
  const windowBays = [2.48, 5.70, 8.92];
  let boardStretch = 1;
  let seatShift = 0;
  let progress = 0;
  let lastFrameTime = 0;
  let frame = 0;
  let sourceReady;
  let clockTimer;

  function randomSequence(seed) {
    return () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
  }

  function texture(width, height, draw) {
    const surface = document.createElement("canvas");
    surface.width = width;
    surface.height = height;
    draw(surface.getContext("2d"), width, height);
    const map = new T.CanvasTexture(surface);
    map.colorSpace = T.SRGBColorSpace;
    map.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 6);
    return map;
  }

  function paintWood(floor) {
    return texture(floor ? 512 : 1024, 512, (context, width, height) => {
      const value = randomSequence(floor ? 46 : 137);
      const columns = floor ? 8 : 1;
      const plankWidth = width / columns;
      for (let column = 0; column < columns; column++) {
        const left = column * plankWidth;
        context.fillStyle = floor ? `hsl(28, 26%, ${41 + value() * 12}%)` : "#a68157";
        context.fillRect(left, 0, plankWidth, height);
        context.save();
        context.beginPath();
        context.rect(left, 0, plankWidth, height);
        context.clip();
        for (let line = 0; line < 280; line++) {
          const x = left + value() * plankWidth;
          const bend = (value() - .5) * 13;
          context.beginPath();
          context.moveTo(x, -20);
          context.bezierCurveTo(x + bend, height * .25, x - bend, height * .6, x + bend * .3, height + 5);
          context.strokeStyle = value() < .67 ? `rgb(50 24 11 / ${value() * .105})` : `rgb(255 220 157 / ${value() * .14})`;
          context.lineWidth = .2 + value() * (floor ? 1.5 : 2.6);
          context.stroke();
        }
        context.restore();
        if (floor) {
          context.fillStyle = "#432e22";
          context.fillRect(left, 0, 2, height);
          context.fillRect(left, ((column * 173) % height), plankWidth, 2);
          context.fillStyle = "#d1a66c";
          context.fillRect(left + 2, 0, 1, height);
        }
      }
    });
  }

  function pebble() {
    return texture(256, 256, (context, width, height) => {
      const value = randomSequence(231);
      const image = context.createImageData(width, height);
      for (let offset = 0; offset < image.data.length; offset += 4) {
        const shade = 244 + Math.round(value() * 11);
        image.data.set([shade, shade, shade, 255], offset);
      }
      context.putImageData(image, 0, 0);
    });
  }

  function material(color, options = {}) {
    return new T.MeshStandardMaterial({ color, roughness: .83, ...options });
  }

  function loadSurface(source, map, paint) {
    if (!source) return;
    const image = new Image();
    image.addEventListener("load", () => {
      const context = map.image.getContext("2d");
      paint(context, map.image.width, map.image.height, image);
      map.needsUpdate = true;
      sourceReady?.();
    }, { once: true });
    image.src = source;
  }

  function box(parent, width, height, depth, x, y, z, surface, cast = false) {
    const mesh = new T.Mesh(new T.BoxGeometry(width, height, depth), surface);
    mesh.position.set(x, y, z);
    mesh.castShadow = cast;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  function cylinder(parent, radius, depth, x, y, z, surface) {
    const mesh = new T.Mesh(new T.CylinderGeometry(radius, radius, depth, 22), surface);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  const slabGeometries = new Map();
  function slab(parent, width, height, depth, x, y, z, surfaces) {
    const key = [width, height, depth].join("/");
    if (!slabGeometries.has(key)) {
      const bevel = Math.min(.018, height / 3);
      const halfX = width / 2 - bevel;
      const halfZ = depth / 2 - bevel;
      const radius = Math.min(.033, halfX * .45, halfZ * .45);
      const outline = new T.Shape();
      outline.moveTo(-halfX + radius, -halfZ);
      outline.lineTo(halfX - radius, -halfZ);
      outline.quadraticCurveTo(halfX, -halfZ, halfX, -halfZ + radius);
      outline.lineTo(halfX, halfZ - radius);
      outline.quadraticCurveTo(halfX, halfZ, halfX - radius, halfZ);
      outline.lineTo(-halfX + radius, halfZ);
      outline.quadraticCurveTo(-halfX, halfZ, -halfX, halfZ - radius);
      outline.lineTo(-halfX, -halfZ + radius);
      outline.quadraticCurveTo(-halfX, -halfZ, -halfX + radius, -halfZ);
      const geometry = new T.ExtrudeGeometry(outline, {
        depth: height - 2 * bevel, bevelSize: bevel, bevelThickness: bevel,
        bevelSegments: 2, curveSegments: 3
      });
      geometry.rotateX(-Math.PI / 2);
      geometry.translate(0, -height / 2 + bevel, 0);
      const position = geometry.attributes.position;
      const uv = geometry.attributes.uv;
      for (let i = 0; i < position.count; i++) {
        uv.setXY(i, .5 + position.getX(i) / width, .5 + position.getZ(i) / depth);
      }
      slabGeometries.set(key, geometry);
    }
    const mesh = new T.Mesh(slabGeometries.get(key), surfaces);
    mesh.position.set(x, y, z);
    mesh.castShadow = mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  const shadowMap = texture(64, 64, (context) => {
    const falloff = context.createRadialGradient(32, 32, 1, 32, 32, 32);
    falloff.addColorStop(0, "#ffffffff");
    falloff.addColorStop(.53, "#ffffff9a");
    falloff.addColorStop(1, "#ffffff00");
    context.fillStyle = falloff;
    context.fillRect(0, 0, 64, 64);
  });
  const floorShadow = new T.MeshBasicMaterial({
    map: shadowMap, color: "#2b211a", transparent: true, opacity: .46, depthWrite: false
  });
  const deskShadow = floorShadow.clone();
  deskShadow.opacity = .56;
  const shadowPlane = new T.PlaneGeometry(1, 1);
  function contactShadow(parent, width, depth, x, y, z, surface) {
    const mesh = new T.Mesh(shadowPlane, surface);
    mesh.position.set(x, y, z);
    mesh.rotation.x = -Math.PI / 2;
    mesh.scale.set(width, depth, 1);
    parent.add(mesh);
    return mesh;
  }

  const boards = paintWood(true);
  boards.wrapS = boards.wrapT = T.RepeatWrapping;
  boards.repeat.set(4, 5);
  const desktopGrain = paintWood(false);
  const flooring = material("#cdbfaf", { map: boards, bumpMap: boards, bumpScale: .010, roughness: .64 });
  const oak = material("#e8e0d4", { map: desktopGrain, bumpMap: desktopGrain, bumpScale: .012, roughness: .50 });
  const oakEdge = material("#977254", { roughness: .66 });
  const darkWood = material("#695440", { roughness: .60 });
  const iron = material("#253832", { metalness: .30 });
  const wallTexture = pebble();
  wallTexture.wrapS = wallTexture.wrapT = T.RepeatWrapping;
  wallTexture.repeat.set(2, 2);
  const plaster = material("#e2d8c2", { map: wallTexture, bumpMap: wallTexture, bumpScale: .012 });
  const teal = material("#60766c", { map: wallTexture, roughness: .73 });
  const trim = material("#647369");
  const windowFrame = material("#e1d3ae", { roughness: .59 });
  const ceiling = material("#cec8b9", { map: wallTexture });
  const lampDiffuser = material("#fff9ec", { emissive: "#fff3e2", emissiveIntensity: 1.85, roughness: .52 });
  const caseColors = ["#a34632", "#5d785d", "#1b4c5c", "#b48a4a", "#998372"].map(color => material(color));
  const pageGrain = texture(192, 48, (context, width, height) => {
    const random = randomSequence(78);
    context.fillStyle = "#f2ead6";
    context.fillRect(0, 0, width, height);
    for (let y = 1; y < height; y += 2) {
      context.fillStyle = `rgb(99 76 50 / ${.12 + random() * .18})`;
      context.fillRect(random() * 3, y, width, .65);
    }
  });
  const pages = material("#fff6e8", { map: pageGrain });

  const surfaceSources = window.classroomSurfaceTextures;
  loadSurface(surfaceSources?.wood, desktopGrain, (context, width, height, image) => {
    context.drawImage(image, 0, 0, width, height);
  });
  loadSurface(surfaceSources?.wood, boards, (context, width, height, image) => {
    context.save();
    context.translate(width, 0);
    context.rotate(Math.PI / 2);
    context.drawImage(image, 0, 0, height, width);
    context.restore();
    const random = randomSequence(46);
    const plank = width / 8;
    for (let i = 0; i < 8; i++) {
      const x = i * plank;
      const joint = Math.floor(random() * height);
      context.fillStyle = `rgb(44 30 19 / ${.10 + random() * .24})`;
      context.fillRect(x, 0, plank, joint);
      context.fillStyle = `rgb(65 47 35 / ${.12 + random() * .22})`;
      context.fillRect(x, joint, plank, height - joint);
      context.fillStyle = "#463325";
      context.fillRect(x, 0, 1.8, height);
      context.fillRect(x, joint, plank, 1.5);
      context.fillStyle = "#dfbf932c";
      context.fillRect(x + 2, 0, .9, height);
    }
  });
  loadSurface(surfaceSources?.plaster, wallTexture, (context, width, height, image) => {
    context.drawImage(image, 0, 0, width, height);
  });

  box(scene, roomWidth + .8, .21, 22, 0, -.115, 10, flooring);
  box(scene, roomWidth, .26, roomDepth, 0, roomHeight, roomDepth / 2, ceiling, true);
  box(scene, roomWidth, roomHeight, .26, 0, roomHeight / 2, -.18, plaster, true);
  box(scene, roomWidth, 1.31, .13, 0, .655, -.015, teal);
  box(scene, roomWidth, .075, .21, 0, 1.32, .04, trim);
  box(scene, .24, roomHeight, roomDepth, 7.10, roomHeight / 2, roomDepth / 2, plaster, true);
  box(scene, .12, 1.32, roomDepth, 6.95, .66, roomDepth / 2, teal);
  box(scene, .19, .074, roomDepth, 6.87, 1.32, roomDepth / 2, trim);
  box(scene, roomWidth, .17, .16, 0, .10, .09, darkWood);
  box(scene, .13, .17, roomDepth, 6.86, .09, roomDepth / 2, darkWood);
  box(scene, .13, .17, roomDepth, -6.87, .09, roomDepth / 2, darkWood);
  for (let z = .7; z < 16.9; z += 1.38) {
    box(scene, .022, 1.17, .028, 6.88, .68, z, trim);
    box(scene, .022, 1.17, .028, -6.88, .68, z, trim);
  }

  // The rear wall has a real opening, so the camera can pass through the doorway.
  box(scene, 11.02, roomHeight, .29, -1.49, roomHeight / 2, 16.85, plaster, true);
  box(scene, .73, roomHeight, .29, 6.80, roomHeight / 2, 16.85, plaster, true);
  box(scene, 2.41, 3, .29, 5.18, 4.75, 16.85, plaster, true);
  for (const x of [4.04, 6.38]) box(scene, .19, 3.28, .39, x, 1.64, 16.86, darkWood, true);
  box(scene, 2.55, .19, .39, 5.21, 3.28, 16.86, darkWood, true);
  box(scene, 2.17, .044, .35, 5.21, .019, 16.89, oakEdge);
  box(scene, .25, roomHeight, 5.1, 7.09, roomHeight / 2, 19.35, plaster, true);
  box(scene, roomWidth, .25, 4.4, 0, 4.27, 19.15, ceiling, true);
  const doorWood = desktopGrain.clone();
  doorWood.center.set(.5, .5);
  doorWood.rotation = Math.PI / 2;
  doorWood.needsUpdate = true;
  const door = material("#b99975", { map: doorWood, roughness: .56 });
  const hardware = material("#827d6c", { roughness: .31, metalness: .42 });
  box(scene, .105, 3.18, 2.12, 6.48, 1.58, 15.74, door, true);
  for (const y of [.31, 1.55, 2.77]) box(scene, .049, .174, .105, 6.423, y, 16.66, hardware);
  box(scene, .025, .245, .103, 6.414, 1.05, 14.83, hardware);
  cylinder(scene, .029, .115, 6.358, 1.076, 14.83, hardware).rotation.z = Math.PI / 2;
  cylinder(scene, .030, .139, 6.308, 1.076, 14.89, hardware).rotation.x = Math.PI / 2;

  // Actual mullions, sills, and glazing openings cast distinct morning shadows.
  box(scene, .27, 1.44, roomDepth, -7.05, .72, 8.5, teal, true);
  box(scene, .23, 1.88, roomDepth, -7.09, 5.39, 8.5, plaster, true);
  for (const [length, z] of [[1.15, .575], [.55, 4.11], [.55, 7.33], [6.18, 13.91]]) {
    box(scene, .26, 3.11, length, -7.06, 2.94, z, plaster, true);
  }
  for (const z of windowBays) {
    for (const offset of [-1.32, 0, 1.32]) box(scene, .22, 3.05, .115, -7.01, 2.98, z + offset, windowFrame, true);
    for (const height of [1.47, 2.55, 4.50]) box(scene, .20, .115, 2.72, -7.01, height, z, windowFrame, true);
    box(scene, .40, .11, 2.81, -6.87, 1.43, z, oakEdge);
    for (const offset of [-1.26, 1.26]) {
      for (const y of [2.85, 4.15]) box(scene, .034, .091, .066, -6.875, y, z + offset, hardware);
    }
    box(scene, .035, .15, .058, -6.876, 2.99, z + .11, hardware);
    cylinder(scene, .015, .126, -6.839, 3.018, z + .14, hardware).rotation.x = Math.PI / 2;
  }

  const outdoors = new T.MeshBasicMaterial({ color: "#dfd2a0", side: T.DoubleSide });
  const landscape = new T.Mesh(new T.PlaneGeometry(12.2, 5.7), outdoors);
  landscape.position.set(-7.52, 2.9, 5.74);
  landscape.rotation.y = Math.PI / 2;
  scene.add(landscape);
  if (window.classroomCourtyardTexture) {
    const photo = new Image();
    photo.addEventListener("load", () => {
      outdoors.map = new T.CanvasTexture(photo);
      outdoors.map.colorSpace = T.SRGBColorSpace;
      outdoors.color.set("#fff3dd").multiplyScalar(1.24);
      outdoors.needsUpdate = true;
      sourceReady?.();
    }, { once: true });
    photo.src = window.classroomCourtyardTexture;
  }

  const ceilingSeam = material("#a49d8d", { roughness: .94 });
  for (let x = -5.7; x < 7; x += 1.9) {
    box(scene, .023, .018, roomDepth, x, roomHeight - .137, roomDepth / 2, ceilingSeam);
  }
  for (let z = 1.6; z < roomDepth; z += 1.7) {
    box(scene, roomWidth, .018, .023, 0, roomHeight - .137, z, ceilingSeam);
  }
  const fixtureShell = material("#b1ae9f", { roughness: .57, metalness: .16 });
  for (const z of [2.8, 7.7, 12.4]) {
    box(scene, roomWidth, .20, .20, 0, 6.025, z, ceiling, true);
    for (const x of [-3.7, 3.7]) {
      box(scene, .035, .45, .035, x + .63, 5.67, z, iron);
      box(scene, .035, .45, .035, x - .63, 5.67, z, iron);
      slab(scene, 1.8, .12, .36, x, 5.45, z, fixtureShell);
      for (const offset of [-.074, .074]) {
        box(scene, 1.66, .029, .117, x, 5.374, z + offset, lampDiffuser);
      }
      if (z !== 12.4) {
        const bounce = new T.SpotLight("#ffeace", 3.4, 2.1, Math.PI * .34, .90);
        bounce.position.set(x, 5.57, z);
        bounce.target.position.set(x, roomHeight, z);
        scene.add(bounce, bounce.target);
      }
      const lamp = new T.SpotLight("#fff2e3", 26, 10, Math.PI * .29, .76);
      lamp.position.set(x, 5.35, z);
      lamp.target.position.set(x, .4, z);
      // The fixtures nearest the front furniture cast shadows from their actual mounting points.
      if ((z === 7.7 && x < 0) || (z === 2.8 && x > 0)) {
        lamp.castShadow = true;
        lamp.shadow.mapSize.set(768, 768);
        lamp.shadow.camera.near = .20;
        lamp.shadow.camera.far = 10;
        lamp.shadow.bias = -.00018;
        lamp.shadow.normalBias = .012;
        lamp.shadow.radius = 2;
      }
      scene.add(lamp, lamp.target);
    }
  }

  const boardGroup = new T.Group();
  boardGroup.name = "classroom-whiteboard";
  boardGroup.position.set(0, 3.43, .23);
  scene.add(boardGroup);
  const boardGlaze = texture(768, 320, (context, width, height) => {
    const shade = context.createLinearGradient(0, 0, width, height);
    shade.addColorStop(0, "#fffdf6");
    shade.addColorStop(.53, "#f6f5f1");
    shade.addColorStop(1, "#e5e5de");
    context.fillStyle = shade;
    context.fillRect(0, 0, width, height);
    const random = randomSequence(804);
    for (let i = 0; i < 68; i++) {
      const x = random() * width;
      const y = random() * height;
      const length = 12 + random() * 107;
      const residue = context.createLinearGradient(x, y, x + length, y);
      residue.addColorStop(0, "#74776500");
      residue.addColorStop(.48, "#7477650a");
      residue.addColorStop(1, "#74776500");
      context.fillStyle = residue;
      context.fillRect(x, y, length, 1 + random() * 3);
    }
  });
  const panel = material("#fffefa", { map: boardGlaze, roughness: .54, emissive: "#c4c1b4", emissiveIntensity: .20 });
  const boardRail = material("#96988d", { metalness: .32, roughness: .38 });
  box(boardGroup, boardWidth + .22, boardHeight + .22, .15, 0, 0, -.015, iron, true);
  box(boardGroup, boardWidth, boardHeight, .045, 0, 0, .071, panel);
  for (const side of [-1, 1]) {
    box(boardGroup, boardWidth + .17, .057, .042, 0, side * (boardHeight / 2 + .052), .075, boardRail);
    box(boardGroup, .056, boardHeight + .165, .042, side * (boardWidth / 2 + .053), 0, .075, boardRail);
  }
  box(boardGroup, boardWidth + .28, .095, .31, 0, -boardHeight / 2 - .065, .185, trim);
  box(boardGroup, boardWidth + .29, .025, .07, 0, -boardHeight / 2 - .027, .33, windowFrame);
  for (const [i, color] of caseColors.slice(0, 3).entries()) {
    box(boardGroup, .23, .043, .049, 2.81 + i * .28, -boardHeight / 2 + .003, .23, color);
  }
  box(boardGroup, .37, .075, .12, -3.02, -boardHeight / 2 + .02, .215, oakEdge);
  for (const x of [-4.35, 3.96]) {
    box(scene, .24, .158, .027, x, .60, .069, windowFrame);
    for (const offset of [-.057, .057]) {
      box(scene, .032, .014, .007, x + offset, .620, .087, iron);
      box(scene, .032, .014, .007, x + offset, .581, .087, iron);
    }
  }

  const noticeBoard = new T.Group();
  noticeBoard.position.set(-5.65, 3.82, .027);
  scene.add(noticeBoard);
  const cork = material("#ab8861", { map: wallTexture, bumpMap: wallTexture, bumpScale: .024 });
  box(noticeBoard, 1.46, 1.08, .071, 0, 0, 0, oakEdge, true);
  box(noticeBoard, 1.36, .98, .018, 0, 0, .034, cork);
  const noticePaper = [
    material("#f4ebd5"), material("#b8c6b6"), material("#e2c79c")
  ];
  for (const [index, [x, y, width, height, angle]] of [
    [-.36, .11, .38, .51, .07], [.13, .20, .39, .39, -.06], [.29, -.23, .43, .24, .03]
  ].entries()) {
    const paper = new T.Group();
    paper.position.set(x, y, .055);
    paper.rotation.z = angle;
    noticeBoard.add(paper);
    box(paper, width, height, .008, 0, 0, 0, noticePaper[index], true);
    const tack = cylinder(paper, .013, .013, 0, height * .42, .011, hardware);
    tack.rotation.x = Math.PI / 2;
  }

  const clockFace = texture(256, 256, (context) => {
    context.translate(128, 128);
    context.fillStyle = "#f5e7c9";
    context.fillRect(-128, -128, 256, 256);
    context.strokeStyle = "#465044";
    context.lineCap = "round";
    for (let index = 0; index < 60; index++) {
      const angle = index * Math.PI / 30;
      const major = index % 5 === 0;
      context.beginPath();
      context.moveTo(Math.cos(angle) * (major ? 96 : 104), Math.sin(angle) * (major ? 96 : 104));
      context.lineTo(Math.cos(angle) * 109, Math.sin(angle) * 109);
      context.lineWidth = major ? 4.5 : 1.5;
      context.stroke();
    }
    context.fillStyle = "#465044";
    context.font = "700 22px system-ui, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    for (const [label, x, y] of [["12", 0, -79], ["3", 80, 1], ["6", 0, 81], ["9", -80, 1]]) {
      context.fillText(label, x, y);
    }
  });
  const clockX = boardWidth / 2 + .77;
  const clockRadius = .31;
  const clockHeight = boardGroup.position.y + .95;
  const clockFrame = cylinder(scene, clockRadius, .08, clockX, clockHeight, .07, iron);
  clockFrame.name = "clock-frame";
  clockFrame.rotation.x = Math.PI / 2;
  const clock = new T.Mesh(new T.CircleGeometry(.274, 40), new T.MeshBasicMaterial({ map: clockFace }));
  clock.position.set(clockX, clockHeight, .116);
  scene.add(clock);
  const handInk = new T.MeshBasicMaterial({ color: "#313630", toneMapped: false });

  function clockHand(name, length, width, depth) {
    const hand = new T.Group();
    hand.name = name;
    hand.position.z = depth;
    box(hand, width, length, .001, 0, length / 2 - .009, 0, handInk);
    clock.add(hand);
    return hand;
  }

  const hourHand = clockHand("clock-hour-hand", .164, .020, .004);
  const minuteHand = clockHand("clock-minute-hand", .222, .014, .007);
  const pin = new T.Mesh(new T.CircleGeometry(.017, 16), handInk);
  pin.position.z = .01;
  clock.add(pin);

  function refreshClock() {
    clearTimeout(clockTimer);
    if (document.hidden) return;
    const localTime = new Date();
    const minute = localTime.getMinutes();
    hourHand.rotation.z = -(localTime.getHours() % 12 + minute / 60) * Math.PI / 6;
    minuteHand.rotation.z = -minute * Math.PI / 30;
    if (progress === 1) draw();
    clockTimer = setTimeout(refreshClock, 60000 - localTime.getSeconds() * 1000 - localTime.getMilliseconds() + 15);
  }

  function desk(x, z, width, depth, parent = scene) {
    slab(parent, width + .025, .144, depth + .025, x, .914, z, [oak, oakEdge]);
    box(parent, width - .13, .066, depth - .10, x, .805, z, darkWood, true);
    contactShadow(parent, width + .30, depth + .56, x, -.007, z, floorShadow);
    for (const side of [-1, 1]) {
      const leg = x + side * (width / 2 - .16);
      for (const foot of [-1, 1]) {
        const legZ = z + foot * (depth / 2 - .13);
        box(parent, .067, .81, .067, leg, .406, legZ, iron, true);
        box(parent, .084, .031, .084, leg, .018, legZ, darkWood);
      }
      box(parent, .08, .08, depth - .16, leg, .23, z, iron);
    }
    box(parent, width - .28, .08, .081, x, .26, z + depth / 2 - .22, iron);
  }

  function bench(x, z, width, parent = scene) {
    slab(parent, width, .079, .37, x, .48, z, [oak, oakEdge]);
    const back = slab(parent, width - .03, .068, .21, x, .82, z + .19, [oak, oakEdge]);
    back.rotation.x = Math.PI / 2 - .12;
    contactShadow(parent, width + .25, .76, x, -.005, z, floorShadow);
    for (const side of [-1, 1]) {
      const leg = x + side * (width / 2 - .13);
      box(parent, .072, .92, .072, leg, .46, z + .16, iron, true);
      box(parent, .072, .43, .072, leg, .21, z - .14, iron, true);
      box(parent, .075, .073, .38, leg, .19, z, iron);
    }
  }

  for (const row of [5.00, 8.5, 11.85, 14.4]) {
    for (const x of row === 14.4 ? [-4.7] : [-4.7, 4.7]) {
      desk(x, row, 2.65, .85);
      bench(x, row + .89, 2.47);
    }
  }
  const studentDesk = new T.Group();
  studentDesk.position.z = 5.95;
  scene.add(studentDesk);
  desk(0, 0, 3.28, 1.37, studentDesk);
  bench(0, 1.83, 3.04, studentDesk);

  function book(x, z, angle, width, depth, surface, parent = scene) {
    const stack = new T.Group();
    stack.position.set(x, 1.015, z);
    stack.rotation.y = angle;
    parent.add(stack);
    contactShadow(stack, width * 1.18, depth * 1.14, 0, -.027, 0, deskShadow);
    box(stack, width - .045, .042, depth - .024, .012, 0, 0, pages, true);
    box(stack, width + .026, .016, depth + .025, 0, .034, 0, surface, true);
    box(stack, width + .026, .015, depth + .025, 0, -.029, 0, surface);
    box(stack, .042, .058, depth + .005, -width / 2 + .004, 0, 0, surface);
    return stack;
  }
  const coverWidth = .82;
  const coverDepth = .94;
  const coverSurface = material("#8f432f", { roughness: .68 });
  const tableBook = book(0, 0, -.13, coverWidth, coverDepth, coverSurface, studentDesk);
  const coverMap = texture(512, 672, () => {});
  const deskCover = new T.Mesh(
    new T.PlaneGeometry(coverWidth + .025, coverDepth + .024),
    material("#fff9f2", { map: coverMap, roughness: .67, emissive: "#aaa79e", emissiveMap: coverMap, emissiveIntensity: .39 })
  );
  deskCover.receiveShadow = true;
  deskCover.rotation.x = -Math.PI / 2;
  deskCover.position.y = .0436;
  tableBook.add(deskCover);
  let bookTitle = "CyberAmo's Classroom";
  let bookColor = "#8f432f";

  function paintBookCover() {
    coverSurface.color.set(bookColor);
    const { width, height } = coverMap.image;
    const context = coverMap.image.getContext("2d");
    context.fillStyle = bookColor;
    context.fillRect(0, 0, width, height);
    const shade = context.createLinearGradient(0, 0, width, height);
    shade.addColorStop(0, "#ffffff10");
    shade.addColorStop(.28, "#ffffff00");
    shade.addColorStop(1, "#18120620");
    context.fillStyle = shade;
    context.fillRect(0, 0, width, height);
    context.fillStyle = "#16120e32";
    context.fillRect(0, 0, 27, height);
    const grain = randomSequence(15);
    for (let i = 0; i < 2600; i++) {
      context.fillStyle = i % 2 ? "#fff4d619" : "#20150b22";
      context.fillRect(grain() * width, grain() * height, 1.4, 1.4);
    }
    context.strokeStyle = "#ead7a99c";
    context.lineWidth = 2;
    context.strokeRect(42, 28, width - 70, height - 56);
    context.strokeStyle = "#ead7a946";
    context.strokeRect(51, 36, width - 86, height - 72);

    context.save();
    context.translate(width / 2 + 5, height * .40);
    context.rotate(-.025);
    context.fillStyle = "#eadab2";
    context.fillRect(-192, -142, 384, 284);
    context.strokeStyle = "#9c8254";
    context.lineWidth = 2.4;
    context.strokeRect(-185, -135, 370, 270);
    context.fillStyle = "#263d38";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.font = '700 61px Kalam, "Segoe Print", cursive';
    const lines = [""];
    for (const word of bookTitle.split(/\s+/)) {
      const index = lines.length - 1;
      const phrase = lines[index] ? `${lines[index]} ${word}` : word;
      if (lines[index] && context.measureText(phrase).width > 333) lines.push(word);
      else lines[index] = phrase;
    }
    const lineHeight = Math.min(73, 242 / lines.length);
    lines.forEach((line, index) => context.fillText(line, 0, (index - (lines.length - 1) / 2) * lineHeight, 333));
    context.restore();
    coverMap.needsUpdate = true;
  }

  paintBookCover();
  const pencil = new T.Group();
  pencil.position.set(.76, 1.002, -.13);
  pencil.scale.setScalar(.8);
  pencil.rotation.y = -.35;
  studentDesk.add(pencil);
  cylinder(pencil, .024, .46, 0, 0, 0, material("#d8aa48")).rotation.z = -Math.PI / 2;
  cylinder(pencil, .023, .053, -.25, 0, 0, material("#c4ac80", { metalness: .42 })).rotation.z = -Math.PI / 2;
  cylinder(pencil, .021, .038, -.29, 0, 0, material("#a66054")).rotation.z = -Math.PI / 2;
  const pencilTip = new T.Mesh(new T.CylinderGeometry(.002, .024, .09, 12), material("#cda275"));
  pencilTip.rotation.z = -Math.PI / 2;
  pencilTip.position.x = .269;
  pencilTip.castShadow = true;
  pencil.add(pencilTip);
  cylinder(pencil, .005, .023, .311, 0, 0, iron).rotation.z = -Math.PI / 2;
  const looseNotes = new T.Group();
  looseNotes.position.set(-.99, .994, .16);
  looseNotes.rotation.y = .18;
  studentDesk.add(looseNotes);
  const ruledSheet = texture(240, 304, (context, width, height) => {
    context.fillStyle = "#f1ead8";
    context.fillRect(0, 0, width, height);
    context.fillStyle = "#7298ae56";
    for (let y = 34; y < height - 13; y += 16) context.fillRect(0, y, width, 1);
    context.fillStyle = "#a879735f";
    context.fillRect(29, 0, 1.6, height);
  });
  contactShadow(looseNotes, .56, .66, 0, -.006, 0, deskShadow);
  box(looseNotes, .43, .010, .55, .018, 0, .021, pages);
  const note = new T.Mesh(new T.PlaneGeometry(.43, .55), material("#fffaf0", { map: ruledSheet }));
  note.rotation.x = -Math.PI / 2;
  note.position.y = .006;
  note.receiveShadow = true;
  looseNotes.add(note);
  book(-4.65, 5.03, .08, .44, .55, caseColors[2]);
  book(4.73, 8.48, .13, .54, .66, caseColors[1]);
  desk(-5.97, 2.03, 1.50, .86);
  book(-6.04, 2.04, .05, .48, .62, caseColors[4]);
  bench(-5.97, 2.93, .91);
  window.addClassroomBookcase?.(scene, {
    box, slab, material, texture, loadSurface, contactShadow, randomSequence,
    oak, oakEdge, darkWood, pages, floorShadow, deskShadow
  });

  scene.add(new T.HemisphereLight("#e0e9f5", "#a49a8d", .90));
  scene.add(new T.AmbientLight("#e7dfd3", .21));
  const soft = new T.DirectionalLight("#e8f1fc", .61);
  soft.position.set(2, 5.6, 9.9);
  scene.add(soft);
  const sun = new T.DirectionalLight("#ffd6a4", 4.75);
  sun.position.set(-13, 6.35, 2.53);
  sun.target.position.set(2, 0, 9.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1536, 1536);
  Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 10, bottom: -10, near: .3, far: 36 });
  sun.shadow.bias = -.00022;
  sun.shadow.normalBias = .038;
  sun.shadow.radius = 1.75;
  scene.add(sun, sun.target);
  const daylight = window.createClassroomDaylight?.(renderer, sun, windowBays);

  function placeCamera(at) {
    const motion = ease(at, .06, .94);
    const aisleTurn = ease(motion, .27, .77);
    const sit = ease(at, .77, 1);
    const steps = Math.sin(motion * 10 * Math.PI) * Math.sin(at * Math.PI) * (1 - sit);
    const wideRoom = ease(camera.aspect, 1.01, 1.48);
    const doorwayOffset = 5.13 * (1 - aisleTurn);
    const x = doorwayOffset + (seatShift - 1.72 * wideRoom) * aisleTurn;
    camera.position.set(x, 1.79 - .37 * sit + steps * .042, 19.55 - 11.69 * motion - .12 * sit);
    target.set(doorwayOffset * (.92 - .33 * aisleTurn) + (seatShift - 2.13 * wideRoom) * aisleTurn,
      2.42 + .27 * sit + steps * .035, 0);
    camera.lookAt(target);
  }

  function draw() {
    placeCamera(progress);
    if (daylight) daylight.render(scene, camera);
    else renderer.render(scene, camera);
  }

  function alignBoard(width, height) {
    const point = new T.Vector3();
    const edgeX = boardWidth / 2 - .11;
    const edgeY = boardHeight / 2 - .10;
    const project = (x, y) => {
      boardGroup.localToWorld(point.set(x, y, .096)).project(camera);
      return { x: (point.x + 1) * width / 2, y: (1 - point.y) * height / 2 };
    };
    const topLeft = project(-edgeX, edgeY);
    const topRight = project(edgeX, edgeY);
    const bottomLeft = project(-edgeX, -edgeY);
    const bottomRight = project(edgeX, -edgeY);
    const left = topLeft.x;
    const top = topLeft.y;
    const projectedWidth = (topRight.x - left + bottomRight.x - bottomLeft.x) / 2;
    const projectedHeight = (bottomLeft.y - top + bottomRight.y - topRight.y) / 2;
    for (const [name, value] of Object.entries({ left, top, width: projectedWidth, height: projectedHeight })) {
      board.style.setProperty(`--board-${name}`, `${value}px`);
    }
    // Fit the HTML controls to the acrylic surface's four projected corners.
    const dx1 = topRight.x - bottomRight.x;
    const dx2 = bottomLeft.x - bottomRight.x;
    const dx3 = left - topRight.x + bottomRight.x - bottomLeft.x;
    const dy1 = topRight.y - bottomRight.y;
    const dy2 = bottomLeft.y - bottomRight.y;
    const dy3 = top - topRight.y + bottomRight.y - bottomLeft.y;
    const determinant = dx1 * dy2 - dx2 * dy1;
    if (Math.abs(determinant) < .0001) return;
    const g = (dx3 * dy2 - dx2 * dy3) / determinant;
    const h = (dx1 * dy3 - dx3 * dy1) / determinant;
    const a = (topRight.x - left) * (1 + g) / projectedWidth;
    const b = (topRight.y - top) * (1 + g) / projectedWidth;
    const c = (bottomLeft.x - left) * (1 + h) / projectedHeight;
    const d = (bottomLeft.y - top) * (1 + h) / projectedHeight;
    const matrix = [a, b, 0, g / projectedWidth, c, d, 0, h / projectedHeight, 0, 0, 1, 0, 0, 0, 0, 1];
    board.style.setProperty("--board-perspective", `matrix3d(${matrix.join(",")})`);
  }

  function alignDeskBook(width, height) {
    const halfWidth = (coverWidth + .025) / 2;
    const halfDepth = (coverDepth + .024) / 2;
    const corners = [[-halfWidth, -halfDepth], [halfWidth, -halfDepth], [halfWidth, halfDepth], [-halfWidth, halfDepth]];
    const points = corners.map(([x, z]) => {
      const point = tableBook.localToWorld(new T.Vector3(x, deskCover.position.y, z)).project(camera);
      return { x: (point.x + 1) * width / 2, y: (1 - point.y) * height / 2 };
    });
    const left = Math.min(...points.map(point => point.x));
    const top = Math.min(...points.map(point => point.y));
    const right = Math.max(...points.map(point => point.x));
    const bottom = Math.max(...points.map(point => point.y));
    for (const [name, value] of Object.entries({ left, top, width: right - left, height: bottom - top })) {
      deskLink.style.setProperty(`--book-${name}`, `${value}px`);
    }
    const shape = points.map(point => `${point.x - left}px ${point.y - top}px`).join(", ");
    deskLink.style.setProperty("--book-shape", `polygon(${shape})`);
  }

  function resize() {
    const width = stage.clientWidth;
    const height = stage.clientHeight;
    if (!width || !height) return;
    camera.aspect = width / height;
    const horizontalFit = T.MathUtils.radToDeg(2 * Math.atan(.60 / camera.aspect));
    camera.fov = Math.max(54 + 6 * ease(camera.aspect, 1.08, 1.47), horizontalFit);
    camera.updateProjectionMatrix();
    boardStretch = 1 + .28 * (1 - ease(camera.aspect, .54, 1.02));
    boardGroup.scale.y = boardStretch;
    const tallRoom = (boardStretch - 1) / .28;
    clock.position.y = clockFrame.position.y = boardGroup.position.y + .95 * boardStretch;
    clock.scale.setScalar(1 - .18 * tallRoom);
    clockFrame.scale.copy(clock.scale);

    // Move the eye and desk together only where the clock needs more room in the frame.
    seatShift = 0;
    placeCamera(1);
    camera.updateMatrixWorld();
    const radius = clockRadius * clock.scale.x;
    const edge = new T.Vector3(clockX + radius, clock.position.y - radius, clock.position.z);
    const right = edge.clone().project(camera).x;
    if (right > .95) {
      camera.position.x += 1;
      camera.updateMatrixWorld();
      const shifted = edge.project(camera).x;
      seatShift = (right - .95) / (right - shifted);
    }
    studentDesk.position.x = seatShift - 1.72 * ease(camera.aspect, 1.01, 1.48);
    renderer.setSize(width, height, false);
    daylight?.resize(width, height);
    renderer.shadowMap.needsUpdate = true;
    draw();
    if (progress === 1) {
      alignBoard(width, height);
      alignDeskBook(width, height);
    }
  }

  function sit() {
    cancelAnimationFrame(frame);
    progress = 1;
    draw();
    alignBoard(stage.clientWidth, stage.clientHeight);
    alignDeskBook(stage.clientWidth, stage.clientHeight);
  }

  function walk(onSeated) {
    function move(now) {
      if (document.hidden) {
        lastFrameTime = 0;
        frame = requestAnimationFrame(move);
        return;
      }
      if (lastFrameTime) progress = Math.min(1, progress + Math.min(now - lastFrameTime, 80) / 3450);
      lastFrameTime = now;
      if (progress === 1) {
        onSeated();
        return;
      }
      draw();
      frame = requestAnimationFrame(move);
    }
    frame = requestAnimationFrame(move);
  }

  function stop() {
    cancelAnimationFrame(frame);
    clearTimeout(clockTimer);
    document.removeEventListener("visibilitychange", refreshClock);
    window.removeEventListener("focus", refreshClock);
    sourceReady = undefined;
    daylight?.dispose();
  }

  function setBookCover(title, color) {
    bookTitle = title;
    bookColor = color;
    paintBookCover();
    draw();
  }

  function pencilScreenLength() {
    const eraser = pencil.localToWorld(new T.Vector3(-.309, 0, 0)).project(camera);
    const tip = pencil.localToWorld(new T.Vector3(.323, 0, 0)).project(camera);
    return Math.hypot(
      (tip.x - eraser.x) * stage.clientWidth / 2,
      (tip.y - eraser.y) * stage.clientHeight / 2
    );
  }

  sourceReady = draw;
  refreshClock();
  resize();
  document.addEventListener("visibilitychange", refreshClock);
  window.addEventListener("focus", refreshClock);
  document.fonts.load("700 61px Kalam").then(() => {
    paintBookCover();
    sourceReady?.();
  });
  return { resize, sit, walk, stop, setBookCover, pencilScreenLength };
};
