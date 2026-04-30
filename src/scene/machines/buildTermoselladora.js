// ─── scene/machines/buildTermoselladora.js ───────────────────────────────────
import { BELT_TOP } from "../../config/constants.js";
import { makeBeltTex } from "../textures.js";

export function buildTermoselladora(THREE, group, seg, imgEl, texOffsets) {
  // Cinta superior — siempre se construye
  const bt = makeBeltTex(THREE);
  texOffsets[seg.id] = bt;
  const bs = new THREE.Mesh(
    new THREE.BoxGeometry(seg.w + 5.0, 0.04, seg.d * 0.5),
    new THREE.MeshStandardMaterial({
      map: bt,
      roughness: 0.85,
      metalness: 0.05,
    })
  );
  bs.position.y = BELT_TOP - 0.02;
  bs.position.x = BELT_TOP - 0.9;
  group.add(bs);

  if (!window.THREE || !window.THREE.GLTFLoader) {
    console.warn("GLTFLoader no disponible — usando fallback");
    buildFallback(THREE, group, seg);
    return;
  }

  const loader = new window.THREE.GLTFLoader();
  loader.load(
    "/termoselladora.glb",
    (gltf) => {
      const model = gltf.scene;

      // Crear un grupo contenedor — esto aísla las transformaciones internas del GLB
      const wrapper = new THREE.Group();
      wrapper.add(model);
      model.rotation.y = Math.PI; // 180 grados — da la vuelta al frente

      // Forzar actualización de TODAS las matrices del árbol
      wrapper.updateMatrixWorld(true);
      model.updateMatrixWorld(true);

      // Calcular bounding box traversando todos los meshes manualmente
      // (más fiable que setFromObject cuando hay nodos con transformaciones internas)
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
          // Aplicar la matriz mundial del child para obtener coordenadas globales
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
        "GLB dimensiones reales:",
        sizeX.toFixed(3),
        sizeY.toFixed(3),
        sizeZ.toFixed(3)
      );
      console.log(
        "GLB centro:",
        centerX.toFixed(3),
        centerY.toFixed(3),
        centerZ.toFixed(3)
      );

      // Si el modelo tiene dimensiones 0 o inválidas, algo va mal
      if (sizeX === 0 || sizeY === 0 || sizeZ === 0 || !isFinite(sizeX)) {
        console.error(
          "Bounding box inválido — el GLB puede estar vacío o sin geometría"
        );
        buildFallback(THREE, group, seg);
        return;
      }

      // Escala uniforme para que encaje en el segmento (90% del espacio disponible)
      const targetW = seg.w * 0.9;
      const targetH = seg.h * 0.9;
      const targetD = seg.d * 0.9;
      const SCALE_MULTIPLIER = 2.0; // ← sube este número hasta que encaje
      const scale =
        Math.min(targetW / sizeX, targetH / sizeY, targetD / sizeZ) *
        SCALE_MULTIPLIER;
      console.log(
        "Escala calculada:",
        scale.toFixed(5),
        "— dimensiones finales:",
        (sizeX * scale).toFixed(3),
        (sizeY * scale).toFixed(3),
        (sizeZ * scale).toFixed(3)
      );

      // Aplicar escala al wrapper (no al model, para no interferir con transformaciones internas)
      wrapper.scale.setScalar(scale);

      // Centrar: mover el wrapper para que el centro del modelo quede en (0, 0, 0)
      // y la base quede en y = -1.25
      wrapper.position.x = -centerX * scale;
      wrapper.position.z = -centerZ * scale;
      wrapper.position.y = -minY * scale - 1.25;

      // Activar sombras
      model.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          if (child.material) {
            child.material.needsUpdate = true;
          }
        }
      });

      group.add(wrapper);
      console.log("Modelo GLB añadido correctamente a la escena");
    },
    (progress) => {
      if (progress.total > 0)
        console.log(
          "Cargando:",
          Math.round((progress.loaded / progress.total) * 100) + "%"
        );
    },
    (error) => {
      console.warn("Error cargando GLB:", error);
      buildFallback(THREE, group, seg);
    }
  );
}

function buildFallback(THREE, group, seg) {
  const inox = new THREE.MeshStandardMaterial({
    color: 0xb8c0c4,
    roughness: 0.22,
    metalness: 0.78,
  });
  const body = new THREE.Mesh(new THREE.BoxGeometry(seg.w, seg.h, seg.d), inox);
  body.position.y = seg.h / 2 - 1.25;
  body.castShadow = true;
  group.add(body);
  const rib = new THREE.Mesh(
    new THREE.BoxGeometry(seg.w + 0.04, 0.05, seg.d + 0.04),
    new THREE.MeshStandardMaterial({
      color: 0x2a2e32,
      roughness: 0.4,
      metalness: 0.7,
    })
  );
  rib.position.y = seg.h - 1.25 + 0.025;
  group.add(rib);
}
