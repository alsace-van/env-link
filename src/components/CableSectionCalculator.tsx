import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, CheckCircle, Calculator, Zap, Ruler, Shield, Euro } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

type CalculationMode = "section" | "current" | "length";
type LengthMode = "aller" | "total";

interface CableCatalogItem {
  id: string;
  nom: string;
  section: number;
  prix_reference?: number;
  prix_vente_ttc?: number;
}

export const CableSectionCalculator = () => {
  const [calculationMode, setCalculationMode] = useState<CalculationMode>("section");
  const [lengthMode, setLengthMode] = useState<LengthMode>("aller");
  const [current, setCurrent] = useState<number>(0);
  const [power, setPower] = useState<number>(0);
  const [length, setLength] = useState<number>(0);
  const [voltage, setVoltage] = useState<number>(12);
  const [selectedSection, setSelectedSection] = useState<number>(0);
  const [cableCatalog, setCableCatalog] = useState<CableCatalogItem[]>([]);

  // Charger les câbles du catalogue
  useEffect(() => {
    loadCableCatalog();
  }, []);

  const loadCableCatalog = async () => {
    try {
      // Chercher les catégories "cable" ou "câble"
      const { data: categories } = (await supabase
        .from("categories")
        .select("id, nom, parent_id")
        .or("nom.ilike.%cable%,nom.ilike.%câble%")) as any;

      if (!categories || categories.length === 0) return;

      // Récupérer les IDs des catégories (incluant les sous-catégories)
      const categoryIds = categories.map((c: any) => c.id);

      // Chercher aussi les catégories dont le parent est une catégorie cable
      const { data: subCategories } = (await supabase
        .from("categories")
        .select("id")
        .in("parent_id", categoryIds)) as any;

      if (subCategories) {
        categoryIds.push(...subCategories.map((c: any) => c.id));
      }

      // Charger les accessoires de ces catégories
      const { data: accessories } = (await supabase
        .from("accessories_catalog")
        .select("id, nom, prix_reference, prix_vente_ttc")
        .in("category_id", categoryIds)) as any;

      if (!accessories) return;

      // Extraire la section du nom (cherche un pattern comme "2.5mm²", "2,5 mm²", "2.5", etc.)
      const cablesWithSection: CableCatalogItem[] = [];

      for (const acc of accessories) {
        // Patterns pour trouver la section dans le nom
        const patterns = [
          /(\d+[.,]?\d*)\s*mm²/i,
          /(\d+[.,]?\d*)\s*mm2/i,
          /section\s*(\d+[.,]?\d*)/i,
          /^(\d+[.,]?\d*)\s*-/,
        ];

        let section: number | null = null;
        for (const pattern of patterns) {
          const match = acc.nom.match(pattern);
          if (match) {
            section = parseFloat(match[1].replace(",", "."));
            break;
          }
        }

        if (section && section > 0) {
          cablesWithSection.push({
            id: acc.id,
            nom: acc.nom,
            section,
            prix_reference: acc.prix_reference,
            prix_vente_ttc: acc.prix_vente_ttc,
          });
        }
      }

      setCableCatalog(cablesWithSection);
    } catch (error) {
      console.error("Erreur lors du chargement des câbles:", error);
    }
  };

  // Gestionnaire pour le changement de puissance
  const handlePowerChange = (value: number) => {
    setPower(value);
    if (voltage > 0) {
      setCurrent(value / voltage);
    }
  };

  // Gestionnaire pour le changement d'intensité
  const handleCurrentChange = (value: number) => {
    setCurrent(value);
    if (voltage > 0) {
      setPower(value * voltage);
    }
  };

  // Gestionnaire pour le changement de tension
  const handleVoltageChange = (value: number) => {
    setVoltage(value);
    if (value > 0 && current > 0) {
      setPower(current * value);
    }
  };

  // Tableau de résistivité pour câbles souples en cuivre (Ω/m/mm²)
  const resistivity = 0.023; // pour cuivre à 20°C

  // Sections standards de câbles (mm²)
  const standardSections = [0.75, 1, 1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120];

  // Calibres de fusibles standards (A) - inclut mini fuse, ATO, midi fuse, mega fuse
  const standardFuses = [1, 2, 3, 5, 7.5, 10, 15, 20, 25, 30, 35, 40, 50, 60, 70, 80, 100, 125, 150, 175, 200];

  // Calibres de fusibles courants (disponibles dans tous les formats)
  const commonFuses = [5, 10, 15, 20, 25, 30, 40, 50, 60, 80, 100];

  // Intensités maximales admissibles pour câbles souples (A)
  const maxCurrentBySectionMap: { [key: number]: number } = {
    0.75: 6,
    1: 8,
    1.5: 10,
    2.5: 16,
    4: 21,
    6: 26,
    10: 36,
    16: 50,
    25: 68,
    35: 89,
    50: 110,
    70: 140,
    95: 175,
    120: 207,
  };

  // Calculer la longueur totale de câble selon le mode
  const getTotalLength = () => {
    return lengthMode === "aller" ? length * 2 : length;
  };

  // Calculer le fusible recommandé et suggestion de section
  const calculateRecommendedFuse = (
    intensite: number,
    section: number,
  ): {
    fuse: number | null;
    isCommon: boolean;
    suggestedSection: number | null;
    suggestedFuse: number | null;
  } => {
    if (intensite <= 0 || section <= 0)
      return { fuse: null, isCommon: false, suggestedSection: null, suggestedFuse: null };

    const maxCurrentForSection = maxCurrentBySectionMap[section] || 0;

    // Le fusible doit être :
    // - Supérieur ou égal à l'intensité nominale + marge 10%
    // - Inférieur ou égal à l'intensité max admissible du câble
    const minFuseWithMargin = intensite * 1.1;

    // Trouver le premier calibre standard ≥ intensité avec marge
    const recommendedFuse = standardFuses.find((f) => f >= minFuseWithMargin);

    // Vérifier que ce fusible ne dépasse pas la capacité du câble
    let fuse: number | null = null;
    if (recommendedFuse && recommendedFuse <= maxCurrentForSection) {
      fuse = recommendedFuse;
    }

    // Vérifier si c'est un fusible courant
    const isCommon = fuse ? commonFuses.includes(fuse) : false;

    // Si le fusible n'est pas courant ou n'existe pas, chercher une section supérieure
    let suggestedSection: number | null = null;
    let suggestedFuse: number | null = null;

    if (!isCommon || !fuse) {
      // Trouver le prochain fusible courant ≥ intensité avec marge
      const nextCommonFuse = commonFuses.find((f) => f >= minFuseWithMargin);

      if (nextCommonFuse) {
        // Trouver la section minimale qui supporte ce fusible
        const sectionForFuse = standardSections.find((s) => {
          const maxI = maxCurrentBySectionMap[s] || 0;
          return maxI >= nextCommonFuse && s > section;
        });

        if (sectionForFuse) {
          suggestedSection = sectionForFuse;
          suggestedFuse = nextCommonFuse;
        }
      }
    }

    return { fuse, isCommon, suggestedSection, suggestedFuse };
  };

  // Trouver le câble du catalogue correspondant à une section
  const findCableInCatalog = (section: number): CableCatalogItem | undefined => {
    return cableCatalog.find((c) => c.section === section);
  };

  // Calculer le prix estimé du câble
  const calculateCablePrice = (
    section: number,
  ): { achat: number | null; vente: number | null; cable: CableCatalogItem | null } => {
    const cable = findCableInCatalog(section);
    if (!cable) return { achat: null, vente: null, cable: null };

    const totalLength = getTotalLength();
    return {
      achat: cable.prix_reference ? cable.prix_reference * totalLength : null,
      vente: cable.prix_vente_ttc ? cable.prix_vente_ttc * totalLength : null,
      cable,
    };
  };

  const calculateMaxCurrent = () => {
    if (selectedSection <= 0 || length <= 0) return null;

    const maxCurrentBySection = maxCurrentBySectionMap[selectedSection] || 0;
    const totalLength = getTotalLength();
    const resistance = (resistivity * totalLength) / selectedSection;
    const maxVoltageDropAllowed = voltage * 0.03; // 3% max
    const maxCurrentByVoltageDrop = maxVoltageDropAllowed / resistance;

    return Math.min(maxCurrentBySection, maxCurrentByVoltageDrop);
  };

  const calculateMaxLength = () => {
    if (current <= 0 || selectedSection <= 0) return null;

    const maxCurrentBySection = maxCurrentBySectionMap[selectedSection] || 0;
    if (current > maxCurrentBySection) return 0; // Intensité trop élevée pour cette section

    const maxVoltageDropAllowed = voltage * 0.03; // 3% max
    const resistance = maxVoltageDropAllowed / current;
    // Longueur totale max du circuit
    const maxTotalLength = (resistance * selectedSection) / resistivity;

    // Retourner selon le mode : si "aller" on divise par 2, si "total" on garde tel quel
    return lengthMode === "aller" ? maxTotalLength / 2 : maxTotalLength;
  };

  const calculateResults = () => {
    if (current <= 0 || length <= 0) return [];

    const totalLength = getTotalLength();
    return standardSections.map((section) => {
      const resistance = (resistivity * totalLength) / section;
      const voltageDrop = current * resistance;
      const voltageDropPercent = (voltageDrop / voltage) * 100;
      const maxCurrent = maxCurrentBySectionMap[section] || 0;
      const voltageOk = voltageDropPercent <= 3;
      const currentOk = current <= maxCurrent;
      const recommended = voltageOk && currentOk;

      return {
        section,
        voltageDrop: voltageDrop.toFixed(2),
        voltageDropPercent: voltageDropPercent.toFixed(2),
        maxCurrent,
        voltageOk,
        currentOk,
        recommended,
      };
    });
  };

  const results = calculationMode === "section" ? calculateResults() : [];
  const recommendedSection = results.find((r) => r.recommended);
  const maxCurrentResult = calculationMode === "current" ? calculateMaxCurrent() : null;
  const maxLengthResult = calculationMode === "length" ? calculateMaxLength() : null;

  // Calculs pour l'affichage
  const displaySection = calculationMode === "section" ? recommendedSection?.section : selectedSection;

  const displayCurrent = calculationMode === "current" && maxCurrentResult ? maxCurrentResult : current;

  const fuseInfo =
    displaySection && displayCurrent
      ? calculateRecommendedFuse(displayCurrent, displaySection)
      : { fuse: null, isCommon: false, suggestedSection: null, suggestedFuse: null };

  const priceInfo =
    displaySection && length > 0 ? calculateCablePrice(displaySection) : { achat: null, vente: null, cable: null };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Calculateur de Section de Câble</CardTitle>
        <CardDescription>Calcul pour câbles souples en cuivre - Courant continu 12V</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label className="text-base font-semibold">Mode de calcul</Label>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={calculationMode === "section" ? "default" : "outline"}
              onClick={() => setCalculationMode("section")}
              className="flex items-center gap-2"
            >
              <Calculator className="h-4 w-4" />
              Calculer la section minimale
            </Button>
            <Button
              variant={calculationMode === "current" ? "default" : "outline"}
              onClick={() => setCalculationMode("current")}
              className="flex items-center gap-2"
            >
              <Zap className="h-4 w-4" />
              Calculer l'intensité maximale
            </Button>
            <Button
              variant={calculationMode === "length" ? "default" : "outline"}
              onClick={() => setCalculationMode("length")}
              className="flex items-center gap-2"
            >
              <Ruler className="h-4 w-4" />
              Calculer la longueur maximale
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="space-y-2">
            <Label htmlFor="power" className="text-base font-semibold">
              Puissance (W)
            </Label>
            <Input
              id="power"
              type="number"
              min="0"
              step="0.1"
              value={power || ""}
              onChange={(e) => handlePowerChange(Number(e.target.value))}
              placeholder="Ex: 120"
              className="h-12 text-lg"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="current" className="text-base font-semibold">
              Intensité (A) {calculationMode === "current" && "- Résultat"}
            </Label>
            <Input
              id="current"
              type="number"
              min="0"
              step="0.1"
              value={current || ""}
              onChange={(e) => handleCurrentChange(Number(e.target.value))}
              placeholder="Ex: 10"
              className="h-12 text-lg"
              disabled={calculationMode === "current"}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="length" className="text-base font-semibold">
              Longueur (m) {calculationMode === "length" && "- Résultat"}
            </Label>
            <Input
              id="length"
              type="number"
              min="0"
              step="0.1"
              value={length || ""}
              onChange={(e) => setLength(Number(e.target.value))}
              placeholder="Ex: 5"
              className="h-12 text-lg"
              disabled={calculationMode === "length"}
            />
            <div className="flex gap-1">
              <Button
                type="button"
                variant={lengthMode === "aller" ? "default" : "outline"}
                size="sm"
                className="flex-1 text-xs h-7"
                onClick={() => setLengthMode("aller")}
              >
                Aller simple (×2 auto)
              </Button>
              <Button
                type="button"
                variant={lengthMode === "total" ? "default" : "outline"}
                size="sm"
                className="flex-1 text-xs h-7"
                onClick={() => setLengthMode("total")}
              >
                Longueur totale
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="voltage" className="text-base font-semibold">
              Tension (V)
            </Label>
            <Input
              id="voltage"
              type="number"
              min="1"
              step="1"
              value={voltage}
              onChange={(e) => handleVoltageChange(Number(e.target.value))}
              placeholder="Ex: 12"
              className="h-12 text-lg"
            />
          </div>
          {(calculationMode === "current" || calculationMode === "length") && (
            <div className="space-y-2">
              <Label htmlFor="section" className="text-base font-semibold">
                Section (mm²)
              </Label>
              <Select
                value={selectedSection > 0 ? selectedSection.toString() : ""}
                onValueChange={(value) => setSelectedSection(Number(value))}
              >
                <SelectTrigger className="h-12 text-lg">
                  <SelectValue placeholder="Choisir" />
                </SelectTrigger>
                <SelectContent>
                  {standardSections.map((s) => (
                    <SelectItem key={s} value={s.toString()}>
                      {s} mm² {findCableInCatalog(s) && "💰"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {calculationMode === "current" && maxCurrentResult !== null && selectedSection > 0 && length > 0 && (
          <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-500">
            <CheckCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <AlertDescription className="text-blue-800 dark:text-blue-200">
              <span className="font-semibold text-xl">Intensité maximale : {maxCurrentResult.toFixed(1)} A</span>
              <br />
              <span className="text-sm">
                Pour une section de {selectedSection} mm² sur {getTotalLength().toFixed(1)} m de câble total avec une
                chute de tension max de 3%
              </span>
            </AlertDescription>
          </Alert>
        )}

        {calculationMode === "length" && maxLengthResult !== null && selectedSection > 0 && current > 0 && (
          <Alert
            className={
              maxLengthResult > 0
                ? "bg-purple-50 dark:bg-purple-950 border-purple-500"
                : "bg-red-50 dark:bg-red-950 border-red-500"
            }
          >
            <CheckCircle
              className={
                maxLengthResult > 0
                  ? "h-4 w-4 text-purple-600 dark:text-purple-400"
                  : "h-4 w-4 text-red-600 dark:text-red-400"
              }
            />
            <AlertDescription
              className={
                maxLengthResult > 0 ? "text-purple-800 dark:text-purple-200" : "text-red-800 dark:text-red-200"
              }
            >
              <span className="font-semibold text-xl">
                {maxLengthResult > 0
                  ? lengthMode === "aller"
                    ? `Distance aller max : ${maxLengthResult.toFixed(1)} m (total: ${(maxLengthResult * 2).toFixed(1)} m)`
                    : `Longueur totale max : ${maxLengthResult.toFixed(1)} m`
                  : "Section insuffisante"}
              </span>
              <br />
              <span className="text-sm">
                {maxLengthResult > 0 ? (
                  <>
                    Pour {current} A avec une section de {selectedSection} mm² et une chute de tension max de 3%
                  </>
                ) : (
                  <>
                    L'intensité de {current} A dépasse la capacité maximale d'une section de {selectedSection} mm² (
                    {maxCurrentBySectionMap[selectedSection]} A max)
                  </>
                )}
              </span>
            </AlertDescription>
          </Alert>
        )}

        {calculationMode === "section" && current > 0 && length > 0 && (
          <>
            {recommendedSection ? (
              <div className="p-4 rounded-lg border-2 border-primary bg-primary/5">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-6 w-6 text-primary flex-shrink-0" />
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-primary">Section recommandée</h3>
                    <div className="text-3xl font-bold text-primary my-2">{recommendedSection.section} mm²</div>
                    <div className="flex flex-wrap gap-3 text-xs">
                      <div>
                        <span className="text-muted-foreground">Chute:</span>{" "}
                        <span className="font-semibold">
                          {recommendedSection.voltageDrop}V ({recommendedSection.voltageDropPercent}%)
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">I max:</span>{" "}
                        <span className="font-semibold">{recommendedSection.maxCurrent}A</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Votre I:</span>{" "}
                        <span className="font-semibold">{current}A</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Aucune section standard ne convient pour ces paramètres. Vérifiez vos valeurs ou envisagez une tension
                  plus élevée.
                </AlertDescription>
              </Alert>
            )}
          </>
        )}

        {/* Fusible et Prix */}
        {displaySection && displaySection > 0 && displayCurrent > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Fusible recommandé */}
            <div className="p-4 rounded-lg border bg-orange-50 dark:bg-orange-950 border-orange-300 dark:border-orange-700">
              <div className="flex items-center gap-3">
                <Shield className="h-6 w-6 text-orange-600 dark:text-orange-400 flex-shrink-0" />
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-orange-800 dark:text-orange-200">Fusible recommandé</h3>
                  {fuseInfo.fuse ? (
                    <>
                      <div className="flex items-center gap-2 my-1">
                        <span className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                          {fuseInfo.fuse} A
                        </span>
                        {!fuseInfo.isCommon && (
                          <Badge variant="outline" className="text-orange-600 border-orange-400 text-xs">
                            Calibre peu courant
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-orange-700 dark:text-orange-300">
                        Protège le câble {displaySection} mm² (max {maxCurrentBySectionMap[displaySection]}A)
                      </p>
                      {!fuseInfo.isCommon && fuseInfo.suggestedSection && fuseInfo.suggestedFuse && (
                        <div className="mt-2 p-2 bg-orange-100 dark:bg-orange-900 rounded text-xs">
                          <p className="font-medium text-orange-800 dark:text-orange-200">
                            💡 Alternative : câble {fuseInfo.suggestedSection} mm² → fusible {fuseInfo.suggestedFuse} A
                          </p>
                          <p className="text-orange-700 dark:text-orange-300">
                            Calibre plus courant, disponible dans tous les formats
                          </p>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-orange-700 dark:text-orange-300 mt-1">
                        Aucun calibre adapté pour cette section.
                      </p>
                      {fuseInfo.suggestedSection && fuseInfo.suggestedFuse && (
                        <div className="mt-2 p-2 bg-orange-100 dark:bg-orange-900 rounded text-xs">
                          <p className="font-medium text-orange-800 dark:text-orange-200">
                            💡 Solution : passer à {fuseInfo.suggestedSection} mm² → fusible {fuseInfo.suggestedFuse} A
                          </p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Prix estimé */}
            <div className="p-4 rounded-lg border bg-green-50 dark:bg-green-950 border-green-300 dark:border-green-700">
              <div className="flex items-center gap-3">
                <Euro className="h-6 w-6 text-green-600 dark:text-green-400 flex-shrink-0" />
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-green-800 dark:text-green-200">Prix estimé du câble</h3>
                  {priceInfo.cable ? (
                    <>
                      <div className="flex flex-wrap gap-3 my-1">
                        {priceInfo.achat !== null && (
                          <div>
                            <span className="text-xs text-green-700 dark:text-green-300">Achat:</span>{" "}
                            <span className="text-lg font-bold text-green-600 dark:text-green-400">
                              {priceInfo.achat.toFixed(2)} €
                            </span>
                          </div>
                        )}
                        {priceInfo.vente !== null && (
                          <div>
                            <span className="text-xs text-green-700 dark:text-green-300">Vente:</span>{" "}
                            <span className="text-lg font-bold text-green-600 dark:text-green-400">
                              {priceInfo.vente.toFixed(2)} €
                            </span>
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-green-700 dark:text-green-300">
                        {priceInfo.cable.nom} × {getTotalLength().toFixed(1)}m
                      </p>
                    </>
                  ) : (
                    <div className="mt-1">
                      <Badge variant="outline" className="text-orange-600 border-orange-400">
                        Câble {displaySection} mm² non trouvé dans le catalogue
                      </Badge>
                      <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                        Ajoutez une catégorie "Câble" avec des articles pour activer le calcul de prix
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="text-sm text-muted-foreground space-y-1">
          <p>
            <strong>Critères de sélection :</strong>
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Chute de tension maximale : 3%</li>
            <li>Intensité ne doit pas dépasser l'intensité maximale admissible du câble</li>
            <li>Fusible : premier calibre ≥ intensité × 1.10 et ≤ intensité max câble</li>
            <li>Calculs basés sur des câbles souples en cuivre à 20°C</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};
