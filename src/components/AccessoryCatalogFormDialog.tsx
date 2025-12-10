import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, X, ImagePlus, Trash2, FileText } from "lucide-react";
import DescriptionEditorDialog from "./DescriptionEditorDialog";

interface Category {
  id: string;
  nom: string;
  parent_id: string | null;
}

interface AccessoryCatalogFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  accessory?: {
    id: string;
    nom: string;
    marque?: string;
    category_id?: string | null;
    prix_reference?: number;
    prix_vente_ttc?: number;
    marge_pourcent?: number;
    marge_nette?: number;
    fournisseur?: string;
    description?: string;
    description_media?: any;
    url_produit?: string;
    type_electrique?: string | null;
    poids_kg?: number | null;
    longueur_mm?: number | null;
    largeur_mm?: number | null;
    hauteur_mm?: number | null;
    puissance_watts?: number | null;
    intensite_amperes?: number | null;
    capacite_ah?: number | null;
    tension_volts?: number | null;
    volume_litres?: number | null;
    couleur?: string | null;
    image_url?: string | null;
  } | null;
}

const AccessoryCatalogFormDialog = ({ isOpen, onClose, onSuccess, accessory }: AccessoryCatalogFormDialogProps) => {
  const [formData, setFormData] = useState({
    nom: "",
    marque: "",
    category_id: "",
    prix_reference: "",
    prix_vente_ttc: "",
    marge_pourcent: "",
    marge_nette: "",
    fournisseur: "",
    description: "",
    url_produit: "",
    type_electrique: "",
    poids_kg: "",
    longueur_mm: "",
    largeur_mm: "",
    hauteur_mm: "",
    puissance_watts: "",
    intensite_amperes: "",
    capacite_ah: "",
    tension_volts: "",
    volume_litres: "",
  });
  const [couleurs, setCouleurs] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoaded, setCategoriesLoaded] = useState(false);
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryParent, setNewCategoryParent] = useState<string | null>(null);
  const [parentCategoryId, setParentCategoryId] = useState<string>("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [descriptionEditorOpen, setDescriptionEditorOpen] = useState(false);
  const [descriptionMedia, setDescriptionMedia] = useState<Array<{ type: "image" | "pdf"; url: string; name: string }>>(
    [],
  );

  // Options payantes
  const [options, setOptions] = useState<
    Array<{
      id?: string;
      nom: string;
      prix_reference: string;
      prix_vente_ttc: string;
      marge_pourcent: string;
      marge_nette: string;
    }>
  >([]);
  const [loadingOptions, setLoadingOptions] = useState(false);

  // Charger les catégories et options quand le dialogue s'ouvre
  useEffect(() => {
    if (isOpen) {
      setCategoriesLoaded(false);
      loadCategories();
      if (accessory) {
        loadOptions(accessory.id);
      } else {
        setOptions([]);
      }
    }
  }, [isOpen, accessory?.id]);

  // Initialiser le formulaire une fois les catégories chargées
  useEffect(() => {
    if (isOpen && categoriesLoaded) {
      if (accessory) {
        // Mode édition - utiliser ?? pour préserver les valeurs null
        setFormData({
          nom: accessory.nom,
          marque: accessory.marque ?? "",
          category_id: accessory.category_id ?? "",
          prix_reference: accessory.prix_reference?.toString() ?? "",
          prix_vente_ttc: accessory.prix_vente_ttc?.toString() ?? "",
          marge_pourcent: accessory.marge_pourcent?.toString() ?? "",
          marge_nette: accessory.marge_nette?.toString() ?? "",
          fournisseur: accessory.fournisseur ?? "",
          description: accessory.description ?? "",
          url_produit: accessory.url_produit ?? "",
          type_electrique: accessory.type_electrique ?? "",
          poids_kg: accessory.poids_kg?.toString() ?? "",
          longueur_mm: accessory.longueur_mm?.toString() ?? "",
          largeur_mm: accessory.largeur_mm?.toString() ?? "",
          hauteur_mm: accessory.hauteur_mm?.toString() ?? "",
          puissance_watts: accessory.puissance_watts?.toString() ?? "",
          intensite_amperes: accessory.intensite_amperes?.toString() ?? "",
          capacite_ah: accessory.capacite_ah?.toString() ?? "",
          tension_volts: accessory.tension_volts?.toString() ?? "",
          volume_litres: accessory.volume_litres?.toString() ?? "",
        });

        // Charger les couleurs depuis le JSON
        if (accessory.couleur) {
          try {
            const parsedCouleurs =
              typeof accessory.couleur === "string" ? JSON.parse(accessory.couleur) : accessory.couleur;
            setCouleurs(Array.isArray(parsedCouleurs) ? parsedCouleurs : [accessory.couleur]);
          } catch {
            // Si ce n'est pas du JSON, c'est une ancienne valeur simple
            setCouleurs([accessory.couleur]);
          }
        } else {
          setCouleurs([]);
        }

        // Charger les médias de description
        if (accessory.description_media) {
          try {
            const parsedMedia =
              typeof accessory.description_media === "string"
                ? JSON.parse(accessory.description_media)
                : accessory.description_media;
            setDescriptionMedia(Array.isArray(parsedMedia) ? parsedMedia : []);
          } catch {
            setDescriptionMedia([]);
          }
        } else {
          setDescriptionMedia([]);
        }

        // Initialiser la catégorie parente si l'accessoire a une catégorie
        if (accessory.category_id) {
          const selectedCategory = categories.find((c) => c.id === accessory.category_id);
          if (selectedCategory?.parent_id) {
            // C'est une sous-catégorie
            setParentCategoryId(selectedCategory.parent_id);
          } else if (selectedCategory) {
            // C'est une catégorie principale
            setParentCategoryId("");
          }
        }
      } else {
        // Mode création
        setFormData({
          nom: "",
          marque: "",
          category_id: "",
          prix_reference: "",
          prix_vente_ttc: "",
          marge_pourcent: "",
          marge_nette: "",
          fournisseur: "",
          description: "",
          url_produit: "",
          type_electrique: "",
          poids_kg: "",
          longueur_mm: "",
          largeur_mm: "",
          hauteur_mm: "",
          puissance_watts: "",
          intensite_amperes: "",
          capacite_ah: "",
          tension_volts: "",
          volume_litres: "",
        });
        setCouleurs([]);
        setDescriptionMedia([]);
        setParentCategoryId("");
        setImagePreview(null);
        setImageFile(null);
      }

      // Charger l'image si elle existe
      if (accessory?.image_url) {
        setImagePreview(accessory.image_url);
      } else {
        setImagePreview(null);
      }
    }
  }, [isOpen, categoriesLoaded, accessory?.id, categories]);

  const loadCategories = async () => {
    const { data, error } = await supabase.from("categories").select("*").order("nom");

    if (!error && data) {
      setCategories(data);
      setCategoriesLoaded(true);
    }
  };

  const loadOptions = async (accessoryId: string) => {
    setLoadingOptions(true);
    const { data, error } = await supabase
      .from("accessory_options")
      .select("*")
      .eq("accessory_id", accessoryId)
      .order("created_at");

    if (!error && data) {
      setOptions(
        data.map((opt) => ({
          id: opt.id,
          nom: opt.nom,
          prix_reference: opt.prix_reference?.toString() ?? "",
          prix_vente_ttc: opt.prix_vente_ttc?.toString() ?? "",
          marge_pourcent: opt.marge_pourcent?.toString() ?? "",
          marge_nette: opt.marge_nette?.toString() ?? "",
        })),
      );
    }
    setLoadingOptions(false);
  };

  const handleAddOption = () => {
    setOptions([
      ...options,
      {
        nom: "",
        prix_reference: "",
        prix_vente_ttc: "",
        marge_pourcent: "",
        marge_nette: "",
      },
    ]);
  };

  const handleRemoveOption = (index: number) => {
    setOptions(options.filter((_, i) => i !== index));
  };

  const handleOptionChange = (
    index: number,
    field: "nom" | "prix_reference" | "prix_vente_ttc" | "marge_pourcent",
    value: string,
  ) => {
    const newOptions = [...options];
    newOptions[index] = { ...newOptions[index], [field]: value };
    setOptions(newOptions);
  };

  const handleOptionPricingChange = (
    index: number,
    field: "prix_reference" | "prix_vente_ttc" | "marge_pourcent",
    value: string,
  ) => {
    const newOptions = [...options];
    const option = { ...newOptions[index], [field]: value };
    const TVA = 1.2; // 20% TVA

    // Calcul bidirectionnel basé sur le champ modifié
    if (field === "prix_reference") {
      // Si on modifie le prix d'achat
      const prixReference = parseFloat(option.prix_reference);
      if (!isNaN(prixReference) && prixReference > 0) {
        if (option.marge_pourcent && parseFloat(option.marge_pourcent) !== 0) {
          // Calculer le prix TTC à partir du prix d'achat + marge
          const margePourcent = parseFloat(option.marge_pourcent);
          const prixVenteHT = prixReference * (1 + margePourcent / 100);
          option.prix_vente_ttc = (prixVenteHT * TVA).toFixed(2);
          option.marge_nette = (prixVenteHT - prixReference).toFixed(2);
        } else if (option.prix_vente_ttc && parseFloat(option.prix_vente_ttc) > 0) {
          // Calculer la marge à partir du prix d'achat + prix TTC
          const prixVenteTTC = parseFloat(option.prix_vente_ttc);
          const prixVenteHT = prixVenteTTC / TVA;
          option.marge_pourcent = (((prixVenteHT - prixReference) / prixReference) * 100).toFixed(2);
          option.marge_nette = (prixVenteHT - prixReference).toFixed(2);
        }
      }
    } else if (field === "marge_pourcent") {
      // Si on modifie la marge
      const margePourcent = parseFloat(option.marge_pourcent);
      if (!isNaN(margePourcent)) {
        if (option.prix_reference && parseFloat(option.prix_reference) > 0) {
          // Calculer le prix TTC à partir de la marge + prix d'achat
          const prixReference = parseFloat(option.prix_reference);
          const prixVenteHT = prixReference * (1 + margePourcent / 100);
          option.prix_vente_ttc = (prixVenteHT * TVA).toFixed(2);
          option.marge_nette = (prixVenteHT - prixReference).toFixed(2);
        } else if (option.prix_vente_ttc && parseFloat(option.prix_vente_ttc) > 0) {
          // Calculer le prix d'achat à partir de la marge + prix TTC
          const prixVenteTTC = parseFloat(option.prix_vente_ttc);
          const prixVenteHT = prixVenteTTC / TVA;
          option.prix_reference = (prixVenteHT / (1 + margePourcent / 100)).toFixed(2);
          const prixReference = parseFloat(option.prix_reference);
          option.marge_nette = (prixVenteHT - prixReference).toFixed(2);
        }
      }
    } else if (field === "prix_vente_ttc") {
      // Si on modifie le prix TTC
      const prixVenteTTC = parseFloat(option.prix_vente_ttc);
      if (!isNaN(prixVenteTTC) && prixVenteTTC > 0) {
        const prixVenteHT = prixVenteTTC / TVA;
        if (option.prix_reference && parseFloat(option.prix_reference) > 0) {
          // Calculer la marge à partir du prix TTC + prix d'achat
          const prixReference = parseFloat(option.prix_reference);
          option.marge_pourcent = (((prixVenteHT - prixReference) / prixReference) * 100).toFixed(2);
          option.marge_nette = (prixVenteHT - prixReference).toFixed(2);
        } else if (option.marge_pourcent && parseFloat(option.marge_pourcent) !== 0) {
          // Calculer le prix d'achat à partir du prix TTC + marge
          const margePourcent = parseFloat(option.marge_pourcent);
          option.prix_reference = (prixVenteHT / (1 + margePourcent / 100)).toFixed(2);
          const prixReference = parseFloat(option.prix_reference);
          option.marge_nette = (prixVenteHT - prixReference).toFixed(2);
        }
      }
    }

    newOptions[index] = option;
    setOptions(newOptions);
  };

  const handleAddCouleur = () => {
    setCouleurs([...couleurs, ""]);
  };

  const handleRemoveCouleur = (index: number) => {
    setCouleurs(couleurs.filter((_, i) => i !== index));
  };

  const handleCouleurChange = (index: number, value: string) => {
    const newCouleurs = [...couleurs];
    newCouleurs[index] = value;
    setCouleurs(newCouleurs);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("L'image ne doit pas dépasser 5 MB");
        return;
      }
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) {
      toast.error("Veuillez entrer un nom de catégorie");
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Vous devez être connecté");
      return;
    }

    const { data, error } = await supabase
      .from("categories")
      .insert({
        nom: newCategoryName.trim(),
        parent_id: newCategoryParent,
        user_id: user.id,
      })
      .select()
      .single();

    if (error) {
      toast.error("Erreur lors de la création de la catégorie");
      console.error(error);
    } else {
      toast.success("Catégorie créée");
      setFormData({ ...formData, category_id: data.id });
      setIsCreatingCategory(false);
      setNewCategoryName("");
      setNewCategoryParent(null);
      loadCategories();
    }
  };

  const handlePricingChange = (field: "prix_reference" | "prix_vente_ttc" | "marge_pourcent", value: string) => {
    const newFormData = { ...formData, [field]: value };
    const TVA = 1.2; // 20% TVA

    // Calcul bidirectionnel basé sur le champ modifié
    if (field === "prix_reference") {
      // Si on modifie le prix d'achat
      const prixReference = parseFloat(newFormData.prix_reference);
      if (!isNaN(prixReference) && prixReference > 0) {
        if (newFormData.marge_pourcent && parseFloat(newFormData.marge_pourcent) !== 0) {
          // Calculer le prix TTC à partir du prix d'achat + marge
          const margePourcent = parseFloat(newFormData.marge_pourcent);
          const prixVenteHT = prixReference * (1 + margePourcent / 100);
          newFormData.prix_vente_ttc = (prixVenteHT * TVA).toFixed(2);
          newFormData.marge_nette = (prixVenteHT - prixReference).toFixed(2);
        } else if (newFormData.prix_vente_ttc && parseFloat(newFormData.prix_vente_ttc) > 0) {
          // Calculer la marge à partir du prix d'achat + prix TTC
          const prixVenteTTC = parseFloat(newFormData.prix_vente_ttc);
          const prixVenteHT = prixVenteTTC / TVA;
          newFormData.marge_pourcent = (((prixVenteHT - prixReference) / prixReference) * 100).toFixed(2);
          newFormData.marge_nette = (prixVenteHT - prixReference).toFixed(2);
        }
      }
    } else if (field === "marge_pourcent") {
      // Si on modifie la marge
      const margePourcent = parseFloat(newFormData.marge_pourcent);
      if (!isNaN(margePourcent)) {
        if (newFormData.prix_reference && parseFloat(newFormData.prix_reference) > 0) {
          // Calculer le prix TTC à partir de la marge + prix d'achat
          const prixReference = parseFloat(newFormData.prix_reference);
          const prixVenteHT = prixReference * (1 + margePourcent / 100);
          newFormData.prix_vente_ttc = (prixVenteHT * TVA).toFixed(2);
          newFormData.marge_nette = (prixVenteHT - prixReference).toFixed(2);
        } else if (newFormData.prix_vente_ttc && parseFloat(newFormData.prix_vente_ttc) > 0) {
          // Calculer le prix d'achat à partir de la marge + prix TTC
          const prixVenteTTC = parseFloat(newFormData.prix_vente_ttc);
          const prixVenteHT = prixVenteTTC / TVA;
          newFormData.prix_reference = (prixVenteHT / (1 + margePourcent / 100)).toFixed(2);
          const prixReference = parseFloat(newFormData.prix_reference);
          newFormData.marge_nette = (prixVenteHT - prixReference).toFixed(2);
        }
      }
    } else if (field === "prix_vente_ttc") {
      // Si on modifie le prix TTC
      const prixVenteTTC = parseFloat(newFormData.prix_vente_ttc);
      if (!isNaN(prixVenteTTC) && prixVenteTTC > 0) {
        const prixVenteHT = prixVenteTTC / TVA;
        if (newFormData.prix_reference && parseFloat(newFormData.prix_reference) > 0) {
          // Calculer la marge à partir du prix TTC + prix d'achat
          const prixReference = parseFloat(newFormData.prix_reference);
          newFormData.marge_pourcent = (((prixVenteHT - prixReference) / prixReference) * 100).toFixed(2);
          newFormData.marge_nette = (prixVenteHT - prixReference).toFixed(2);
        } else if (newFormData.marge_pourcent && parseFloat(newFormData.marge_pourcent) !== 0) {
          // Calculer le prix d'achat à partir du prix TTC + marge
          const margePourcent = parseFloat(newFormData.marge_pourcent);
          newFormData.prix_reference = (prixVenteHT / (1 + margePourcent / 100)).toFixed(2);
          const prixReference = parseFloat(newFormData.prix_reference);
          newFormData.marge_nette = (prixVenteHT - prixReference).toFixed(2);
        }
      }
    }

    setFormData(newFormData);
  };

  const handleElectricalChange = (field: "puissance_watts" | "intensite_amperes" | "tension_volts", value: string) => {
    const newFormData = { ...formData, [field]: value };

    // Utiliser la tension sélectionnée ou 12V par défaut
    const voltage = field === "tension_volts" ? parseFloat(value) || 12 : parseFloat(formData.tension_volts) || 12;

    if (field === "puissance_watts" && value) {
      // Calculate intensity from power: I = P / U
      const power = parseFloat(value);
      if (!isNaN(power) && power > 0) {
        newFormData.intensite_amperes = (power / voltage).toFixed(2);
      }
    } else if (field === "intensite_amperes" && value) {
      // Calculate power from intensity: P = U × I
      const intensity = parseFloat(value);
      if (!isNaN(intensity) && intensity > 0) {
        newFormData.puissance_watts = (intensity * voltage).toFixed(1);
      }
    } else if (field === "tension_volts" && value) {
      // Recalculer l'intensité si la puissance existe
      const power = parseFloat(formData.puissance_watts);
      if (!isNaN(power) && power > 0) {
        newFormData.intensite_amperes = (power / voltage).toFixed(2);
      }
    }

    setFormData(newFormData);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Vous devez être connecté");
      setIsSubmitting(false);
      return;
    }

    let savedAccessoryId = accessory?.id;
    let imageUrl = accessory?.image_url || null;

    // Upload de l'image si nécessaire
    if (imageFile) {
      const fileExt = imageFile.name.split(".").pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage.from("accessory-images").upload(fileName, imageFile);

      if (uploadError) {
        toast.error("Erreur lors de l'upload de l'image");
        console.error(uploadError);
        setIsSubmitting(false);
        return;
      }

      const { data: urlData } = supabase.storage.from("accessory-images").getPublicUrl(fileName);

      imageUrl = urlData.publicUrl;
    } else if (imagePreview === null && accessory?.image_url) {
      // Supprimer l'ancienne image
      const oldPath = accessory.image_url.split("/accessory-images/")[1];
      if (oldPath) {
        await supabase.storage.from("accessory-images").remove([oldPath]);
      }
      imageUrl = null;
    }

    if (accessory) {
      // Mode édition - Marquer comme complété automatiquement
      const { error } = await supabase
        .from("accessories_catalog")
        .update({
          nom: formData.nom,
          marque: formData.marque || null,
          category_id: formData.category_id || null,
          prix_reference: formData.prix_reference ? parseFloat(formData.prix_reference) : null,
          prix_vente_ttc: formData.prix_vente_ttc ? parseFloat(formData.prix_vente_ttc) : null,
          marge_pourcent: formData.marge_pourcent ? parseFloat(formData.marge_pourcent) : null,
          fournisseur: formData.fournisseur || null,
          description: formData.description || null,
          url_produit: formData.url_produit || null,
          type_electrique: formData.type_electrique || null,
          poids_kg: formData.poids_kg ? parseFloat(formData.poids_kg) : null,
          longueur_mm: formData.longueur_mm ? parseInt(formData.longueur_mm) : null,
          largeur_mm: formData.largeur_mm ? parseInt(formData.largeur_mm) : null,
          hauteur_mm: formData.hauteur_mm ? parseInt(formData.hauteur_mm) : null,
          puissance_watts: formData.puissance_watts ? parseFloat(formData.puissance_watts) : null,
          intensite_amperes: formData.intensite_amperes ? parseFloat(formData.intensite_amperes) : null,
          capacite_ah: formData.capacite_ah ? parseFloat(formData.capacite_ah) : null,
          tension_volts: formData.tension_volts ? parseFloat(formData.tension_volts) : null,
          volume_litres: formData.volume_litres ? parseFloat(formData.volume_litres) : null,
          couleur: couleurs.length > 0 ? JSON.stringify(couleurs.filter((c) => c.trim())) : null,
          description_media: descriptionMedia.length > 0 ? JSON.stringify(descriptionMedia) : null,
          image_url: imageUrl,
          needs_completion: false, // Marquer comme complété après édition
        })
        .eq("id", accessory.id);

      if (error) {
        toast.error("Erreur lors de la modification");
        console.error(error);
        setIsSubmitting(false);
        return;
      }

      // ✅ SYNCHRONISATION BIDIRECTIONNELLE : Mettre à jour les dépenses liées
      const { error: syncError } = await supabase
        .from("project_expenses")
        .update({
          nom_accessoire: formData.nom,
          marque: formData.marque || null,
          prix: formData.prix_reference ? parseFloat(formData.prix_reference) : null,
          prix_vente_ttc: formData.prix_vente_ttc ? parseFloat(formData.prix_vente_ttc) : null,
          marge_pourcent: formData.marge_pourcent ? parseFloat(formData.marge_pourcent) : null,
          fournisseur: formData.fournisseur || null,
          type_electrique: formData.type_electrique || null,
          poids_kg: formData.poids_kg ? parseFloat(formData.poids_kg) : null,
          puissance_watts: formData.puissance_watts ? parseFloat(formData.puissance_watts) : null,
          intensite_amperes: formData.intensite_amperes ? parseFloat(formData.intensite_amperes) : null,
        })
        .eq("accessory_id", accessory.id);

      if (syncError) {
        console.warn("Erreur sync dépenses liées:", syncError);
        // Ne pas bloquer - les données du catalogue sont déjà sauvegardées
      } else {
        console.log("[Catalogue] Dépenses liées synchronisées");
      }
    } else {
      // Mode création
      const { data: newAccessory, error } = await supabase
        .from("accessories_catalog")
        .insert({
          nom: formData.nom,
          marque: formData.marque || null,
          category_id: formData.category_id || null,
          prix_reference: formData.prix_reference ? parseFloat(formData.prix_reference) : null,
          prix_vente_ttc: formData.prix_vente_ttc ? parseFloat(formData.prix_vente_ttc) : null,
          marge_pourcent: formData.marge_pourcent ? parseFloat(formData.marge_pourcent) : null,
          fournisseur: formData.fournisseur || null,
          description: formData.description || null,
          url_produit: formData.url_produit || null,
          type_electrique: formData.type_electrique || null,
          poids_kg: formData.poids_kg ? parseFloat(formData.poids_kg) : null,
          longueur_mm: formData.longueur_mm ? parseInt(formData.longueur_mm) : null,
          largeur_mm: formData.largeur_mm ? parseInt(formData.largeur_mm) : null,
          hauteur_mm: formData.hauteur_mm ? parseInt(formData.hauteur_mm) : null,
          puissance_watts: formData.puissance_watts ? parseFloat(formData.puissance_watts) : null,
          intensite_amperes: formData.intensite_amperes ? parseFloat(formData.intensite_amperes) : null,
          capacite_ah: formData.capacite_ah ? parseFloat(formData.capacite_ah) : null,
          tension_volts: formData.tension_volts ? parseFloat(formData.tension_volts) : null,
          volume_litres: formData.volume_litres ? parseFloat(formData.volume_litres) : null,
          couleur: couleurs.length > 0 ? JSON.stringify(couleurs.filter((c) => c.trim())) : null,
          description_media: descriptionMedia.length > 0 ? JSON.stringify(descriptionMedia) : null,
          image_url: imageUrl,
          user_id: user.id,
        })
        .select()
        .single();

      if (error) {
        toast.error("Erreur lors de l'ajout");
        console.error(error);
        setIsSubmitting(false);
        return;
      }

      savedAccessoryId = newAccessory.id;
    }

    // Gérer les options
    if (savedAccessoryId) {
      // Supprimer les options existantes qui ne sont plus dans la liste
      const existingOptionIds = options.filter((opt) => opt.id).map((opt) => opt.id!);
      if (accessory) {
        const { error: deleteError } = await supabase
          .from("accessory_options")
          .delete()
          .eq("accessory_id", savedAccessoryId)
          .not("id", "in", `(${existingOptionIds.length > 0 ? existingOptionIds.join(",") : "'none'"})`);

        if (deleteError) {
          console.error("Erreur lors de la suppression des options:", deleteError);
        }
      }

      // Ajouter ou mettre à jour les options
      for (const option of options) {
        if (option.nom && option.prix_vente_ttc) {
          if (option.id) {
            // Mettre à jour l'option existante
            const { error: updateError } = await supabase
              .from("accessory_options")
              .update({
                nom: option.nom,
                prix_reference: option.prix_reference ? parseFloat(option.prix_reference) : 0,
                prix_vente_ttc: parseFloat(option.prix_vente_ttc),
                marge_pourcent: option.marge_pourcent ? parseFloat(option.marge_pourcent) : 0,
                marge_nette: option.marge_nette ? parseFloat(option.marge_nette) : 0,
              })
              .eq("id", option.id);

            if (updateError) {
              console.error("Erreur lors de la mise à jour d'une option:", updateError);
            }
          } else {
            // Créer une nouvelle option
            const { error: insertError } = await supabase.from("accessory_options").insert({
              accessory_id: savedAccessoryId,
              nom: option.nom,
              prix_reference: option.prix_reference ? parseFloat(option.prix_reference) : 0,
              prix_vente_ttc: parseFloat(option.prix_vente_ttc),
              marge_pourcent: option.marge_pourcent ? parseFloat(option.marge_pourcent) : 0,
              marge_nette: option.marge_nette ? parseFloat(option.marge_nette) : 0,
            });

            if (insertError) {
              console.error("Erreur lors de l'ajout d'une option:", insertError);
            }
          }
        }
      }
    }

    toast.success(accessory ? "Accessoire modifié" : "Accessoire ajouté au catalogue");
    onSuccess();
    onClose();

    setIsSubmitting(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{accessory ? "Modifier l'accessoire" : "Ajouter un accessoire au catalogue"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="nom">
                Nom <span className="text-red-500">*</span>
              </Label>
              <Input
                id="nom"
                type="text"
                required
                value={formData.nom}
                onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                onKeyDown={(e) => e.stopPropagation()}
                placeholder="Ex: Panneau solaire 400W"
                autoComplete="off"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="marque">Marque</Label>
              <Input
                id="marque"
                type="text"
                value={formData.marque}
                onChange={(e) => setFormData({ ...formData, marque: e.target.value })}
                onKeyDown={(e) => e.stopPropagation()}
                placeholder="Ex: Victron Energy"
                autoComplete="off"
              />
            </div>
          </div>

          <div className="space-y-2">
            {isCreatingCategory ? (
              <div className="space-y-3 p-4 border rounded-lg bg-muted/50">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">Nouvelle catégorie</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setIsCreatingCategory(false);
                      setNewCategoryName("");
                      setNewCategoryParent(null);
                    }}
                  >
                    Annuler
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="new_category_name">Nom de la catégorie</Label>
                  <Input
                    id="new_category_name"
                    type="text"
                    value={newCategoryName}
                    onChange={(e) => {
                      // Force la mise à jour du state
                      setNewCategoryName(e.target.value);
                    }}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      // Permettre Enter pour créer la catégorie
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleCreateCategory();
                      } else if (e.key === "Escape") {
                        e.preventDefault();
                        setIsCreatingCategory(false);
                        setNewCategoryName("");
                        setNewCategoryParent(null);
                      }
                    }}
                    placeholder="Ex: Panneaux solaires"
                    autoComplete="off"
                    spellCheck="false"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category_parent">Catégorie parente (optionnel)</Label>
                  <Select
                    value={newCategoryParent || "none"}
                    onValueChange={(value) => setNewCategoryParent(value === "none" ? null : value)}
                  >
                    <SelectTrigger id="category_parent">
                      <SelectValue placeholder="Aucune (catégorie principale)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Aucune (catégorie principale)</SelectItem>
                      {categories
                        .filter((cat) => cat.parent_id === null)
                        .map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.nom}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button type="button" onClick={handleCreateCategory} className="w-full">
                  Créer la catégorie
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="parent_category_id">Catégorie principale</Label>
                  <Select
                    value={parentCategoryId || "none"}
                    onValueChange={(value) => {
                      if (value === "__create__") {
                        setIsCreatingCategory(true);
                      } else {
                        const newParentId = value === "none" ? "" : value;
                        setParentCategoryId(newParentId);
                        // Si la catégorie n'a pas de sous-catégories, on l'assigne directement
                        const hasSubcategories = newParentId && categories.some((cat) => cat.parent_id === newParentId);
                        if (newParentId && !hasSubcategories) {
                          setFormData({ ...formData, category_id: newParentId });
                        } else {
                          setFormData({ ...formData, category_id: "" });
                        }
                      }
                    }}
                  >
                    <SelectTrigger id="parent_category_id">
                      <SelectValue placeholder="Sélectionner une catégorie principale" />
                    </SelectTrigger>
                    <SelectContent className="bg-background z-50">
                      <SelectItem value="__create__">+ Créer une nouvelle catégorie</SelectItem>
                      <SelectItem value="none">Aucune catégorie</SelectItem>
                      {categories
                        .filter((cat) => cat.parent_id === null)
                        .map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.nom}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                {parentCategoryId && categories.some((cat) => cat.parent_id === parentCategoryId) && (
                  <div className="space-y-2">
                    <Label htmlFor="subcategory_id">Sous-catégorie</Label>
                    <Select
                      value={formData.category_id || "none"}
                      onValueChange={(value) => {
                        setFormData({ ...formData, category_id: value === "none" ? parentCategoryId : value });
                      }}
                    >
                      <SelectTrigger id="subcategory_id">
                        <SelectValue placeholder="Sélectionner une sous-catégorie" />
                      </SelectTrigger>
                      <SelectContent className="bg-background z-50">
                        <SelectItem value="none">Aucune sous-catégorie</SelectItem>
                        {categories
                          .filter((cat) => cat.parent_id === parentCategoryId)
                          .map((cat) => (
                            <SelectItem key={cat.id} value={cat.id}>
                              {cat.nom}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Image de l'accessoire (optionnelle)</Label>
            {imagePreview ? (
              <div className="relative">
                <img src={imagePreview} alt="Aperçu" className="w-full h-48 object-contain rounded-lg border" />
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="absolute top-2 right-2"
                  onClick={handleRemoveImage}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="border-2 border-dashed rounded-lg p-8 text-center">
                <Input type="file" accept="image/*" onChange={handleImageChange} className="hidden" id="image-upload" />
                <Label htmlFor="image-upload" className="cursor-pointer">
                  <ImagePlus className="h-12 w-12 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Cliquez pour ajouter une image (max 5 MB)</p>
                </Label>
              </div>
            )}
          </div>

          <Separator />

          <div className="space-y-2">
            <Label className="text-base font-semibold">Calcul de prix (remplir 2 sur 3)</Label>
            <div className="grid grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="prix_reference">Prix d'achat HT (€)</Label>
                <Input
                  id="prix_reference"
                  type="number"
                  step="0.01"
                  value={formData.prix_reference}
                  onChange={(e) => handlePricingChange("prix_reference", e.target.value)}
                  onKeyDown={(e) => e.stopPropagation()}
                  placeholder="Prix d'achat HT"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="prix_vente">Prix de vente TTC (€)</Label>
                <Input
                  id="prix_vente"
                  type="number"
                  step="0.01"
                  value={formData.prix_vente_ttc}
                  onChange={(e) => handlePricingChange("prix_vente_ttc", e.target.value)}
                  onKeyDown={(e) => e.stopPropagation()}
                  placeholder="Prix de vente"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="marge">Marge (%)</Label>
                <Input
                  id="marge"
                  type="number"
                  step="0.01"
                  value={formData.marge_pourcent}
                  onChange={(e) => handlePricingChange("marge_pourcent", e.target.value)}
                  onKeyDown={(e) => e.stopPropagation()}
                  placeholder="% de marge"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="marge_euros">Marge nette (€)</Label>
                <Input
                  id="marge_euros"
                  type="text"
                  value={
                    formData.prix_reference && formData.prix_vente_ttc
                      ? (parseFloat(formData.prix_vente_ttc) / 1.2 - parseFloat(formData.prix_reference)).toFixed(2)
                      : ""
                  }
                  readOnly
                  disabled
                  placeholder="Auto"
                  className="bg-muted"
                />
              </div>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="type_electrique">Type électrique</Label>
              <Select
                value={formData.type_electrique || "none"}
                onValueChange={(value) => setFormData({ ...formData, type_electrique: value === "none" ? "" : value })}
              >
                <SelectTrigger id="type_electrique">
                  <SelectValue placeholder="Sélectionner" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Non applicable</SelectItem>
                  <SelectItem value="consommateur">Consommateur</SelectItem>
                  <SelectItem value="producteur">Producteur</SelectItem>
                  <SelectItem value="stockage">Stockage</SelectItem>
                  <SelectItem value="convertisseur">Convertisseur</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* ✅ Sélecteur de tension - placé en premier */}
            <div className="space-y-2">
              <Label htmlFor="tension">Tension</Label>
              <Select
                value={formData.tension_volts || "12"}
                onValueChange={(value) => handleElectricalChange("tension_volts", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choisir la tension" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="12">12V (Batterie auxiliaire)</SelectItem>
                  <SelectItem value="24">24V (Camion/Bus)</SelectItem>
                  <SelectItem value="230">230V (Secteur)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="puissance">Puissance (W)</Label>
              <Input
                id="puissance"
                type="number"
                step="0.1"
                value={formData.puissance_watts}
                onChange={(e) => handleElectricalChange("puissance_watts", e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
                placeholder="Ex: 400"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="intensite">Intensité (A) @ {formData.tension_volts || "12"}V</Label>
              <Input
                id="intensite"
                type="number"
                step="0.1"
                value={formData.intensite_amperes}
                onChange={(e) => handleElectricalChange("intensite_amperes", e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
                placeholder="Ex: 33.3"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="capacite">Capacité (Ah)</Label>
              <Input
                id="capacite"
                type="number"
                step="0.1"
                value={formData.capacite_ah}
                onChange={(e) => setFormData({ ...formData, capacite_ah: e.target.value })}
                onKeyDown={(e) => e.stopPropagation()}
                placeholder="Ex: 100"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="volume">Volume (L)</Label>
              <Input
                id="volume"
                type="number"
                step="0.1"
                value={formData.volume_litres}
                onChange={(e) => setFormData({ ...formData, volume_litres: e.target.value })}
                onKeyDown={(e) => e.stopPropagation()}
                placeholder="Ex: 80"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="poids">Poids (kg)</Label>
              <Input
                id="poids"
                type="number"
                step="0.01"
                value={formData.poids_kg}
                onChange={(e) => setFormData({ ...formData, poids_kg: e.target.value })}
                onKeyDown={(e) => e.stopPropagation()}
                placeholder="Ex: 12.5"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Dimensions (mm)</Label>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="longueur" className="text-xs text-muted-foreground">
                  Longueur
                </Label>
                <Input
                  id="longueur"
                  type="number"
                  value={formData.longueur_mm}
                  onChange={(e) => setFormData({ ...formData, longueur_mm: e.target.value })}
                  onKeyDown={(e) => e.stopPropagation()}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="largeur" className="text-xs text-muted-foreground">
                  Largeur
                </Label>
                <Input
                  id="largeur"
                  type="number"
                  value={formData.largeur_mm}
                  onChange={(e) => setFormData({ ...formData, largeur_mm: e.target.value })}
                  onKeyDown={(e) => e.stopPropagation()}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hauteur" className="text-xs text-muted-foreground">
                  Hauteur
                </Label>
                <Input
                  id="hauteur"
                  type="number"
                  value={formData.hauteur_mm}
                  onChange={(e) => setFormData({ ...formData, hauteur_mm: e.target.value })}
                  onKeyDown={(e) => e.stopPropagation()}
                  placeholder="0"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Couleurs disponibles</Label>
              <Button type="button" onClick={handleAddCouleur} size="sm" variant="outline">
                <Plus className="h-4 w-4 mr-1" />
                Ajouter une couleur
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Si des couleurs sont définies, elles seront proposées lors de la configuration du kit
            </p>
            {couleurs.length > 0 ? (
              <div className="space-y-2">
                {couleurs.map((couleur, index) => (
                  <div key={index} className="flex gap-2">
                    <Select
                      value={couleur || "none"}
                      onValueChange={(value) => handleCouleurChange(index, value === "none" ? "" : value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner une couleur" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Aucune</SelectItem>
                        <SelectItem value="Noir">Noir</SelectItem>
                        <SelectItem value="Blanc">Blanc</SelectItem>
                        <SelectItem value="Gris">Gris</SelectItem>
                        <SelectItem value="Rouge">Rouge</SelectItem>
                        <SelectItem value="Bleu">Bleu</SelectItem>
                        <SelectItem value="Vert">Vert</SelectItem>
                        <SelectItem value="Jaune">Jaune</SelectItem>
                        <SelectItem value="Orange">Orange</SelectItem>
                        <SelectItem value="Marron">Marron</SelectItem>
                        <SelectItem value="Beige">Beige</SelectItem>
                        <SelectItem value="Violet">Violet</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveCouleur(index)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Aucune couleur ajoutée</p>
            )}
          </div>

          <Separator />

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">Options payantes</Label>
              <Button type="button" onClick={handleAddOption} size="sm" variant="outline">
                <Plus className="h-4 w-4 mr-1" />
                Ajouter une option
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Ajoutez des options supplémentaires que les clients pourront sélectionner pour ce produit
            </p>
            {loadingOptions ? (
              <p className="text-sm text-muted-foreground">Chargement...</p>
            ) : options.length > 0 ? (
              <div className="space-y-4">
                {options.map((option, index) => (
                  <div key={index} className="border rounded-lg p-4 space-y-3">
                    <div className="flex gap-2 items-start">
                      <div className="flex-1 space-y-1">
                        <Label htmlFor={`option-nom-${index}`} className="text-xs">
                          Nom de l'option
                        </Label>
                        <Input
                          id={`option-nom-${index}`}
                          value={option.nom}
                          onChange={(e) => handleOptionChange(index, "nom", e.target.value)}
                          onKeyDown={(e) => e.stopPropagation()}
                          placeholder="Ex: Câble de 5m supplémentaire"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveOption(index)}
                        className="mt-5"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-4 gap-2">
                      <div className="space-y-1">
                        <Label htmlFor={`option-prix-ref-${index}`} className="text-xs">
                          Prix achat HT (€)
                        </Label>
                        <Input
                          id={`option-prix-ref-${index}`}
                          type="number"
                          step="0.01"
                          value={option.prix_reference}
                          onChange={(e) => handleOptionPricingChange(index, "prix_reference", e.target.value)}
                          onKeyDown={(e) => e.stopPropagation()}
                          placeholder="0.00"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={`option-prix-vente-${index}`} className="text-xs">
                          Prix vente TTC (€)
                        </Label>
                        <Input
                          id={`option-prix-vente-${index}`}
                          type="number"
                          step="0.01"
                          value={option.prix_vente_ttc}
                          onChange={(e) => handleOptionPricingChange(index, "prix_vente_ttc", e.target.value)}
                          onKeyDown={(e) => e.stopPropagation()}
                          placeholder="0.00"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={`option-marge-pct-${index}`} className="text-xs">
                          Marge (%)
                        </Label>
                        <Input
                          id={`option-marge-pct-${index}`}
                          type="number"
                          step="0.01"
                          value={option.marge_pourcent}
                          onChange={(e) => handleOptionPricingChange(index, "marge_pourcent", e.target.value)}
                          onKeyDown={(e) => e.stopPropagation()}
                          placeholder="0.00"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={`option-marge-nette-${index}`} className="text-xs">
                          Marge nette (€)
                        </Label>
                        <Input
                          id={`option-marge-nette-${index}`}
                          type="number"
                          step="0.01"
                          value={option.marge_nette}
                          disabled
                          onKeyDown={(e) => e.stopPropagation()}
                          placeholder="0.00"
                          className="bg-muted"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Aucune option ajoutée</p>
            )}
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fournisseur">Fournisseur</Label>
              <Input
                id="fournisseur"
                type="text"
                value={formData.fournisseur}
                onChange={(e) => setFormData({ ...formData, fournisseur: e.target.value })}
                onKeyDown={(e) => e.stopPropagation()}
                placeholder="Nom du fournisseur"
                autoComplete="off"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="url_produit">URL du produit</Label>
              <Input
                id="url_produit"
                type="url"
                value={formData.url_produit}
                onChange={(e) => setFormData({ ...formData, url_produit: e.target.value })}
                onKeyDown={(e) => e.stopPropagation()}
                placeholder="https://..."
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Description</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDescriptionEditorOpen(true)}
                className="flex items-center gap-2"
              >
                <FileText className="h-4 w-4" />
                {formData.description ? "Modifier" : "Ajouter"}
              </Button>
            </div>
            {formData.description ? (
              <div
                className="text-sm text-muted-foreground border rounded-md p-3 bg-muted/20 max-h-24 overflow-auto cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => setDescriptionEditorOpen(true)}
              >
                {formData.description.length > 200
                  ? formData.description.substring(0, 200) + "..."
                  : formData.description}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">Aucune description</p>
            )}
          </div>

          <div className="flex gap-2 justify-end pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "En cours..." : accessory ? "Modifier" : "Ajouter"}
            </Button>
          </div>
        </form>

        {/* Modale éditeur de description */}
        <DescriptionEditorDialog
          open={descriptionEditorOpen}
          onOpenChange={setDescriptionEditorOpen}
          value={formData.description}
          media={descriptionMedia}
          onSave={(value, media) => {
            setFormData({ ...formData, description: value });
            setDescriptionMedia(media);
          }}
          title={`Description - ${formData.nom || "Nouvel article"}`}
          accessoryId={accessory?.id}
        />
      </DialogContent>
    </Dialog>
  );
};

export default AccessoryCatalogFormDialog;
