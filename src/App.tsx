import { Toolbar } from '@/ui/components/Toolbar';
import { StageCanvas } from '@/ui/components/StageCanvas';
import { SurfaceList } from '@/ui/components/SurfaceList';
import { WarpControls } from '@/ui/components/WarpControls';
import { LayersPanel } from '@/ui/components/LayersPanel';
import { MediaLibrary } from '@/ui/components/MediaLibrary';
import { GeneratorPanel } from '@/ui/components/GeneratorPanel';
import { AudioPanel } from '@/ui/components/AudioPanel';
import { DetectionPanel } from '@/ui/components/DetectionPanel';
import { TimelinePanel } from '@/ui/components/TimelinePanel';
import { CueBar } from '@/ui/components/CueBar';
import { MaskPanel } from '@/ui/components/MaskPanel';
import { BlendPanel } from '@/ui/components/BlendPanel';
import { useProjectStore } from '@/stores/projectStore';
import { useSceneStore } from '@/stores/sceneStore';
import { useOutputSync } from '@/ui/hooks/useOutputSync';
import { useKeyboardShortcuts } from '@/ui/hooks/useKeyboardShortcuts';
import { useAudio } from '@/ui/hooks/useAudio';
import { useTimelinePlayback } from '@/ui/hooks/useTimelinePlayback';

export default function App() {
  // Synchronise l'éditeur avec la fenêtre de sortie (si ouverte).
  useOutputSync();
  // Raccourcis globaux (undo/redo, transport, cue).
  useKeyboardShortcuts();
  // Capture + analyse audio (audio-réactif).
  useAudio();
  // Lecture de la timeline (morph des surfaces entre scènes).
  useTimelinePlayback();

  const resolution = useProjectStore((s) => s.project.resolution);
  const isFhd = resolution.width === 1920 && resolution.height === 1080;
  const performanceMode = useSceneStore((s) => s.performanceMode);

  return (
    <div className={`app${performanceMode ? ' is-performance' : ''}`}>
      <Toolbar />
      <div className="workspace">
        <aside className="sidebar">
          <SurfaceList />
          <WarpControls />
          <MaskPanel />
          <BlendPanel />
          <LayersPanel />
          <MediaLibrary />
          <GeneratorPanel />
          <AudioPanel />
          <DetectionPanel />
          <TimelinePanel />
          <div className="sidebar-foot">
            Projet · {resolution.width} × {resolution.height}
            {isFhd ? ' · FHD' : ''}
          </div>
        </aside>
        <main className="stage-area">
          <StageCanvas />
          <CueBar />
        </main>
      </div>
    </div>
  );
}
