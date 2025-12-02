// Modale d'aperçu du dossier RTI
// Affiche l'état d'avancement même si des éléments sont manquants

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  Car,
  User,
  Package,
  Scale,
  FileText,
  Wrench,
  Bed,
  Armchair,
  Download,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { downloadRTIPDF, RTIData } from "@/services/rtiGeneratorService";
import { toast } from "sonner";

// ============================================
// TYPES
// ============================================

interface RTIField {
  label: string;
  value: string | number | null | undefined;
  required: boolean;
  source?: string; // D'où vient la donnée
}

interface RTISection {
  title: string;
  icon: React.ReactNode;
  fields: RTIField[];
  isExpanded?: boolean;
}

interface RTIPreviewData {
  // Véhicule
  vehicleMarque?: string;
  vehicleModele?: string;
  vehicleImmatriculation?: string;
  vehicleVin?: string;
  vehicleDatePremiereImmat?: string;
  vehicleGenre?: string;
  vehicleCarrosserie?: string;
  vehicleType?: string;
  vehiclePtac?: number;
  vehiclePoidsVide?: number;
  vehicleEnergie?: string;
  vehiclePuissanceFiscale?: number;
  vehicleCylindree?: number;
  vehiclePlacesAssises?: number;

  // Client/Propriétaire
  clientNom?: string;
  clientPrenom?: string;
  clientAdresse?: string;
  clientCodePostal?: string;
  clientVille?: string;
  clientTelephone?: string;
  clientEmail?: string;

  // Transformation
  projectName?: string;
  transformationType?: string;
  descriptionTransformation?: string;

  // Équipements
  equipements: {
    nom: string;
    marque?: string;
    numeroAgrement?: string;
    type?: string;
    poids?: number;
  }[];

  // Poids
  poidsVideAvant?: number;
  poidsAmenagements?: number;
  poidsApresTransformation?: number;
  chargeUtile?: number;

  // Aménagement
  placesCouchage?: number;
  placesAssisesApres?: number;
  meubles: {
    nom: string;
    poids?: number;
  }[];
}

interface RTIPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
}

// ============================================
// COMPOSANTS HELPERS
// ============================================

const FieldStatus = ({ field }: { field: RTIField }) => {
  const hasValue = field.value !== null && field.value !== undefined && field.value !== "";

  if (hasValue) {
    return <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />;
  }

  if (field.required) {
    return <XCircle className="h-4 w-4 text-red-500 shrink-0" />;
  }

  return <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />;
};

const FieldRow = ({ field }: { field: RTIField }) => {
  const hasValue = field.value !== null && field.value !== undefined && field.value !== "";

  return (
    <div className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/50">
      <div className="flex items-center gap-2 flex-1">
        <FieldStatus field={field} />
        <span className="text-sm">{field.label}</span>
        {field.required && (
          <Badge variant="outline" className="text-[10px] h-4 px-1">
            Requis
          </Badge>
        )}
      </div>
      <div className="text-sm text-right max-w-[200px] truncate">
        {hasValue ? (
          <span className="font-medium">{String(field.value)}</span>
        ) : (
          <span className="text-muted-foreground italic">Non renseigné</span>
        )}
      </div>
    </div>
  );
};

const SectionCard = ({
  section,
  isExpanded,
  onToggle,
}: {
  section: RTISection;
  isExpanded: boolean;
  onToggle: () => void;
}) => {
  const filledCount = section.fields.filter((f) => f.value !== null && f.value !== undefined && f.value !== "").length;
  const requiredCount = section.fields.filter((f) => f.required).length;
  const filledRequiredCount = section.fields.filter(
    (f) => f.required && f.value !== null && f.value !== undefined && f.value !== "",
  ).length;

  const completionPercent = section.fields.length > 0 ? Math.round((filledCount / section.fields.length) * 100) : 0;

  const requiredComplete = requiredCount === 0 || filledRequiredCount === requiredCount;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="p-3 cursor-pointer hover:bg-muted/50 transition-colors" onClick={onToggle}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {section.icon}
            <CardTitle className="text-sm font-medium">{section.title}</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={requiredComplete ? "default" : "destructive"} className="text-xs">
              {filledCount}/{section.fields.length}
            </Badge>
            {isExpanded ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </div>
        <Progress value={completionPercent} className="h-1 mt-2" />
      </CardHeader>

      {isExpanded && (
        <CardContent className="p-2 pt-0 border-t">
          <div className="space-y-0.5">
            {section.fields.map((field, i) => (
              <FieldRow key={i} field={field} />
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
};

// ============================================
// COMPOSANT PRINCIPAL
// ============================================

export function RTIPreviewDialog({ open, onOpenChange, projectId }: RTIPreviewDialogProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [data, setData] = useState<RTIPreviewData | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["vehicule", "proprietaire"]));

  // Charger les données
  useEffect(() => {
    if (open && projectId) {
      loadData();
    }
  }, [open, projectId]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Charger le projet
      const { data: project } = await (supabase as any).from("projects").select("*").eq("id", projectId).single();

      // Charger la carte grise
      const { data: vehicleReg } = await (supabase as any)
        .from("vehicle_registration")
        .select("*")
        .eq("project_id", projectId)
        .single();

      // Charger le client
      let client = null;
      if (project?.client_id) {
        const { data: clientData } = await (supabase as any)
          .from("clients")
          .select("*")
          .eq("id", project.client_id)
          .single();
        client = clientData;
      }

      // Charger les accessoires
      const { data: accessories } = await (supabase as any)
        .from("project_accessories")
        .select(
          `
          quantity,
          accessory:accessories_catalog(nom, marque, poids_kg, type_electrique)
        `,
        )
        .eq("project_id", projectId);

      // Charger les tâches
      const { data: tasks } = await (supabase as any)
        .from("work_tasks")
        .select("name, description, category")
        .eq("project_id", projectId);

      // Parser furniture_data
      let meubles: { nom: string; poids?: number }[] = [];
      let totalPoidsMeubles = 0;

      if (project?.furniture_data) {
        try {
          const furnitureData =
            typeof project.furniture_data === "string" ? JSON.parse(project.furniture_data) : project.furniture_data;

          if (Array.isArray(furnitureData)) {
            meubles = furnitureData.map((item: any) => {
              const poids = item.poids_kg || item.weight || item.poids || 0;
              totalPoidsMeubles += poids;
              return {
                nom: item.name || item.nom || "Élément",
                poids,
              };
            });
          }
        } catch (e) {
          console.error("Erreur parsing furniture_data:", e);
        }
      }

      // Calculer poids total accessoires
      let totalPoidsAccessoires = 0;
      const equipements = (accessories || []).map((acc: any) => {
        const poids = (acc.accessory?.poids_kg || 0) * (acc.quantity || 1);
        totalPoidsAccessoires += poids;
        return {
          nom: acc.accessory?.nom || "Accessoire",
          marque: acc.accessory?.marque,
          poids,
          type: acc.accessory?.type_electrique,
        };
      });

      // Calculer poids après transformation
      const poidsVide = vehicleReg?.poids_vide || project?.poids_vide_kg || 0;
      const poidsAmenagements = totalPoidsMeubles + totalPoidsAccessoires;
      const poidsApres = poidsVide + poidsAmenagements;
      const ptac = vehicleReg?.ptac || project?.ptac_kg || 0;
      const chargeUtile = ptac > 0 ? ptac - poidsApres : 0;

      setData({
        // Véhicule
        vehicleMarque: vehicleReg?.marque || project?.marque_vehicule,
        vehicleModele: vehicleReg?.modele || project?.modele_vehicule,
        vehicleImmatriculation: vehicleReg?.immatriculation || project?.immatriculation,
        vehicleVin: vehicleReg?.vin || project?.numero_chassis_vin,
        vehicleDatePremiereImmat: vehicleReg?.date_premiere_immatriculation || project?.date_premiere_immatriculation,
        vehicleGenre: vehicleReg?.genre || project?.genre_national,
        vehicleCarrosserie: vehicleReg?.carrosserie || project?.carrosserie,
        vehicleType: vehicleReg?.type || project?.type_mine,
        vehiclePtac: vehicleReg?.ptac || project?.ptac_kg,
        vehiclePoidsVide: vehicleReg?.poids_vide || project?.poids_vide_kg,
        vehicleEnergie: vehicleReg?.energie || project?.energie,
        vehiclePuissanceFiscale: vehicleReg?.puissance_fiscale || project?.puissance_fiscale,
        vehicleCylindree: vehicleReg?.cylindree || project?.cylindree,
        vehiclePlacesAssises: vehicleReg?.places_assises || project?.nombre_places,

        // Client
        clientNom: client?.last_name || project?.nom_proprietaire,
        clientPrenom: client?.first_name || project?.prenom_proprietaire,
        clientAdresse: client?.address || project?.adresse_proprietaire,
        clientCodePostal: client?.postal_code || project?.code_postal_proprietaire,
        clientVille: client?.city || project?.ville_proprietaire,
        clientTelephone: client?.phone || project?.telephone_proprietaire,
        clientEmail: client?.email || project?.email_proprietaire,

        // Transformation
        projectName: project?.name || project?.nom_projet,
        descriptionTransformation: project?.description,

        // Équipements
        equipements,

        // Poids
        poidsVideAvant: poidsVide,
        poidsAmenagements,
        poidsApresTransformation: poidsApres,
        chargeUtile,

        // Aménagement
        placesAssisesApres: project?.nombre_places,
        meubles,
      });
    } catch (error) {
      console.error("Erreur chargement données RTI:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  // Générer le PDF RTI
  const handleGeneratePDF = async () => {
    if (!data) return;

    setIsGenerating(true);
    try {
      const rtiData: RTIData = {
        // Véhicule
        vehicleMarque: data.vehicleMarque,
        vehicleModele: data.vehicleModele,
        vehicleImmatriculation: data.vehicleImmatriculation,
        vehicleVin: data.vehicleVin,
        vehicleDatePremiereImmat: data.vehicleDatePremiereImmat,
        vehicleGenre: data.vehicleGenre,
        vehicleCarrosserie: data.vehicleCarrosserie,
        vehicleType: data.vehicleType,
        vehiclePtac: data.vehiclePtac,
        vehiclePoidsVide: data.vehiclePoidsVide,
        vehicleEnergie: data.vehicleEnergie,
        vehiclePuissanceFiscale: data.vehiclePuissanceFiscale,
        vehicleCylindree: data.vehicleCylindree,
        vehiclePlacesAssises: data.vehiclePlacesAssises,

        // Client
        clientNom: data.clientNom,
        clientPrenom: data.clientPrenom,
        clientAdresse: data.clientAdresse,
        clientCodePostal: data.clientCodePostal,
        clientVille: data.clientVille,
        clientTelephone: data.clientTelephone,
        clientEmail: data.clientEmail,

        // Projet
        projectName: data.projectName,
        descriptionTransformation: data.descriptionTransformation,

        // Équipements
        equipements: data.equipements.map((eq) => ({
          nom: eq.nom,
          marque: eq.marque,
          numeroAgrement: eq.numeroAgrement,
          poids: eq.poids,
        })),

        // Poids
        poidsVideAvant: data.poidsVideAvant,
        poidsAmenagements: data.poidsAmenagements,
        poidsApresTransformation: data.poidsApresTransformation,
        chargeUtile: data.chargeUtile,

        // Aménagements
        placesCouchage: data.placesCouchage,
        placesAssisesApres: data.placesAssisesApres,
        meubles: data.meubles.map((m) => ({
          nom: m.nom,
          poids: m.poids,
        })),
      };

      await downloadRTIPDF(rtiData, `RTI_${data.projectName || "projet"}.pdf`);
      toast.success("PDF RTI généré avec succès !");
    } catch (error) {
      console.error("Erreur génération PDF:", error);
      toast.error("Erreur lors de la génération du PDF");
    } finally {
      setIsGenerating(false);
    }
  };

  // Construire les sections
  const sections: (RTISection & { id: string })[] = data
    ? [
        {
          id: "vehicule",
          title: "Véhicule",
          icon: <Car className="h-4 w-4 text-blue-500" />,
          fields: [
            { label: "Marque", value: data.vehicleMarque, required: true },
            { label: "Modèle", value: data.vehicleModele, required: true },
            { label: "Immatriculation", value: data.vehicleImmatriculation, required: true },
            { label: "N° VIN / Châssis", value: data.vehicleVin, required: true },
            { label: "Date 1ère immat.", value: data.vehicleDatePremiereImmat, required: true },
            { label: "Genre", value: data.vehicleGenre, required: true },
            { label: "Carrosserie", value: data.vehicleCarrosserie, required: true },
            { label: "Type Mine", value: data.vehicleType, required: false },
            { label: "Énergie", value: data.vehicleEnergie, required: true },
            {
              label: "Puissance fiscale",
              value: data.vehiclePuissanceFiscale ? `${data.vehiclePuissanceFiscale} CV` : null,
              required: false,
            },
            {
              label: "Cylindrée",
              value: data.vehicleCylindree ? `${data.vehicleCylindree} cm³` : null,
              required: false,
            },
            { label: "Places assises origine", value: data.vehiclePlacesAssises, required: true },
          ],
        },
        {
          id: "proprietaire",
          title: "Propriétaire",
          icon: <User className="h-4 w-4 text-purple-500" />,
          fields: [
            { label: "Nom", value: data.clientNom, required: true },
            { label: "Prénom", value: data.clientPrenom, required: true },
            { label: "Adresse", value: data.clientAdresse, required: true },
            { label: "Code postal", value: data.clientCodePostal, required: true },
            { label: "Ville", value: data.clientVille, required: true },
            { label: "Téléphone", value: data.clientTelephone, required: false },
            { label: "Email", value: data.clientEmail, required: false },
          ],
        },
        {
          id: "poids",
          title: "Masses et charges",
          icon: <Scale className="h-4 w-4 text-orange-500" />,
          fields: [
            { label: "PTAC", value: data.vehiclePtac ? `${data.vehiclePtac} kg` : null, required: true },
            {
              label: "Poids à vide origine",
              value: data.poidsVideAvant ? `${data.poidsVideAvant} kg` : null,
              required: true,
            },
            {
              label: "Poids des aménagements",
              value: data.poidsAmenagements ? `${data.poidsAmenagements} kg` : null,
              required: true,
            },
            {
              label: "Poids après transformation",
              value: data.poidsApresTransformation ? `${data.poidsApresTransformation} kg` : null,
              required: true,
            },
            {
              label: "Charge utile restante",
              value: data.chargeUtile ? `${data.chargeUtile} kg` : null,
              required: true,
            },
          ],
        },
        {
          id: "equipements",
          title: `Équipements (${data.equipements.length})`,
          icon: <Package className="h-4 w-4 text-green-500" />,
          fields:
            data.equipements.length > 0
              ? data.equipements.map((eq) => ({
                  label: eq.nom,
                  value: eq.marque
                    ? `${eq.marque}${eq.poids ? ` - ${eq.poids} kg` : ""}`
                    : eq.poids
                      ? `${eq.poids} kg`
                      : "Installé",
                  required: false,
                }))
              : [{ label: "Aucun équipement", value: null, required: false }],
        },
        {
          id: "amenagement",
          title: `Aménagements (${data.meubles.length})`,
          icon: <Armchair className="h-4 w-4 text-amber-500" />,
          fields:
            data.meubles.length > 0
              ? data.meubles.map((m) => ({
                  label: m.nom,
                  value: m.poids ? `${m.poids} kg` : "Défini",
                  required: false,
                }))
              : [{ label: "Aucun meuble défini", value: null, required: false }],
        },
      ]
    : [];

  // Calculer la progression globale
  const totalFields = sections.flatMap((s) => s.fields).length;
  const filledFields = sections
    .flatMap((s) => s.fields)
    .filter((f) => f.value !== null && f.value !== undefined && f.value !== "").length;
  const requiredFields = sections.flatMap((s) => s.fields).filter((f) => f.required);
  const filledRequiredFields = requiredFields.filter(
    (f) => f.value !== null && f.value !== undefined && f.value !== "",
  ).length;

  const globalProgress = totalFields > 0 ? Math.round((filledFields / totalFields) * 100) : 0;
  const requiredProgress =
    requiredFields.length > 0 ? Math.round((filledRequiredFields / requiredFields.length) * 100) : 100;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Aperçu du dossier RTI
          </DialogTitle>
          <DialogDescription>
            {data?.projectName || "Projet en cours"} - État d'avancement de votre dossier d'homologation
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {/* Barre de progression globale */}
            <div className="space-y-3 pb-3 border-b shrink-0">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Progression globale</span>
                <span className="text-sm text-muted-foreground">
                  {filledFields}/{totalFields} champs remplis
                </span>
              </div>
              <Progress value={globalProgress} className="h-2" />

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Champs obligatoires</span>
                <Badge variant={requiredProgress === 100 ? "default" : "destructive"}>
                  {filledRequiredFields}/{requiredFields.length}
                </Badge>
              </div>
              <Progress
                value={requiredProgress}
                className={cn("h-2", requiredProgress === 100 ? "[&>div]:bg-green-500" : "[&>div]:bg-red-500")}
              />

              {/* Statut global */}
              <div className="flex items-center gap-2 mt-2">
                {requiredProgress === 100 ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    <span className="text-sm text-green-700 font-medium">Dossier complet - Prêt pour génération</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-5 w-5 text-amber-500" />
                    <span className="text-sm text-amber-700 font-medium">
                      {requiredFields.length - filledRequiredFields} champ(s) obligatoire(s) manquant(s)
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Sections */}
            <ScrollArea className="flex-1 min-h-0 pr-4">
              <div className="space-y-3 py-3">
                {sections.map((section) => (
                  <SectionCard
                    key={section.id}
                    section={section}
                    isExpanded={expandedSections.has(section.id)}
                    onToggle={() => toggleSection(section.id)}
                  />
                ))}
              </div>
            </ScrollArea>

            {/* Actions */}
            <div className="flex items-center justify-between pt-3 border-t shrink-0">
              <div className="text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-green-500" /> Rempli
                </span>
                <span className="inline-flex items-center gap-1 ml-3">
                  <XCircle className="h-3 w-3 text-red-500" /> Requis manquant
                </span>
                <span className="inline-flex items-center gap-1 ml-3">
                  <AlertCircle className="h-3 w-3 text-amber-500" /> Optionnel
                </span>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Fermer
                </Button>
                <Button disabled={isGenerating} onClick={handleGeneratePDF}>
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Génération...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      Générer le RTI
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default RTIPreviewDialog;
