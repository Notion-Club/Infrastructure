import { Tree, Folder, File } from "notionclub-infra";

export const SelectedAndDefault = () => (
  <div style={{ width: 320 }}>
    <Tree initialExpandedItems={["module-6"]} initialSelectedId="v3">
      <Folder element="Module 6 — Bases de données" value="module-6">
        <File value="v1">Créer une base</File>
        <File value="v2">Vues et filtres</File>
        <File value="v3">Relations et rollups</File>
        <File value="v4" isSelectable={false}>
          Quiz final (verrouillé)
        </File>
      </Folder>
    </Tree>
  </div>
);
