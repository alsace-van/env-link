// ============================================
// NOUVEAU CODE (CORRIGÉ) - À COPIER-COLLER
// ============================================
// Fichier : src/components/ProjectForm.tsx
// Lignes : 189-263
// Action : Remplacer toute la fonction handleScannedData
// ============================================

const handleScannedData = (data: VehicleRegistrationData) => {
  console.log("📥 Données reçues du scanner OCR:", data);
  setScannedData(data);

  // ✅ VÉRIFIER QUE VEHICLES EST CHARGÉ
  if (vehicles.length === 0) {
    console.warn("⚠️  vehicles_catalog pas encore chargé, rechargement...");
    loadVehicles().then(() => {
      handleScannedData(data);
    });
    return;
  }

  // Fonction de normalisation ultra-tolérante
  const normalize = (str: string): string => {
    return str
      .normalize("NFD") // Décompose les caractères accentués
      .replace(/[\u0300-\u036f]/g, "") // Supprime les accents
      .replace(/[^a-z0-9]/gi, "") // Garde seulement lettres et chiffres
      .toUpperCase();
  };

  if (data.marque) {
    const marqueNormalized = normalize(data.marque);
    console.log("🔍 Recherche marque:", data.marque, "→ normalisé:", marqueNormalized);

    // ✅ CORRECTION : Extraire availableMarques MAINTENANT (pas au render)
    const currentAvailableMarques = Array.from(new Set(vehicles.map((v) => v.marque))).sort();
    console.log(`📊 ${currentAvailableMarques.length} marques disponibles:`, currentAvailableMarques);

    // Chercher avec différentes stratégies
    let foundMarque = currentAvailableMarques.find((m) => {
      const mNorm = normalize(m);
      console.log(`  🔎 Comparaison: "${m}" (${mNorm}) vs "${data.marque}" (${marqueNormalized})`);

      // Stratégie 1 : Match exact
      if (mNorm === marqueNormalized) {
        console.log(`    ✅ Match exact trouvé !`);
        return true;
      }

      // Stratégie 2 : L'un contient l'autre
      if (mNorm.includes(marqueNormalized) || marqueNormalized.includes(mNorm)) {
        console.log(`    ✅ Match partiel trouvé (inclusion) !`);
        return true;
      }

      // Stratégie 3 : Match partiel (au moins 80% de correspondance)
      const minLength = Math.min(mNorm.length, marqueNormalized.length);
      const maxLength = Math.max(mNorm.length, marqueNormalized.length);
      if (minLength / maxLength >= 0.8 && mNorm.startsWith(marqueNormalized.substring(0, 3))) {
        console.log(`    ✅ Match 80% trouvé !`);
        return true;
      }

      return false;
    });

    // Si pas trouvé, essayer avec juste les premiers caractères (PEUG → PEUGEOT)
    if (!foundMarque && marqueNormalized.length >= 4) {
      console.log(`  🔎 Tentative avec préfixe de 4 caractères: ${marqueNormalized.substring(0, 4)}`);
      foundMarque = currentAvailableMarques.find((m) => {
        const mNorm = normalize(m);
        const match = mNorm.startsWith(marqueNormalized.substring(0, 4));
        if (match) console.log(`    ✅ Match préfixe trouvé: ${m}`);
        return match;
      });
    }

    if (foundMarque) {
      console.log("✅✅✅ MARQUE TROUVÉE DANS LA BASE:", foundMarque);
      setSelectedMarque(foundMarque);

      // Essayer aussi de trouver le modèle
      if (data.denominationCommerciale) {
        const modeleNormalized = normalize(data.denominationCommerciale);
        console.log("🔍 Recherche modèle:", data.denominationCommerciale, "→ normalisé:", modeleNormalized);

        const availableModelesForMarque = vehicles
          .filter((v) => v.marque === foundMarque)
          .map((v) => v.modele);

        console.log(`📊 ${availableModelesForMarque.length} modèles pour ${foundMarque}:`, availableModelesForMarque);

        const foundModele = Array.from(new Set(availableModelesForMarque)).find((m) => {
          const mNorm = normalize(m);
          console.log(`  🔎 Comparaison modèle: "${m}" (${mNorm}) vs "${data.denominationCommerciale}" (${modeleNormalized})`);
          const match = mNorm.includes(modeleNormalized) || modeleNormalized.includes(mNorm);
          if (match) console.log(`    ✅ Match modèle trouvé !`);
          return match;
        });

        if (foundModele) {
          console.log("✅✅✅ MODÈLE TROUVÉ DANS LA BASE:", foundModele);
          setSelectedModele(foundModele);
          toast.success(`Marque et modèle trouvés : ${foundMarque} ${foundModele}`, {
            duration: 3000,
          });
        } else {
          console.log("❌ Modèle non trouvé, proposition de création");
          // Modèle non trouvé, proposer de le créer
          setNewModeleToCreate(data.denominationCommerciale);
          setShowCreateModeleDialog(true);
        }
      } else {
        toast.success(`Marque trouvée : ${foundMarque}. Sélectionnez le modèle manuellement.`, {
          duration: 4000,
        });
      }
    } else {
      // Marque non trouvée, proposer de la créer
      console.log("❌❌❌ MARQUE NON TROUVÉE:", data.marque);
      console.log("  Liste des marques dans vehicles:", currentAvailableMarques);
      setNewMarqueToCreate(data.marque);
      setShowCreateMarqueDialog(true);
    }
  }
};
