import * as THREE from 'three';
import { Renderer } from './Renderer';
import { WarpQuad } from './WarpQuad';
import { WarpGrid } from './WarpGrid';
import { createCheckerTexture, createMaskTexture, createSolidTexture } from './textures';
import { GenerativeTexture } from './GenerativeTexture';
import { ParticleTexture } from './ParticleTexture';
import type { DynamicTexture } from './DynamicTexture';
import type { WarpObject } from './WarpObject';
import { getAudioFeatures } from '@/content/audioBus';
import type { BlendMode, LayerTransform, ParticleParams, Vec2, WarpMode } from '@/types';
import type { GridSize } from '@/utils/warp';
import { NO_BLEND, type EdgeBlend } from '@/utils/edgeBlend';
import { LAYER_TRANSFORM_IDENTITY } from '@/utils/layerTransform';

export interface StageLayer {
  id: string;
  kind: 'pattern' | 'image' | 'video' | 'webcam' | 'generative' | 'particles';
  blendMode: BlendMode;
  opacity: number;
  visible: boolean;
  /** Pour generative : corps du fragment shader. */
  shaderCode?: string;
  /** Pour particles : paramètres du système de particules. */
  particles?: ParticleParams;
  /** Repositionnement du contenu dans la surface (absent = identité). */
  transform?: LayerTransform;
}

export interface StageMask {
  enabled: boolean;
  points: Vec2[];
}

export interface StageSurface {
  id: string;
  warpMode: WarpMode;
  controlPoints: Vec2[];
  gridSize: GridSize;
  layers: StageLayer[];
  mask?: StageMask;
  /** Edge blending par bord (fondu vers les recouvrements de projecteurs). */
  blend?: EdgeBlend;
}

export interface StageOptions {
  background?: number;
}

/** Résout la texture d'un calque image (null tant qu'elle n'est pas chargée). */
export type TextureResolver = (surfaceId: string, layer: StageLayer) => THREE.Texture | null;

interface SurfaceEntry {
  warpKey: string;
  objs: WarpObject[];
}

function surfaceKey(surface: StageSurface): string {
  return surface.warpMode === 'grid'
    ? `grid:${surface.gridSize.cols}x${surface.gridSize.rows}`
    : 'quad';
}

function maskSignature(mask: StageMask | undefined): string {
  if (!mask || !mask.enabled || mask.points.length < 3) return '';
  return mask.points.map((p) => `${p.x.toFixed(4)},${p.y.toFixed(4)}`).join(';');
}

/** Hash stable (FNV-1a) d'une chaîne -> graine déterministe (éditeur = sortie). */
function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Scène multi-surfaces partagée (éditeur ET sortie). Chaque surface est une pile
 * de calques déformés (quad/grille) empilés via le blending Three.js, avec un
 * masque de découpe optionnel (texture alpha en espace sortie). La résolution
 * des textures de calque est déléguée à l'appelant.
 */
export class Stage {
  private readonly renderer: Renderer;
  private readonly defaultTexture: THREE.Texture;
  private readonly defaultMask: THREE.Texture;
  private readonly entries = new Map<string, SurfaceEntry>();
  private readonly maskCache = new Map<string, { sig: string; texture: THREE.Texture }>();
  private readonly dynamic = new Map<
    string,
    { sig: string; kind: 'generative' | 'particles'; obj: DynamicTexture; visible: boolean }
  >();
  private surfaces: StageSurface[] = [];
  private selectedId: string | null = null;
  private showOutlines = true;
  private resolveTexture: TextureResolver = () => null;

  constructor(canvas: HTMLCanvasElement, options: StageOptions = {}) {
    this.renderer = new Renderer(canvas, { clearColor: options.background });
    this.defaultTexture = createCheckerTexture();
    this.defaultMask = createSolidTexture();
    this.renderer.onResize = () => this.applyCorners();
    this.renderer.onFrame = (time) => this.renderDynamic(time);
  }

  setShowOutlines(visible: boolean): void {
    this.showOutlines = visible;
    this.refreshOutlines();
  }

  sync(surfaces: StageSurface[], selectedId: string | null, resolveTexture: TextureResolver): void {
    this.surfaces = surfaces;
    this.selectedId = selectedId;
    this.resolveTexture = resolveTexture;

    const ids = new Set(surfaces.map((s) => s.id));
    for (const [id, entry] of this.entries) {
      if (!ids.has(id)) {
        this.disposeEntry(entry);
        this.entries.delete(id);
        this.disposeMask(id);
      }
    }

    surfaces.forEach((surface, surfaceIndex) => {
      const warpKey = surfaceKey(surface);
      let entry = this.entries.get(surface.id);

      if (!entry || entry.warpKey !== warpKey || entry.objs.length !== surface.layers.length) {
        if (entry) this.disposeEntry(entry);
        const objs = surface.layers.map(() => this.createWarpObject(surface));
        objs.forEach((o) => this.renderer.add(o.group));
        entry = { warpKey, objs };
        this.entries.set(surface.id, entry);
      }

      const mask = this.maskTextureFor(surface);
      surface.layers.forEach((layer, i) => {
        const obj = entry.objs[i];
        obj.setCorners(surface.controlPoints, this.renderer.aspect);
        obj.setTexture(this.textureFor(surface.id, layer));
        obj.setMask(mask.texture, mask.enabled);
        obj.setStyle(layer.opacity, layer.blendMode);
        obj.setBlend(surface.blend ?? NO_BLEND);
        obj.setTransform(layer.transform ?? LAYER_TRANSFORM_IDENTITY, this.renderer.aspect);
        obj.setVisible(layer.visible);
        obj.setRenderOrder(surfaceIndex * 1000 + i);
        obj.setOutlineVisible(i === 0 && this.showOutlines && surface.id === selectedId);
      });
    });
    // Libère les textures dynamiques (génératif/particules) des calques disparus.
    const activeDynamic = new Set<string>();
    surfaces.forEach((s) =>
      s.layers.forEach((l) => {
        if (l.kind === 'generative' || l.kind === 'particles') activeDynamic.add(l.id);
      }),
    );
    for (const [id, entry] of this.dynamic) {
      if (!activeDynamic.has(id)) {
        entry.obj.dispose();
        this.dynamic.delete(id);
      }
    }
  }

  dispose(): void {
    for (const entry of this.entries.values()) this.disposeEntry(entry);
    this.entries.clear();
    for (const cached of this.maskCache.values()) cached.texture.dispose();
    this.maskCache.clear();
    for (const entry of this.dynamic.values()) entry.obj.dispose();
    this.dynamic.clear();
    this.renderer.dispose();
    this.defaultTexture.dispose();
    this.defaultMask.dispose();
  }

  private createWarpObject(surface: StageSurface): WarpObject {
    return surface.warpMode === 'grid'
      ? new WarpGrid(surface.gridSize, this.defaultTexture, this.defaultMask)
      : new WarpQuad(this.defaultTexture, this.defaultMask);
  }

  private textureFor(surfaceId: string, layer: StageLayer): THREE.Texture {
    if (layer.kind === 'pattern') return this.defaultTexture;
    if (layer.kind === 'generative' || layer.kind === 'particles') return this.dynamicFor(layer);
    return this.resolveTexture(surfaceId, layer) ?? this.defaultTexture;
  }

  private dynamicFor(layer: StageLayer): THREE.Texture {
    const kind = layer.kind === 'particles' ? 'particles' : 'generative';
    const hasContent = kind === 'particles' ? !!layer.particles : !!layer.shaderCode;
    if (!hasContent) {
      const existing = this.dynamic.get(layer.id);
      if (existing) {
        existing.obj.dispose();
        this.dynamic.delete(layer.id);
      }
      return this.defaultTexture;
    }
    // Particules : reconstruction seulement si le NOMBRE change (les autres
    // paramètres sont appliqués en place via update()). Génératif : sur le code.
    const sig =
      kind === 'particles'
        ? `count:${Math.floor(layer.particles!.count)}`
        : (layer.shaderCode ?? '');
    let entry = this.dynamic.get(layer.id);
    if (!entry || entry.sig !== sig || entry.kind !== kind) {
      entry?.obj.dispose();
      const obj: DynamicTexture =
        kind === 'particles'
          ? new ParticleTexture(layer.particles!, hashString(layer.id))
          : new GenerativeTexture(layer.shaderCode!);
      entry = { sig, kind, obj, visible: layer.visible };
      this.dynamic.set(layer.id, entry);
    }
    entry.visible = layer.visible;
    if (kind === 'particles') (entry.obj as ParticleTexture).update(layer.particles!);
    return entry.obj.texture;
  }

  private renderDynamic(time: number): void {
    const audio = getAudioFeatures();
    for (const entry of this.dynamic.values()) {
      if (entry.visible) entry.obj.render(this.renderer.gl, time, audio);
    }
  }

  private maskTextureFor(surface: StageSurface): { texture: THREE.Texture; enabled: boolean } {
    const sig = maskSignature(surface.mask);
    if (sig === '') {
      this.disposeMask(surface.id);
      return { texture: this.defaultMask, enabled: false };
    }
    let cached = this.maskCache.get(surface.id);
    if (!cached || cached.sig !== sig) {
      cached?.texture.dispose();
      cached = { sig, texture: createMaskTexture(surface.mask!.points) };
      this.maskCache.set(surface.id, cached);
    }
    return { texture: cached.texture, enabled: true };
  }

  private disposeMask(surfaceId: string): void {
    const cached = this.maskCache.get(surfaceId);
    if (cached) {
      cached.texture.dispose();
      this.maskCache.delete(surfaceId);
    }
  }

  private disposeEntry(entry: SurfaceEntry): void {
    entry.objs.forEach((o) => {
      this.renderer.remove(o.group);
      o.dispose();
    });
  }

  private applyCorners(): void {
    this.surfaces.forEach((surface) => {
      this.entries.get(surface.id)?.objs.forEach((o, i) => {
        o.setCorners(surface.controlPoints, this.renderer.aspect);
        // L'aspect intervient dans la correction de rotation : ré-appliquer au resize.
        o.setTransform(
          surface.layers[i]?.transform ?? LAYER_TRANSFORM_IDENTITY,
          this.renderer.aspect,
        );
      });
    });
  }

  private refreshOutlines(): void {
    this.surfaces.forEach((surface) => {
      const entry = this.entries.get(surface.id);
      entry?.objs.forEach((o, i) =>
        o.setOutlineVisible(i === 0 && this.showOutlines && surface.id === this.selectedId),
      );
    });
  }
}
