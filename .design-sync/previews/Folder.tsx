import { Tree, Folder, File } from "notionclub-infra";

export const ExpandedFolder = () => (
  <div style={{ width: 320 }}>
    <Tree initialExpandedItems={["module-6"]}>
      <Folder element="Module 6 — Bases de données" value="module-6">
        <File value="v1">Créer une base</File>
        <File value="v2">Vues et filtres</File>
        <File value="v3">Relations et rollups</File>
      </Folder>
    </Tree>
  </div>
);

export const NestedFolders = () => (
  <div style={{ width: 320 }}>
    <Tree initialExpandedItems={["formation", "module-5"]}>
      <Folder element="Formation Notion" value="formation">
        <Folder element="Module 5 — Automatisations" value="module-5">
          <File value="a1">Introduction aux boutons</File>
          <File value="a2">Déclencheurs et formules</File>
        </Folder>
        <Folder element="Module 7 — Verrouillé" value="module-7" isSelectable={false}>
          <File value="b1">À venir</File>
        </Folder>
      </Folder>
    </Tree>
  </div>
);
