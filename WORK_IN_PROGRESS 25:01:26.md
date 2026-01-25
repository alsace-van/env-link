# 📋 WORK IN PROGRESS - Van Project Buddy

**Dernière mise à jour:** 2025-01-25

---

## ✅ Tâches terminées

### 2025-01-25 - Fix Stretch non pris en compte (usePhotoPreparation v1.0.2)

**Problème:** Quand on étirait une photo dans la modale de préparation (ex: de 945mm à 925mm) et qu'on l'importait dans le canvas, l'étirement n'était pas pris en compte - l'image gardait ses dimensions originales.

**Cause:** Dans `prepareForExport()`, le `scale` retourné était le scale ArUco **original** (`photo.arucoScaleX`), qui ne tenait pas compte du stretch appliqué.

**Solution:** Calculer le `scale` directement à partir des dimensions réelles du canvas exporté:
```javascript
// AVANT (bug)
const scale = photo.arucoScaleX || stateRef.current.scaleFactor;

// APRÈS (corrigé)
const scaleX = canvas.width / widthMm;
const scaleY = canvas.height / heightMm;
const scale = (scaleX + scaleY) / 2;
```

**Fichier modifié:** `src/components/cad-gabarit/photo-preparation/usePhotoPreparation.ts`
- Fonction: `prepareForExport` 
- Version: 1.0.1 → 1.0.2
- Ajout de logs de debug pour faciliter le diagnostic

---

### 2025-01-25 - Fix Import Photos Préparées (v7.55a)

**Problème:** Après avoir préparé une photo (déformation/étirement) et l'avoir importée dans le canvas CAD, l'image apparaissait ~2.5× plus petite que prévu.

**Cause:** Dans `handleImportPreparedPhotos`, les coordonnées (x, y) et le scale étaient passés directement en mm, mais le système de coordonnées du canvas CAD utilise des "unités internes" où: `unités = mm × sketch.scaleFactor` (scaleFactor = 2.5 par défaut).

**Solution:** Multiplier les coordonnées et le scale par `sketch.scaleFactor`:
```javascript
// AVANT (bug)
x: xOffset + photo.widthMm / 2,
y: photo.heightMm / 2,
scale: 1 / photo.scale,

// APRÈS (corrigé)
const sf = sketch.scaleFactor;
x: (xOffset + photo.widthMm / 2) * sf,
y: (photo.heightMm / 2) * sf,
scale: (1 / photo.scale) * sf,
```

**Fichier modifié:** `src/components/cad-gabarit/CADGabaritCanvas.tsx`
- Fonction: `handleImportPreparedPhotos` (ligne ~5776)
- Version: 7.55 → 7.55a

---

## 🔄 Tâches en cours

*(Aucune)*

---

## 📝 Notes contextuelles

### Système de préparation photo (v7.55)

Le nouveau système de préparation photo est situé dans:
```
src/components/cad-gabarit/photo-preparation/
├── PhotoPreparationModal.tsx  # Modale principale
├── PhotoGridView.tsx          # Vue grille + détection doublons
├── PhotoPreviewEditor.tsx     # Éditeur avec rotation/mesure/stretch
├── StretchHandles.tsx         # Poignées d'étirement
├── usePhotoPreparation.ts     # Hook principal (état, logique)
├── useArucoDetection.ts       # Détection markers ArUco
├── useDuplicateDetection.ts   # Détection doublons par hash
├── types.ts                   # Types TypeScript
└── REFACTORING_PHOTO_PREPARATION.md  # Documentation détaillée
```

### Unités et scales dans le canvas CAD

- `sketch.scaleFactor` = px/mm (défaut: 2.5)
- `photo.scale` (depuis ArUco ou calculé) = px/mm du canvas exporté
- `BackgroundImage.scale` = unités sketch / px = (mm/px) × scaleFactor

Pour convertir des mm en unités sketch: `unités = mm × sketch.scaleFactor`

### Calcul du scale après stretch

Le scale doit être calculé à partir des dimensions réelles du canvas exporté:
- `scale = canvas.width / widthMm` (px/mm)
- Ce scale tient compte du stretch ET de la rotation

---

## 🔗 Fichiers liés

- `REFACTORING_PHOTO_PREPARATION.md` - Documentation du refactoring photo
- `CLAUDE_INSTRUCTIONS.md` - Règles de développement
