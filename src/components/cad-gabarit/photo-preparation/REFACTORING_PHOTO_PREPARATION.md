# 📷 Refactoring - Système de Préparation Photo

**Date de création :** 2025-01-23  
**Dernière mise à jour :** 2025-01-23  
**Statut :** 🟢 Terminé (Phase 1-7) - Prêt pour test

---

## 🎯 Objectif

Remplacer le système actuel de calibration/étirement (complexe et dispersé) par une **modale de préparation photo** simple et efficace, qui traite les photos **AVANT** leur import dans le canvas CAD.

---

## ❌ Problèmes de l'ancien système

| Composant | Problème |
|-----------|----------|
| `CalibrationPanel.tsx` | Trop complexe (122 props), 4 modes différents, UX confuse |
| `ManualStretchControls.tsx` | Redondant, indicateurs hors écran au zoom, mesures qui ne suivent pas l'image |
| `ArucoStitcher.tsx` | Assemblage jamais top, résultat à reprendre |
| Touches clavier | SHIFT+flèches trop fin (0.05%), % pas intuitif |
| Calibration | Ratio X-Y faisait des décalages de 10-20cm |

---

## ✅ Workflow utilisateur cible

### Sur le terrain
1. Ruban scotch bleu pour repérage dans l'espace
2. Marqueurs ArUco imprimés pour redimensionnement rapide
3. Max 4 photos par plancher, appareil en mode paysage, hauteur 1.50m minimum

### Dans l'application
1. **Import** → Vue grille avec détection doublons
2. **Préparation individuelle** → Rotation, Crop, ArUco auto, Mesure, Étirement
3. **Validation** → Import dans le canvas avec création d'un calque par photo

---

## 📁 Architecture des nouveaux fichiers

```
src/components/cad-gabarit/photo-preparation/
├── index.ts                      # Export principal
├── types.ts                      # Types spécifiques
├── PhotoPreparationModal.tsx     # Modale principale (orchestrateur)
├── PhotoGridView.tsx             # Vue grille + détection doublons
├── PhotoPreviewEditor.tsx        # Preview individuelle avec outils
├── MeasureOverlay.tsx            # Mesure 2 points (suit l'image en temps réel)
├── StretchHandles.tsx            # Poignées d'étirement (toujours visibles)
├── usePhotoPreparation.ts        # Hook principal (état, logique)
├── useArucoDetection.ts          # Hook détection ArUco (simplifié)
└── useDuplicateDetection.ts      # Hook détection doublons par hash
```

---

## 🖼️ Spécifications UI

### Étape 1 : Vue Grille
- Affichage en grille de toutes les photos importées
- Doublons détectés par hash, affichés en **surbrillance rouge**
- Bouton pour supprimer un doublon individuellement
- Bouton "Supprimer tous les doublons"
- Clic sur une photo → passe à l'étape 2

### Étape 2 : Preview individuelle
- Navigation **[←] [→]** entre les photos
- **Détection ArUco automatique** au chargement (redimensionnement initial)
- Barre d'outils : `[🔄 -90°] [🔄 +90°] [✂️ Crop] [📏 Mesurer]`
- **Poignées d'étirement** : 2 barres pour X (gauche/droite), 2 barres pour Y (haut/bas)
  - Fines et discrètes visuellement
  - **Toujours au moins une visible** quel que soit le zoom
  - Position fixée au viewport, pas à l'image
- **Système de mesure** : 
  - Clic pour placer 2 points
  - Points **suivent l'image** quand elle s'étire
  - Distance **recalculée en temps réel** pendant l'étirement
  - Possibilité de garder plusieurs mesures affichées
- **Champs de dimension** : input éditable pour X et Y en mm
  - Affichage du delta (ex: "Δ +2.7mm")
- Boutons : `[← Retour grille] [Passer] [Valider →]`

### Étape 3 : Résumé final
- Liste des photos avec statut (✅ validée, ⏭️ passée)
- Dimensions finales de chaque photo
- Bouton "Importer N photos dans le canvas"
- Création automatique d'un calque par photo

---

## ⌨️ Raccourcis clavier (dans la modale)

| Raccourci | Action | Incrément |
|-----------|--------|-----------|
| `←` `→` `↑` `↓` | Étirement | **1 mm** |
| `SHIFT + ←` `→` `↑` `↓` | Étirement fin | **0.1 mm** |
| `CTRL + ←` `→` `↑` `↓` | Étirement rapide | **5 mm** |
| `R` | Rotation +90° | - |
| `SHIFT + R` | Rotation -90° | - |
| `M` | Activer outil mesure | - |
| `Échap` | Annuler action en cours | - |

---

## 🔧 Spécifications techniques

### Détection ArUco
- **Garder** : Paramètres de détection actuels (fonctionnent bien)
- **Améliorer** : Calcul du scale X et Y séparé pour éviter les écarts de 10-20cm
- **Supprimer** : Rotation automatique (faisait n'importe quoi)
- **Supprimer** : Assemblage/stitching

### Poignées d'étirement
```typescript
// Position calculée par rapport au viewport
const handlePosition = {
  left: Math.max(MARGIN, imageLeftInViewport),
  right: Math.min(viewportWidth - MARGIN, imageRightInViewport),
  // Garantit qu'au moins une poignée est visible
};
```

### Mesures qui suivent l'image
```typescript
interface MeasurePoint {
  // Coordonnées en % de l'image (pas en pixels absolus)
  xPercent: number;
  yPercent: number;
}

// Quand l'image s'étire, les points restent au même % 
// → la distance en mm change proportionnellement
```

### Détection de doublons
```typescript
// Hash basé sur : taille fichier + premiers bytes + derniers bytes
// Rapide et suffisant pour détecter les vrais doublons
```

---

## 🗑️ Fichiers à supprimer

| Fichier | Raison |
|---------|--------|
| `CalibrationPanel.tsx` | Remplacé par nouveau système |
| `ManualStretchControls.tsx` | Remplacé par StretchHandles |
| `ArucoStitcher.tsx` | Stitching supprimé |
| `useCalibration.ts` | À simplifier fortement ou supprimer |
| `ImageCalibrationModal.tsx` | Remplacé par PhotoPreparationModal |

---

## ♻️ Code à réutiliser

| Source | Élément | Destination |
|--------|---------|-------------|
| `useOpenCVAruco.ts` | `detectMarkers()` | `useArucoDetection.ts` |
| `CADGabaritCanvas.tsx` | Système de crop (lignes 9618-9750) | `PhotoPreviewEditor.tsx` |
| `types.ts` | `BackgroundImage`, `ImageCrop` | `photo-preparation/types.ts` |

---

## 📋 Checklist d'implémentation

### Phase 1 : Structure de base
- [x] Créer le dossier `photo-preparation/`
- [x] Créer `types.ts` avec les nouveaux types
- [x] Créer `index.ts` pour les exports
- [x] Créer `usePhotoPreparation.ts` (état principal)

### Phase 2 : Vue Grille
- [x] Créer `useDuplicateDetection.ts`
- [x] Créer `PhotoGridView.tsx`
- [x] Implémenter détection doublons
- [x] Implémenter suppression

### Phase 3 : Preview individuelle
- [x] Créer `PhotoPreviewEditor.tsx`
- [x] Créer `useArucoDetection.ts` (simplifié)
- [x] Implémenter rotation -90°/+90°
- [x] Intégrer le système de mesure (intégré dans PhotoPreviewEditor)

### Phase 4 : Système de mesure
- [x] Créer `MeasureOverlay.tsx` (intégré dans PhotoPreviewEditor)
- [x] Points en coordonnées relatives (%)
- [x] Mise à jour en temps réel
- [x] Plusieurs mesures simultanées

### Phase 5 : Poignées d'étirement
- [x] Créer `StretchHandles.tsx`
- [x] Position fixée au viewport
- [x] Garantir visibilité au zoom
- [x] Feedback visuel pendant le drag

### Phase 6 : Modale principale
- [x] Créer `PhotoPreparationModal.tsx`
- [x] Orchestrer les 3 étapes
- [x] Navigation entre photos
- [x] Résumé final + import

### Phase 7 : Intégration
- [x] Ajouter bouton d'ouverture dans CADGabaritCanvas
- [x] Connecter l'import au système de calques
- [ ] Supprimer les anciens fichiers (reporté - garder pour rétrocompatibilité)

### Phase 8 : Nettoyage
- [ ] Nettoyer CADGabaritCanvas.tsx (imports, fonctions)
- [ ] Réduire le changelog à 3 versions
- [ ] Tester le workflow complet
- [ ] Mettre à jour WORK_IN_PROGRESS.md

---

## 📝 Notes de développement

*Section pour noter les décisions prises et problèmes rencontrés pendant le dev*

### 2025-01-23
- Décision : Pas de rotation automatique ArUco (trop de bugs)
- Décision : Incrément clavier en mm (pas en %) pour cohérence
- À vérifier : Le crop existant fonctionne-t-il avec transformedCanvas ?

### 2025-01-23 - Phase 1 terminée
- ✅ Créé `types.ts` avec tous les types nécessaires
- ✅ Créé `usePhotoPreparation.ts` avec le reducer et toutes les actions
- ✅ Créé `index.ts` pour les exports
- Incréments clavier définis : 1mm (normal), 0.1mm (SHIFT), 5mm (CTRL)
- Hash doublons basé sur : taille fichier + premiers bytes + derniers bytes
- Le hook gère : navigation, transformations, mesures, export

### 2025-01-23 - Phase 2 terminée
- ✅ Créé `useDuplicateDetection.ts` - regroupe les photos par hash
- ✅ Créé `PhotoGridView.tsx` - grille responsive avec drag & drop
- Doublons affichés en surbrillance rouge avec icône warning
- Bouton "Supprimer les doublons" global
- Affiche le nom de l'original pour chaque doublon
- Zone de drop pour ajouter des photos
- Badge avec compteur de doublons

### 2025-01-23 - Phase 3 terminée
- ✅ Créé `useArucoDetection.ts` - détection simplifiée, mêmes paramètres qu'avant
- ✅ Créé `PhotoPreviewEditor.tsx` - preview complète avec :
  - Rotation -90°/+90° (boutons + raccourci R)
  - Zoom molette + boutons
  - Pan avec drag
  - Système de mesure intégré (points qui suivent l'image)
  - Inputs pour dimensions X/Y en mm
  - Raccourcis clavier (flèches, SHIFT, CTRL)
  - Détection ArUco automatique au chargement
  - Panneau latéral avec tous les contrôles
- Décision : MeasureOverlay intégré directement dans PhotoPreviewEditor (plus simple)
- Note : Le crop sera ajouté plus tard si besoin (le système existant peut être réutilisé)

### 2025-01-23 - Phases 4, 5, 6 terminées
- ✅ Phase 4 : Mesures intégrées dans PhotoPreviewEditor (SVG overlay)
  - Points stockés en % de l'image
  - Recalcul automatique de la distance quand l'image s'étire
  - Bouton supprimer sur chaque mesure
  - Plusieurs mesures simultanées avec couleurs différentes
- ✅ Phase 5 : Créé `StretchHandles.tsx`
  - 4 barres (gauche, droite, haut, bas)
  - Position calculée pour rester visible même si image dépasse
  - Affichage du delta en mm pendant le drag
  - Labels X et Y avec dimensions actuelles
- ✅ Phase 6 : Créé `PhotoPreparationModal.tsx`
  - Orchestre les 3 étapes (grid → preview → summary)
  - SummaryView avec liste des photos et statuts
  - Bouton import qui appelle prepareForExport()
- Prochaine étape : Intégrer dans CADGabaritCanvas + nettoyer

### 2025-01-23 - Phase 7 terminée (Intégration)
- ✅ Ajouté import de PhotoPreparationModal dans CADGabaritCanvas.tsx
- ✅ Ajouté état `showPhotoPreparationModal`
- ✅ Ajouté fonction `handleImportPreparedPhotos` qui :
  - Crée un calque par photo importée
  - Positionne les photos en ligne (espacées de 50mm)
  - Utilise le scale de la photo préparée
  - Déclenche une sauvegarde automatique
- ✅ Ajouté option "Préparer photos..." dans le menu Importer (avec badge "Nouveau")
- ✅ Ajouté rendu de PhotoPreparationModal après ArucoStitcher
- ✅ Mis à jour le header : VERSION 7.55, changelog réduit à 3 versions
- Décision : Garder les anciens fichiers (CalibrationPanel, ManualStretch, ArucoStitcher) pour rétrocompatibilité

### 2025-01-25 - Corrections bugs import (v7.55a, v1.0.2)
- 🐛 **BUG 1**: Image importée ~2.5× plus petite que prévu
  - Cause : Coordonnées et scale non multipliés par `sketch.scaleFactor`
  - Fix : CADGabaritCanvas.tsx v7.55a - `handleImportPreparedPhotos` multiplie x, y, scale par sf
- 🐛 **BUG 2**: Stretch non pris en compte après import
  - Cause : `prepareForExport()` utilisait le scale ArUco original au lieu du scale du canvas
  - Fix : usePhotoPreparation.ts v1.0.2 - Calcul `scale = canvas.width / widthMm`
- ✅ Ajout de logs de debug dans prepareForExport pour faciliter le diagnostic
- ✅ Gestion correcte de la rotation + stretch (swap des dimensions mm)

---

## 🔗 Fichiers liés

- `WORK_IN_PROGRESS.md` (à mettre à jour)
- `CLAUDE_INSTRUCTIONS.md` (règles de dev)
