# 📋 WORK IN PROGRESS - Van Project Buddy

**Dernière mise à jour:** 2025-01-25

---

## ✅ Tâches terminées

### 2025-01-25 - Correction de perspective v1.2.0

**Fonctionnalité:** Corriger la déformation trapézoïdale des photos en utilisant les mesures existantes.

**Principe:**
1. Placer 2 mesures sur des longueurs qui devraient être identiques en réalité
2. Entrer la valeur réelle dans le champ "Réel" de chaque mesure
3. Cliquer sur "Corriger perspective" → l'étirement X/Y est ajusté automatiquement

**Fichiers modifiés:**
- `types.ts` v1.2.0: 
  - `Measurement.targetValueMm` (valeur cible)
  - `PhotoToProcess.skewX/skewY` (prêt pour correction avancée)
  - Actions `SET_SKEW`, `SET_MEASUREMENT_TARGET`
- `usePhotoPreparation.ts` v1.2.0: setSkew, setMeasurementTarget
- `PhotoPreviewEditor.tsx` v1.2.0: UI mesures avec input, bouton corriger
- `PhotoPreparationModal.tsx` v1.2.0: passage des nouvelles props

**Algorithme de correction:**
```javascript
// Pour chaque mesure avec valeur cible:
ratio = targetValueMm / measuredValueMm

// Si mesure horizontale (dx > dy*2) → correction X
// Si mesure verticale (dy > dx*2) → correction Y
// Si diagonale → correction X et Y

stretchX *= avgRatioX
stretchY *= avgRatioY
```

---

### 2025-01-25 - Grille de taille fixe (PhotoPreviewEditor v1.1.3)

**Problème:** Les cases de la grille grandissaient au fur et à mesure qu'on tournait l'image.

**Cause:** La grille était basée sur le **bounding box** (rectangle englobant) qui change de taille selon l'angle. Une image rectangulaire tournée à 45° a un bounding box carré plus grand.

**Solution:** Baser la grille sur les dimensions de l'image stretchée (`stretchedWidth × stretchedHeight`) au lieu du bounding box, et la centrer sur le centre de l'image:
```javascript
const gridWidth = stretchedWidth * scale;  // Taille fixe
const gridHeight = stretchedHeight * scale;
const gridLeft = centerX - gridWidth / 2;  // Centré sur l'image
const gridTop = centerY - gridHeight / 2;
```

**Fichier modifié:** `PhotoPreviewEditor.tsx` v1.1.2 → v1.1.3

---

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

### Système de préparation photo (v1.2.0)

```
src/components/cad-gabarit/photo-preparation/
├── PhotoPreparationModal.tsx  # v1.2.0 - Modale principale
├── PhotoGridView.tsx          # Vue grille + détection doublons
├── PhotoPreviewEditor.tsx     # v1.2.0 - Rotation libre + grille + correction perspective
├── StretchHandles.tsx         # Poignées d'étirement
├── usePhotoPreparation.ts     # v1.2.0 - Hook principal (setSkew, setMeasurementTarget)
├── useArucoDetection.ts       # Détection markers ArUco
├── useDuplicateDetection.ts   # Détection doublons par hash
├── types.ts                   # v1.2.0 - Types (targetValueMm, skewX/Y)
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

### Correction de perspective (v1.2.0)

La correction de perspective utilise les mesures avec valeur cible:
```javascript
// Ratio de correction
ratio = targetValueMm / measuredValueMm

// Déterminer l'axe de correction
if (dx > dy * 2) → mesure horizontale → stretchX *= ratio
if (dy > dx * 2) → mesure verticale → stretchY *= ratio
sinon → diagonale → stretchX *= ratio ET stretchY *= ratio
```

Le champ `skewX/skewY` est préparé pour une future correction par cisaillement (transformation affine) qui serait plus précise pour les trapèzes asymétriques.

---

## 🔗 Fichiers liés

- `REFACTORING_PHOTO_PREPARATION.md` - Documentation du refactoring photo
- `CLAUDE_INSTRUCTIONS.md` - Règles de développement
