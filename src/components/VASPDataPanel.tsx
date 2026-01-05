// ============================================
// COMPOSANT: VASPDataPanel
// Panneau de données VASP M1 pour répartition des charges
// VERSION: 1.0
// DATE: 2026-01-05
// ============================================

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  Car,
  Gauge,
  Armchair,
  Package,
  Droplets,
  Flame,
  Calculator,
  Save,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import {
  VASPRangeeSiege,
  VASPCoffre,
  VASPReservoirEau,
  VASPReservoirGaz,
  DENSITES_LIQUIDES,
  MASSE_OCCUPANT_KG,
  calculerMasseCarburantManquante,
  calculerMasseOrdreMarche,
  calculerChargeUtile,
  calculerRepartitionAvant,
} from "@/types/vasp";

interface VASPDataPanelProps {
  projectId: string;
  projectData: any;
  onDataChange?: (data: any) => void;
  onRangeeSiegeChange?: (rangees: VASPRangeeSiege[]) => void;
  onCoffreChange?: (coffres: VASPCoffre[]) => void;
}

export const VASPDataPanel = ({
  projectId,
  projectData,
  onDataChange,
  onRangeeSiegeChange,
  onCoffreChange,
}: VASPDataPanelProps) => {
  // États pour les sections ouvertes/fermées
  const [openSections, setOpenSections] = useState({
    coc: true,
    pesee: true,
    reservoirs: false,
    sieges: true,
    coffres: true,
    eau: false,
    gaz: false,
    calculs: true,
  });

  // États pour les données
  const [donneesCOC, setDonneesCOC] = useState({
    mmta_kg: projectData?.mmta_kg || "",
    mmta_essieu_av_kg: projectData?.mmta_essieu_av_kg || "",
    mmta_essieu_ar_kg: projectData?.mmta_essieu_ar_kg || "",
    empattement_mm: projectData?.empattement_mm || "",
    charge_attelage_s_kg: projectData?.charge_attelage_s_kg || "",
    porte_a_faux_avant_mm: projectData?.porte_a_faux_avant_mm || "",
    porte_a_faux_arriere_mm: projectData?.porte_a_faux_arriere_mm || "",
  });

  const [donneesPesee, setDonneesPesee] = useState({
    pesee_essieu_av_kg: projectData?.pesee_essieu_av_kg || "",
    pesee_essieu_ar_kg: projectData?.pesee_essieu_ar_kg || "",
  });

  const [donneesReservoirs, setDonneesReservoirs] = useState({
    reservoir_carburant_litres: projectData?.reservoir_carburant_litres || "",
    reservoir_carburant_distance_av_mm: projectData?.reservoir_carburant_distance_av_mm || "",
    reservoir_carburant_taux_remplissage: projectData?.reservoir_carburant_taux_remplissage || 100,
    reservoir_gpl_litres: projectData?.reservoir_gpl_litres || "",
    reservoir_gpl_distance_av_mm: projectData?.reservoir_gpl_distance_av_mm || "",
    reservoir_gpl_taux_remplissage: projectData?.reservoir_gpl_taux_remplissage || 100,
    reservoir_adblue_litres: projectData?.reservoir_adblue_litres || "",
    reservoir_adblue_distance_av_mm: projectData?.reservoir_adblue_distance_av_mm || "",
    reservoir_adblue_taux_remplissage: projectData?.reservoir_adblue_taux_remplissage || 100,
  });

  const [rangeesSieges, setRangeesSieges] = useState<VASPRangeeSiege[]>(
    projectData?.vasp_rangees_sieges || [{ id: "rang-1", nom: "Rangée 1", distance_av_mm: 0, nb_occupants: 1 }],
  );

  const [coffres, setCoffres] = useState<VASPCoffre[]>(projectData?.vasp_coffres || []);

  const [reservoirsEau, setReservoirsEau] = useState<VASPReservoirEau[]>(projectData?.vasp_reservoirs_eau || []);

  const [reservoirGaz, setReservoirGaz] = useState<VASPReservoirGaz | null>(projectData?.vasp_reservoir_gaz || null);

  const [isSaving, setIsSaving] = useState(false);

  // Calculs automatiques
  const calculs = useCallback(() => {
    const peseeAv = Number(donneesPesee.pesee_essieu_av_kg) || 0;
    const peseeAr = Number(donneesPesee.pesee_essieu_ar_kg) || 0;
    const ptac = Number(projectData?.ptac_kg) || Number(donneesCOC.mmta_kg) || 0;
    const nombrePlaces =
      Number(projectData?.nombre_places) || rangeesSieges.reduce((sum, r) => sum + r.nb_occupants, 0);
    const chargeAttelage = Number(donneesCOC.charge_attelage_s_kg) || 0;

    // Masses manquantes liquides
    const masseCarburantManquante = calculerMasseCarburantManquante(
      Number(donneesReservoirs.reservoir_carburant_litres) || 0,
      Number(donneesReservoirs.reservoir_carburant_taux_remplissage) || 100,
      DENSITES_LIQUIDES.diesel,
    );

    const masseGplManquante = calculerMasseCarburantManquante(
      Number(donneesReservoirs.reservoir_gpl_litres) || 0,
      Number(donneesReservoirs.reservoir_gpl_taux_remplissage) || 100,
      DENSITES_LIQUIDES.gpl,
    );

    const masseAdblueManquante = calculerMasseCarburantManquante(
      Number(donneesReservoirs.reservoir_adblue_litres) || 0,
      Number(donneesReservoirs.reservoir_adblue_taux_remplissage) || 100,
      DENSITES_LIQUIDES.adblue,
    );

    const masseOrdreMarche = calculerMasseOrdreMarche(
      peseeAv,
      peseeAr,
      masseCarburantManquante,
      masseGplManquante,
      masseAdblueManquante,
    );

    const chargeUtile = calculerChargeUtile(ptac, masseOrdreMarche, nombrePlaces, chargeAttelage);
    const repartitionAvant = calculerRepartitionAvant(peseeAv, peseeAr);

    return {
      masseCarburantManquante: masseCarburantManquante.toFixed(2),
      masseGplManquante: masseGplManquante.toFixed(2),
      masseAdblueManquante: masseAdblueManquante.toFixed(2),
      masseOrdreMarche: masseOrdreMarche.toFixed(2),
      chargeUtile: chargeUtile.toFixed(2),
      repartitionAvant: repartitionAvant.toFixed(1),
      masseTotalePesee: (peseeAv + peseeAr).toFixed(0),
    };
  }, [donneesPesee, donneesReservoirs, donneesCOC, projectData, rangeesSieges]);

  const resultatsCalculs = calculs();

  // Notifier les changements de rangées
  useEffect(() => {
    onRangeeSiegeChange?.(rangeesSieges);
  }, [rangeesSieges, onRangeeSiegeChange]);

  // Notifier les changements de coffres
  useEffect(() => {
    onCoffreChange?.(coffres);
  }, [coffres, onCoffreChange]);

  // Toggle section
  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  // Ajouter une rangée de sièges
  const ajouterRangeeSiege = () => {
    const newId = `rang-${Date.now()}`;
    const newRangee: VASPRangeeSiege = {
      id: newId,
      nom: `Rangée ${rangeesSieges.length + 1}`,
      distance_av_mm: 0,
      nb_occupants: 0,
    };
    setRangeesSieges([...rangeesSieges, newRangee]);
  };

  // Supprimer une rangée de sièges
  const supprimerRangeeSiege = (id: string) => {
    if (rangeesSieges.length <= 1) {
      toast.error("Il doit y avoir au moins une rangée de sièges");
      return;
    }
    setRangeesSieges(rangeesSieges.filter((r) => r.id !== id));
  };

  // Mettre à jour une rangée de sièges
  const updateRangeeSiege = (id: string, field: keyof VASPRangeeSiege, value: any) => {
    setRangeesSieges(
      rangeesSieges.map((r) => (r.id === id ? { ...r, [field]: field === "nom" ? value : Number(value) || 0 } : r)),
    );
  };

  // Ajouter un coffre
  const ajouterCoffre = () => {
    const newId = `coffre-${Date.now()}`;
    const newCoffre: VASPCoffre = {
      id: newId,
      nom: `Coffre ${coffres.length + 1}`,
      distance_av_mm: 0,
      masse_kg: 0,
    };
    setCoffres([...coffres, newCoffre]);
  };

  // Supprimer un coffre
  const supprimerCoffre = (id: string) => {
    setCoffres(coffres.filter((c) => c.id !== id));
  };

  // Mettre à jour un coffre
  const updateCoffre = (id: string, field: keyof VASPCoffre, value: any) => {
    setCoffres(coffres.map((c) => (c.id === id ? { ...c, [field]: field === "nom" ? value : Number(value) || 0 } : c)));
  };

  // Ajouter un réservoir d'eau
  const ajouterReservoirEau = () => {
    const newId = `eau-${Date.now()}`;
    const newReservoir: VASPReservoirEau = {
      id: newId,
      nom: reservoirsEau.length === 0 ? "Eau propre" : `Réservoir ${reservoirsEau.length + 1}`,
      distance_av_mm: 0,
      masse_kg: 0,
    };
    setReservoirsEau([...reservoirsEau, newReservoir]);
  };

  // Supprimer un réservoir d'eau
  const supprimerReservoirEau = (id: string) => {
    setReservoirsEau(reservoirsEau.filter((r) => r.id !== id));
  };

  // Mettre à jour un réservoir d'eau
  const updateReservoirEau = (id: string, field: keyof VASPReservoirEau, value: any) => {
    setReservoirsEau(
      reservoirsEau.map((r) => (r.id === id ? { ...r, [field]: field === "nom" ? value : Number(value) || 0 } : r)),
    );
  };

  // Sauvegarder les données
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("projects")
        .update({
          // Données COC
          mmta_kg: Number(donneesCOC.mmta_kg) || null,
          mmta_essieu_av_kg: Number(donneesCOC.mmta_essieu_av_kg) || null,
          mmta_essieu_ar_kg: Number(donneesCOC.mmta_essieu_ar_kg) || null,
          empattement_mm: Number(donneesCOC.empattement_mm) || null,
          charge_attelage_s_kg: Number(donneesCOC.charge_attelage_s_kg) || null,
          porte_a_faux_avant_mm: Number(donneesCOC.porte_a_faux_avant_mm) || null,
          porte_a_faux_arriere_mm: Number(donneesCOC.porte_a_faux_arriere_mm) || null,
          // Pesée
          pesee_essieu_av_kg: Number(donneesPesee.pesee_essieu_av_kg) || null,
          pesee_essieu_ar_kg: Number(donneesPesee.pesee_essieu_ar_kg) || null,
          // Réservoirs
          reservoir_carburant_litres: Number(donneesReservoirs.reservoir_carburant_litres) || null,
          reservoir_carburant_distance_av_mm: Number(donneesReservoirs.reservoir_carburant_distance_av_mm) || null,
          reservoir_carburant_taux_remplissage: Number(donneesReservoirs.reservoir_carburant_taux_remplissage) || null,
          reservoir_gpl_litres: Number(donneesReservoirs.reservoir_gpl_litres) || null,
          reservoir_gpl_distance_av_mm: Number(donneesReservoirs.reservoir_gpl_distance_av_mm) || null,
          reservoir_gpl_taux_remplissage: Number(donneesReservoirs.reservoir_gpl_taux_remplissage) || null,
          reservoir_adblue_litres: Number(donneesReservoirs.reservoir_adblue_litres) || null,
          reservoir_adblue_distance_av_mm: Number(donneesReservoirs.reservoir_adblue_distance_av_mm) || null,
          reservoir_adblue_taux_remplissage: Number(donneesReservoirs.reservoir_adblue_taux_remplissage) || null,
          // Données VASP JSON (cast vers Json pour Supabase)
          vasp_rangees_sieges: rangeesSieges as unknown as Json,
          vasp_coffres: coffres as unknown as Json,
          vasp_reservoirs_eau: reservoirsEau as unknown as Json,
          vasp_reservoir_gaz: reservoirGaz as unknown as Json,
        })
        .eq("id", projectId);

      if (error) throw error;

      toast.success("Données VASP sauvegardées");
      onDataChange?.({
        ...donneesCOC,
        ...donneesPesee,
        ...donneesReservoirs,
        vasp_rangees_sieges: rangeesSieges,
        vasp_coffres: coffres,
        vasp_reservoirs_eau: reservoirsEau,
        vasp_reservoir_gaz: reservoirGaz,
      });
    } catch (error) {
      console.error("Erreur sauvegarde VASP:", error);
      toast.error("Erreur lors de la sauvegarde");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Données VASP M1
          </CardTitle>
          <Button size="sm" onClick={handleSave} disabled={isSaving}>
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? "Sauvegarde..." : "Sauvegarder"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[calc(100vh-300px)]">
          <div className="p-4 space-y-4">
            {/* Section Données COC */}
            <Collapsible open={openSections.coc} onOpenChange={() => toggleSection("coc")}>
              <CollapsibleTrigger className="flex items-center justify-between w-full p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                <div className="flex items-center gap-2">
                  <Car className="h-4 w-4 text-blue-600" />
                  <span className="font-medium">Données COC</span>
                </div>
                {openSections.coc ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-3 space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">MMTA (16.1)</Label>
                    <Input
                      type="number"
                      placeholder="kg"
                      value={donneesCOC.mmta_kg}
                      onChange={(e) => setDonneesCOC({ ...donneesCOC, mmta_kg: e.target.value })}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">MMTA Ess.AV (16.2)</Label>
                    <Input
                      type="number"
                      placeholder="kg"
                      value={donneesCOC.mmta_essieu_av_kg}
                      onChange={(e) => setDonneesCOC({ ...donneesCOC, mmta_essieu_av_kg: e.target.value })}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">MMTA Ess.AR (16.2)</Label>
                    <Input
                      type="number"
                      placeholder="kg"
                      value={donneesCOC.mmta_essieu_ar_kg}
                      onChange={(e) => setDonneesCOC({ ...donneesCOC, mmta_essieu_ar_kg: e.target.value })}
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Empattement (4.1)</Label>
                    <Input
                      type="number"
                      placeholder="mm"
                      value={donneesCOC.empattement_mm}
                      onChange={(e) => setDonneesCOC({ ...donneesCOC, empattement_mm: e.target.value })}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Charge S (19)</Label>
                    <Input
                      type="number"
                      placeholder="kg"
                      value={donneesCOC.charge_attelage_s_kg}
                      onChange={(e) => setDonneesCOC({ ...donneesCOC, charge_attelage_s_kg: e.target.value })}
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>

            <Separator />

            {/* Section Pesée */}
            <Collapsible open={openSections.pesee} onOpenChange={() => toggleSection("pesee")}>
              <CollapsibleTrigger className="flex items-center justify-between w-full p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                <div className="flex items-center gap-2">
                  <Gauge className="h-4 w-4 text-green-600" />
                  <span className="font-medium">Pesée</span>
                </div>
                {openSections.pesee ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-3 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Pesée Essieu AV</Label>
                    <Input
                      type="number"
                      placeholder="kg"
                      value={donneesPesee.pesee_essieu_av_kg}
                      onChange={(e) => setDonneesPesee({ ...donneesPesee, pesee_essieu_av_kg: e.target.value })}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Pesée Essieu AR</Label>
                    <Input
                      type="number"
                      placeholder="kg"
                      value={donneesPesee.pesee_essieu_ar_kg}
                      onChange={(e) => setDonneesPesee({ ...donneesPesee, pesee_essieu_ar_kg: e.target.value })}
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
                <div className="p-2 bg-green-50 rounded-lg text-sm">
                  <span className="text-muted-foreground">Total pesée: </span>
                  <span className="font-semibold">{resultatsCalculs.masseTotalePesee} kg</span>
                </div>
              </CollapsibleContent>
            </Collapsible>

            <Separator />

            {/* Section Réservoirs liquides */}
            <Collapsible open={openSections.reservoirs} onOpenChange={() => toggleSection("reservoirs")}>
              <CollapsibleTrigger className="flex items-center justify-between w-full p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                <div className="flex items-center gap-2">
                  <Droplets className="h-4 w-4 text-cyan-600" />
                  <span className="font-medium">Réservoirs liquides</span>
                </div>
                {openSections.reservoirs ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-3 space-y-3">
                {/* Carburant */}
                <div className="p-2 border rounded-lg space-y-2">
                  <Label className="text-xs font-semibold">Carburant</Label>
                  <div className="grid grid-cols-3 gap-2">
                    <Input
                      type="number"
                      placeholder="Litres"
                      value={donneesReservoirs.reservoir_carburant_litres}
                      onChange={(e) =>
                        setDonneesReservoirs({ ...donneesReservoirs, reservoir_carburant_litres: e.target.value })
                      }
                      className="h-7 text-xs"
                    />
                    <Input
                      type="number"
                      placeholder="Dist. AV (mm)"
                      value={donneesReservoirs.reservoir_carburant_distance_av_mm}
                      onChange={(e) =>
                        setDonneesReservoirs({
                          ...donneesReservoirs,
                          reservoir_carburant_distance_av_mm: e.target.value,
                        })
                      }
                      className="h-7 text-xs"
                    />
                    <Input
                      type="number"
                      placeholder="Taux %"
                      value={donneesReservoirs.reservoir_carburant_taux_remplissage}
                      onChange={(e) =>
                        setDonneesReservoirs({
                          ...donneesReservoirs,
                          reservoir_carburant_taux_remplissage: e.target.value,
                        })
                      }
                      className="h-7 text-xs"
                    />
                  </div>
                </div>
                {/* GPL/GNV */}
                <div className="p-2 border rounded-lg space-y-2">
                  <Label className="text-xs font-semibold">GPL / GNV</Label>
                  <div className="grid grid-cols-3 gap-2">
                    <Input
                      type="number"
                      placeholder="Litres"
                      value={donneesReservoirs.reservoir_gpl_litres}
                      onChange={(e) =>
                        setDonneesReservoirs({ ...donneesReservoirs, reservoir_gpl_litres: e.target.value })
                      }
                      className="h-7 text-xs"
                    />
                    <Input
                      type="number"
                      placeholder="Dist. AV (mm)"
                      value={donneesReservoirs.reservoir_gpl_distance_av_mm}
                      onChange={(e) =>
                        setDonneesReservoirs({ ...donneesReservoirs, reservoir_gpl_distance_av_mm: e.target.value })
                      }
                      className="h-7 text-xs"
                    />
                    <Input
                      type="number"
                      placeholder="Taux %"
                      value={donneesReservoirs.reservoir_gpl_taux_remplissage}
                      onChange={(e) =>
                        setDonneesReservoirs({ ...donneesReservoirs, reservoir_gpl_taux_remplissage: e.target.value })
                      }
                      className="h-7 text-xs"
                    />
                  </div>
                </div>
                {/* AdBlue */}
                <div className="p-2 border rounded-lg space-y-2">
                  <Label className="text-xs font-semibold">AdBlue</Label>
                  <div className="grid grid-cols-3 gap-2">
                    <Input
                      type="number"
                      placeholder="Litres"
                      value={donneesReservoirs.reservoir_adblue_litres}
                      onChange={(e) =>
                        setDonneesReservoirs({ ...donneesReservoirs, reservoir_adblue_litres: e.target.value })
                      }
                      className="h-7 text-xs"
                    />
                    <Input
                      type="number"
                      placeholder="Dist. AV (mm)"
                      value={donneesReservoirs.reservoir_adblue_distance_av_mm}
                      onChange={(e) =>
                        setDonneesReservoirs({ ...donneesReservoirs, reservoir_adblue_distance_av_mm: e.target.value })
                      }
                      className="h-7 text-xs"
                    />
                    <Input
                      type="number"
                      placeholder="Taux %"
                      value={donneesReservoirs.reservoir_adblue_taux_remplissage}
                      onChange={(e) =>
                        setDonneesReservoirs({
                          ...donneesReservoirs,
                          reservoir_adblue_taux_remplissage: e.target.value,
                        })
                      }
                      className="h-7 text-xs"
                    />
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>

            <Separator />

            {/* Section Rangées de sièges */}
            <Collapsible open={openSections.sieges} onOpenChange={() => toggleSection("sieges")}>
              <CollapsibleTrigger className="flex items-center justify-between w-full p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                <div className="flex items-center gap-2">
                  <Armchair className="h-4 w-4 text-purple-600" />
                  <span className="font-medium">Rangées de sièges</span>
                  <Badge variant="secondary" className="ml-2">
                    {rangeesSieges.length}
                  </Badge>
                </div>
                {openSections.sieges ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-3 space-y-2">
                {rangeesSieges.map((rangee, index) => (
                  <div key={rangee.id} className="flex items-center gap-2 p-2 border rounded-lg">
                    <Input
                      type="text"
                      value={rangee.nom}
                      onChange={(e) => updateRangeeSiege(rangee.id, "nom", e.target.value)}
                      className="h-7 text-xs w-24"
                    />
                    <Input
                      type="number"
                      placeholder="Dist. AV (mm)"
                      value={rangee.distance_av_mm || ""}
                      onChange={(e) => updateRangeeSiege(rangee.id, "distance_av_mm", e.target.value)}
                      className="h-7 text-xs flex-1"
                    />
                    <Input
                      type="number"
                      placeholder="Occ."
                      value={rangee.nb_occupants || ""}
                      onChange={(e) => updateRangeeSiege(rangee.id, "nb_occupants", e.target.value)}
                      className="h-7 text-xs w-16"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => supprimerRangeeSiege(rangee.id)}
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" className="w-full" onClick={ajouterRangeeSiege}>
                  <Plus className="h-3 w-3 mr-1" />
                  Ajouter une rangée
                </Button>
              </CollapsibleContent>
            </Collapsible>

            <Separator />

            {/* Section Coffres */}
            <Collapsible open={openSections.coffres} onOpenChange={() => toggleSection("coffres")}>
              <CollapsibleTrigger className="flex items-center justify-between w-full p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-orange-600" />
                  <span className="font-medium">Coffres / Rangements</span>
                  <Badge variant="secondary" className="ml-2">
                    {coffres.length}
                  </Badge>
                </div>
                {openSections.coffres ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-3 space-y-2">
                {coffres.map((coffre) => (
                  <div key={coffre.id} className="flex items-center gap-2 p-2 border rounded-lg">
                    <Input
                      type="text"
                      value={coffre.nom}
                      onChange={(e) => updateCoffre(coffre.id, "nom", e.target.value)}
                      className="h-7 text-xs w-28"
                    />
                    <Input
                      type="number"
                      placeholder="Dist. AV (mm)"
                      value={coffre.distance_av_mm || ""}
                      onChange={(e) => updateCoffre(coffre.id, "distance_av_mm", e.target.value)}
                      className="h-7 text-xs flex-1"
                    />
                    <Input
                      type="number"
                      placeholder="kg"
                      value={coffre.masse_kg || ""}
                      onChange={(e) => updateCoffre(coffre.id, "masse_kg", e.target.value)}
                      className="h-7 text-xs w-16"
                    />
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => supprimerCoffre(coffre.id)}>
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" className="w-full" onClick={ajouterCoffre}>
                  <Plus className="h-3 w-3 mr-1" />
                  Ajouter un coffre
                </Button>
              </CollapsibleContent>
            </Collapsible>

            <Separator />

            {/* Section Réservoirs eau */}
            <Collapsible open={openSections.eau} onOpenChange={() => toggleSection("eau")}>
              <CollapsibleTrigger className="flex items-center justify-between w-full p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                <div className="flex items-center gap-2">
                  <Droplets className="h-4 w-4 text-blue-400" />
                  <span className="font-medium">Réservoirs d'eau</span>
                  <Badge variant="secondary" className="ml-2">
                    {reservoirsEau.length}
                  </Badge>
                </div>
                {openSections.eau ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-3 space-y-2">
                {reservoirsEau.map((reservoir) => (
                  <div key={reservoir.id} className="flex items-center gap-2 p-2 border rounded-lg">
                    <Input
                      type="text"
                      value={reservoir.nom}
                      onChange={(e) => updateReservoirEau(reservoir.id, "nom", e.target.value)}
                      className="h-7 text-xs w-28"
                    />
                    <Input
                      type="number"
                      placeholder="Dist. AV (mm)"
                      value={reservoir.distance_av_mm || ""}
                      onChange={(e) => updateReservoirEau(reservoir.id, "distance_av_mm", e.target.value)}
                      className="h-7 text-xs flex-1"
                    />
                    <Input
                      type="number"
                      placeholder="kg"
                      value={reservoir.masse_kg || ""}
                      onChange={(e) => updateReservoirEau(reservoir.id, "masse_kg", e.target.value)}
                      className="h-7 text-xs w-16"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => supprimerReservoirEau(reservoir.id)}
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" className="w-full" onClick={ajouterReservoirEau}>
                  <Plus className="h-3 w-3 mr-1" />
                  Ajouter un réservoir
                </Button>
              </CollapsibleContent>
            </Collapsible>

            <Separator />

            {/* Section Calculs automatiques */}
            <Collapsible open={openSections.calculs} onOpenChange={() => toggleSection("calculs")}>
              <CollapsibleTrigger className="flex items-center justify-between w-full p-2 rounded-lg bg-blue-50 hover:bg-blue-100 transition-colors">
                <div className="flex items-center gap-2">
                  <Calculator className="h-4 w-4 text-blue-600" />
                  <span className="font-medium text-blue-700">Calculs automatiques</span>
                </div>
                {openSections.calculs ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-3">
                <div className="p-3 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Masse carburant manquante:</span>
                    <span className="font-medium">{resultatsCalculs.masseCarburantManquante} kg</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Masse GPL manquante:</span>
                    <span className="font-medium">{resultatsCalculs.masseGplManquante} kg</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Masse AdBlue manquante:</span>
                    <span className="font-medium">{resultatsCalculs.masseAdblueManquante} kg</span>
                  </div>
                  <Separator className="my-2" />
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Masse en ordre de marche:</span>
                    <span className="font-semibold text-blue-700">{resultatsCalculs.masseOrdreMarche} kg</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Charge utile disponible:</span>
                    <span
                      className={`font-semibold ${Number(resultatsCalculs.chargeUtile) < 0 ? "text-red-600" : "text-green-600"}`}
                    >
                      {resultatsCalculs.chargeUtile} kg
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Répartition avant:</span>
                    <span className="font-medium">{resultatsCalculs.repartitionAvant}%</span>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default VASPDataPanel;
