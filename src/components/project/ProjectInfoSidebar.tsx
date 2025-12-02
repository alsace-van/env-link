import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  X,
  Edit,
  ChevronLeft,
  ChevronRight,
  FileText,
  User,
  Ruler,
  Weight,
  Car,
  ClipboardList,
} from "lucide-react";

interface Project {
  id: string;
  nom_proprietaire: string;
  nom_projet?: string;
  adresse_proprietaire?: string;
  telephone_proprietaire?: string;
  email_proprietaire?: string;
  numero_chassis?: string;
  immatriculation?: string;
  type_mine?: string;
  date_premiere_circulation?: string;
  marque_custom?: string;
  modele_custom?: string;
  longueur_mm?: number;
  largeur_mm?: number;
  hauteur_mm?: number;
  longueur_chargement_mm?: number;
  largeur_chargement_mm?: number;
  poids_vide_kg?: number;
  charge_utile_kg?: number;
  ptac_kg?: number;
  vehicles_catalog?: {
    marque: string;
    modele: string;
  };
  prenom_proprietaire?: string;
  ville_proprietaire?: string;
  code_postal_proprietaire?: string;
  date_premiere_immatriculation?: string;
  puissance_fiscale?: number;
  cylindree?: number;
  masse_vide?: number;
  masse_en_charge_max?: number;
  numero_chassis_vin?: string;
  vin?: string;
  denomination_commerciale?: string;
  genre_national?: string;
  carrosserie?: string;
  energie?: string;
  ptra?: number;
  masse_ordre_marche_kg?: number;
  marque_officielle?: string;
  modele_officiel?: string;
  nombre_places?: number;
  marque_vehicule?: string;
  modele_vehicule?: string;
  categorie_international?: string;
  type_variante?: string;
  numero_reception_ce?: string;
  places_assises_origine?: number;
  puissance_kw?: number;
  co2_emission?: number;
  norme_euro?: string;
  carrosserie_ce?: string;
  carrosserie_nationale?: string;
}

interface ProjectInfoSidebarProps {
  project: Project;
  isOpen: boolean;
  onClose: () => void;
  onEdit: () => void;
}

export const ProjectInfoSidebar = ({ project, isOpen, onClose, onEdit }: ProjectInfoSidebarProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!isOpen) return null;

  // Vérifie si on a des données RTI / Dimensions / Poids
  const hasRTIData = !!(
    project.categorie_international ||
    project.type_variante ||
    project.numero_reception_ce ||
    project.places_assises_origine ||
    project.puissance_kw ||
    project.norme_euro ||
    project.co2_emission
  );

  const hasDimensionsData = !!(
    project.longueur_mm ||
    project.largeur_mm ||
    project.hauteur_mm ||
    project.longueur_chargement_mm ||
    project.largeur_chargement_mm
  );

  const hasWeightData = !!(
    project.poids_vide_kg ||
    project.masse_vide ||
    project.masse_ordre_marche_kg ||
    project.charge_utile_kg ||
    project.ptac_kg ||
    project.masse_en_charge_max ||
    project.ptra
  );

  const hasExtendedContent = hasRTIData || hasDimensionsData || hasWeightData;

  return (
    <>
      {/* Overlay transparent */}
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />

      {/* Sidebar avec animation */}
      <div
        className={`fixed left-0 top-1/2 -translate-y-1/2 z-50 h-[85vh] bg-card shadow-2xl rounded-r-xl overflow-hidden transition-all duration-300 flex ${
          isExpanded ? "w-[850px]" : "w-[380px]"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Panneau principal - Informations générales + Propriétaire */}
        <div className="w-[380px] flex flex-col border-r border-blue-200 dark:border-blue-800">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b bg-blue-50 dark:bg-blue-950/30 flex-shrink-0">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              <h2 className="text-lg font-semibold">Informations Projet</h2>
            </div>
            <div className="flex items-center gap-1">
              {hasExtendedContent && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsExpanded(!isExpanded)}
                  title={isExpanded ? "Réduire" : "Voir RTI & Dimensions"}
                  className="text-blue-600 hover:text-blue-700 hover:bg-blue-100"
                >
                  {isExpanded ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={onEdit}>
                <Edit className="h-4 w-4 mr-2" />
                Modifier
              </Button>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Contenu scrollable - Infos générales + Propriétaire */}
          <ScrollArea className="flex-1 p-4">
            {/* Informations générales */}
            <div className="space-y-1.5 mb-4">
              <div className="flex items-center gap-2 mb-3">
                <Car className="h-4 w-4 text-blue-600" />
                <h4 className="text-sm font-semibold text-blue-600">Véhicule</h4>
              </div>
              
              {project.nom_projet && (
                <div className="flex gap-2 text-xs">
                  <span className="text-muted-foreground shrink-0 w-32">Nom du projet :</span>
                  <p className="font-medium">{project.nom_projet}</p>
                </div>
              )}
              {project.immatriculation && (
                <div className="flex gap-2 text-xs">
                  <span className="text-muted-foreground shrink-0 w-32">Immatriculation :</span>
                  <p className="font-medium">{project.immatriculation}</p>
                </div>
              )}
              {(project.vin || project.numero_chassis_vin || project.numero_chassis) && (
                <div className="flex gap-2 text-xs">
                  <span className="text-muted-foreground shrink-0 w-32">N° châssis (VIN) :</span>
                  <p className="font-medium text-xs">{project.vin || project.numero_chassis_vin || project.numero_chassis}</p>
                </div>
              )}
              {project.type_mine && (
                <div className="flex gap-2 text-xs">
                  <span className="text-muted-foreground shrink-0 w-32">Type mine :</span>
                  <p className="font-medium">{project.type_mine}</p>
                </div>
              )}
              {(project.marque_officielle || project.marque_vehicule || project.marque_custom) && (
                <div className="flex gap-2 text-xs">
                  <span className="text-muted-foreground shrink-0 w-32">Marque :</span>
                  <p className="font-medium">{project.marque_officielle || project.marque_vehicule || project.marque_custom}</p>
                </div>
              )}
              {(project.modele_officiel || project.modele_vehicule || project.modele_custom) && (
                <div className="flex gap-2 text-xs">
                  <span className="text-muted-foreground shrink-0 w-32">Modèle :</span>
                  <p className="font-medium">{project.modele_officiel || project.modele_vehicule || project.modele_custom}</p>
                </div>
              )}
              {project.denomination_commerciale && (
                <div className="flex gap-2 text-xs">
                  <span className="text-muted-foreground shrink-0 w-32">Dénomination :</span>
                  <p className="font-medium">{project.denomination_commerciale}</p>
                </div>
              )}
              {project.genre_national && (
                <div className="flex gap-2 text-xs">
                  <span className="text-muted-foreground shrink-0 w-32">Genre :</span>
                  <p className="font-medium">{project.genre_national}</p>
                </div>
              )}
              {project.carrosserie && (
                <div className="flex gap-2 text-xs">
                  <span className="text-muted-foreground shrink-0 w-32">Carrosserie :</span>
                  <p className="font-medium">{project.carrosserie}</p>
                </div>
              )}
              {project.energie && (
                <div className="flex gap-2 text-xs">
                  <span className="text-muted-foreground shrink-0 w-32">Énergie :</span>
                  <p className="font-medium">{project.energie}</p>
                </div>
              )}
              {project.nombre_places && (
                <div className="flex gap-2 text-xs">
                  <span className="text-muted-foreground shrink-0 w-32">Nombre de places :</span>
                  <p className="font-medium">{project.nombre_places}</p>
                </div>
              )}
              {project.puissance_fiscale && (
                <div className="flex gap-2 text-xs">
                  <span className="text-muted-foreground shrink-0 w-32">Puissance fiscale :</span>
                  <p className="font-medium">{project.puissance_fiscale} CV</p>
                </div>
              )}
              {project.cylindree && (
                <div className="flex gap-2 text-xs">
                  <span className="text-muted-foreground shrink-0 w-32">Cylindrée :</span>
                  <p className="font-medium">{project.cylindree} cm³</p>
                </div>
              )}
              {project.date_premiere_circulation && (
                <div className="flex gap-2 text-xs">
                  <span className="text-muted-foreground shrink-0 w-32">1ère circulation :</span>
                  <p className="font-medium">{new Date(project.date_premiere_circulation).toLocaleDateString("fr-FR")}</p>
                </div>
              )}
              {project.date_premiere_immatriculation && (
                <div className="flex gap-2 text-xs">
                  <span className="text-muted-foreground shrink-0 w-32">1ère immat. :</span>
                  <p className="font-medium">{new Date(project.date_premiere_immatriculation).toLocaleDateString("fr-FR")}</p>
                </div>
              )}
            </div>

            {/* Propriétaire */}
            <div className="space-y-1.5 pt-4 border-t">
              <div className="flex items-center gap-2 mb-3">
                <User className="h-4 w-4 text-green-600" />
                <h4 className="text-sm font-semibold text-green-600">Propriétaire</h4>
              </div>
              
              {(project.prenom_proprietaire || project.nom_proprietaire) && (
                <div className="flex gap-2 text-xs">
                  <span className="text-muted-foreground shrink-0 w-32">Nom :</span>
                  <p className="font-medium">{project.prenom_proprietaire} {project.nom_proprietaire}</p>
                </div>
              )}
              {project.adresse_proprietaire && (
                <div className="flex gap-2 text-xs">
                  <span className="text-muted-foreground shrink-0 w-32">Adresse :</span>
                  <p className="font-medium">{project.adresse_proprietaire}</p>
                </div>
              )}
              {(project.code_postal_proprietaire || project.ville_proprietaire) && (
                <div className="flex gap-2 text-xs">
                  <span className="text-muted-foreground shrink-0 w-32">Ville :</span>
                  <p className="font-medium">{project.code_postal_proprietaire} {project.ville_proprietaire}</p>
                </div>
              )}
              {project.telephone_proprietaire && (
                <div className="flex gap-2 text-xs">
                  <span className="text-muted-foreground shrink-0 w-32">Téléphone :</span>
                  <p className="font-medium">{project.telephone_proprietaire}</p>
                </div>
              )}
              {project.email_proprietaire && (
                <div className="flex gap-2 text-xs">
                  <span className="text-muted-foreground shrink-0 w-32">Email :</span>
                  <p className="font-medium">{project.email_proprietaire}</p>
                </div>
              )}
            </div>

            {/* Bouton pour étendre si non étendu et données disponibles */}
            {hasExtendedContent && !isExpanded && (
              <div className="mt-6 pt-4 border-t">
                <Button 
                  variant="outline" 
                  className="w-full text-blue-600 border-blue-200 hover:bg-blue-50"
                  onClick={() => setIsExpanded(true)}
                >
                  <ChevronRight className="h-4 w-4 mr-2" />
                  Voir données RTI & Dimensions
                </Button>
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Panneau étendu - RTI + Dimensions + Poids */}
        {isExpanded && (
          <div className="w-[470px] flex flex-col bg-muted/10">
            {/* Header du panneau étendu */}
            <div className="flex items-center justify-between p-4 border-b bg-orange-50 dark:bg-orange-950/30 flex-shrink-0">
              <div className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-orange-600" />
                <h3 className="font-semibold text-orange-700 dark:text-orange-400">Données techniques & Dimensions</h3>
              </div>
            </div>

            <ScrollArea className="flex-1 p-4">
              {/* Données techniques RTI */}
              {hasRTIData && (
                <div className="space-y-2 mb-6 p-4 rounded-lg bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
                  <h4 className="text-sm font-semibold text-blue-700 dark:text-blue-400 mb-3 flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Données techniques RTI
                  </h4>
                  {project.categorie_international && (
                    <div className="flex gap-2 text-xs">
                      <span className="text-muted-foreground shrink-0 w-36">Catégorie (J) :</span>
                      <p className="font-bold text-blue-700 dark:text-blue-400">{project.categorie_international}</p>
                    </div>
                  )}
                  {project.type_variante && (
                    <div className="flex gap-2 text-xs">
                      <span className="text-muted-foreground shrink-0 w-36">Type variante (D.2) :</span>
                      <p className="font-medium font-mono">{project.type_variante}</p>
                    </div>
                  )}
                  {project.numero_reception_ce && (
                    <div className="flex gap-2 text-xs">
                      <span className="text-muted-foreground shrink-0 w-36">N° Réception (K) :</span>
                      <p className="font-medium font-mono">{project.numero_reception_ce}</p>
                    </div>
                  )}
                  {project.places_assises_origine && (
                    <div className="flex gap-2 text-xs">
                      <span className="text-muted-foreground shrink-0 w-36">Places origine (S.1) :</span>
                      <p className="font-medium">{project.places_assises_origine}</p>
                    </div>
                  )}
                  {project.puissance_kw && (
                    <div className="flex gap-2 text-xs">
                      <span className="text-muted-foreground shrink-0 w-36">Puissance (P.2) :</span>
                      <p className="font-medium">{project.puissance_kw} kW</p>
                    </div>
                  )}
                  {project.norme_euro && (
                    <div className="flex gap-2 text-xs">
                      <span className="text-muted-foreground shrink-0 w-36">Norme Euro (V.9) :</span>
                      <p className="font-medium text-green-700 dark:text-green-400">{project.norme_euro}</p>
                    </div>
                  )}
                  {project.co2_emission && (
                    <div className="flex gap-2 text-xs">
                      <span className="text-muted-foreground shrink-0 w-36">CO2 (V.7) :</span>
                      <p className="font-medium">{project.co2_emission} g/km</p>
                    </div>
                  )}
                </div>
              )}

              {/* Dimensions totales */}
              {hasDimensionsData && (
                <div className="grid grid-cols-2 gap-4 mb-6">
                  {/* Dimensions totales */}
                  {(project.longueur_mm || project.largeur_mm || project.hauteur_mm) && (
                    <div className="p-4 rounded-lg bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
                      <h4 className="text-xs font-semibold text-blue-700 dark:text-blue-400 mb-3 flex items-center gap-2">
                        <Ruler className="h-4 w-4" />
                        Dimensions totales
                      </h4>
                      {project.longueur_mm && (
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-muted-foreground">Longueur</span>
                          <span className="font-medium">{project.longueur_mm} mm</span>
                        </div>
                      )}
                      {project.largeur_mm && (
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-muted-foreground">Largeur</span>
                          <span className="font-medium">{project.largeur_mm} mm</span>
                        </div>
                      )}
                      {project.hauteur_mm && (
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Hauteur</span>
                          <span className="font-medium">{project.hauteur_mm} mm</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Surface utile */}
                  {(project.longueur_chargement_mm || project.largeur_chargement_mm) && (
                    <div className="p-4 rounded-lg bg-orange-50/50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800">
                      <h4 className="text-xs font-semibold text-orange-700 dark:text-orange-400 mb-3 flex items-center gap-2">
                        <Ruler className="h-4 w-4" />
                        Surface utile
                      </h4>
                      {project.longueur_chargement_mm && (
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-muted-foreground">Longueur</span>
                          <span className="font-medium">{project.longueur_chargement_mm} mm</span>
                        </div>
                      )}
                      {project.largeur_chargement_mm && (
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Largeur</span>
                          <span className="font-medium">{project.largeur_chargement_mm} mm</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Poids */}
              {hasWeightData && (
                <div className="p-4 rounded-lg bg-green-50/50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
                  <h4 className="text-xs font-semibold text-green-700 dark:text-green-400 mb-3 flex items-center gap-2">
                    <Weight className="h-4 w-4" />
                    Poids
                  </h4>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                    {(project.poids_vide_kg || project.masse_vide) && (
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Poids à vide</span>
                        <span className="font-medium">{project.poids_vide_kg || project.masse_vide} kg</span>
                      </div>
                    )}
                    {project.masse_ordre_marche_kg && (
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Masse ordre marche</span>
                        <span className="font-medium">{project.masse_ordre_marche_kg} kg</span>
                      </div>
                    )}
                    {project.charge_utile_kg && (
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Charge utile</span>
                        <span className="font-medium text-green-700">{project.charge_utile_kg} kg</span>
                      </div>
                    )}
                    {(project.ptac_kg || project.masse_en_charge_max) && (
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">PTAC</span>
                        <span className="font-medium">{project.ptac_kg || project.masse_en_charge_max} kg</span>
                      </div>
                    )}
                    {project.ptra && (
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">PTRA</span>
                        <span className="font-medium">{project.ptra} kg</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </ScrollArea>
          </div>
        )}
      </div>
    </>
  );
};

export default ProjectInfoSidebar;
