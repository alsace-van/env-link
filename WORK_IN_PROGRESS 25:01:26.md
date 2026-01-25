# 📋 WORK IN PROGRESS - Van Project Buddy

**Dernière mise à jour:** 2025-01-25

---

## ✅ Tâches terminées

### 2025-01-25 - Grille fixe pour alignement (PhotoPreviewEditor v1.1.2)

**Demande:** La grille doit rester horizontale/verticale pendant que l'image tourne, pour servir de référence d'alignement.

**Solution:** Déplacer le code de dessin de la grille hors du contexte rotaté (`ctx.restore()` avant de dessiner la grille). La grille est maintenant basée sur le bounding box (qui reste fixe) au lieu de l'image (qui tourne).

**Fichier modifié:** `PhotoPreviewEditor.tsx` v1.1.1 → v1.1.2

---

### 2025-01-25 - Fix centre de rotation (PhotoPreviewEditor v1.1.1)

**Problème:** Quand on utilisait le slider de rotation, le centre de l'image se déplaçait au fur et à mesure.

**Cause:** Le bounding box de l'image change de taille selon l'angle de rotation, mais le viewport (offsetX, offsetY) restait fixe. Le centre visuel se déplaçait donc.

**Solution:** Ajouter un useEffect qui compense le changement de bounding box en ajustant le viewport pour garder le centre de l'image au même endroit:
```javascript
// Quand la rotation change, recalculer les offsets
const centerX = offsetX + (oldBoundingWidth * scale) / 2;
const centerY = offsetY + (oldBoundingHeight * scale) / 2;
// Nouveaux offsets pour garder le même centre
offsetX = centerX - (newBoundingWidth * scale) / 2;
offsetY = centerY - (newBoundingHeight * scale) / 2;
```

**Fichier modifié:** `PhotoPreviewEditor.tsx` v1.1.0 → v1.1.1

---

### 2025-01-25 - Rotation libre + Grille de cadrage (v1.1.0)

**Nouvelles fonctionnalités:**
1. **Rotation libre** (-180° à +180°)
   - Slider pour rotation continue
   - Input numérique pour valeur précise
   - Boutons d'incrément: ±0.1°, ±1°, ±90°
   - Bouton reset (remettre à 0°)
   - L'export tient compte de la rotation avec calcul du bounding box

2. **Grille de cadrage**
   - Sélecteur avec 5 options: Aucune, Règle des tiers, Grille 6×6, Croix centrale, Diagonales
   - Affichée sur l'image avec la rotation appliquée
   - Points d'intersection visibles pour la règle des tiers

**Fichiers modifiés:**
- `types.ts` v1.1.0: `rotation: number` (au lieu de 0|90|180|270), ajout `GridOverlayType`
- `usePhotoPreparation.ts` v1.1.0: Actions SET_ROTATION, prepareForExport avec rotation libre
- `PhotoPreviewEditor.tsx` v1.1.0: UI rotation, grille, rendu canvas avec rotation
- `PhotoPreparationModal.tsx` v1.1.0: Passage de setRotation au composant

---

### 2025-01-25 - Fix Stretch non pris en compte (usePhotoPreparation v1.0.2)

**Problème:** Quand on étirait une photo dans la modale de préparation (ex: de 945mm à 925mm) et qu'on l'importait dans le canvas, l'étirement n'était pas pris en compte.

**Cause:** Dans `prepareForExport()`, le `scale` retourné était le scale ArUco **original**.

**Solution:** Calculer le `scale` directement à partir des dimensions réelles du canvas exporté.

---

### 2025-01-25 - Fix Import Photos Préparées (v7.55a)

**Problème:** Images ~2.5× plus petites que prévu après import.

**Cause:** Coordonnées et scale non multipliés par `sketch.scaleFactor`.

**Solution:** Multiplier x, y, scale par `sketch.scaleFactor` dans handleImportPreparedPhotos.

---

## 🔄 Tâches en cours

*(Aucune)*

---

## 📝 Notes contextuelles

### Système de préparation photo (v1.1.2)

```
src/components/cad-gabarit/photo-preparation/
├── PhotoPreparationModal.tsx  # v1.1.0 - Modale principale
├── PhotoGridView.tsx          # Vue grille + détection doublons
├── PhotoPreviewEditor.tsx     # v1.1.2 - Éditeur rotation libre + grille fixe d'alignement
├── StretchHandles.tsx         # Poignées d'étirement
├── usePhotoPreparation.ts     # v1.1.0 - Hook principal (rotation libre)
├── useArucoDetection.ts       # Détection markers ArUco
├── useDuplicateDetection.ts   # Détection doublons par hash
├── types.ts                   # v1.1.0 - Types (rotation: number, GridOverlayType)
└── REFACTORING_PHOTO_PREPARATION.md
```

### Formules de rotation

Pour une rotation libre, le bounding box change:
```javascript
const radians = (rotation * Math.PI) / 180;
const cos = Math.abs(Math.cos(radians));
const sin = Math.abs(Math.sin(radians));
const boundingWidth = width * cos + height * sin;
const boundingHeight = width * sin + height * cos;
```

---

## 🔗 Fichiers liés

- `REFACTORING_PHOTO_PREPARATION.md` - Documentation du refactoring photo
- `CLAUDE_INSTRUCTIONS.md` - Règles de développement
