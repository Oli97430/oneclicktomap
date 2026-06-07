import { useRef, type ChangeEvent } from 'react';
import { useMediaStore } from '@/stores/mediaStore';
import { useProjectStore } from '@/stores/projectStore';
import type { MediaItem } from '@/types';

export function MediaLibrary() {
  const fileRef = useRef<HTMLInputElement>(null);
  const items = useMediaStore((s) => s.items);
  const addItem = useMediaStore((s) => s.addItem);
  const removeItem = useMediaStore((s) => s.removeItem);
  const addLayer = useProjectStore((s) => s.addLayer);
  const selectedSurfaceId = useProjectStore((s) => s.selectedSurfaceId);

  const onFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    files.forEach((file) => {
      // file.type est souvent vide sous Windows (.mkv/.avi/.mov) : on retombe sur l'extension.
      const isVideo = file.type
        ? file.type.startsWith('video')
        : /\.(mp4|webm|mov|mkv|avi|m4v)$/i.test(file.name);
      const kind: 'image' | 'video' = isVideo ? 'video' : 'image';
      const reader = new FileReader();
      reader.onload = () => addItem(kind, file.name, reader.result as string);
      reader.readAsDataURL(file);
    });
    event.target.value = '';
  };

  const addToSurface = (item: MediaItem) => {
    if (selectedSurfaceId) {
      addLayer(selectedSurfaceId, { kind: item.kind, dataUrl: item.dataUrl }, item.name);
    }
  };

  const addWebcam = () => {
    if (selectedSurfaceId) addLayer(selectedSurfaceId, { kind: 'webcam' }, 'Webcam');
  };

  return (
    <section className="panel">
      <div className="panel-head">
        <h2 className="panel-title">Médias</h2>
        <button
          type="button"
          className="icon-btn"
          onClick={() => fileRef.current?.click()}
          title="Importer une image ou une vidéo"
        >
          ＋
        </button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*,video/*"
        multiple
        hidden
        aria-label="Importer un média"
        onChange={onFiles}
      />

      <button
        type="button"
        className="panel-action"
        onClick={addWebcam}
        disabled={!selectedSurfaceId}
      >
        + Webcam
      </button>

      <ul className="media-list">
        {items.length === 0 && <li className="panel-hint">Importez des images ou des vidéos…</li>}
        {items.map((item) => (
          <li key={item.id} className="media-row">
            {item.kind === 'image' ? (
              <img className="media-thumb" src={item.dataUrl} alt="" />
            ) : (
              <span className="media-thumb media-thumb-video" aria-hidden="true">
                ▶
              </span>
            )}
            <button
              type="button"
              className="media-name"
              onClick={() => addToSurface(item)}
              disabled={!selectedSurfaceId}
              title="Ajouter comme calque à la surface sélectionnée"
            >
              {item.name}
            </button>
            <button
              type="button"
              className="icon-btn"
              onClick={() => removeItem(item.id)}
              title="Retirer de la bibliothèque"
              aria-label="Retirer le média"
            >
              ×
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
