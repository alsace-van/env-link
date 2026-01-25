# 📋 Work In Progress - VPB

**Dernière mise à jour:** 2025-01-24

---

## 🔧 Session du 24/01/2025 - Fix module photo-preparation

### Contexte
Le module `photo-preparation` (créé le 23/01) avait plusieurs bugs après le refactoring majeur :
1. L'image devenait minuscule (16% de zoom) après une fraction de seconde
2. Les marqueurs ArUco étaient détectés mais pas affichés visuellement
3. Les données ArUco n'étaient pas propagées au state principal

### Bugs identifiés et corrigés

#### Bug 1: Zoom qui devient minuscule
**Cause:** Le `fitToView()` se redéclenchait après la détection ArUco car `photo.image` dans les dépendances du useEffect était une nouvelle référence à chaque re-render.

**Solution:**
- Utilisation d'une `imageRef` stable au lieu de `photo.image` dans les dépendances
- Ajout d'un garde minimum de 5% pour le zoom
- Utilisation de `fitDoneForPhotoRef` pour tracker si le fit a été fait pour chaque photo
- Vérification que le container a des dimensions valides (>100px)

**Fichier:** `PhotoPreviewEditor.tsx` v1.0.0 → v1.0.1

#### Bug 2: handleUpdatePhoto ne faisait rien
**Cause:** La fonction `handleUpdatePhoto` dans `PhotoPreparationModal.tsx` était vide - elle ne propagait pas les résultats ArUco au state.

**Solution:**
- Ajout de la fonction `setArucoResult` dans le hook `usePhotoPreparation`
- Export de `setArucoResult` dans le return du hook
- Utilisation de `setArucoResult` dans `handleUpdatePhoto`

**Fichiers:**
- `usePhotoPreparation.ts` v1.0.0 → v1.0.1
- `PhotoPreparationModal.tsx` v1.0.0 → v1.0.1

#### Bug 3: Marqueurs ArUco non affichés
**Cause:** Il n'y avait aucun code pour afficher visuellement les marqueurs détectés.

**Solution:**
- Ajout d'un état `detectedMarkers` pour stocker les marqueurs
- Création de la fonction `renderArucoMarkers()` qui dessine :
  - Contour vert semi-transparent du marqueur
  - Points aux coins (premier coin en rouge, autres en vert)
  - Label avec l'ID du marqueur au centre
- Appel de `renderArucoMarkers()` dans le JSX entre l'image et les mesures

**Fichier:** `PhotoPreviewEditor.tsx` v1.0.1

### Fichiers modifiés

| Fichier | Version | Modifications |
|---------|---------|---------------|
| `PhotoPreviewEditor.tsx` | 1.0.0 → 1.0.1 | Fix zoom + affichage ArUco |
| `usePhotoPreparation.ts` | 1.0.0 → 1.0.1 | Ajout setArucoResult |
| `PhotoPreparationModal.tsx` | 1.0.0 → 1.0.1 | Fix handleUpdatePhoto |

### À tester
- [ ] Import d'une photo → l'image doit s'afficher à une taille raisonnable
- [ ] Détection ArUco → les marqueurs doivent s'afficher en vert
- [ ] Zoom/Pan → les marqueurs doivent suivre l'image
- [ ] Validation → les données doivent être correctement exportées

---

## 📁 Architecture photo-preparation

```
src/components/cad-gabarit/photo-preparation/
├── index.ts                      # Export principal
├── types.ts                      # Types spécifiques
├── PhotoPreparationModal.tsx     # Modale principale (v1.0.1)
├── PhotoGridView.tsx             # Vue grille + détection doublons
├── PhotoPreviewEditor.tsx        # Preview avec outils (v1.0.1)
├── StretchHandles.tsx            # Poignées d'étirement
├── usePhotoPreparation.ts        # Hook principal (v1.0.1)
└── REFACTORING_PHOTO_PREPARATION.md # Documentation du refactoring
```

---

## 🔗 Notes techniques

### Détection ArUco
- Taille marqueur configurée: 50mm
- Dictionnaire: DICT_4X4_50
- Version détecteur: v20 (useOpenCVAruco.ts)
- Scale X et Y calculés séparément pour chaque axe

### Dimensions affichées
- Si ArUco détecté: utilise `arucoScaleX` et `arucoScaleY` (px/mm)
- Sinon: utilise `scaleFactor` global (défaut = 1, donc en pixels)
