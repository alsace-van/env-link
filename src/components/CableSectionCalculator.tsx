import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, CheckCircle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type CalculationMode = "section" | "current" | "length";

export const CableSectionCalculator = () => {
  const [calculationMode, setCalculationMode] = useState<CalculationMode>("section");
  const [current, setCurrent] = useState<number>(0);
  const [power, setPower] = useState<number>(0);
  const [length, setLength] = useState<number>(0);
  const [voltage, setVoltage] = useState<number>(12);
  const [selectedSection, setSelectedSection] = useState<number>(0);

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

  const calculateMaxCurrent = () => {
    if (selectedSection <= 0 || length <= 0) return null;

    const maxCurrentBySection = maxCurrentBySectionMap[selectedSection] || 0;
    const resistance = (resistivity * length * 2) / selectedSection;
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
    const maxLength = (resistance * selectedSection) / (resistivity * 2);

    return maxLength;
  };

  const calculateResults = () => {
    if (current <= 0 || length <= 0) return [];

    return standardSections.map((section) => {
      const resistance = (resistivity * length * 2) / section;
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Calculateur de Section de Câble</CardTitle>
        <CardDescription>Calcul pour câbles souples en cuivre - Courant continu 12V</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="mode" className="text-base font-semibold">
            Mode de calcul
          </Label>
          <Select value={calculationMode} onValueChange={(value) => setCalculationMode(value as CalculationMode)}>
            <SelectTrigger className="h-12 text-lg">
              <SelectValue placeholder="Sélectionner le mode" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="section">Calculer la section minimale</SelectItem>
              <SelectItem value="current">Calculer l'intensité maximale</SelectItem>
              <SelectItem value="length">Calculer la longueur maximale</SelectItem>
            </SelectContent>
          </Select>
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
              Longueur du câble (m) {calculationMode === "length" && "- Résultat"}
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
            <p className="text-xs text-muted-foreground">
              Distance simple. Ex: 2m = 2m aller + 2m retour = 4m de câble total
            </p>
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
                      {s} mm²
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
                Pour une section de {selectedSection} mm² sur {length} m avec une chute de tension max de 3%
              </span>
            </AlertDescription>
          </Alert>
        )}

        {calculationMode === "length" && maxLengthResult !== null && selectedSection > 0 && current > 0 && (
          <Alert className={maxLengthResult > 0 ? "bg-purple-50 dark:bg-purple-950 border-purple-500" : "bg-red-50 dark:bg-red-950 border-red-500"}>
            <CheckCircle className={maxLengthResult > 0 ? "h-4 w-4 text-purple-600 dark:text-purple-400" : "h-4 w-4 text-red-600 dark:text-red-400"} />
            <AlertDescription className={maxLengthResult > 0 ? "text-purple-800 dark:text-purple-200" : "text-red-800 dark:text-red-200"}>
              <span className="font-semibold text-xl">
                {maxLengthResult > 0 ? `Longueur maximale : ${maxLengthResult.toFixed(1)} m (distance simple)` : "Section insuffisante"}
              </span>
              <br />
              <span className="text-sm">
                {maxLengthResult > 0 ? (
                  <>Pour {current} A avec une section de {selectedSection} mm² et une chute de tension max de 3%. Câble total nécessaire : {(maxLengthResult * 2).toFixed(1)} m</>
                ) : (
                  <>L'intensité de {current} A dépasse la capacité maximale d'une section de {selectedSection} mm² ({maxCurrentBySectionMap[selectedSection]} A max)</>
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

        <div className="text-sm text-muted-foreground space-y-1">
          <p>
            <strong>Critères de sélection :</strong>
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Chute de tension maximale : 3%</li>
            <li>Intensité ne doit pas dépasser l'intensité maximale admissible du câble</li>
            <li>Calculs basés sur des câbles souples en cuivre à 20°C</li>
            <li>Longueur : distance aller-retour automatiquement prise en compte</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};
