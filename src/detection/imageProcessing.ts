// Opérations image bas niveau, pures et testables (sans DOM).
// Travaillent sur des tampons de luminance en Float32 (0..255).

/** Image matricielle RGBA. `ImageData` du navigateur est compatible structurellement. */
export interface RasterImage {
  data: Uint8ClampedArray | Uint8Array;
  width: number;
  height: number;
}

/** Convertit une image RGBA en luminance (0..255) via la pondération Rec. 601. */
export function toGrayscale(image: RasterImage): Float32Array {
  const { data, width, height } = image;
  const out = new Float32Array(width * height);
  for (let i = 0; i < out.length; i += 1) {
    const o = i * 4;
    out[i] = 0.299 * data[o] + 0.587 * data[o + 1] + 0.114 * data[o + 2];
  }
  return out;
}

/** Noyau gaussien 1D normalisé pour un sigma donné. sigma ≤ 0 ⇒ noyau identité (aucun flou). */
export function gaussianKernel1D(sigma: number): Float32Array {
  if (sigma <= 0) return new Float32Array([1]);
  const radius = Math.max(1, Math.ceil(sigma * 3));
  const size = radius * 2 + 1;
  const kernel = new Float32Array(size);
  const denom = 2 * sigma * sigma;
  let sum = 0;
  for (let i = 0; i < size; i += 1) {
    const x = i - radius;
    const v = Math.exp(-(x * x) / denom);
    kernel[i] = v;
    sum += v;
  }
  for (let i = 0; i < size; i += 1) kernel[i] /= sum;
  return kernel;
}

const clampIndex = (v: number, max: number) => (v < 0 ? 0 : v > max ? max : v);

/** Flou gaussien séparable (bord répliqué). */
export function gaussianBlur(
  gray: Float32Array,
  width: number,
  height: number,
  sigma = 1.4,
): Float32Array {
  const kernel = gaussianKernel1D(sigma);
  const radius = (kernel.length - 1) / 2;
  const tmp = new Float32Array(width * height);
  const out = new Float32Array(width * height);

  // Passe horizontale.
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let acc = 0;
      for (let k = -radius; k <= radius; k += 1) {
        acc += gray[y * width + clampIndex(x + k, width - 1)] * kernel[k + radius];
      }
      tmp[y * width + x] = acc;
    }
  }
  // Passe verticale.
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let acc = 0;
      for (let k = -radius; k <= radius; k += 1) {
        acc += tmp[clampIndex(y + k, height - 1) * width + x] * kernel[k + radius];
      }
      out[y * width + x] = acc;
    }
  }
  return out;
}

export interface SobelResult {
  /** Magnitude du gradient. */
  mag: Float32Array;
  /** Orientation du gradient en radians (atan2(gy, gx)). */
  dir: Float32Array;
}

/** Gradient de Sobel 3×3 (magnitude + orientation), bord répliqué. */
export function sobel(gray: Float32Array, width: number, height: number): SobelResult {
  const mag = new Float32Array(width * height);
  const dir = new Float32Array(width * height);
  const at = (x: number, y: number) =>
    gray[clampIndex(y, height - 1) * width + clampIndex(x, width - 1)];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const gx =
        -at(x - 1, y - 1) -
        2 * at(x - 1, y) -
        at(x - 1, y + 1) +
        at(x + 1, y - 1) +
        2 * at(x + 1, y) +
        at(x + 1, y + 1);
      const gy =
        -at(x - 1, y - 1) -
        2 * at(x, y - 1) -
        at(x + 1, y - 1) +
        at(x - 1, y + 1) +
        2 * at(x, y + 1) +
        at(x + 1, y + 1);
      const i = y * width + x;
      mag[i] = Math.hypot(gx, gy);
      dir[i] = Math.atan2(gy, gx);
    }
  }
  return { mag, dir };
}
