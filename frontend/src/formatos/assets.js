import cocheSuperior from "@/assets/formatos/coche-superior.png";
import cocheInferior from "@/assets/formatos/coche-inferior.png";
import cocheLateral from "@/assets/formatos/coche-lateral.png";

export const BUILTIN_IMAGES = {
  "coche-superior": cocheSuperior,
  "coche-inferior": cocheInferior,
  "coche-lateral": cocheLateral,
};

export const BUILTIN_IMAGE_NAMES = {
  "coche-superior": "Coche - vista superior",
  "coche-inferior": "Coche - vista inferior",
  "coche-lateral": "Coche - vista lateral",
};

export function resolveImageSrc(src) {
  return BUILTIN_IMAGES[src] || src;
}
