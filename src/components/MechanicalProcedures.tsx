import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, Plus, FileText, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface NoticeUploadDialogProps {
  trigger?: React.ReactNode;
  onSuccess?: () => void;
  preselectedAccessoryId?: string;
}

export const NoticeUploadDialog = ({ trigger, onSuccess, preselectedAccessoryId }: NoticeUploadDialogProps) => {
  const [open, setOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [titre, setTitre] = useState("");
  const [marque, setMarque] = useState("");
  const [modele, setModele] = useState("");
  const [categorie, setCategorie] = useState("");
  const [description, setDescription] = useState("");
  const [urlNotice, setUrlNotice] = useState("");
  const [accessories, setAccessories] = useState<Array<{ id: string; nom: string; marque?: string }>>([]);
  const [selectedAccessoryId, setSelectedAccessoryId] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [existingCategories, setExistingCategories] = useState<string[]>([]);
  const [categoriePopoverOpen, setCategoriePopoverOpen] = useState(false);

  // Auto-open when preselectedAccessoryId changes
  useEffect(() => {
    if (preselectedAccessoryId) {
      setOpen(true);
      setSelectedAccessoryId(preselectedAccessoryId);
    }
  }, [preselectedAccessoryId]);

  useEffect(() => {
    if (open) {
      loadAccessories();
      loadExistingCategories();
    }
  }, [open]);

  const loadAccessories = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("accessories_catalog")
      .select("id, nom, marque")
      .eq("user_id", user.id)
      .order("nom");

    if (error) {
      console.error("Error loading accessories:", error);
      return;
    }

    setAccessories(data || []);
  };

  const loadExistingCategories = async () => {
    const { data, error } = (await supabase
      .from("notices_database")
      .select("categorie")
      .not("categorie", "is", null)) as any;

    if (error) {
      console.error("Erreur lors du chargement des catégories:", error);
      return;
    }

    // Extraire les catégories uniques et les trier
    const categories = [...new Set(data.map((item: any) => item.categorie).filter(Boolean))].sort();
    console.log("📂 Catégories chargées:", categories);
    setExistingCategories(categories as string[]);
  };

  const handleFileSelect = (file: File) => {
    // Vérifier le type de fichier (PDF uniquement) - accepter plusieurs types MIME pour PDF
    const isPDF =
      file.type === "application/pdf" || file.type === "application/x-pdf" || file.name.toLowerCase().endsWith(".pdf");

    if (!isPDF) {
      toast.error("Seuls les fichiers PDF sont acceptés");
      return;
    }

    // Vérifier la taille (max 20MB)
    if (file.size > 20 * 1024 * 1024) {
      toast.error("Le fichier ne doit pas dépasser 20 MB");
      return;
    }

    setSelectedFile(file);
    if (!titre) {
      setTitre(file.name.replace(/\.pdf$/i, ""));
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const uploadFile = async (file: File): Promise<string | null> => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const fileExt = file.name.split(".").pop();
    const fileName = `${user.id}/${Date.now()}.${fileExt}`;

    const { data, error } = await supabase.storage.from("notice-files").upload(fileName, file);

    if (error) {
      console.error("Error uploading file:", error);
      toast.error("Erreur lors de l'upload du fichier");
      return null;
    }

    // Return the file path instead of a signed URL
    return fileName;
  };

  const handleSubmit = async () => {
    if (!titre) {
      toast.error("Le titre est requis");
      return;
    }

    if (!selectedFile && !urlNotice) {
      toast.error("Veuillez uploader un fichier ou fournir une URL");
      return;
    }

    setIsUploading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Vous devez être connecté");
        return;
      }

      let finalUrl = urlNotice;

      // Upload file if selected
      if (selectedFile) {
        const uploadedUrl = await uploadFile(selectedFile);
        if (!uploadedUrl) {
          return;
        }
        finalUrl = uploadedUrl;
      }

      // Insert notice
      const { data: notice, error: noticeError } = await supabase
        .from("notices_database")
        .insert({
          titre,
          marque,
          modele,
          categorie,
          description,
          notice_url: finalUrl,
          user_id: user.id,
        })
        .select()
        .single();

      if (noticeError) {
        toast.error("Erreur lors de l'ajout de la notice");
        console.error(noticeError);
        return;
      }

      // Link accessory to notice if selected
      if (selectedAccessoryId && notice) {
        const { error: linkError } = await supabase
          .from("accessories_catalog")
          .update({ notice_id: notice.id } as any)
          .eq("id", selectedAccessoryId);

        if (linkError) {
          console.error("Error linking accessory:", linkError);
          toast.warning("Notice créée mais non liée à l'accessoire");
        }
      }

      toast.success("Notice ajoutée avec succès !");
      setOpen(false);
      resetForm();
      onSuccess?.();
    } catch (error) {
      console.error(error);
      toast.error("Erreur lors de l'ajout de la notice");
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
    resetForm();
    onSuccess?.(); // Call onSuccess to clear preselectedAccessoryId in parent
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setOpen(true);
    } else {
      handleClose();
    }
  };

  const resetForm = () => {
    setTitre("");
    setMarque("");
    setModele("");
    setCategorie("");
    setDescription("");
    setUrlNotice("");
    setSelectedAccessoryId("");
    setSelectedFile(null);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Ajouter une notice
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Ajouter une notice</DialogTitle>
          <CardDescription>
            Renseignez les informations de la notice et liez-la éventuellement à un accessoire
          </CardDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {/* Zone de drag and drop */}
          <div className="grid gap-2">
            <Label>Fichier notice (PDF)</Label>
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
              }`}
            >
              {selectedFile ? (
                <div className="flex items-center justify-center gap-3">
                  <FileText className="h-8 w-8 text-primary" />
                  <div className="flex-1 text-left">
                    <p className="font-medium">{selectedFile.name}</p>
                    <p className="text-sm text-muted-foreground">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                  <Button type="button" variant="ghost" size="icon" onClick={() => setSelectedFile(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <>
                  <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground mb-2">Glissez-déposez votre fichier PDF ici</p>
                  <p className="text-xs text-muted-foreground mb-4">ou</p>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => document.getElementById("file-input")?.click()}
                  >
                    Parcourir les fichiers
                  </Button>
                  <input
                    id="file-input"
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    onChange={handleFileInputChange}
                  />
                </>
              )}
            </div>
          </div>

          {/* URL alternative */}
          <div className="grid gap-2">
            <Label htmlFor="url">Ou URL de la notice</Label>
            <Input
              id="url"
              value={urlNotice}
              onChange={(e) => setUrlNotice(e.target.value)}
              placeholder="https://..."
              type="url"
              disabled={!!selectedFile}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="titre">Titre *</Label>
            <Input
              id="titre"
              value={titre}
              onChange={(e) => setTitre(e.target.value)}
              placeholder="Titre de la notice"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="marque">Marque</Label>
              <Input id="marque" value={marque} onChange={(e) => setMarque(e.target.value)} placeholder="Marque" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="modele">Modèle</Label>
              <Input id="modele" value={modele} onChange={(e) => setModele(e.target.value)} placeholder="Modèle" />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="categorie">Catégorie</Label>
            <div className="relative">
              <Input
                id="categorie"
                value={categorie}
                onChange={(e) => {
                  setCategorie(e.target.value);
                  setCategoriePopoverOpen(true);
                }}
                onFocus={() => setCategoriePopoverOpen(true)}
                onBlur={() => {
                  // Délai pour permettre le clic sur les options
                  setTimeout(() => setCategoriePopoverOpen(false), 200);
                }}
                placeholder="Saisissez ou sélectionnez une catégorie"
                autoComplete="off"
              />
              {categoriePopoverOpen && (
                <div className="absolute z-[100] top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-md max-h-[200px] overflow-auto">
                  {(() => {
                    const filteredCategories = existingCategories.filter(
                      (cat) => !categorie || cat.toLowerCase().includes(categorie.toLowerCase()),
                    );

                    return (
                      <>
                        {filteredCategories.length > 0 ? (
                          filteredCategories.map((cat) => (
                            <button
                              key={cat}
                              type="button"
                              className={cn(
                                "w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center gap-2",
                                categorie === cat && "bg-accent",
                              )}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setCategorie(cat);
                                setCategoriePopoverOpen(false);
                              }}
                            >
                              {categorie === cat && <Check className="h-4 w-4 text-primary" />}
                              <span className={categorie === cat ? "" : "ml-6"}>{cat}</span>
                            </button>
                          ))
                        ) : existingCategories.length > 0 ? (
                          <div className="px-3 py-2 text-sm text-muted-foreground">Aucune correspondance</div>
                        ) : null}

                        {categorie &&
                          !existingCategories.some((cat) => cat.toLowerCase() === categorie.toLowerCase()) && (
                            <button
                              type="button"
                              className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center gap-2 border-t"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setCategoriePopoverOpen(false);
                              }}
                            >
                              <Plus className="h-4 w-4" />
                              Créer "{categorie}"
                            </button>
                          )}

                        {!categorie && existingCategories.length === 0 && (
                          <div className="px-3 py-2 text-sm text-muted-foreground">
                            Aucune catégorie. Tapez pour en créer une.
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description de la notice"
              rows={3}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="accessory">Lier à un accessoire (optionnel)</Label>
            <Select value={selectedAccessoryId} onValueChange={setSelectedAccessoryId}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner un accessoire" />
              </SelectTrigger>
              <SelectContent>
                {accessories.map((acc) => (
                  <SelectItem key={acc.id} value={acc.id}>
                    {acc.nom} {acc.marque ? `(${acc.marque})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button onClick={handleSubmit} disabled={isUploading} className="w-full">
            {isUploading ? (
              "Ajout en cours..."
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Ajouter la notice
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
