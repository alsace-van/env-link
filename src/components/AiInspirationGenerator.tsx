/**
 * AiInspirationGenerator.tsx
 * Version: 1.1
 * Date: 2025-12-20
 * Description: Générateur d'inspirations via Gemini 2.5 Flash Image (Nano Banana) avec slider avant/après
 */

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { toast } from "sonner";
import {
  Sparkles,
  Upload,
  X,
  Settings,
  Eye,
  Download,
  Save,
  Loader2,
  ChevronDown,
  ImageIcon,
  Key,
  AlertCircle,
} from "lucide-react";
import { ImageCompareSlider } from "./ImageCompareSlider";
import { supabase } from "@/integrations/supabase/client";

interface AiInspirationGeneratorProps {
  projectId: string;
  onImageSaved?: () => void;
}

interface GeneratedImage {
  id: string;
  url: string;
  prompt: string;
  sourceImage: string;
}

const AMENAGEMENT_OPTIONS = [
  { id: "lit_fixe", label: "Lit fixe", icon: "🛏️" },
  { id: "lit_pavillon", label: "Lit pavillon", icon: "🛏️" },
  { id: "lit_convertible", label: "Lit convertible", icon: "🛋️" },
  { id: "cuisine", label: "Cuisine", icon: "🍳" },
  { id: "douche", label: "Douche intérieure", icon: "🚿" },
  { id: "toilettes", label: "Toilettes", icon: "🚽" },
  { id: "bureau", label: "Espace bureau", icon: "💻" },
  { id: "dinette", label: "Coin repas/dinette", icon: "🪑" },
  { id: "rangements", label: "Rangements", icon: "🗄️" },
  { id: "garage", label: "Garage vélos/motos", icon: "🚲" },
];

const STYLE_OPTIONS = [
  { value: "moderne", label: "Moderne & minimaliste" },
  { value: "scandinave", label: "Scandinave (bois clair)" },
  { value: "industriel", label: "Industriel" },
  { value: "boheme", label: "Bohème / Cosy" },
  { value: "luxe", label: "Luxe / Haut de gamme" },
  { value: "outdoor", label: "Outdoor / Aventure" },
  { value: "vintage", label: "Vintage / Rétro" },
  { value: "japandi", label: "Japandi" },
];

const AMBIANCE_OPTIONS = [
  { value: "lumineux", label: "Lumineux & aéré" },
  { value: "cosy", label: "Cosy & chaleureux" },
  { value: "nature", label: "Nature & organique" },
  { value: "urban", label: "Urban & contemporain" },
  { value: "maritime", label: "Maritime / Côtier" },
  { value: "montagne", label: "Montagne / Chalet" },
];

export const AiInspirationGenerator = ({ projectId, onImageSaved }: AiInspirationGeneratorProps) => {
  // API Key
  const [apiKey, setApiKey] = useState(() => localStorage.getItem("gemini_api_key") || "");
  const [showApiKeySettings, setShowApiKeySettings] = useState(false);

  // Images sources
  const [sourceImages, setSourceImages] = useState<Array<{ file: File; preview: string }>>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Options d'aménagement
  const [selectedAmenagements, setSelectedAmenagements] = useState<string[]>([]);
  const [style, setStyle] = useState<string>("");
  const [ambiance, setAmbiance] = useState<string>("");
  const [customPrompt, setCustomPrompt] = useState("");

  // Génération
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);

  // Modal de comparaison
  const [compareModal, setCompareModal] = useState<{
    isOpen: boolean;
    before: string;
    after: string;
  }>({ isOpen: false, before: "", after: "" });

  // Sauvegarder la clé API
  const handleSaveApiKey = () => {
    localStorage.setItem("gemini_api_key", apiKey);
    setShowApiKeySettings(false);
    toast.success("Clé API sauvegardée");
  };

  // Gestion des fichiers
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newImages: Array<{ file: File; preview: string }> = [];

    Array.from(files).forEach((file) => {
      if (!file.type.startsWith("image/")) {
        toast.error(`${file.name} n'est pas une image`);
        return;
      }

      const preview = URL.createObjectURL(file);
      newImages.push({ file, preview });
    });

    setSourceImages((prev) => [...prev, ...newImages]);
  };

  const removeSourceImage = (index: number) => {
    setSourceImages((prev) => {
      const newImages = [...prev];
      URL.revokeObjectURL(newImages[index].preview);
      newImages.splice(index, 1);
      return newImages;
    });
  };

  // Toggle aménagement
  const toggleAmenagement = (id: string) => {
    setSelectedAmenagements((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    );
  };

  // Convertir image en base64
  const imageToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(",")[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Construire le prompt
  const buildPrompt = () => {
    let prompt = "Transforme cette photo d'intérieur de fourgon/van en une visualisation réaliste d'un aménagement camper van professionnel. ";

    if (selectedAmenagements.length > 0) {
      const amenagementLabels = selectedAmenagements
        .map((id) => AMENAGEMENT_OPTIONS.find((a) => a.id === id)?.label)
        .filter(Boolean);
      prompt += `L'aménagement doit inclure : ${amenagementLabels.join(", ")}. `;
    }

    if (style) {
      const styleLabel = STYLE_OPTIONS.find((s) => s.value === style)?.label;
      prompt += `Style : ${styleLabel}. `;
    }

    if (ambiance) {
      const ambianceLabel = AMBIANCE_OPTIONS.find((a) => a.value === ambiance)?.label;
      prompt += `Ambiance : ${ambianceLabel}. `;
    }

    if (customPrompt) {
      prompt += customPrompt + " ";
    }

    prompt += "Garde les mêmes dimensions et perspective que l'image originale. Rendu photoréaliste avec éclairage naturel.";

    return prompt;
  };

  // Générer les images
  const handleGenerate = async () => {
    if (!apiKey) {
      toast.error("Veuillez configurer votre clé API Gemini");
      setShowApiKeySettings(true);
      return;
    }

    if (sourceImages.length === 0) {
      toast.error("Veuillez uploader au moins une photo");
      return;
    }

    setIsGenerating(true);
    const newGeneratedImages: GeneratedImage[] = [];

    try {
      const prompt = buildPrompt();

      for (const sourceImage of sourceImages) {
        try {
          const base64Image = await imageToBase64(sourceImage.file);
          const mimeType = sourceImage.file.type || "image/jpeg";

          const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${apiKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [
                  {
                    parts: [
                      { text: prompt },
                      {
                        inlineData: {
                          mimeType: mimeType,
                          data: base64Image,
                        },
                      },
                    ],
                  },
                ],
              }),
            }
          );

          if (!response.ok) {
            const error = await response.json();
            console.error("Gemini API error:", error);
            
            if (response.status === 429) {
              toast.error("Quota API dépassé. Réessayez plus tard.");
            } else if (response.status === 400) {
              toast.error("Erreur de requête. Vérifiez votre clé API.");
            } else {
              toast.error(`Erreur API: ${error.error?.message || "Inconnue"}`);
            }
            continue;
          }

          const data = await response.json();

          // Extraire l'image générée
          const candidates = data.candidates || [];
          for (const candidate of candidates) {
            const parts = candidate.content?.parts || [];
            for (const part of parts) {
              if (part.inlineData?.data) {
                const imageUrl = `data:${part.inlineData.mimeType || "image/png"};base64,${part.inlineData.data}`;
                newGeneratedImages.push({
                  id: `gen_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                  url: imageUrl,
                  prompt: prompt,
                  sourceImage: sourceImage.preview,
                });
              }
            }
          }
        } catch (err) {
          console.error("Error generating image:", err);
          toast.error("Erreur lors de la génération");
        }
      }

      if (newGeneratedImages.length > 0) {
        setGeneratedImages((prev) => [...newGeneratedImages, ...prev]);
        toast.success(`${newGeneratedImages.length} image(s) générée(s)`);
      }
    } catch (error) {
      console.error("Generation error:", error);
      toast.error("Erreur lors de la génération");
    } finally {
      setIsGenerating(false);
    }
  };

  // Sauvegarder dans la galerie
  const handleSaveToGallery = async (image: GeneratedImage) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Vous devez être connecté");
        return;
      }

      // Convertir base64 en blob
      const response = await fetch(image.url);
      const blob = await response.blob();

      // Upload vers Supabase Storage
      const fileName = `${user.id}/${projectId}/ai_${Date.now()}.png`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("project-photos")
        .upload(fileName, blob, { contentType: "image/png" });

      if (uploadError) {
        throw uploadError;
      }

      // Obtenir l'URL publique
      const { data: publicUrl } = supabase.storage
        .from("project-photos")
        .getPublicUrl(fileName);

      // Enregistrer en base de données
      const { error: dbError } = await supabase.from("project_photos").insert({
        project_id: projectId,
        user_id: user.id,
        photo_url: publicUrl.publicUrl,
        description: "Inspiration générée par IA",
        comment: image.prompt,
        type: "inspiration",
      });

      if (dbError) {
        throw dbError;
      }

      toast.success("Image sauvegardée dans la galerie");
      onImageSaved?.();
    } catch (error) {
      console.error("Save error:", error);
      toast.error("Erreur lors de la sauvegarde");
    }
  };

  // Télécharger l'image
  const handleDownload = (image: GeneratedImage) => {
    const link = document.createElement("a");
    link.href = image.url;
    link.download = `inspiration_${Date.now()}.png`;
    link.click();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-500" />
              Générateur d'inspirations IA
            </CardTitle>
            <CardDescription>
              Uploadez vos photos de fourgon et laissez l'IA imaginer des aménagements
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowApiKeySettings(true)}
            className={!apiKey ? "border-orange-300 text-orange-600" : ""}
          >
            <Key className="h-4 w-4 mr-2" />
            {apiKey ? "Clé API configurée" : "Configurer l'API"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Alerte si pas de clé API */}
        {!apiKey && (
          <div className="flex items-center gap-3 p-3 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 rounded-lg">
            <AlertCircle className="h-5 w-5 text-orange-500 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-orange-700 dark:text-orange-400">
                Clé API Gemini requise
              </p>
              <p className="text-orange-600 dark:text-orange-500">
                Obtenez votre clé gratuite sur{" "}
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  Google AI Studio
                </a>
              </p>
            </div>
          </div>
        )}

        {/* Zone d'upload */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Photos de votre fourgon</Label>
          <div
            className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Cliquez ou glissez vos photos ici
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              PNG, JPG jusqu'à 10MB
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleFileSelect}
          />

          {/* Aperçu des images uploadées */}
          {sourceImages.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {sourceImages.map((img, index) => (
                <div key={index} className="relative group">
                  <img
                    src={img.preview}
                    alt={`Source ${index + 1}`}
                    className="h-20 w-20 object-cover rounded-lg border"
                  />
                  <button
                    onClick={() => removeSourceImage(index)}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Options d'aménagement */}
        <Collapsible defaultOpen>
          <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium w-full">
            <ChevronDown className="h-4 w-4" />
            Options d'aménagement
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3 space-y-4">
            {/* Équipements */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Équipements souhaités</Label>
              <div className="flex flex-wrap gap-2">
                {AMENAGEMENT_OPTIONS.map((option) => (
                  <Badge
                    key={option.id}
                    variant={selectedAmenagements.includes(option.id) ? "default" : "outline"}
                    className="cursor-pointer hover:bg-primary/80 transition-colors"
                    onClick={() => toggleAmenagement(option.id)}
                  >
                    <span className="mr-1">{option.icon}</span>
                    {option.label}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Style et Ambiance */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Style</Label>
                <Select value={style} onValueChange={setStyle}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir un style" />
                  </SelectTrigger>
                  <SelectContent>
                    {STYLE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Ambiance</Label>
                <Select value={ambiance} onValueChange={setAmbiance}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir une ambiance" />
                  </SelectTrigger>
                  <SelectContent>
                    {AMBIANCE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Prompt personnalisé */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">
                Instructions supplémentaires (optionnel)
              </Label>
              <Textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="Ex: Ajouter une grande fenêtre sur le côté, utiliser du bois de chêne..."
                rows={2}
              />
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Bouton générer */}
        <Button
          onClick={handleGenerate}
          disabled={isGenerating || sourceImages.length === 0 || !apiKey}
          className="w-full"
          size="lg"
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Génération en cours...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-2" />
              Générer des inspirations
            </>
          )}
        </Button>

        {/* Résultats générés */}
        {generatedImages.length > 0 && (
          <div className="space-y-4">
            <Label className="text-sm font-medium">Inspirations générées</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {generatedImages.map((image) => (
                <Card key={image.id} className="overflow-hidden">
                  <div className="relative aspect-video">
                    <img
                      src={image.url}
                      alt="Inspiration générée"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-3 flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() =>
                        setCompareModal({
                          isOpen: true,
                          before: image.sourceImage,
                          after: image.url,
                        })
                      }
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Comparer
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownload(image)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => handleSaveToGallery(image)}
                    >
                      <Save className="h-4 w-4 mr-1" />
                      Sauver
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </CardContent>

      {/* Modal configuration API Key */}
      <Dialog open={showApiKeySettings} onOpenChange={setShowApiKeySettings}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Configuration de l'API Gemini
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Pour utiliser le générateur d'inspirations, vous avez besoin d'une clé API Gemini gratuite.
            </p>
            <ol className="text-sm space-y-2 list-decimal list-inside text-muted-foreground">
              <li>
                Rendez-vous sur{" "}
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline"
                >
                  Google AI Studio
                </a>
              </li>
              <li>Connectez-vous avec votre compte Google</li>
              <li>Cliquez sur "Create API Key"</li>
              <li>Copiez la clé et collez-la ci-dessous</li>
            </ol>
            <div className="space-y-2">
              <Label htmlFor="apiKey">Clé API Gemini</Label>
              <Input
                id="apiKey"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="AIza..."
              />
              <p className="text-xs text-muted-foreground">
                Votre clé est stockée localement sur votre appareil uniquement.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowApiKeySettings(false)} className="flex-1">
                Annuler
              </Button>
              <Button onClick={handleSaveApiKey} className="flex-1" disabled={!apiKey}>
                Sauvegarder
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de comparaison avant/après */}
      <Dialog open={compareModal.isOpen} onOpenChange={(open) => setCompareModal((prev) => ({ ...prev, isOpen: open }))}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Comparaison avant / après</DialogTitle>
          </DialogHeader>
          <ImageCompareSlider
            beforeImage={compareModal.before}
            afterImage={compareModal.after}
            beforeLabel="Original"
            afterLabel="Inspiration IA"
            className="w-full"
          />
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default AiInspirationGenerator;
