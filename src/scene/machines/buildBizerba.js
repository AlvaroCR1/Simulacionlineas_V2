// ─── scene/machines/buildBizerba.js ──────────────────────────────────────────
import { BELT_TOP } from "../../config/constants.js";
import { makeBeltTex } from "../textures.js";

export function buildBizerba(THREE, group, seg, imgEl, texOffsets) {
  // Cinta pesadora — siempre se construye independiente del GLB
  const bt = makeBeltTex(THREE);
  texOffsets[seg.id] = bt;
  const belt = new THREE.Mesh(
    new THREE.BoxGeometry(seg.w * 1.8, 0.04, seg.d * 0.3),
    new THREE.MeshStandardMaterial({
      map: bt,
      color: 0xf5f5dc,
      roughness: 0.9,
      metalness: 0.05,
    })
  );
  belt.position.y = BELT_TOP - 0.0;
  belt.position.x = BELT_TOP + 0.1;
  group.add(belt);

  if (!window.THREE || !window.THREE.GLTFLoader) {
    console.warn("GLTFLoader no disponible — usando fallback Bizerba");
    buildFallback(THREE, group, seg);
    return;
  }

  const loader = new window.THREE.GLTFLoader();
  loader.load(
    "/bizerba.glb",
    (gltf) => {
      const model = gltf.scene;

      // Wrapper para aislar transformaciones internas del GLB
      const wrapper = new THREE.Group();
      wrapper.add(model);

      // Escala neutra y posición cero antes de medir
      model.scale.set(1, 1, 1);
      model.position.set(0, 0, 0);
      model.rotation.set(0, 0, 0);

      // Forzar actualización de matrices
      wrapper.updateMatrixWorld(true);
      model.updateMatrixWorld(true);

      // Calcular bounding box recorriendo cada mesh individualmente
      // (más fiable que setFromObject con GLBs que tienen nodos anidados)
      let minX = Infinity,
        minY = Infinity,
        minZ = Infinity;
      let maxX = -Infinity,
        maxY = -Infinity,
        maxZ = -Infinity;
      model.traverse((child) => {
        if (child.isMesh && child.geometry) {
          child.geometry.computeBoundingBox();
          const geomBox = child.geometry.boundingBox.clone();
          geomBox.applyMatrix4(child.matrixWorld);
          minX = Math.min(minX, geomBox.min.x);
          maxX = Math.max(maxX, geomBox.max.x);
          minY = Math.min(minY, geomBox.min.y);
          maxY = Math.max(maxY, geomBox.max.y);
          minZ = Math.min(minZ, geomBox.min.z);
          maxZ = Math.max(maxZ, geomBox.max.z);
        }
      });

      const sizeX = maxX - minX;
      const sizeY = maxY - minY;
      const sizeZ = maxZ - minZ;
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;
      const centerZ = (minZ + maxZ) / 2;

      console.log(
        "Bizerba GLB dimensiones originales:",
        sizeX.toFixed(3),
        sizeY.toFixed(3),
        sizeZ.toFixed(3)
      );

      if (!isFinite(sizeX) || sizeX === 0 || sizeY === 0 || sizeZ === 0) {
        console.error("Bizerba GLB: bounding box inválido");
        buildFallback(THREE, group, seg);
        return;
      }

      // ── Ajusta SCALE_MULTIPLIER hasta conseguir el tamaño visual correcto ──
      const SCALE_MULTIPLIER = 1.55; // ← sube este valor si el modelo sale pequeño
      const scale =
        Math.min(
          (seg.w * 0.9) / sizeX,
          (seg.h * 0.9) / sizeY,
          (seg.d * 0.9) / sizeZ
        ) * SCALE_MULTIPLIER;

      console.log("Bizerba escala aplicada:", scale.toFixed(5));
      wrapper.scale.setScalar(scale);
      wrapper.position.x = -centerX * scale;
      wrapper.position.z = -centerZ * scale;
      wrapper.position.y = -minY * scale - 1.3; // ← cambia -1.25 para subir o bajar

      // ── Rotación: ajusta si el frente no mira en la dirección correcta ──
      model.rotation.y = 0; // prueba Math.PI, Math.PI/2, -Math.PI/2

      // Activar sombras y mejorar materiales
      model.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          if (child.material) {
            child.material.roughness = child.material.roughness ?? 0.4;
            child.material.metalness = child.material.metalness ?? 0.5;
            child.material.needsUpdate = true;
          }
        }
      });

      group.add(wrapper);
      console.log("Bizerba GLB añadido correctamente —", seg.id);
    },
    (progress) => {
      if (progress.total > 0)
        console.log(
          "Cargando Bizerba GLB:",
          Math.round((progress.loaded / progress.total) * 100) + "%"
        );
    },
    (error) => {
      console.warn("Error cargando Bizerba GLB, usando fallback:", error);
      buildFallback(THREE, group, seg);
    }
  );
}

// ─── Fallback geométrico ──────────────────────────────────────────────────────
function buildFallback(THREE, group, seg) {
  const inox = new THREE.MeshStandardMaterial({
    color: 0xc4ccd0,
    roughness: 0.22,
    metalness: 0.78,
  });
  const blue = new THREE.MeshStandardMaterial({
    color: 0x1a3a8a,
    roughness: 0.5,
    metalness: 0.2,
  });

  // 4 patas
  [
    [-0.42, -0.5],
    [0.42, -0.5],
    [-0.42, 0.5],
    [0.42, 0.5],
  ].forEach(([x, z]) => {
    const leg = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.03, 1.48, 8),
      inox
    );
    leg.position.set(x, -0.49, z);
    leg.castShadow = true;
    group.add(leg);
    const fp = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.065, 0.04, 8),
      inox
    );
    fp.position.set(x, -1.35, z);
    group.add(fp);
  });

  // Plataforma azul
  const platform = new THREE.Mesh(
    new THREE.BoxGeometry(seg.w, 0.06, seg.d * 0.88),
    blue
  );
  platform.position.y = -0.28;
  platform.castShadow = true;
  group.add(platform);

  // Cuerpo principal
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(seg.w, seg.h * 0.5, seg.d),
    inox
  );
  body.position.y = seg.h * 0.25 - 1.0;
  body.castShadow = true;
  group.add(body);

  // Ribete superior
  const rib = new THREE.Mesh(
    new THREE.BoxGeometry(seg.w + 0.04, 0.05, seg.d + 0.04),
    new THREE.MeshStandardMaterial({
      color: 0x2a2e32,
      roughness: 0.4,
      metalness: 0.7,
    })
  );
  rib.position.y = BELT_TOP + 0.025;
  group.add(rib);
}
