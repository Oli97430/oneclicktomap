/**
 * D2 - Définition et parsing des paramètres de shader GLSL exposés en UI.
 *
 * Convention de déclaration dans le code GLSL :
 *   uniform float uP_speed;  // [0.0, 2.0, 0.5]  label: Vitesse
 *   uniform float uP_count;  // [1, 32, 8]        label: Nombre
 *
 * Format du commentaire : [min, max, default]  label: Libellé facultatif
 * Si le commentaire est absent : min=0, max=1, default=0.5.
 */

/** Définition d'un uniform exposé en slider UI (D2 : shader params). */
export interface ShaderParamDef {
  /** Nom du uniform sans le préfixe « uP_ » (ex. "speed"). */
  name: string;
  uniformName: string; // "uP_speed"
  label: string;
  min: number;
  max: number;
  default: number;
  step: number;
}

const UNIFORM_RE =
  /^\s*uniform\s+float\s+(uP_[\w]+)\s*;(?:\s*\/\/\s*\[([^\]]+)\](?:\s*label:\s*(.+))?)?/gm;

/** Extrait les definitions de parametres depuis le code GLSL d'un preset. */
export function parseShaderParams(glslCode: string): ShaderParamDef[] {
  const defs: ShaderParamDef[] = [];
  let match: RegExpExecArray | null;
  UNIFORM_RE.lastIndex = 0;
  while ((match = UNIFORM_RE.exec(glslCode)) !== null) {
    const uniformName = match[1];
    const name = uniformName.replace(/^uP_/, '');
    const rangeStr = match[2] ?? '';
    const labelRaw = match[3]?.trim() ?? '';

    let min = 0;
    let max = 1;
    let defaultVal = 0.5;
    let step = 0.01;

    if (rangeStr) {
      const parts = rangeStr.split(',').map((s) => parseFloat(s.trim()));
      if (parts.length >= 2 && !parts.some(isNaN)) {
        min = parts[0];
        max = parts[1];
        defaultVal = parts[2] ?? (min + max) / 2;
        const span = max - min;
        step = span <= 2 ? 0.01 : span <= 20 ? 0.1 : 1;
      }
    }

    defs.push({
      name,
      uniformName,
      label: labelRaw || name,
      min,
      max,
      default: defaultVal,
      step,
    });
  }
  return defs;
}

/**
 * Construit un objet shaderParams initialise aux valeurs par defaut
 * a partir des definitions d'un preset.
 */
export function defaultShaderParams(defs: ShaderParamDef[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const def of defs) {
    result[def.uniformName] = def.default;
  }
  return result;
}
