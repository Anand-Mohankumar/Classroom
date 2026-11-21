"use strict";

window.addClassroomBookcase = function addClassroomBookcase(scene, finishes) {
  const T = window.THREE;
  const {
    box, slab, material, texture, loadSurface, contactShadow, randomSequence,
    oak, oakEdge, darkWood, pages, floorShadow, deskShadow
  } = finishes;
  const shelf = new T.Group();
  shelf.name = "reading-bookcase";
  shelf.position.set(-5.19, 0, .60);
  scene.add(shelf);

  const joinery = material("#886747", { roughness: .68 });
  const peg = material("#786b53", { metalness: .24, roughness: .5 });
  box(shelf, 2.47, 1.47, .065, 0, .88, -.273, darkWood, true);
  for (const side of [-1, 1]) {
    box(shelf, .116, 1.59, .61, side * 1.23, .855, 0, oakEdge, true);
    box(shelf, .057, 1.55, .048, side * 1.233, .85, .315, joinery);
    box(shelf, .175, .13, .48, side * 1.066, .066, -.018, darkWood);
    for (const height of [.51, .56, .97, 1.02, 1.42, 1.47]) {
      const pin = new T.Mesh(new T.CircleGeometry(.008, 8), peg);
      pin.position.set(side * 1.17, height, .235);
      pin.rotation.y = -side * Math.PI / 2;
      shelf.add(pin);
    }
  }
  box(shelf, 2.42, .14, .08, 0, .126, .235, darkWood, true);
  for (const y of [.23, .69, 1.15]) {
    slab(shelf, 2.39, .061, .59, 0, y, -.005, [oak, oakEdge]);
  }
  slab(shelf, 2.67, .09, .68, 0, 1.65, -.006, [oak, oakEdge]);
  contactShadow(shelf, 2.76, .91, 0, -.007, .01, floorShadow);

  const volumes = [
    ["#314c4e", "#d7bf8c", "ATLAS"],
    ["#704d3c", "#e7cfaa", "FIELD NOTES"],
    ["#33475b", "#d2d5ca", "NETWORKS"],
    ["#837251", "#f1dcad", "REFERENCE"],
    ["#4e6048", "#ddc89e", "METHODS"],
    ["#68515b", "#eadac1", "VOLUME II"],
    ["#443d38", "#d0b98e", "HANDBOOK"]
  ].map(([base, ink, label], index) => {
    const cloth = texture(80, 240, (context, width, height) => {
      const shade = context.createLinearGradient(0, 0, width, 0);
      shade.addColorStop(0, "#191913");
      shade.addColorStop(.18, base);
      shade.addColorStop(.64, base);
      shade.addColorStop(1, "#201a16");
      context.fillStyle = shade;
      context.fillRect(0, 0, width, height);
      const grain = randomSequence(112 + index);
      for (let i = 0; i < 2700; i++) {
        context.fillStyle = i % 2 ? "#e7d6b21c" : "#100d0a35";
        context.fillRect(grain() * width, grain() * height, .9, 1.25);
      }
      context.strokeStyle = ink;
      context.lineWidth = 1.7;
      context.globalAlpha = .74;
      if (index % 3 === 0) {
        for (const y of [21, 29, 205, 213]) {
          context.beginPath();
          context.moveTo(14, y);
          context.lineTo(66, y);
          context.stroke();
        }
      } else if (index % 3 === 1) {
        context.strokeRect(13, 37, 54, 42);
      }
      context.save();
      context.translate(width * .53, height * .51);
      context.rotate(-Math.PI / 2);
      context.fillStyle = ink;
      context.font = "600 15px Georgia, serif";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(label, 0, 0, height * .7);
      context.restore();
      context.globalAlpha = 1;
      context.fillStyle = "#ead7b7";
      if (index % 2 === 0) {
        context.fillRect(18, height - 31, 44, 16);
        context.fillStyle = "#594c3e";
        context.fillRect(25, height - 25, 30, 1.6);
      }
    });
    return {
      cover: material(base, { roughness: .74 }),
      spine: material("#fffdf7", { map: cloth, bumpMap: cloth, bumpScale: .008, roughness: .69 })
    };
  });

  function volume(width, height, depth, index) {
    const book = new T.Group();
    book.name = "shelf-volume";
    const { cover, spine } = volumes[index % volumes.length];
    box(book, width - .023, height - .024, depth - .024, 0, 0, -.003, pages, true);
    for (const side of [-1, 1]) {
      box(book, .012, height, depth, side * (width / 2 - .006), 0, 0, cover);
    }
    slab(book, width, .032, height, 0, 0, depth / 2 - .005, [spine, cover]).rotation.x = -Math.PI / 2;
    shelf.add(book);
    return book;
  }

  const random = randomSequence(558);
  function uprightRow(y, x, count, first, leanLast = false) {
    for (let i = 0; i < count; i++) {
      const width = .085 + random() * .081;
      const height = .247 + random() * .115;
      const depth = .26 + random() * .12;
      const leaning = i === count - 1 && leanLast;
      const book = volume(width, height, depth, first + i);
      book.position.set(x + width / 2 + (leaning ? .045 : 0), y + height / 2, .084 - random() * .09);
      book.rotation.y = (random() - .5) * .11;
      if (leaning) book.rotation.z = .19;
      x += width + .021 + random() * .034;
    }
  }

  function stack(y, x, count, first) {
    for (let i = 0; i < count; i++) {
      const thickness = .043 + random() * .031;
      const book = volume(thickness, .424 - i * .041, .313 - i * .021, first + i);
      book.rotation.set(0, (random() - .5) * .22, Math.PI / 2, "YXZ");
      book.position.set(x + (random() - .5) * .055, y + thickness / 2, .036 - i * .016);
      y += thickness + .012;
    }
  }
  uprightRow(.263, -.99, 5, 3, true);
  stack(.265, .57, 3, 1);
  uprightRow(.723, -.30, 7, 1);
  stack(.725, -.78, 2, 5);
  uprightRow(1.183, -.99, 8, 0, true);
  uprightRow(1.183, .62, 3, 4);
  stack(1.699, -.64, 2, 2);

  const plant = new T.Group();
  plant.name = "potted-classroom-plant";
  plant.position.set(.66, 1.698, .027);
  shelf.add(plant);
  contactShadow(plant, .83, .68, 0, .001, 0, deskShadow);
  const glaze = texture(160, 100, (context, width, height) => {
    const layers = context.createLinearGradient(0, 0, 0, height);
    layers.addColorStop(0, "#cbb48f");
    layers.addColorStop(.15, "#d3bb91");
    layers.addColorStop(.68, "#b08361");
    layers.addColorStop(1, "#97563c");
    context.fillStyle = layers;
    context.fillRect(0, 0, width, height);
    const grain = randomSequence(465);
    for (let i = 0; i < 1900; i++) {
      context.fillStyle = i % 3 === 0 ? "#ffefd442" : "#52312136";
      const fleck = .45 + grain() * .69;
      context.fillRect(grain() * width, grain() * height, fleck, fleck);
    }
  });
  const clay = material("#f1ded0", { map: glaze, bumpMap: glaze, bumpScale: .013, roughness: .64, side: T.DoubleSide });
  const terracotta = material("#9e6349", { roughness: .84 });
  const soil = material("#41362b", { roughness: 1 });

  function potLayer(top, bottom, height, y, surface, open = false) {
    const mesh = new T.Mesh(new T.CylinderGeometry(top, bottom, height, 32, 1, open), surface);
    mesh.position.y = y;
    mesh.castShadow = mesh.receiveShadow = true;
    plant.add(mesh);
  }
  potLayer(.259, .235, .041, .021, terracotta);
  potLayer(.218, .153, .292, .179, clay, true);
  potLayer(.224, .225, .034, .320, clay, true);
  potLayer(.197, .187, .012, .300, soil);

  const leafMap = texture(192, 192, (context, width, height) => {
    context.fillStyle = "#59764a";
    context.fillRect(0, 0, width, height);
    context.strokeStyle = "#9caa6d";
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(width / 2, 0);
    context.lineTo(width / 2, height);
    for (let i = 1; i < 9; i++) {
      const y = height * i / 9;
      context.moveTo(width / 2, y);
      context.quadraticCurveTo(width * .3, y - 9, 0, y - 22);
      context.moveTo(width / 2, y);
      context.quadraticCurveTo(width * .7, y - 9, width, y - 22);
    }
    context.stroke();
  });
  loadSurface(window.classroomLeafTexture, leafMap, (context, width, height, image) => {
    context.drawImage(image, 0, 0, width, height);
  });
  const leafFinishes = ["#c4d7a9", "#e4e1bc", "#afbfa9", "#d2d8ab"].map((color, i) =>
    material(color, { map: leafMap, bumpMap: leafMap, bumpScale: .006,
      emissive: "#bad08c", emissiveMap: leafMap, emissiveIntensity: .16,
      roughness: .39 + i * .045, side: T.DoubleSide })
  );
  const stemMaterial = material("#647959", { roughness: .68 });
  const stemGeometry = new T.CylinderGeometry(.009, .014, 1, 8);
  const vertical = new T.Vector3(0, 1, 0);
  function petiole(start, end) {
    const stem = new T.Mesh(stemGeometry, stemMaterial);
    const direction = end.clone().sub(start);
    stem.position.copy(start).lerp(end, .5);
    stem.scale.y = direction.length();
    stem.quaternion.setFromUnitVectors(vertical, direction.normalize());
    stem.castShadow = true;
    plant.add(stem);
  }

  function leaf(length, widthRatio, lift, shape) {
    const geometry = new T.PlaneGeometry(1, 1, 8, 12);
    const { position, uv } = geometry.attributes;
    for (let i = 0; i < position.count; i++) {
      const u = 2 * uv.getX(i) - 1;
      const t = uv.getY(i);
      const taper = Math.pow(Math.sin(Math.PI * t), .82) * (1.14 - .43 * t);
      const fold = Math.pow(Math.abs(u), 1.55) * taper;
      position.setXYZ(i, length * (u * widthRatio * taper + shape * t * t),
        length * (lift * t - .28 * t * t - .118 * fold), length * t);
    }
    geometry.computeVertexNormals();
    return geometry;
  }

  const foliage = randomSequence(639);
  for (let i = 0; i < 17; i++) {
    const angle = i * 2.39996 + foliage() * .32;
    const lift = .14 + foliage() * .63;
    const rise = .20 + foliage() * .57;
    const reach = .09 + foliage() * .29;
    const radial = (radius, y) => new T.Vector3(Math.sin(angle) * radius, y, Math.cos(angle) * radius);
    const start = radial(.045, .302);
    const bend = radial(reach * .38, .37 + rise * .48);
    const tip = radial(reach, .33 + rise);
    petiole(start, bend);
    petiole(bend, tip);
    const blade = new T.Mesh(
      leaf(.27 + foliage() * .30, .24 + foliage() * .10, lift, (foliage() - .5) * .14),
      leafFinishes[i % leafFinishes.length]
    );
    blade.position.copy(tip);
    blade.rotation.set(0, angle, (foliage() - .5) * .98, "YXZ");
    blade.castShadow = blade.receiveShadow = true;
    plant.add(blade);
  }

  const windowFill = new T.SpotLight("#ffe9c6", 8, 5.5, Math.PI * .29, .83);
  windowFill.position.set(-6.64, 3.6, 2.35);
  windowFill.target.position.set(-5.09, 1.33, .62);
  scene.add(windowFill, windowFill.target);
};
