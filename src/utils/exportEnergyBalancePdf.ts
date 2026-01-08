// ============================================
// exportEnergyBalancePdf.ts
// Export PDF du bilan énergétique
// VERSION: 1.1 - Affiche capacité Ah/Wh pour batteries
// ============================================

import jsPDF from "jspdf";

interface ElectricalItem {
  id: string;
  nom_accessoire: string;
  type_electrique: string;
  quantite: number;
  puissance_watts?: number | null;
  puissance_charge_watts?: number | null;
  intensite_amperes?: number | null;
  capacite_ah?: number | null;
  temps_utilisation_heures?: number | null;
  temps_production_heures?: number | null;
  prix_unitaire?: number | null;
}

interface EnergyBalanceData {
  items: ElectricalItem[];
  projectName?: string;
}

// Catégoriser les items
const categorizeItems = (itemsList: ElectricalItem[]) => {
  const producers = itemsList.filter(
    (item) =>
      item.type_electrique === "producteur" || item.type_electrique === "chargeur" || item.type_electrique === "combi",
  );
  const consumers = itemsList.filter((item) => item.type_electrique === "consommateur");
  const storage = itemsList.filter((item) => item.type_electrique === "stockage");
  const converters = itemsList.filter(
    (item) => item.type_electrique === "convertisseur" || item.type_electrique === "combi",
  );
  return { producers, consumers, storage, converters };
};

// Calcul consommation totale
const calculateTotalConsumption = (itemsList: ElectricalItem[]) => {
  const consumers = itemsList.filter((item) => item.type_electrique === "consommateur");
  return consumers.reduce((total, item) => {
    const power = item.puissance_watts || 0;
    const usageTime = item.temps_utilisation_heures || 0;
    const quantity = item.quantite || 1;
    return total + power * usageTime * quantity;
  }, 0);
};

// Calcul production totale
const calculateTotalProduction = (itemsList: ElectricalItem[]) => {
  const producers = itemsList.filter(
    (item) =>
      item.type_electrique === "producteur" || item.type_electrique === "chargeur" || item.type_electrique === "combi",
  );
  return producers.reduce((total, item) => {
    const power = item.puissance_watts || item.puissance_charge_watts || 0;
    const productionTime = item.temps_production_heures || 0;
    const quantity = item.quantite || 1;
    return total + power * productionTime * quantity;
  }, 0);
};

// Calcul capacité batterie
const calculateBatteryCapacity = (itemsList: ElectricalItem[]) => {
  const storage = itemsList.filter((item) => item.type_electrique === "stockage");
  return storage.reduce((total, item) => {
    const capacityWh = (item.capacite_ah || 0) * 12.8;
    const quantity = item.quantite || 1;
    return total + capacityWh * quantity;
  }, 0);
};

// Calcul autonomie
const calculateRemainingAutonomy = (itemsList: ElectricalItem[]) => {
  const totalConsumption = calculateTotalConsumption(itemsList);
  const totalProduction = calculateTotalProduction(itemsList);
  const batteryCapacity = calculateBatteryCapacity(itemsList);
  const netConsumption = totalConsumption - totalProduction;
  if (netConsumption <= 0) return null;
  return batteryCapacity / netConsumption;
};

export const exportEnergyBalancePdf = (data: EnergyBalanceData) => {
  const { items, projectName } = data;
  const doc = new jsPDF();

  const { producers, consumers, storage, converters } = categorizeItems(items);
  const totalConsumption = calculateTotalConsumption(items);
  const totalProduction = calculateTotalProduction(items);
  const batteryCapacity = calculateBatteryCapacity(items);
  const netConsumption = totalConsumption - totalProduction;
  const autonomy = calculateRemainingAutonomy(items);

  let y = 20;
  const marginLeft = 20;
  const pageWidth = 210;

  // Titre
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("Bilan Énergétique", marginLeft, y);
  y += 8;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  if (projectName) {
    doc.text(`Projet: ${projectName}`, marginLeft, y);
    y += 5;
  }
  doc.text(
    `Généré le ${new Date().toLocaleDateString("fr-FR")} à ${new Date().toLocaleTimeString("fr-FR")}`,
    marginLeft,
    y,
  );
  y += 15;

  // Résumé
  doc.setTextColor(0);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Résumé", marginLeft, y);
  y += 8;

  // Cartes résumé
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");

  const cardWidth = 40;
  const cards = [
    {
      label: "Producteurs",
      value: producers.reduce((sum, item) => sum + item.quantite, 0),
      types: producers.length,
      color: [34, 197, 94],
    },
    {
      label: "Consommateurs",
      value: consumers.reduce((sum, item) => sum + item.quantite, 0),
      types: consumers.length,
      color: [239, 68, 68],
    },
    {
      label: "Stockage",
      value: storage.reduce((sum, item) => sum + item.quantite, 0),
      types: storage.length,
      color: [59, 130, 246],
    },
    {
      label: "Convertisseurs",
      value: converters.reduce((sum, item) => sum + item.quantite, 0),
      types: converters.length,
      color: [168, 85, 247],
    },
  ];

  cards.forEach((card, i) => {
    const x = marginLeft + i * (cardWidth + 5);
    doc.setFillColor(card.color[0], card.color[1], card.color[2]);
    doc.setDrawColor(card.color[0], card.color[1], card.color[2]);
    doc.roundedRect(x, y, cardWidth, 20, 2, 2, "S");
    doc.setTextColor(card.color[0], card.color[1], card.color[2]);
    doc.setFontSize(8);
    doc.text(card.label, x + 2, y + 5);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(String(card.value), x + 2, y + 13);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text(`${card.types} type${card.types > 1 ? "s" : ""}`, x + 2, y + 17);
  });

  y += 30;

  // Autonomie estimée
  doc.setTextColor(0);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Autonomie Estimée", marginLeft, y);
  y += 10;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");

  // Tableau autonomie
  const autonomyData = [
    { label: "Consommation quotidienne", value: `${totalConsumption.toFixed(1)} Wh/jour`, color: [239, 68, 68] },
    { label: "Production quotidienne", value: `${totalProduction.toFixed(1)} Wh/jour`, color: [34, 197, 94] },
    { label: "Capacité batterie", value: `${batteryCapacity.toFixed(1)} Wh`, color: [59, 130, 246] },
  ];

  autonomyData.forEach((item, i) => {
    const x = marginLeft + i * 60;
    doc.setTextColor(100);
    doc.setFontSize(8);
    doc.text(item.label, x, y);
    doc.setTextColor(item.color[0], item.color[1], item.color[2]);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(item.value, x, y + 6);
  });

  y += 15;

  doc.setTextColor(100);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(`Consommation nette: ${netConsumption.toFixed(1)} Wh/jour`, marginLeft, y);
  y += 8;

  doc.setTextColor(59, 130, 246);
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  if (autonomy !== null) {
    doc.text(`${autonomy.toFixed(1)} jours`, marginLeft, y);
  } else {
    doc.text("Autonomie infinie", marginLeft, y);
  }
  y += 15;

  // Fonction pour dessiner un tableau
  const drawTable = (
    title: string,
    tableItems: ElectricalItem[],
    timeField: "temps_production_heures" | "temps_utilisation_heures" | null,
    startY: number,
    isStorage: boolean = false,
  ): number => {
    if (tableItems.length === 0) return startY;

    // Vérifier si on a besoin d'une nouvelle page
    if (startY > 250) {
      doc.addPage();
      startY = 20;
    }

    doc.setTextColor(0);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(title, marginLeft, startY);
    startY += 8;

    // En-têtes
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100);

    const cols = [marginLeft, 90, 115, 145, 175];
    doc.text("Nom", cols[0], startY);
    doc.text("Qté", cols[1], startY);

    if (isStorage) {
      doc.text("Capacité", cols[2], startY);
      doc.text("Total", cols[3], startY);
    } else {
      doc.text("Puissance", cols[2], startY);
      if (timeField) {
        doc.text("Temps (h/24h)", cols[3], startY);
        doc.text("Total", cols[4], startY);
      }
    }
    startY += 5;

    // Ligne séparatrice
    doc.setDrawColor(200);
    doc.line(marginLeft, startY, pageWidth - marginLeft, startY);
    startY += 3;

    // Données
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0);

    tableItems.forEach((item) => {
      // Vérifier si on a besoin d'une nouvelle page
      if (startY > 280) {
        doc.addPage();
        startY = 20;
      }

      // Tronquer le nom si trop long
      let nom = item.nom_accessoire;
      if (nom.length > 45) {
        nom = nom.substring(0, 42) + "...";
      }

      doc.setFontSize(8);
      doc.text(nom, cols[0], startY);
      doc.text(String(item.quantite), cols[1], startY);

      if (isStorage) {
        // Pour les batteries : afficher capacité
        const capacityAh = item.capacite_ah || 0;
        const capacityWh = capacityAh * 12.8;
        const totalCapacity = capacityWh * item.quantite;

        doc.text(`${capacityAh} Ah`, cols[2], startY);
        doc.setTextColor(59, 130, 246); // Bleu
        doc.text(`${totalCapacity.toFixed(0)} Wh`, cols[3], startY);
        doc.setTextColor(0);
      } else {
        const power = item.puissance_watts || item.puissance_charge_watts || 0;
        doc.text(`${power} W`, cols[2], startY);

        if (timeField) {
          const time = item[timeField] || 0;
          const total = power * time * item.quantite;
          doc.text(String(time), cols[3], startY);
          doc.setTextColor(
            timeField === "temps_production_heures" ? 34 : 239,
            timeField === "temps_production_heures" ? 197 : 68,
            timeField === "temps_production_heures" ? 94 : 68,
          );
          doc.text(`${total.toFixed(1)} Wh/j`, cols[4], startY);
          doc.setTextColor(0);
        }
      }
      startY += 5;
    });

    startY += 5;
    return startY;
  };

  // Dessiner les tableaux
  y = drawTable("Sources d'énergie (producteurs + chargeurs + combis)", producers, "temps_production_heures", y, false);
  y = drawTable("Consommateurs d'énergie", consumers, "temps_utilisation_heures", y, false);
  y = drawTable("Systèmes de stockage", storage, null, y, true); // isStorage = true
  y = drawTable("Convertisseurs", converters, null, y, false);

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Page ${i}/${pageCount}`, pageWidth - 30, 290);
    doc.text("Van Project Builder - Bilan Énergétique", marginLeft, 290);
  }

  // Télécharger
  const filename = projectName
    ? `bilan-energetique-${projectName.replace(/\s+/g, "-").toLowerCase()}.pdf`
    : `bilan-energetique-${new Date().toISOString().split("T")[0]}.pdf`;

  doc.save(filename);
};
