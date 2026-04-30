// ─── scene/machines/buildDetector.js ─────────────────────────────────────────
import { BELT_TOP } from "../../config/constants.js";
import { makeBeltTex } from "../textures.js";

export function buildDetector(THREE, group, seg, imgEl, texOffsets) {
  // Cinta — siempre se construye
  const bt = makeBeltTex(THREE);
  texOffsets[seg.id] = bt;
  const cBelt = new THREE.Mesh(
    new THREE.BoxGeometry(seg.w + 4.0, 0.04, seg.d * 0.75),
    new THREE.MeshStandardMaterial({ map: bt, color: 0x485868, roughness: 0.9 })
  );
  cBelt.position.y = BELT_TOP - 0.02;
  cBelt.position.x = BELT_TOP + 1.75;

  group.add(cBelt);

  if (!window.THREE || !window.THREE.GLTFLoader) {
    console.warn("GLTFLoader no disponible — usando fallback");
    buildFallback(THREE, group, seg);
    return;
  }

  const loader = new window.THREE.GLTFLoader();
  loader.load(
    "/DET_MET.glb",
    (gltf) => {
      const model = gltf.scene;
      const wrapper = new THREE.Group();
      wrapper.add(model);
      model.rotation.y = 0;

      wrapper.updateMatrixWorld(true);
      model.updateMatrixWorld(true);

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
      const centerZ = (minZ + maxZ) / 2;

      console.log(
        "DET_MET GLB dimensiones:",
        sizeX.toFixed(3),
        sizeY.toFixed(3),
        sizeZ.toFixed(3)
      );

      if (sizeX === 0 || sizeY === 0 || sizeZ === 0 || !isFinite(sizeX)) {
        console.error("Bounding box inválido — usando fallback");
        buildFallback(THREE, group, seg);
        return;
      }

      const SCALE_MULTIPLIER = 3.6; // ← ajusta si queda muy grande o pequeño
      const scale =
        Math.min(
          (seg.w * 0.9) / sizeX,
          (seg.h * 0.9) / sizeY,
          (seg.d * 0.9) / sizeZ
        ) * SCALE_MULTIPLIER;

      wrapper.scale.setScalar(scale);
      wrapper.position.x = -centerX * scale + 2.0;
      wrapper.position.z = -centerZ * scale;
      wrapper.position.y = -minY * scale - 1.25; // ← ajusta si queda muy alto o bajo

      model.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          if (child.material) child.material.needsUpdate = true;
        }
      });

      group.add(wrapper);
      console.log("DET_MET GLB cargado correctamente");
    },
    (progress) => {
      if (progress.total > 0)
        console.log(
          "Cargando detector:",
          Math.round((progress.loaded / progress.total) * 100) + "%"
        );
    },
    (error) => {
      console.warn("Error cargando DET_MET.glb:", error);
      buildFallback(THREE, group, seg);
    }
  );
}

function buildFallback(THREE, group, seg) {
  const inox = new THREE.MeshStandardMaterial({
    color: 0xbcc5ca,
    roughness: 0.24,
    metalness: 0.76,
  });
  const body = new THREE.Mesh(new THREE.BoxGeometry(seg.w, seg.h, seg.d), inox);
  body.position.y = seg.h / 2 - 1.25;
  body.castShadow = true;
  group.add(body);
  const rib = new THREE.Mesh(
    new THREE.BoxGeometry(seg.w + 0.04, 0.04, seg.d + 0.04),
    new THREE.MeshStandardMaterial({
      color: 0x2a2e32,
      roughness: 0.4,
      metalness: 0.7,
    })
  );
  rib.position.y = seg.h - 1.25 + 0.022;
  group.add(rib);
}
