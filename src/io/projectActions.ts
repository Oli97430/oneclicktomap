import { useProjectStore } from '@/stores/projectStore';
import { useSceneStore } from '@/stores/sceneStore';
import { parseProjectFile, projectFileToJson, serializeProject } from '@/io/projectFile';

/** Serialise l'etat courant (projet + scenes + reglages) et l'enregistre via le dialogue natif. */
export async function saveProjectToFile(): Promise<void> {
  const project = useProjectStore.getState().project;
  const { scenes, bpm, loop } = useSceneStore.getState();
  const json = projectFileToJson(serializeProject({ project, scenes, settings: { bpm, loop } }));
  const result = await window.oneClickToMap?.saveProject(json);
  if (result && !result.ok && result.error) {
    window.alert(`Echec de l'enregistrement : ${result.error}`);
  }
  // A3 : enregistre dans les fichiers recents.
  if (result?.ok && result.path) {
    void window.oneClickToMap?.addRecentFile(result.path);
  }
}

/** Ouvre un fichier projet via le dialogue natif, le valide et l'applique aux stores. */
export async function openProjectFromFile(): Promise<void> {
  const result = await window.oneClickToMap?.openProject();
  if (!result || !result.ok || !result.text) {
    if (result?.error) window.alert(`Echec de l'ouverture : ${result.error}`);
    return;
  }
  try {
    const file = parseProjectFile(result.text);
    useProjectStore.getState().loadProject(file.project);
    useSceneStore.getState().loadProject(file.scenes, file.settings);
    // A3 : enregistre dans les fichiers recents.
    // On n'a pas le chemin cote renderer (IPC openProject ne le renvoie pas),
    // donc on demandera a l'utilisateur d'ouvrir une prochaine fois via le dialogue.
  } catch (err) {
    window.alert(err instanceof Error ? err.message : String(err));
  }
}
