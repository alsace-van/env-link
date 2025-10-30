import { useState, useEffect } from "react";

interface City {
  nom: string;
  code: string;
  codesPostaux: string[];
  codeDepartement: string;
}

export const useAddressAutocomplete = () => {
  const [cities, setCities] = useState<City[]>([]);
  const [loading, setLoading] = useState(false);

  // Recherche par code postal
  const searchByPostalCode = async (postalCode: string) => {
    if (!postalCode || postalCode.length < 2) {
      setCities([]);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `https://geo.api.gouv.fr/communes?codePostal=${postalCode}&fields=nom,code,codesPostaux,codeDepartement&format=json&geometry=centre`
      );
      const data = await response.json();
      setCities(data);
    } catch (error) {
      console.error("Erreur lors de la recherche par code postal:", error);
      setCities([]);
    } finally {
      setLoading(false);
    }
  };

  // Recherche par nom de ville
  const searchByCity = async (cityName: string) => {
    if (!cityName || cityName.length < 2) {
      setCities([]);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `https://geo.api.gouv.fr/communes?nom=${encodeURIComponent(cityName)}&fields=nom,code,codesPostaux,codeDepartement&format=json&geometry=centre&limit=10`
      );
      const data = await response.json();
      setCities(data);
    } catch (error) {
      console.error("Erreur lors de la recherche par ville:", error);
      setCities([]);
    } finally {
      setLoading(false);
    }
  };

  // Réinitialiser les résultats
  const reset = () => {
    setCities([]);
  };

  return {
    cities,
    loading,
    searchByPostalCode,
    searchByCity,
    reset,
  };
};
