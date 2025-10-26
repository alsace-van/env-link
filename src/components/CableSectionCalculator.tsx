import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, CheckCircle } from "lucide-react";

export const CableSectionCalculator = () => {
  const [current, setCurrent] = useState<number>(0);
  const [length, setLength] = useState<number>(0);
  const [voltage, setVoltage] = useState<number>(12);

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

  const calculateResults = () => {
    if (current <= 0 || length <= 0) return [];

    return standardSections.map((section) => {
      // Calcul de la chute de tension (V)
      const resistance = (resistivity * length * 2) / section; // *2 pour aller-retour
      const voltageDrop = current * resistance;
      const voltageDropPercent = (voltageDrop / voltage) * 100;

      // Intensité maximale admissible
      const maxCurrent = maxCurrentBySectionMap[section] || 0;

      // Vérification des critères
      const voltageOk = voltageDropPercent <= 3; // Max 3% de chute de tension
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

  const results = calculateResults();
  const recommendedSection = results.find((r) => r.recommended);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Calculateur de Section de Câble</CardTitle>
        <CardDescription>
          Calcul pour câbles souples en cuivre - Courant continu 12V
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="current">Intensité (A)</Label>
            <Input
              id="current"
              type="number"
              min="0"
              step="0.1"
              value={current || ""}
              onChange={(e) => setCurrent(Number(e.target.value))}
              placeholder="Ex: 10"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="length">Longueur du câble (m)</Label>
            <Input
              id="length"
              type="number"
              min="0"
              step="0.1"
              value={length || ""}
              onChange={(e) => setLength(Number(e.target.value))}
              placeholder="Ex: 5"
            />
            <p className="text-xs text-muted-foreground">Aller-retour déjà pris en compte</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="voltage">Tension (V)</Label>
            <Input
              id="voltage"
              type="number"
              min="1"
              step="1"
              value={voltage}
              onChange={(e) => setVoltage(Number(e.target.value))}
              placeholder="Ex: 12"
            />
          </div>
        </div>

        {current > 0 && length > 0 && (
          <>
            {recommendedSection ? (
              <div className="p-4 rounded-lg border-2 border-primary bg-primary/5">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-6 w-6 text-primary flex-shrink-0" />
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-primary">Section recommandée</h3>
                    <div className="text-3xl font-bold text-primary my-2">
                      {recommendedSection.section} mm²
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs">
                      <div>
                        <span className="text-muted-foreground">Chute:</span>{" "}
                        <span className="font-semibold">{recommendedSection.voltageDrop}V ({recommendedSection.voltageDropPercent}%)</span>
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
                  Aucune section standard ne convient pour ces paramètres. Vérifiez vos valeurs ou envisagez une tension plus élevée.
                </AlertDescription>
              </Alert>
            )}
          </>
        )}

        <div className="text-sm text-muted-foreground space-y-1">
          <p><strong>Critères de sélection :</strong></p>
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
