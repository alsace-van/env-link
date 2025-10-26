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
          </div>
          <div className="space-y-2">
            <Label htmlFor="voltage">Tension (V)</Label>
            <Input
              id="voltage"
              type="number"
              value={voltage}
              onChange={(e) => setVoltage(Number(e.target.value))}
              disabled
            />
          </div>
        </div>

        {recommendedSection && (
          <Alert className="border-primary bg-primary/5">
            <CheckCircle className="h-4 w-4 text-primary" />
            <AlertDescription className="text-primary font-medium">
              Section recommandée : <span className="text-lg font-bold">{recommendedSection.section} mm²</span>
              <br />
              <span className="text-sm font-normal">
                Chute de tension : {recommendedSection.voltageDrop}V ({recommendedSection.voltageDropPercent}%)
                | Intensité max : {recommendedSection.maxCurrent}A
              </span>
            </AlertDescription>
          </Alert>
        )}

        {current > 0 && length > 0 && !recommendedSection && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Aucune section standard ne convient pour ces paramètres. Vérifiez vos valeurs ou envisagez une tension plus élevée.
            </AlertDescription>
          </Alert>
        )}

        {results.length > 0 && (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Section (mm²)</TableHead>
                  <TableHead>Chute de tension (V)</TableHead>
                  <TableHead>Chute de tension (%)</TableHead>
                  <TableHead>Intensité max (A)</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((result) => (
                  <TableRow
                    key={result.section}
                    className={result.recommended ? "bg-primary/5" : ""}
                  >
                    <TableCell className="font-medium">
                      {result.section}
                      {result.recommended && (
                        <span className="ml-2 text-xs bg-primary text-primary-foreground px-2 py-1 rounded">
                          Recommandé
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{result.voltageDrop}</TableCell>
                    <TableCell>
                      <span className={result.voltageOk ? "text-green-600" : "text-red-600"}>
                        {result.voltageDropPercent}%
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={result.currentOk ? "text-green-600" : "text-red-600"}>
                        {result.maxCurrent}
                      </span>
                    </TableCell>
                    <TableCell>
                      {result.voltageOk && result.currentOk ? (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-red-600" />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
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
