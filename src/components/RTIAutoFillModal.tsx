import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Sparkles, AlertCircle, CheckCircle2, Loader2, FileText } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface RTIAutoFillModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
}

interface TransformationItem {
  id: string;
  name: string;
  category: string;
  selected: boolean;
}

export const RTIAutoFillModal = ({ open, onOpenChange, projectId }: RTIAutoFillModalProps) => {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [step, setStep] = useState<'select' | 'generate' | 'preview'>('select');
  
  // Données du projet
  const [vehicleData, setVehicleData] = useState<any>(null);
  const [customerData, setCustomerData] = useState<any>(null);
  const [expenses, setExpenses] = useState<any[]>([]);
  
  // Transformations sélectionnées
  const [transformations, setTransformations] = useState<TransformationItem[]>([]);
  const [manualTransformations, setManualTransformations] = useState("");
  
  // Données générées
  const [generatedRTI, setGeneratedRTI] = useState<any>(null);

  useEffect(() => {
    if (open && projectId) {
      loadProjectData();
    }
  }, [open, projectId]);

  const loadProjectData = async () => {
    setLoading(true);
    try {
      // Charger les données du projet
      const { data: project, error: projectError } = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .single();

      if (projectError) throw projectError;

      // Vérifier si la carte grise a été scannée
      if (!project.vehicle_vin) {
        toast.error("Aucune carte grise scannée pour ce projet", {
          description: "Veuillez d'abord scanner la carte grise dans la création du projet",
        });
        onOpenChange(false);
        return;
      }

      setVehicleData({
        vin: project.vehicle_vin,
        immatriculation: project.vehicle_immatriculation,
        marque: project.vehicle_marque,
        modele: project.vehicle_modele,
        genre: project.vehicle_genre,
        carrosserie: project.vehicle_carrosserie,
        ptac: project.vehicle_ptac,
        masseVide: project.vehicle_masse_vide,
        nombrePlaces: project.vehicle_nombre_places,
        longueur: project.vehicle_longueur,
        largeur: project.vehicle_largeur,
        hauteur: project.vehicle_hauteur,
      });

      setCustomerData({
        nom: project.customer_name || "",
        prenom: "",
        telephone: project.customer_phone || "",
        email: project.customer_email || "",
        adresse: "",
      });

      // Charger les dépenses du projet
      const { data: expensesData, error: expensesError } = await supabase
        .from("project_expenses")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

      if (expensesError) throw expensesError;

      setExpenses(expensesData || []);

      // Convertir les dépenses en transformations
      const items: TransformationItem[] = (expensesData || []).map((expense) => ({
        id: expense.id,
        name: expense.nom_accessoire || "Sans nom",
        category: expense.categorie || "Autre",
        selected: true,
      }));

      setTransformations(items);
    } catch (error: any) {
      console.error("Erreur chargement données:", error);
      toast.error("Erreur lors du chargement des données");
    } finally {
      setLoading(false);
    }
  };

  const toggleTransformation = (id: string) => {
    setTransformations(
      transformations.map((t) =>
        t.id === id ? { ...t, selected: !t.selected } : t
      )
    );
  };

  const handleGenerate = async () => {
    setStep('generate');
    setLoading(true);
    setProgress(10);

    try {
      // Préparer les données de transformation
      const selectedTransformations = transformations
        .filter((t) => t.selected)
        .map((t) => t.name);

      const allTransformations = [
        ...selectedTransformations,
        ...(manualTransformations ? [manualTransformations] : []),
      ];

      setProgress(30);

      // Appeler l'Edge Function pour générer le RTI
      const { data, error } = await supabase.functions.invoke("fill-rti-document", {
        body: {
          vehicleData,
          customerData,
          transformationData: {
            items: allTransformations,
            motif: "Aménagement en autocaravane",
          },
        },
      });

      setProgress(70);

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || "Erreur lors de la génération");
      }

      setGeneratedRTI(data.data);
      setProgress(100);
      setStep('preview');

      toast.success("Document RTI généré avec succès", {
        description: "Vérifiez les données avant de télécharger",
      });
    } catch (error: any) {
      console.error("Erreur génération RTI:", error);
      toast.error("Erreur lors de la génération", {
        description: error.message,
      });
      setStep('select');
    } finally {
      setLoading(false);
      setProgress(0);
    }
  };

  const handleDownload = () => {
    if (!generatedRTI) return;

    // Créer un fichier texte avec les données
    const content = JSON.stringify(generatedRTI, null, 2);
    const blob = new Blob([content], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `RTI_${vehicleData?.immatriculation || "document"}_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success("Document RTI téléchargé", {
      description: "Utilisez ces données pour remplir le formulaire PDF",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-yellow-500" />
            Remplissage automatique RTI
            <Badge variant="secondary">IA Gemini</Badge>
          </DialogTitle>
          <DialogDescription>
            Génération automatique des données pour le formulaire RTI 03.5.1
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          {step === 'select' && (
            <div className="space-y-6">
              {/* Informations véhicule */}
              <div>
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  Données véhicule (carte grise)
                </h3>
                <div className="grid grid-cols-2 gap-2 p-3 bg-green-50 rounded-lg text-sm">
                  <div>
                    <span className="text-muted-foreground">VIN:</span>
                    <span className="ml-2 font-mono">{vehicleData?.vin}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Immat:</span>
                    <span className="ml-2 font-bold">{vehicleData?.immatriculation}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Marque:</span>
                    <span className="ml-2">{vehicleData?.marque}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">PTAC:</span>
                    <span className="ml-2">{vehicleData?.ptac} kg</span>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Informations client */}
              <div>
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  Données client
                </h3>
                <div className="p-3 bg-blue-50 rounded-lg text-sm">
                  <p>
                    <strong>{customerData?.nom} {customerData?.prenom}</strong>
                  </p>
                  <p className="text-muted-foreground">{customerData?.telephone}</p>
                  <p className="text-muted-foreground">{customerData?.email}</p>
                </div>
              </div>

              <Separator />

              {/* Transformations */}
              <div>
                <h3 className="text-sm font-semibold mb-2">
                  Travaux de transformation
                </h3>
                
                {transformations.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground mb-2">
                      Sélectionnez les éléments à inclure dans le dossier RTI :
                    </p>
                    {transformations.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded"
                      >
                        <Checkbox
                          id={item.id}
                          checked={item.selected}
                          onCheckedChange={() => toggleTransformation(item.id)}
                        />
                        <Label htmlFor={item.id} className="flex-1 cursor-pointer">
                          <div className="flex items-center gap-2">
                            <span>{item.name}</span>
                            <Badge variant="outline" className="text-xs">
                              {item.category}
                            </Badge>
                          </div>
                        </Label>
                      </div>
                    ))}
                  </div>
                ) : (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Aucune dépense enregistrée. Vous pouvez ajouter des transformations manuellement.
                    </AlertDescription>
                  </Alert>
                )}

                <div className="mt-4">
                  <Label htmlFor="manual-transformations">
                    Transformations supplémentaires (optionnel)
                  </Label>
                  <Textarea
                    id="manual-transformations"
                    value={manualTransformations}
                    onChange={(e) => setManualTransformations(e.target.value)}
                    placeholder="Ex: Installation d'un lit escamotable, pose de 2 fenêtres latérales..."
                    rows={4}
                    className="mt-2"
                  />
                </div>
              </div>
            </div>
          )}

          {step === 'generate' && (
            <div className="space-y-4 py-8">
              <div className="text-center">
                <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
                <p className="mt-4 text-lg font-medium">Génération en cours...</p>
                <p className="text-sm text-muted-foreground">
                  L'IA analyse les données et génère le formulaire RTI
                </p>
              </div>
              <Progress value={progress} className="w-full" />
            </div>
          )}

          {step === 'preview' && generatedRTI && (
            <div className="space-y-4">
              <Alert className="border-green-500 bg-green-50">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-900">
                  Document RTI généré avec succès !
                </AlertDescription>
              </Alert>

              {/* Annexe 1 */}
              <div>
                <h3 className="font-semibold mb-2">Annexe 1 - Demande de réception</h3>
                <div className="p-3 bg-gray-50 rounded-lg space-y-2 text-sm">
                  <div><strong>Motif:</strong> {generatedRTI.annexe1?.motifReception}</div>
                  <div><strong>Demandeur:</strong> {generatedRTI.annexe1?.nomPrenom}</div>
                  <div><strong>VIN:</strong> {generatedRTI.annexe1?.numeroIdentification}</div>
                  <div><strong>Transformations:</strong> {generatedRTI.annexe1?.modificationsEffectuees}</div>
                </div>
              </div>

              {/* Annexe 2 */}
              <div>
                <h3 className="font-semibold mb-2">Annexe 2 - Répartition des charges</h3>
                <div className="grid grid-cols-2 gap-2 p-3 bg-gray-50 rounded-lg text-sm">
                  <div><strong>PTAC:</strong> {generatedRTI.annexe2?.ptac} kg</div>
                  <div><strong>Poids vide:</strong> {generatedRTI.annexe2?.poidsVideTotal} kg</div>
                  <div><strong>CUM:</strong> {generatedRTI.annexe2?.chargeUtileMarchandises} kg</div>
                  <div><strong>Passagers:</strong> {generatedRTI.annexe2?.nombrePassagers}</div>
                </div>
              </div>

              {/* Annexe 3 */}
              <div>
                <h3 className="font-semibold mb-2">Annexe 3 - Attestation de transformation</h3>
                <div className="p-3 bg-gray-50 rounded-lg text-sm">
                  <p><strong>Transformateur:</strong> {generatedRTI.annexe3?.transformateur}</p>
                  <p className="mt-2 text-muted-foreground">
                    {generatedRTI.annexe3?.descriptifTransformations}
                  </p>
                </div>
              </div>
            </div>
          )}
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fermer
          </Button>
          
          {step === 'select' && (
            <Button onClick={handleGenerate} disabled={loading}>
              <Sparkles className="h-4 w-4 mr-2" />
              Générer le document
            </Button>
          )}
          
          {step === 'preview' && (
            <>
              <Button variant="outline" onClick={() => setStep('select')}>
                Modifier
              </Button>
              <Button onClick={handleDownload}>
                <FileText className="h-4 w-4 mr-2" />
                Télécharger les données
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
