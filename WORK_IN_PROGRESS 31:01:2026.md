# WORK IN PROGRESS - Van Project Buddy

## 📅 Dernière mise à jour: 2026-02-01 21:00

---

## ✅ TÂCHE TERMINÉE: DailyNotesCanvas v3.2a - Fix perte de focus inputs

### Problème
Dans l'outil Notes du calendrier (DailyNotesCanvas), les inputs (texte, checklist, liste, table, titre zone) perdaient le focus après 1-2 caractères tapés. L'utilisateur devait re-cliquer sur le champ à chaque fois.

### Cause racine
Le `useEffect` qui convertit les blocs en nodes ReactFlow (ligne ~4180) avait **22 dépendances**, dont 14 callbacks. Quand l'utilisateur tapait un caractère :

1. `onUpdate()` → `setBlocks()` met à jour l'état `blocks`
2. `blocks` change → 7+ callbacks sont recréés (car ils dépendent de `blocks` : `searchTasks`, `searchExpenses`, `sendToSidebarTask`, `sendToSidebarNote`, `moveBlockToDate`, etc.)
3. Le useEffect se déclenche (22 dépendances changées) → `setNodes(newNodes)` recrée TOUS les nodes ReactFlow
4. ReactFlow met à jour les composants → les champs Input/Textarea perdent le focus
5. Pour le bloc texte : le `onBlur` se déclenche en plus → sort du mode édition → le Textarea disparaît

**Cascade complète** : 1 caractère tapé → 22 dépendances changent → tous les nodes recréés → focus perdu

### Solution appliquée (3 corrections)

#### 1. Refs stables pour les callbacks (correction principale)
- Création d'un `stableCallbacksRef` qui stocke les 14 callbacks
- Les refs sont mises à jour à chaque render (synchrone, pas de re-render)
- Le useEffect utilise les refs au lieu des callbacks directs
- **Résultat** : dépendances réduites de 22 à 6 (`blocks`, `setNodes`, `globalUsedQuantities`, `suppliers`, `projects`, `projectId`)

#### 2. Protection anti-faux-blur (bloc texte + titre zone)
- `onBlur` avec `setTimeout(200ms)` au lieu d'un `setIsEditing(false)` immédiat
- `onFocus` annule le timer en attente via `clearTimeout`
- Si le blur est causé par un re-render ReactFlow, le `autoFocus` redonne le focus avant que le timer expire

#### 3. Suppression de `selectedBlockId` des dépendances
- `selectedBlockId` était dans les dépendances du useEffect mais pas utilisé dans le code
- Chaque clic sur un bloc déclenchait une recréation inutile de tous les nodes

### Fichiers modifiés
```
src/components/planning/DailyNotesCanvas.tsx  # v3.2a
```

### Détail des modifications par zone

| Ligne (approx) | Modification |
|---|---|
| 5 | Version 3.2 → 3.2a |
| 378-380 | Ajout `isEditingRef` + `blurTimeoutRef` dans CustomBlockNode |
| 412-426 | Remplacement `onBlur` texte par système `onFocus`/`onBlur` avec timer |
| 1685-1695 | Même fix pour le titre de zone (Input onBlur) |
| 2678-2696 | Déclaration `stableCallbacksRef` (14 callbacks typés) |
| 4207-4227 | Sync des refs avec les callbacks actuels (à chaque render) |
| 4229-4285 | useEffect nodes : utilise `cbs.xxx()` au lieu des callbacks directs |
| 4280-4285 | Dépendances réduites de 22 à 6 |

---

## 📝 Notes contexte (repris de la version précédente)

### Structure base de données
- `accessories_catalog`: 69 articles (pompes, vannes, réservoirs...)
- `project_expenses`: 179 lignes mixtes (accessoires + transactions bancaires)
  - Accessoires identifiés par `nom_accessoire` non NULL
  - `accessory_id` toujours NULL (pas de liaison FK)

### Architecture similaire à TechnicalCanvas
- Utilise ReactFlow pour le canvas
- Sauvegarde par projet avec `project_id`
- Fallback localStorage si Supabase échoue

### PlumbingCanvas v1.0e
- Catalogue fonctionne: 69 articles depuis `accessories_catalog`
- Devis fonctionne: 64 items depuis `project_expenses`
- Table Supabase créée: `plumbing_schemas`
- Intégration UI: Onglet "Circuit eau" dans ProjectDetail
