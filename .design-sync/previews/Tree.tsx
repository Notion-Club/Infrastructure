import { Tree, Folder, File } from "notionclub-infra";

export const FormationTree = () => (
  <div style={{ width: 320 }}>
    <Tree
      initialExpandedItems={["formation", "module-6"]}
      initialSelectedId="video-3"
    >
      <Folder element="Formation Notion" value="formation">
        <Folder element="Module 5 — Automatisations" value="module-5">
          <File value="video-1">Introduction aux boutons</File>
          <File value="video-2">Déclencheurs et formules</File>
        </Folder>
        <Folder element="Module 6 — Bases de données" value="module-6">
          <File value="video-1b">Créer une base</File>
          <File value="video-2b">Vues et filtres</File>
          <File value="video-3">Relations et rollups</File>
        </Folder>
        <File value="ressources">Ressources PDF</File>
      </Folder>
    </Tree>
  </div>
);

export const Collapsed = () => (
  <div style={{ width: 320 }}>
    <Tree>
      <Folder element="Espace communauté" value="communaute">
        <File value="c1">Charte des membres</File>
        <File value="c2">Annuaire</File>
      </Folder>
      <Folder element="Coaching" value="coaching">
        <File value="co1">Prochains appels</File>
      </Folder>
      <File value="cgv">Conditions générales</File>
    </Tree>
  </div>
);
