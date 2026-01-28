# WORK IN PROGRESS - Van Project Buddy

## 📅 Dernière mise à jour: 2025-01-28 23:50

---

## ✅ TÂCHE TERMINÉE: PlumbingCanvas v1.0e - Intégration complète

### Statut actuel
- ✅ **Catalogue fonctionne**: 69 articles chargés depuis `accessories_catalog`
- ✅ **Devis fonctionne**: 64 items chargés depuis `project_expenses`
- ✅ **Table Supabase créée**: `plumbing_schemas`
- ✅ **Intégration UI**: Onglet "Circuit eau" dans ProjectDetail

### Fichiers créés
```
src/components/plumbing/
├── types.ts                    # Types, constantes, éléments prédéfinis
├── usePlumbingState.ts         # Hook gestion état nodes/edges + historique
├── usePlumbingSave.ts          # v1.0a - Hook sauvegarde (fix 406)
├── usePlumbingCatalog.ts       # v1.0e - Hook catalogue/devis
├── PlumbingNode.tsx            # Composant node ReactFlow
├── PlumbingEdge.tsx            # Composant edge (tuyaux/câbles)
├── PlumbingToolbar.tsx         # Barre d'outils
├── PlumbingPropertiesPanel.tsx # Panneau propriétés
├── PlumbingCanvas.tsx          # Composant principal
└── index.ts                    # Exports

sql/
└── plumbing_schemas.sql        # Table Supabase ✅ EXÉCUTÉ
```

### Fichiers modifiés
```
src/pages/ProjectDetail.tsx     # v3.9 - Ajout onglet "Circuit eau"
```

### Historique debug catalogue/devis

#### Problème initial
- La table `project_accessories` n'existe pas
- Le champ `accessory_id` est NULL pour toutes les lignes dans `project_expenses`

#### Solution (v1.0e)
Utiliser `project_expenses` avec `nom_accessoire` au lieu d'une jointure sur `accessory_id`:
```typescript
const { data, error } = await supabase
  .from("project_expenses")
  .select("id, nom_accessoire, description, quantite, prix_vente_ttc, prix_unitaire")
  .eq("project_id", projectId)
  .not("nom_accessoire", "is", null);
```

#### Résultat console
```
[PlumbingCatalog v1.0e] 69 articles catalogue chargés
[PlumbingCatalog v1.0e] project_expenses trouvés: 64
[PlumbingCatalog v1.0e] QuoteItems finaux: 64
```

### Spécifications techniques

#### Connexions eau (traits ÉPAIS 6px)
- Eau froide: `#60A5FA` (bleu clair)
- Eau chaude: `#F87171` (rouge clair)
- Eau usée: `#9CA3AF` (gris clair)

#### Connexions électriques (traits fins 2px)
- 12V +: `#DC2626` (rouge)
- 12V -: `#171717` (noir)
- 230V Phase L: `#92400E` (marron)
- 230V Neutre N: `#1D4ED8` (bleu)
- 230V Terre PE: `#84CC16` (jaune/vert)

### Features implémentées
- ✅ Drag & drop éléments prédéfinis
- ✅ Connexions automatiques eau/électrique
- ✅ Panneau propriétés éditable
- ✅ Calculs automatiques (capacité totale, puissance)
- ✅ Import depuis catalogue Supabase
- ✅ Export vers devis projet
- ✅ Sauvegarde auto (3s debounce)
- ✅ Historique undo/redo
- ✅ Export JSON
- ✅ Raccourcis clavier (Ctrl+S, Ctrl+Z, Ctrl+D, Delete)
- ✅ Intégration dans ProjectDetail.tsx (onglet "Circuit eau")

---

## 📝 Notes contexte

### Structure base de données
- `accessories_catalog`: 69 articles (pompes, vannes, réservoirs...)
- `project_expenses`: 179 lignes mixtes (accessoires + transactions bancaires)
  - Accessoires identifiés par `nom_accessoire` non NULL
  - `accessory_id` toujours NULL (pas de liaison FK)

### Architecture similaire à TechnicalCanvas
- Utilise ReactFlow pour le canvas
- Sauvegarde par projet avec `project_id`
- Fallback localStorage si Supabase échoue 
