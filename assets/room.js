"use strict";

window.createClassroomRoom = function createClassroomRoom(stage, canvas, board, deskLink) {
  const T = window.THREE;
  const renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.19;
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
  let boardStretch = 1;
  let progress = 0;
  let lastFrameTime = 0;
  let frame = 0;
  let sourceReady;

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
    return texture(512, 512, (context, width, height) => {
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
    return texture(128, 128, (context, width, height) => {
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

  const boards = paintWood(true);
  boards.wrapS = boards.wrapT = T.RepeatWrapping;
  boards.repeat.set(4, 5);
  const flooring = material("#d0b295", { map: boards, roughness: .78 });
  const oak = material("#e6c9a4", { map: paintWood(false), roughness: .51 });
  const oakEdge = material("#996b3c");
  const darkWood = material("#654830", { roughness: .58 });
  const iron = material("#253832", { metalness: .30 });
  const wallTexture = pebble();
  wallTexture.wrapS = wallTexture.wrapT = T.RepeatWrapping;
  wallTexture.repeat.set(4, 4);
  const plaster = material("#d8c8a8", { map: wallTexture });
  const teal = material("#53736a", { map: wallTexture });
  const trim = material("#647369");
  const windowFrame = material("#e1d3ae", { roughness: .59 });
  const ceiling = material("#b9b39e");
  const white = material("#fff8e7", { roughness: .72 });
  const caseColors = ["#a34632", "#5d785d", "#1b4c5c", "#b48a4a", "#998372"].map(color => material(color));
  const pages = material("#eee2bd");

  box(scene, roomWidth + .8, .21, 22, 0, -.115, 10, flooring);
  box(scene, roomWidth, .26, roomDepth, 0, roomHeight, roomDepth / 2, ceiling, true);
  box(scene, roomWidth, roomHeight, .26, 0, roomHeight / 2, -.18, plaster, true);
  box(scene, roomWidth, 1.31, .13, 0, .655, -.015, teal);
  box(scene, roomWidth, .075, .21, 0, 1.32, .04, trim);
  box(scene, .24, roomHeight, roomDepth, 7.10, roomHeight / 2, roomDepth / 2, plaster, true);
  box(scene, .12, 1.32, roomDepth, 6.95, .66, roomDepth / 2, teal);
  box(scene, .19, .074, roomDepth, 6.87, 1.32, roomDepth / 2, trim);
  box(scene, roomWidth, .17, .16, 0, .10, .09, darkWood);
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
  box(scene, .105, 3.18, 2.12, 6.48, 1.58, 15.74, oak, true);
  box(scene, .18, .085, .21, 6.38, 1.03, 14.83, iron);

  // Actual mullions, sills, and glazing openings cast distinct morning shadows.
  box(scene, .27, 1.44, roomDepth, -7.05, .72, 8.5, teal, true);
  box(scene, .23, 1.88, roomDepth, -7.09, 5.39, 8.5, plaster, true);
  for (const [length, z] of [[1.15, .575], [.55, 4.11], [.55, 7.33], [6.18, 13.91]]) {
    box(scene, .26, 3.11, length, -7.06, 2.94, z, plaster, true);
  }
  for (const z of [2.48, 5.70, 8.92]) {
    for (const offset of [-1.32, 0, 1.32]) box(scene, .22, 3.05, .115, -7.01, 2.98, z + offset, windowFrame, true);
    for (const height of [1.47, 2.55, 4.50]) box(scene, .20, .115, 2.72, -7.01, height, z, windowFrame, true);
    box(scene, .40, .11, 2.81, -6.87, 1.43, z, oakEdge);
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
      outdoors.color.set("#ffffff");
      outdoors.needsUpdate = true;
      sourceReady?.();
    }, { once: true });
    photo.src = window.classroomCourtyardTexture;
  }

  for (const z of [2.8, 7.7, 12.4]) {
    box(scene, roomWidth, .24, .25, 0, 6.0, z, trim, true);
    for (const x of [-3.7, 3.7]) {
      box(scene, .035, .45, .035, x + .63, 5.67, z, iron);
      box(scene, .035, .45, .035, x - .63, 5.67, z, iron);
      box(scene, 1.8, .12, .33, x, 5.45, z, trim);
      box(scene, 1.66, .032, .27, x, 5.375, z, white);
    }
  }

  const boardGroup = new T.Group();
  boardGroup.position.set(0, 3.28, .23);
  scene.add(boardGroup);
  const panel = material("#f9f6e9", { roughness: .76, emissive: "#403c26", emissiveIntensity: .15 });
  box(boardGroup, boardWidth + .22, boardHeight + .22, .15, 0, 0, -.015, iron, true);
  box(boardGroup, boardWidth, boardHeight, .045, 0, 0, .071, panel);
  box(boardGroup, boardWidth + .28, .095, .31, 0, -boardHeight / 2 - .065, .185, trim);
  box(boardGroup, boardWidth + .29, .025, .07, 0, -boardHeight / 2 - .027, .33, windowFrame);
  for (const [i, color] of caseColors.slice(0, 3).entries()) {
    box(boardGroup, .23, .043, .049, 2.81 + i * .28, -boardHeight / 2 + .003, .23, color);
  }
  box(boardGroup, .37, .075, .12, -3.02, -boardHeight / 2 + .02, .215, oakEdge);

  const clockFace = texture(256, 256, (context) => {
    context.translate(128, 128);
    context.fillStyle = "#f5e7c9";
    context.fillRect(-128, -128, 256, 256);
    context.strokeStyle = "#465044";
    context.lineCap = "round";
    for (let index = 0; index < 12; index++) {
      const angle = index * Math.PI / 6;
      context.beginPath();
      context.moveTo(Math.cos(angle) * 96, Math.sin(angle) * 96);
      context.lineTo(Math.cos(angle) * 109, Math.sin(angle) * 109);
      context.lineWidth = 5;
      context.stroke();
    }
    context.beginPath();
    context.moveTo(-43, -34);
    context.lineTo(0, 0);
    context.lineTo(50, -67);
    context.lineWidth = 8;
    context.stroke();
  });
  const clockFrame = cylinder(scene, .35, .08, 0, 5.55, .07, iron);
  clockFrame.rotation.x = Math.PI / 2;
  const clock = new T.Mesh(new T.CircleGeometry(.303, 40), new T.MeshBasicMaterial({ map: clockFace }));
  clock.position.set(0, 5.55, .116);
  scene.add(clock);

  function desk(x, z, width, depth, parent = scene) {
    box(parent, width, .123, depth, x, .908, z, oak, true);
    box(parent, width + .025, .045, depth + .025, x, .963, z, oak, true);
    box(parent, width - .10, .087, depth - .09, x, .80, z, oakEdge, true);
    for (const side of [-1, 1]) {
      const leg = x + side * (width / 2 - .16);
      for (const foot of [-1, 1]) box(parent, .085, .81, .085, leg, .406, z + foot * (depth / 2 - .13), iron, true);
      box(parent, .08, .08, depth - .16, leg, .23, z, iron);
    }
    box(parent, width - .28, .08, .081, x, .26, z + depth / 2 - .22, iron);
  }

  function bench(x, z, width, parent = scene) {
    box(parent, width, .11, .36, x, .48, z, oak, true);
    box(parent, width - .03, .21, .068, x, .82, z + .19, oakEdge, true);
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
    box(stack, width, .042, depth, 0, 0, 0, pages, true);
    box(stack, width + .026, .016, depth + .025, 0, .034, 0, surface, true);
    box(stack, width + .026, .015, depth + .025, 0, -.029, 0, surface);
    box(stack, .04, .060, depth, -width / 2, 0, 0, surface);
    return stack;
  }
  const coverWidth = .82;
  const coverDepth = .94;
  const coverSurface = material("#8f432f", { roughness: .68 });
  const tableBook = book(0, 0, -.13, coverWidth, coverDepth, coverSurface, studentDesk);
  const coverMap = texture(512, 672, () => {});
  const deskCover = new T.Mesh(
    new T.PlaneGeometry(coverWidth + .025, coverDepth + .024),
    new T.MeshBasicMaterial({ map: coverMap, toneMapped: false })
  );
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
  pencil.rotation.y = -.35;
  studentDesk.add(pencil);
  cylinder(pencil, .024, .46, 0, 0, 0, material("#d8aa48")).rotation.z = -Math.PI / 2;
  cylinder(pencil, .023, .053, -.25, 0, 0, material("#c4ac80", { metalness: .42 })).rotation.z = -Math.PI / 2;
  cylinder(pencil, .021, .038, -.29, 0, 0, material("#a66054")).rotation.z = -Math.PI / 2;
  const pencilTip = new T.Mesh(new T.CylinderGeometry(.002, .024, .09, 12), material("#cda275"));
  pencilTip.rotation.z = -Math.PI / 2;
  pencilTip.position.x = .269;
  pencil.add(pencilTip);
  cylinder(pencil, .005, .023, .311, 0, 0, iron).rotation.z = -Math.PI / 2;
  book(-4.65, 5.03, .08, .44, .55, caseColors[2]);
  book(4.73, 8.48, .13, .54, .66, caseColors[1]);
  desk(-5.32, 1.76, 2.45, .98);
  book(-5.74, 1.73, .05, .48, .62, caseColors[4]);
  bench(-5.32, 2.8, .91);

  // A low bookcase and plant balance the depth of the windows on the opposite side.
  for (const x of [4.45, 6.67]) box(scene, .11, 1.75, .58, x, .90, .49, darkWood, true);
  box(scene, 2.30, 1.72, .075, 5.56, .88, .23, darkWood, true);
  for (const y of [.15, .69, 1.23, 1.77]) box(scene, 2.39, .086, .66, 5.56, y, .53, oak, true);
  const bookRandom = randomSequence(744);
  for (const shelf of [.74, 1.28]) {
    for (let index = 0; index < 8; index++) {
      const height = .26 + bookRandom() * .18;
      const x = 4.65 + index * .20;
      const coverMaterial = caseColors[(index + (shelf < 1 ? 0 : 2)) % caseColors.length];
      box(scene, .135, height, .28, x, shelf + height / 2, .55, coverMaterial, true);
      box(scene, .092, .018, .013, x, shelf + height * .74, .697, pages);
    }
  }

  const pot = material("#9f5b3e", { roughness: .92 });
  const leaves = [material("#45694c"), material("#748755"), material("#4c755e")];
  cylinder(scene, .22, .31, 6.12, 1.96, .49, pot);
  cylinder(scene, .24, .046, 6.12, 2.13, .49, pot);
  cylinder(scene, .025, .34, 6.12, 2.28, .49, leaves[0]);
  for (let index = 0; index < 11; index++) {
    const angle = index * 2.38;
    const leaf = new T.Mesh(new T.SphereGeometry(1, 8, 6), leaves[index % leaves.length]);
    leaf.scale.set(.12, .035, .23);
    leaf.position.set(6.12 + Math.cos(angle) * .17, 2.33 + index * .023, .49 + Math.sin(angle) * .17);
    leaf.rotation.set(.25 * (index % 3), angle, (index % 4 - 1.5) * .37);
    leaf.castShadow = true;
    scene.add(leaf);
  }

  scene.add(new T.HemisphereLight("#fff3dc", "#929f91", 1.60));
  scene.add(new T.AmbientLight("#f4e9d1", .39));
  const soft = new T.DirectionalLight("#ebe7d5", 1.13);
  soft.position.set(2, 5.6, 9.9);
  scene.add(soft);
  const sun = new T.DirectionalLight("#ffe2ad", 3.1);
  sun.position.set(-13, 8.5, 3.4);
  sun.target.position.set(2, 0, 9.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1536, 1536);
  Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 10, bottom: -10, near: .3, far: 36 });
  sun.shadow.bias = -.00022;
  sun.shadow.normalBias = .038;
  sun.shadow.radius = 1.8;
  scene.add(sun, sun.target);

  function draw() {
    const motion = ease(progress, .06, .94);
    const aisleTurn = ease(motion, .27, .77);
    const sit = ease(progress, .77, 1);
    const steps = Math.sin(motion * 10 * Math.PI) * Math.sin(progress * Math.PI) * (1 - sit);
    const wideRoom = ease(camera.aspect, 1.01, 1.48);
    const doorwayOffset = 5.13 * (1 - aisleTurn);
    const x = doorwayOffset - 1.72 * wideRoom * aisleTurn;
    camera.position.set(x, 1.79 - .37 * sit + steps * .042, 19.55 - 11.69 * motion - .12 * sit);
    target.set(doorwayOffset * (.92 - .33 * aisleTurn) - 2.13 * wideRoom * aisleTurn,
      2.42 + .27 * sit + steps * .035, 0);
    camera.lookAt(target);
    renderer.render(scene, camera);
  }

  function alignBoard(width, height) {
    const point = new T.Vector3();
    const edgeX = boardWidth / 2 - .11;
    const edgeY = (boardHeight / 2 - .10) * boardStretch;
    const project = (x, y) => {
      point.set(x, 3.28 + y, .326).project(camera);
      return { x: (point.x + 1) * width / 2, y: (1 - point.y) * height / 2 };
    };
    const topLeft = project(-edgeX, edgeY);
    const topRight = project(edgeX, edgeY);
    const bottomLeft = project(-edgeX, -edgeY);
    const bottomRight = project(edgeX, -edgeY);
    const left = Math.max(topLeft.x, bottomLeft.x);
    const right = Math.min(topRight.x, bottomRight.x);
    const top = Math.max(topLeft.y, topRight.y);
    const bottom = Math.min(bottomLeft.y, bottomRight.y);
    for (const [name, value] of Object.entries({ left, top, width: right - left, height: bottom - top })) {
      board.style.setProperty(`--board-${name}`, `${value}px`);
    }
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
    clock.position.y = clockFrame.position.y = 5.55 + .21 * tallRoom;
    clock.scale.setScalar(1 - .18 * tallRoom);
    clockFrame.scale.copy(clock.scale);
    studentDesk.position.x = -1.72 * ease(camera.aspect, 1.01, 1.48);
    renderer.setSize(width, height, false);
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
    sourceReady = undefined;
  }

  function setBookCover(title, color) {
    bookTitle = title;
    bookColor = color;
    paintBookCover();
    draw();
  }

  sourceReady = draw;
  resize();
  document.fonts.load("700 61px Kalam").then(() => {
    paintBookCover();
    sourceReady?.();
  });
  return { resize, sit, walk, stop, setBookCover };
};
