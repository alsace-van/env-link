# 📋 WORK IN PROGRESS - Van Project Buddy

**Dernière mise à jour:** 2025-01-28

---

## ✅ Tâches terminées

### 2025-01-28 - Cotation cercle + Fix TAB rectangle + Fix suppression v7.55h

**Problèmes résolus:**
1. **Cercle sans cotation** - Les cercles n'avaient pas de cotation automatique du rayon
2. **TAB dans rectangle** - Quand on appuyait sur TAB pour passer de largeur à hauteur, le focus allait dans la toolbar
3. **Cotations orphelines** - Quand on supprimait une figure, les cotations restaient affichées

**Solutions:**

**1. Cotation automatique des cercles:**
- Ajout de `addCircleDimension()` dans `useAutoDimensions.ts` v1.3
- Crée une dimension de type "radius" avec contrainte associée
- Appel lors de la création du cercle dans `CADGabaritCanvas.tsx`

**2. Fix TAB rectangle:**
- Ajout de `e.stopPropagation()` dans les handlers `onKeyDown` des inputs largeur/hauteur
- Empêche l'événement de se propager au navigateur
- Ajout `autoFocus` sur l'input largeur

**3. Modification de la cotation du cercle:**
- Extension de `findDimensionAtScreenPos()` pour gérer les dimensions "radius"
- Double-clic sur la cotation du cercle → input inline pour modifier le rayon
- Le rayon est mis à jour en temps réel ainsi que la dimension

**4. Fix suppression des cotations (v7.55h):**
- Dans `deleteSelectedEntities()`, ajout de la copie des dimensions
- Après suppression des figures, parcours des dimensions pour supprimer les orphelines
- Suppression automatique des contraintes associées

**Fichiers modifiés:**
- `useAutoDimensions.ts` v1.2 → v1.3: Ajout `addCircleDimension()`
- `CADGabaritCanvas.tsx` v7.55f → v7.55h: 
  - Cotation auto cercle
  - Fix TAB inputs
  - Focus auto input largeur
  - Support radius dans findDimensionAtScreenPos
  - Suppression des dimensions orphelines

---

### 2025-01-25 - FIX coordonnées avec skewX v1.2.2

**Problème:** Après correction de perspective, les points de mesure "décrochaient" - décalage entre le clic et l'emplacement du point.

**Cause:** Les fonctions de conversion de coordonnées (écran ↔ image) ne prenaient pas en compte le skewX.

**Solution:** Mettre à jour toutes les fonctions de conversion :
1. `screenToImage()` - conversion clic → coordonnées image (avec rotation inverse + skewX)
2. `imageToScreenWithRotation()` - conversion coordonnées image → écran (avec skewX)
3. Conversion des marqueurs ArUco (avec skewX)
4. Conversion du point en attente (pendingMeasurePoint) (avec skewX)

**Formule appliquée:**
```javascript
// Image → Screen : le stretchX local dépend de la position Y
const yRel = imgY / imgHeight; // 0 = haut, 1 = bas
const localStretchX = stretchX * (1 + skewX * (yRel - 0.5));

// Screen → Image : calculer Y d'abord, puis utiliser le skewX pour X
const imgY = (unrotatedY / (scale * stretchY)) + imgHeight / 2;
const yRel = imgY / imgHeight;
const localStretchX = stretchX * (1 + skewX * (yRel - 0.5));
const imgX = (unrotatedX / (scale * localStretchX)) + imgWidth / 2;
```

**Fichier modifié:** `PhotoPreviewEditor.tsx` v1.2.1 → v1.2.2

---

### 2025-01-25 - Vraie correction de perspective v1.2.1

**Problème:** La v1.2.0 appliquait un étirement uniforme (stretchX identique sur toute l'image), mais pour corriger un trapèze il faut un étirement différentiel.

**Solution:** Dessiner l'image par bandes horizontales, chaque bande ayant un étirement X différent basé sur sa position Y.

**Principe:**
```
skewX > 0 : le bas est plus large que le haut
skewX < 0 : le haut est plus large que le bas

Pour une position Y (0=haut, 1=bas):
localStretchX = stretchX * (1 + skewX * (yRel - 0.5))
```

**Algorithme de calcul du skewX:**
1. Prendre 2 mesures horizontales avec valeurs cibles
2. Trier par position Y (haut → bas)
3. Calculer skewX pour que les deux mesures deviennent égales après correction:
   ```javascript
   coefSkew = topMeasured * (topY - 0.5) - bottomMeasured * (bottomY - 0.5)
   skewX = (bottomMeasured - topMeasured) / coefSkew
   ```
4. Ajuster stretchX pour atteindre la valeur cible moyenne

**Fichiers modifiés:**
- `PhotoPreviewEditor.tsx` v1.2.1: Rendu par bandes + nouvel algorithme correction
- `usePhotoPreparation.ts` v1.2.1: Export avec skewX par bandes

---

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

### Système de préparation photo (v1.2.2)

```
src/components/cad-gabarit/photo-preparation/
├── PhotoPreparationModal.tsx  # v1.2.0 - Modale principale
├── PhotoGridView.tsx          # Vue grille + détection doublons
├── PhotoPreviewEditor.tsx     # v1.2.2 - Rotation + grille + correction perspective + FIX coords
├── StretchHandles.tsx         # Poignées d'étirement
├── usePhotoPreparation.ts     # v1.2.1 - Hook principal (export avec skewX)
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

### Correction de perspective (v1.2.1)

La correction de perspective utilise un cisaillement (skewX) pour corriger les trapèzes:

```javascript
// skewX > 0 : le bas est plus large que le haut
// skewX < 0 : le haut est plus large que le bas

// L'étirement varie linéairement selon Y:
// yRel = y / height (0 = haut, 1 = bas)
localStretchX = stretchX * (1 + skewX * (yRel - 0.5))

// Exemples avec skewX = 0.1, stretchX = 1.0:
// - En haut (y=0): localStretchX = 1.0 * (1 + 0.1 * -0.5) = 0.95
// - Au milieu (y=0.5): localStretchX = 1.0 * (1 + 0.1 * 0) = 1.0
// - En bas (y=1): localStretchX = 1.0 * (1 + 0.1 * 0.5) = 1.05
```

L'image est dessinée par bandes horizontales (80 en preview, 100 à l'export), chaque bande avec son propre étirement.

**Calcul automatique du skewX depuis 2 mesures:**
```javascript
// Avec 2 mesures horizontales à positions Y différentes:
coefSkew = topMeasured * (topY - 0.5) - bottomMeasured * (bottomY - 0.5)
skewX = (bottomMeasured - topMeasured) / coefSkew
```

---

## 🔗 Fichiers liés

- `REFACTORING_PHOTO_PREPARATION.md` - Documentation du refactoring photo
- `CLAUDE_INSTRUCTIONS.md` - Règles de développement
