import * as THREE from 'three';

/**
 * Renderer Three.js principal. Caméra orthographique sur le carré unité [0,1]²
 * (y vers le haut) : tout le contenu est exprimé en coordonnées normalisées de
 * la sortie, indépendamment de la taille du canvas.
 */
export class Renderer {
  readonly scene: THREE.Scene;
  readonly camera: THREE.OrthographicCamera;
  onResize?: (aspect: number) => void;
  /** Appelé à chaque frame avant le rendu principal (temps en secondes). */
  onFrame?: (time: number) => void;

  private readonly renderer: THREE.WebGLRenderer;
  private readonly canvas: HTMLCanvasElement;
  private readonly resizeObserver: ResizeObserver;
  private frameId = 0;

  constructor(canvas: HTMLCanvasElement, options: { clearColor?: number } = {}) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setClearColor(options.clearColor ?? 0x0a0e16, 1);

    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(0, 1, 1, 0, 0.1, 1000);
    this.camera.position.z = 1;

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.resize();
    this.renderLoop();
  }

  get aspect(): number {
    return (this.canvas.clientWidth || 1) / (this.canvas.clientHeight || 1);
  }

  /** Accès au renderer WebGL sous-jacent (passes hors-écran, ex. génératif). */
  get gl(): THREE.WebGLRenderer {
    return this.renderer;
  }

  add(object: THREE.Object3D): void {
    this.scene.add(object);
  }

  remove(object: THREE.Object3D): void {
    this.scene.remove(object);
  }

  dispose(): void {
    cancelAnimationFrame(this.frameId);
    this.resizeObserver.disconnect();
    this.renderer.dispose();
    // Libère explicitement le contexte WebGL (sinon fuite au remontage / HMR).
    this.renderer.forceContextLoss();
  }

  private resize(): void {
    const width = this.canvas.clientWidth || 1;
    const height = this.canvas.clientHeight || 1;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(width, height, false);
    this.onResize?.(width / height);
  }

  private renderLoop = (): void => {
    this.frameId = requestAnimationFrame(this.renderLoop);
    this.onFrame?.(performance.now() / 1000);
    this.renderer.render(this.scene, this.camera);
  };
}
