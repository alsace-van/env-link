import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus,
  Search,
  ChevronDown,
  ChevronRight,
  Car,
  Wrench,
  FileText,
  Image,
  Pencil,
  Trash2,
  GripVertical,
  Eye,
  FolderPlus,
  Settings,
  Copy,
  Download,
} from "lucide-react";
import { toast } from "sonner";

// Types
interface Vehicle {
  id: string;
  marque: string;
  modele: string;
}

interface MechanicalProcedure {
  id: string;
  title: string;
  description?: string;
  vehicle_brand: string;
  vehicle_model: string;
  category: string;
  created_at: string;
  updated_at: string;
  steps?: ProcedureStep[];
}

interface ProcedureStep {
  id: string;
  procedure_id: string;
  step_number: number;
  title: string;
  description?: string;
  image_url?: string;
  drawing_data?: string;
  notes?: string;
  duration_minutes?: number;
  tools_required?: string;
}

// Catégories de gammes de montage
const PROCEDURE_CATEGORIES = [
  { value: "installation", label: "Installation" },
  { value: "demontage", label: "Démontage" },
  { value: "maintenance", label: "Maintenance" },
  { value: "reparation", label: "Réparation" },
  { value: "modification", label: "Modification" },
  { value: "controle", label: "Contrôle" },
  { value: "autre", label: "Autre" },
];

const MechanicalProcedures = () => {
  // États
  const [procedures, setProcedures] = useState<MechanicalProcedure[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBrand, setSelectedBrand] = useState<string>("all");
  const [selectedModel, setSelectedModel] = useState<string>("all");
  
  // États pour les dialogues
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isStepDialogOpen, setIsStepDialogOpen] = useState(false);
  
  // États pour les formulaires
  const [selectedProcedure, setSelectedProcedure] = useState<MechanicalProcedure | null>(null);
  const [newProcedure, setNewProcedure] = useState({
    title: "",
    description: "",
    vehicle_brand: "",
    vehicle_model: "",
    category: "installation",
  });
  const [newStep, setNewStep] = useState({
    title: "",
    description: "",
    notes: "",
    duration_minutes: 0,
    tools_required: "",
  });
  const [editingStep, setEditingStep] = useState<ProcedureStep | null>(null);
  
  // États pour l'arborescence
  const [expandedBrands, setExpandedBrands] = useState<Set<string>>(new Set());
  const [expandedModels, setExpandedModels] = useState<Set<string>>(new Set());

  // Charger les données
  useEffect(() => {
    loadProcedures();
    loadVehicles();
  }, []);

  const loadProcedures = async () => {
    setIsLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      // Charger les gammes depuis Supabase
      const { data: proceduresData, error: proceduresError } = await (supabase as any)
        .from("mechanical_procedures")
        .select("*")
        .eq("user_id", userData.user.id)
        .order("created_at", { ascending: false });

      if (proceduresError) {
        console.error("Erreur chargement gammes:", proceduresError);
        toast.error("Erreur lors du chargement des gammes");
        return;
      }

      // Charger les étapes pour chaque gamme
      if (proceduresData && proceduresData.length > 0) {
        const procedureIds = proceduresData.map((p: any) => p.id);
        const { data: stepsData, error: stepsError } = await (supabase as any)
          .from("mechanical_procedure_steps")
          .select("*")
          .in("procedure_id", procedureIds)
          .order("step_number", { ascending: true });

        if (stepsError) {
          console.error("Erreur chargement étapes:", stepsError);
        }

        // Associer les étapes aux gammes
        const proceduresWithSteps = proceduresData.map((proc: any) => ({
          ...proc,
          steps: stepsData?.filter((s: any) => s.procedure_id === proc.id) || [],
        }));

        setProcedures(proceduresWithSteps);
      } else {
        setProcedures([]);
      }
    } catch (error) {
      console.error("Erreur chargement:", error);
      toast.error("Erreur lors du chargement");
    } finally {
      setIsLoading(false);
    }
  };

  const loadVehicles = async () => {
    try {
      const { data } = await (supabase as any)
        .from("vehicles_catalog")
        .select("id, marque, modele")
        .order("marque");
      
      if (data) {
        setVehicles(data);
      }
    } catch (error) {
      console.error("Erreur chargement véhicules:", error);
    }
  };

  // Créer une nouvelle gamme
  const handleCreateProcedure = async () => {
    if (!newProcedure.title || !newProcedure.vehicle_brand) {
      toast.error("Veuillez remplir les champs obligatoires");
      return;
    }

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const { data, error } = await (supabase as any)
        .from("mechanical_procedures")
        .insert({
          user_id: userData.user.id,
          title: newProcedure.title,
          description: newProcedure.description || null,
          vehicle_brand: newProcedure.vehicle_brand,
          vehicle_model: newProcedure.vehicle_model || null,
          category: newProcedure.category,
        })
        .select()
        .single();

      if (error) {
        console.error("Erreur création:", error);
        toast.error("Erreur lors de la création");
        return;
      }

      const newProc: MechanicalProcedure = {
        ...data,
        steps: [],
      };

      setProcedures([newProc, ...procedures]);
      toast.success("Gamme de montage créée");
      setIsCreateDialogOpen(false);
      setNewProcedure({
        title: "",
        description: "",
        vehicle_brand: "",
        vehicle_model: "",
        category: "installation",
      });
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors de la création");
    }
  };

  // Supprimer une gamme
  const handleDeleteProcedure = async () => {
    if (!selectedProcedure) return;
    
    try {
      const { error } = await (supabase as any)
        .from("mechanical_procedures")
        .delete()
        .eq("id", selectedProcedure.id);

      if (error) {
        console.error("Erreur suppression:", error);
        toast.error("Erreur lors de la suppression");
        return;
      }

      setProcedures(procedures.filter(p => p.id !== selectedProcedure.id));
      toast.success("Gamme de montage supprimée");
      setIsDeleteDialogOpen(false);
      setSelectedProcedure(null);
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors de la suppression");
    }
  };

  // Ajouter une étape
  const handleAddStep = async () => {
    if (!selectedProcedure || !newStep.title) {
      toast.error("Veuillez remplir le titre de l'étape");
      return;
    }

    try {
      const stepNumber = (selectedProcedure.steps?.length || 0) + 1;
      
      const { data, error } = await (supabase as any)
        .from("mechanical_procedure_steps")
        .insert({
          procedure_id: selectedProcedure.id,
          step_number: stepNumber,
          title: newStep.title,
          description: newStep.description || null,
          notes: newStep.notes || null,
          duration_minutes: newStep.duration_minutes || null,
          tools_required: newStep.tools_required || null,
        })
        .select()
        .single();

      if (error) {
        console.error("Erreur ajout étape:", error);
        toast.error("Erreur lors de l'ajout de l'étape");
        return;
      }

      const updatedSteps = [...(selectedProcedure.steps || []), data];
      
      // Mettre à jour la gamme sélectionnée
      setSelectedProcedure({
        ...selectedProcedure,
        steps: updatedSteps,
      });

      // Mettre à jour la liste des gammes
      setProcedures(procedures.map(p => {
        if (p.id === selectedProcedure.id) {
          return { ...p, steps: updatedSteps };
        }
        return p;
      }));
      
      toast.success("Étape ajoutée");
      setIsStepDialogOpen(false);
      setNewStep({
        title: "",
        description: "",
        notes: "",
        duration_minutes: 0,
        tools_required: "",
      });
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors de l'ajout de l'étape");
    }
  };

  // Supprimer une étape
  const handleDeleteStep = async (stepId: string) => {
    if (!selectedProcedure) return;

    try {
      const { error } = await (supabase as any)
        .from("mechanical_procedure_steps")
        .delete()
        .eq("id", stepId);

      if (error) {
        console.error("Erreur suppression étape:", error);
        toast.error("Erreur lors de la suppression");
        return;
      }

      // Recalculer les numéros d'étapes
      const remainingSteps = selectedProcedure.steps?.filter(s => s.id !== stepId) || [];
      
      // Mettre à jour les numéros d'étapes dans Supabase
      for (let i = 0; i < remainingSteps.length; i++) {
        if (remainingSteps[i].step_number !== i + 1) {
          await (supabase as any)
            .from("mechanical_procedure_steps")
            .update({ step_number: i + 1 })
            .eq("id", remainingSteps[i].id);
          remainingSteps[i].step_number = i + 1;
        }
      }

      setSelectedProcedure({
        ...selectedProcedure,
        steps: remainingSteps,
      });

      setProcedures(procedures.map(p => {
        if (p.id === selectedProcedure.id) {
          return { ...p, steps: remainingSteps };
        }
        return p;
      }));

      toast.success("Étape supprimée");
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors de la suppression");
    }
  };

  // Upload d'image pour une étape
  const handleImageUpload = async (stepId: string, file: File) => {
    if (!selectedProcedure) return;

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      // Upload vers Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${userData.user.id}/${selectedProcedure.id}/${stepId}_${Date.now()}.${fileExt}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("mechanical-images")
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: true,
        });

      if (uploadError) {
        console.error("Erreur upload:", uploadError);
        // Fallback: stocker en base64 si le bucket n'existe pas
        const reader = new FileReader();
        reader.onload = async (e) => {
          const imageUrl = e.target?.result as string;
          await updateStepImage(stepId, imageUrl);
        };
        reader.readAsDataURL(file);
        return;
      }

      // Obtenir l'URL publique
      const { data: urlData } = supabase.storage
        .from("mechanical-images")
        .getPublicUrl(fileName);

      await updateStepImage(stepId, urlData.publicUrl);
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors de l'upload de l'image");
    }
  };

  // Mettre à jour l'image d'une étape
  const updateStepImage = async (stepId: string, imageUrl: string) => {
    if (!selectedProcedure) return;

    const { error } = await (supabase as any)
      .from("mechanical_procedure_steps")
      .update({ image_url: imageUrl })
      .eq("id", stepId);

    if (error) {
      console.error("Erreur mise à jour image:", error);
      toast.error("Erreur lors de la mise à jour");
      return;
    }

    const updatedSteps = selectedProcedure.steps?.map(s => {
      if (s.id === stepId) {
        return { ...s, image_url: imageUrl };
      }
      return s;
    }) || [];

    setSelectedProcedure({
      ...selectedProcedure,
      steps: updatedSteps,
    });

    setProcedures(procedures.map(p => {
      if (p.id === selectedProcedure.id) {
        return { ...p, steps: updatedSteps };
      }
      return p;
    }));

    toast.success("Image ajoutée");
  };

  // Organiser les données par marque/modèle
  const organizedData = () => {
    const filtered = procedures.filter(p => {
      const matchesSearch = searchQuery === "" || 
        p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesBrand = selectedBrand === "all" || p.vehicle_brand === selectedBrand;
      const matchesModel = selectedModel === "all" || p.vehicle_model === selectedModel;
      return matchesSearch && matchesBrand && matchesModel;
    });

    const byBrand: Record<string, Record<string, MechanicalProcedure[]>> = {};
    
    filtered.forEach(p => {
      const brand = p.vehicle_brand || "Sans marque";
      const model = p.vehicle_model || "Tous modèles";
      
      if (!byBrand[brand]) byBrand[brand] = {};
      if (!byBrand[brand][model]) byBrand[brand][model] = [];
      byBrand[brand][model].push(p);
    });

    return byBrand;
  };

  // Obtenir les marques uniques
  const uniqueBrands = [...new Set(vehicles.map(v => v.marque))].sort();
  
  // Obtenir les modèles pour une marque
  const getModelsForBrand = (brand: string) => {
    return [...new Set(vehicles.filter(v => v.marque === brand).map(v => v.modele))].sort();
  };

  // Toggle expansion
  const toggleBrand = (brand: string) => {
    const newExpanded = new Set(expandedBrands);
    if (newExpanded.has(brand)) {
      newExpanded.delete(brand);
    } else {
      newExpanded.add(brand);
    }
    setExpandedBrands(newExpanded);
  };

  const toggleModel = (key: string) => {
    const newExpanded = new Set(expandedModels);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedModels(newExpanded);
  };

  const data = organizedData();

  return (
    <div className="space-y-4">
      {/* Header avec recherche et actions */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex items-center gap-2">
          <Wrench className="h-6 w-6" />
          <h2 className="text-xl font-bold">Gammes de montage</h2>
          <Badge variant="secondary">{procedures.length}</Badge>
        </div>
        
        <div className="flex gap-2">
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nouvelle gamme
          </Button>
        </div>
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher une gamme..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <Select value={selectedBrand} onValueChange={setSelectedBrand}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Toutes marques" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes marques</SelectItem>
            {uniqueBrands.map(brand => (
              <SelectItem key={brand} value={brand}>{brand}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {selectedBrand !== "all" && (
          <Select value={selectedModel} onValueChange={setSelectedModel}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Tous modèles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous modèles</SelectItem>
              {getModelsForBrand(selectedBrand).map(model => (
                <SelectItem key={model} value={model}>{model}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Arborescence par marque/modèle */}
      <ScrollArea className="h-[calc(100vh-350px)]">
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Chargement...</div>
        ) : Object.keys(data).length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Wrench className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p className="text-lg font-medium">Aucune gamme de montage</p>
            <p className="text-sm">Créez votre première gamme de montage</p>
          </div>
        ) : (
          <div className="space-y-2">
            {Object.entries(data).sort().map(([brand, models]) => (
              <Collapsible
                key={brand}
                open={expandedBrands.has(brand)}
                onOpenChange={() => toggleBrand(brand)}
              >
                <CollapsibleTrigger asChild>
                  <Card className="cursor-pointer hover:bg-muted/50 transition-colors">
                    <CardHeader className="py-3 px-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {expandedBrands.has(brand) ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                          <Car className="h-5 w-5 text-primary" />
                          <span className="font-semibold">{brand}</span>
                        </div>
                        <Badge variant="outline">
                          {Object.values(models).flat().length} gamme(s)
                        </Badge>
                      </div>
                    </CardHeader>
                  </Card>
                </CollapsibleTrigger>
                
                <CollapsibleContent className="pl-6 mt-2 space-y-2">
                  {Object.entries(models).sort().map(([model, procs]) => (
                    <Collapsible
                      key={`${brand}-${model}`}
                      open={expandedModels.has(`${brand}-${model}`)}
                      onOpenChange={() => toggleModel(`${brand}-${model}`)}
                    >
                      <CollapsibleTrigger asChild>
                        <Card className="cursor-pointer hover:bg-muted/50 transition-colors">
                          <CardHeader className="py-2 px-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                {expandedModels.has(`${brand}-${model}`) ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                                <span className="font-medium">{model}</span>
                              </div>
                              <Badge variant="secondary" className="text-xs">
                                {procs.length}
                              </Badge>
                            </div>
                          </CardHeader>
                        </Card>
                      </CollapsibleTrigger>
                      
                      <CollapsibleContent className="pl-6 mt-2 space-y-2">
                        {procs.map(proc => (
                          <Card 
                            key={proc.id} 
                            className="hover:border-primary/50 transition-colors"
                          >
                            <CardContent className="py-3 px-4">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <FileText className="h-4 w-4 text-muted-foreground" />
                                  <div>
                                    <p className="font-medium">{proc.title}</p>
                                    <div className="flex items-center gap-2 mt-1">
                                      <Badge variant="outline" className="text-xs">
                                        {PROCEDURE_CATEGORIES.find(c => c.value === proc.category)?.label}
                                      </Badge>
                                      <span className="text-xs text-muted-foreground">
                                        {proc.steps?.length || 0} étape(s)
                                      </span>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => {
                                      setSelectedProcedure(proc);
                                      setIsViewDialogOpen(true);
                                    }}
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => {
                                      setSelectedProcedure(proc);
                                      setIsDeleteDialogOpen(true);
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4 text-red-500" />
                                  </Button>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </CollapsibleContent>
                    </Collapsible>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Dialog création */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nouvelle gamme de montage</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label>Titre *</Label>
              <Input
                value={newProcedure.title}
                onChange={(e) => setNewProcedure({ ...newProcedure, title: e.target.value })}
                placeholder="Ex: Installation chauffage Webasto"
              />
            </div>
            
            <div>
              <Label>Description</Label>
              <Textarea
                value={newProcedure.description}
                onChange={(e) => setNewProcedure({ ...newProcedure, description: e.target.value })}
                placeholder="Description de la procédure..."
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Marque du véhicule *</Label>
                <Select
                  value={newProcedure.vehicle_brand}
                  onValueChange={(v) => setNewProcedure({ ...newProcedure, vehicle_brand: v, vehicle_model: "" })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner" />
                  </SelectTrigger>
                  <SelectContent>
                    {uniqueBrands.map(brand => (
                      <SelectItem key={brand} value={brand}>{brand}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label>Modèle</Label>
                <Select
                  value={newProcedure.vehicle_model}
                  onValueChange={(v) => setNewProcedure({ ...newProcedure, vehicle_model: v })}
                  disabled={!newProcedure.vehicle_brand}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Tous modèles</SelectItem>
                    {newProcedure.vehicle_brand && getModelsForBrand(newProcedure.vehicle_brand).map(model => (
                      <SelectItem key={model} value={model}>{model}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div>
              <Label>Catégorie</Label>
              <Select
                value={newProcedure.category}
                onValueChange={(v) => setNewProcedure({ ...newProcedure, category: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROCEDURE_CATEGORIES.map(cat => (
                    <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleCreateProcedure}>
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog visualisation/édition */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5" />
              {selectedProcedure?.title}
            </DialogTitle>
          </DialogHeader>
          
          {selectedProcedure && (
            <div className="flex-1 overflow-hidden flex flex-col">
              {/* Info de la gamme */}
              <div className="flex items-center gap-4 pb-4 border-b">
                <Badge>{selectedProcedure.vehicle_brand}</Badge>
                {selectedProcedure.vehicle_model && (
                  <Badge variant="outline">{selectedProcedure.vehicle_model}</Badge>
                )}
                <Badge variant="secondary">
                  {PROCEDURE_CATEGORIES.find(c => c.value === selectedProcedure.category)?.label}
                </Badge>
                <span className="text-sm text-muted-foreground ml-auto">
                  {selectedProcedure.steps?.length || 0} étape(s)
                </span>
              </div>
              
              {selectedProcedure.description && (
                <p className="text-sm text-muted-foreground py-2">
                  {selectedProcedure.description}
                </p>
              )}
              
              {/* Liste des étapes */}
              <ScrollArea className="flex-1 mt-4">
                <div className="space-y-4 pr-4">
                  {selectedProcedure.steps?.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>Aucune étape pour cette gamme</p>
                      <p className="text-sm">Ajoutez des étapes avec le bouton ci-dessous</p>
                    </div>
                  ) : (
                    selectedProcedure.steps?.map((step, index) => (
                      <Card key={step.id} className="overflow-hidden">
                        <CardHeader className="py-3 bg-muted/30">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                                {step.step_number}
                              </div>
                              <span className="font-semibold">{step.title}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {step.duration_minutes && (
                                <Badge variant="outline" className="text-xs">
                                  {step.duration_minutes} min
                                </Badge>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteStep(step.id)}
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="py-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Image */}
                            <div className="space-y-2">
                              {step.image_url ? (
                                <img 
                                  src={step.image_url} 
                                  alt={step.title}
                                  className="rounded-lg border max-h-[200px] w-full object-contain bg-muted"
                                />
                              ) : (
                                <div className="h-[150px] rounded-lg border-2 border-dashed flex flex-col items-center justify-center text-muted-foreground">
                                  <Image className="h-8 w-8 mb-2" />
                                  <span className="text-sm">Aucune image</span>
                                </div>
                              )}
                              <Input
                                type="file"
                                accept="image/*"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleImageUpload(step.id, file);
                                }}
                                className="text-sm"
                              />
                            </div>
                            
                            {/* Description */}
                            <div className="space-y-3">
                              {step.description && (
                                <div>
                                  <Label className="text-xs text-muted-foreground">Description</Label>
                                  <p className="text-sm">{step.description}</p>
                                </div>
                              )}
                              {step.tools_required && (
                                <div>
                                  <Label className="text-xs text-muted-foreground">Outils nécessaires</Label>
                                  <p className="text-sm">{step.tools_required}</p>
                                </div>
                              )}
                              {step.notes && (
                                <div>
                                  <Label className="text-xs text-muted-foreground">Notes</Label>
                                  <p className="text-sm text-yellow-600">{step.notes}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </ScrollArea>
              
              {/* Bouton ajouter étape */}
              <div className="pt-4 border-t">
                <Button onClick={() => setIsStepDialogOpen(true)} className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Ajouter une étape
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog ajout étape */}
      <Dialog open={isStepDialogOpen} onOpenChange={setIsStepDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter une étape</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label>Titre de l'étape *</Label>
              <Input
                value={newStep.title}
                onChange={(e) => setNewStep({ ...newStep, title: e.target.value })}
                placeholder="Ex: Déposer le panneau de porte"
              />
            </div>
            
            <div>
              <Label>Description</Label>
              <Textarea
                value={newStep.description}
                onChange={(e) => setNewStep({ ...newStep, description: e.target.value })}
                placeholder="Décrivez les actions à effectuer..."
              />
            </div>
            
            <div>
              <Label>Outils nécessaires</Label>
              <Input
                value={newStep.tools_required}
                onChange={(e) => setNewStep({ ...newStep, tools_required: e.target.value })}
                placeholder="Ex: Tournevis Torx T20, Clé de 10"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Durée estimée (minutes)</Label>
                <Input
                  type="number"
                  value={newStep.duration_minutes || ""}
                  onChange={(e) => setNewStep({ ...newStep, duration_minutes: parseInt(e.target.value) || 0 })}
                  placeholder="15"
                />
              </div>
            </div>
            
            <div>
              <Label>Notes / Attention</Label>
              <Textarea
                value={newStep.notes}
                onChange={(e) => setNewStep({ ...newStep, notes: e.target.value })}
                placeholder="Points d'attention, risques..."
                className="border-yellow-300"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsStepDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleAddStep}>
              Ajouter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog confirmation suppression */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette gamme ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. La gamme "{selectedProcedure?.title}" et toutes ses étapes seront supprimées.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteProcedure} className="bg-red-600 hover:bg-red-700">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default MechanicalProcedures;
