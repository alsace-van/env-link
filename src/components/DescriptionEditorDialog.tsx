import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Bold, Italic, List, ListOrdered, Heading2, Eye, Edit, Undo, 
  ImagePlus, FileText, X, ZoomIn, Loader2, Trash2 
} from "lucide-react";
import { toast } from "sonner";

interface MediaItem {
  type: "image" | "pdf";
  url: string;
  name: string;
}

interface DescriptionEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: string;
  media: MediaItem[];
  onSave: (value: string, media: MediaItem[]) => void;
  title?: string;
  accessoryId?: string;
}

// Fonction simple pour convertir le markdown basique en HTML
const renderMarkdown = (text: string): string => {
  if (!text) return "";
  
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/^### (.+)$/gm, "<h4 class='font-semibold text-base mt-3 mb-1'>$1</h4>")
    .replace(/^## (.+)$/gm, "<h3 class='font-semibold text-lg mt-4 mb-2'>$1</h3>")
    .replace(/^# (.+)$/gm, "<h2 class='font-bold text-xl mt-4 mb-2'>$1</h2>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/^- (.+)$/gm, "<li class='ml-4'>• $1</li>")
    .replace(/^\* (.+)$/gm, "<li class='ml-4'>• $1</li>")
    .replace(/^\d+\. (.+)$/gm, "<li class='ml-4 list-decimal'>$1</li>")
    .replace(/\n\n/g, "</p><p class='mb-2'>")
    .replace(/\n/g, "<br/>");
  
  return `<p class='mb-2'>${html}</p>`;
};

const DescriptionEditorDialog = ({
  open,
  onOpenChange,
  value,
  media = [],
  onSave,
  title = "Éditer la description",
  accessoryId,
}: DescriptionEditorDialogProps) => {
  const [content, setContent] = useState(value);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>(media);
  const [activeTab, setActiveTab] = useState<string>("edit");
  const [history, setHistory] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [previewMedia, setPreviewMedia] = useState<MediaItem | null>(null);
  
  const imageInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setContent(value);
      setMediaItems(media || []);
      setHistory([value]);
    }
  }, [open, value, media]);

  const insertText = (before: string, after: string = "") => {
    const textarea = document.getElementById("description-editor") as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end);
    const newText = content.substring(0, start) + before + selectedText + after + content.substring(end);
    
    setHistory([...history, content]);
    setContent(newText);
    
    setTimeout(() => {
      textarea.focus();
      const newPosition = start + before.length + selectedText.length + after.length;
      textarea.setSelectionRange(newPosition, newPosition);
    }, 0);
  };

  const insertAtLineStart = (prefix: string) => {
    const textarea = document.getElementById("description-editor") as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const lineStart = content.lastIndexOf("\n", start - 1) + 1;
    const newText = content.substring(0, lineStart) + prefix + content.substring(lineStart);
    
    setHistory([...history, content]);
    setContent(newText);
  };

  const handleUndo = () => {
    if (history.length > 1) {
      const newHistory = [...history];
      newHistory.pop();
      setContent(newHistory[newHistory.length - 1]);
      setHistory(newHistory);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Veuillez sélectionner une image");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("L'image ne doit pas dépasser 5 Mo");
      return;
    }

    setUploading(true);

    try {
      const timestamp = Date.now();
      const fileName = `description/${accessoryId || "new"}_${timestamp}_${file.name.replace(/\s+/g, "_")}`;
      
      const { error: uploadError } = await supabase.storage
        .from("accessory-images")
        .upload(fileName, file);

      if (uploadError) {
        throw uploadError;
      }

      const { data: urlData } = supabase.storage
        .from("accessory-images")
        .getPublicUrl(fileName);

      const newMedia: MediaItem = {
        type: "image",
        url: urlData.publicUrl,
        name: file.name,
      };

      setMediaItems([...mediaItems, newMedia]);
      toast.success("Image ajoutée");
    } catch (error) {
      console.error("Erreur upload:", error);
      toast.error("Erreur lors de l'upload de l'image");
    } finally {
      setUploading(false);
      if (imageInputRef.current) {
        imageInputRef.current.value = "";
      }
    }
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      toast.error("Veuillez sélectionner un fichier PDF");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("Le PDF ne doit pas dépasser 10 Mo");
      return;
    }

    setUploading(true);

    try {
      const timestamp = Date.now();
      const fileName = `description/${accessoryId || "new"}_${timestamp}_${file.name.replace(/\s+/g, "_")}`;
      
      const { error: uploadError } = await supabase.storage
        .from("accessory-images")
        .upload(fileName, file);

      if (uploadError) {
        throw uploadError;
      }

      const { data: urlData } = supabase.storage
        .from("accessory-images")
        .getPublicUrl(fileName);

      const newMedia: MediaItem = {
        type: "pdf",
        url: urlData.publicUrl,
        name: file.name,
      };

      setMediaItems([...mediaItems, newMedia]);
      toast.success("PDF ajouté");
    } catch (error) {
      console.error("Erreur upload:", error);
      toast.error("Erreur lors de l'upload du PDF");
    } finally {
      setUploading(false);
      if (pdfInputRef.current) {
        pdfInputRef.current.value = "";
      }
    }
  };

  const removeMedia = (index: number) => {
    const newMedia = [...mediaItems];
    newMedia.splice(index, 1);
    setMediaItems(newMedia);
  };

  const handleSave = () => {
    onSave(content, mediaItems);
    onOpenChange(false);
  };

  const toolbarButtons = [
    { icon: Bold, label: "Gras", action: () => insertText("**", "**") },
    { icon: Italic, label: "Italique", action: () => insertText("*", "*") },
    { icon: Heading2, label: "Titre", action: () => insertAtLineStart("## ") },
    { icon: List, label: "Liste à puces", action: () => insertAtLineStart("- ") },
    { icon: ListOrdered, label: "Liste numérotée", action: () => insertAtLineStart("1. ") },
  ];

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
            <div className="flex items-center justify-between border-b pb-2">
              <TabsList>
                <TabsTrigger value="edit" className="flex items-center gap-1">
                  <Edit className="h-4 w-4" />
                  Éditer
                </TabsTrigger>
                <TabsTrigger value="preview" className="flex items-center gap-1">
                  <Eye className="h-4 w-4" />
                  Aperçu
                </TabsTrigger>
              </TabsList>

              {activeTab === "edit" && (
                <div className="flex items-center gap-1">
                  {toolbarButtons.map((btn, index) => (
                    <Button
                      key={index}
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={btn.action}
                      title={btn.label}
                    >
                      <btn.icon className="h-4 w-4" />
                    </Button>
                  ))}
                  <div className="w-px h-6 bg-border mx-1" />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={handleUndo}
                    disabled={history.length <= 1}
                    title="Annuler"
                  >
                    <Undo className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>

            <TabsContent value="edit" className="flex-1 mt-4 space-y-4">
              <Textarea
                id="description-editor"
                value={content}
                onChange={(e) => {
                  setHistory([...history, content]);
                  setContent(e.target.value);
                }}
                onKeyDown={(e) => e.stopPropagation()}
                className="min-h-[200px] font-mono text-sm resize-none"
                placeholder="Décrivez l'article...

Vous pouvez utiliser du formatage :
- **texte en gras**
- *texte en italique*
- ## Titre de section
- Liste à puces avec - ou *
- Liste numérotée avec 1. 2. 3."
              />

              {/* Section Médias */}
              <div className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-sm">Images et documents</h4>
                  <div className="flex items-center gap-2">
                    <input
                      ref={imageInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                      id="media-image-upload"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => imageInputRef.current?.click()}
                      disabled={uploading}
                    >
                      {uploading ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <ImagePlus className="h-4 w-4 mr-2" />
                      )}
                      Image
                    </Button>

                    <input
                      ref={pdfInputRef}
                      type="file"
                      accept="application/pdf"
                      onChange={handlePdfUpload}
                      className="hidden"
                      id="media-pdf-upload"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => pdfInputRef.current?.click()}
                      disabled={uploading}
                    >
                      {uploading ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <FileText className="h-4 w-4 mr-2" />
                      )}
                      PDF
                    </Button>
                  </div>
                </div>

                {mediaItems.length > 0 ? (
                  <div className="flex flex-wrap gap-3">
                    {mediaItems.map((item, index) => (
                      <div
                        key={index}
                        className="relative group border rounded-lg overflow-hidden bg-muted/30"
                      >
                        {item.type === "image" ? (
                          <img
                            src={item.url}
                            alt={item.name}
                            className="w-24 h-24 object-cover cursor-pointer hover:opacity-80 transition-opacity"
                            onClick={() => setPreviewMedia(item)}
                          />
                        ) : (
                          <div
                            className="w-24 h-24 flex flex-col items-center justify-center cursor-pointer hover:bg-muted/50 transition-colors p-2"
                            onClick={() => setPreviewMedia(item)}
                          >
                            <FileText className="h-8 w-8 text-red-500 mb-1" />
                            <span className="text-xs text-center text-muted-foreground truncate w-full">
                              {item.name.length > 12 ? item.name.substring(0, 12) + "..." : item.name}
                            </span>
                          </div>
                        )}
                        
                        {/* Bouton supprimer */}
                        <button
                          onClick={() => removeMedia(index)}
                          className="absolute top-1 right-1 p-1 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="h-3 w-3" />
                        </button>

                        {/* Bouton agrandir */}
                        <button
                          onClick={() => setPreviewMedia(item)}
                          className="absolute bottom-1 right-1 p-1 bg-black/50 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <ZoomIn className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Aucun média. Ajoutez des images ou des PDFs pour illustrer la description.
                  </p>
                )}
              </div>
            </TabsContent>

            <TabsContent value="preview" className="flex-1 mt-4">
              <ScrollArea className="h-[400px] border rounded-md p-4 bg-muted/20">
                {/* Médias */}
                {mediaItems.length > 0 && (
                  <div className="flex flex-wrap gap-3 mb-4 pb-4 border-b">
                    {mediaItems.map((item, index) => (
                      <div
                        key={index}
                        className="cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => setPreviewMedia(item)}
                      >
                        {item.type === "image" ? (
                          <img
                            src={item.url}
                            alt={item.name}
                            className="w-20 h-20 object-cover rounded-lg border"
                          />
                        ) : (
                          <div className="w-20 h-20 flex flex-col items-center justify-center rounded-lg border bg-white p-2">
                            <FileText className="h-6 w-6 text-red-500 mb-1" />
                            <span className="text-xs text-center text-muted-foreground truncate w-full">
                              PDF
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Texte */}
                {content ? (
                  <div
                    className="prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
                  />
                ) : (
                  <p className="text-muted-foreground text-sm">Aucun contenu à afficher</p>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>

          <div className="text-xs text-muted-foreground mt-2">
            <span className="font-medium">Raccourcis :</span> **gras** • *italique* • ## Titre • - Liste à puces • 1. Liste numérotée
          </div>

          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="button" onClick={handleSave}>
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modale de prévisualisation média */}
      <Dialog open={!!previewMedia} onOpenChange={(open) => !open && setPreviewMedia(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {previewMedia?.type === "image" ? (
                <ImagePlus className="h-5 w-5" />
              ) : (
                <FileText className="h-5 w-5 text-red-500" />
              )}
              {previewMedia?.name}
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-auto">
            {previewMedia?.type === "image" ? (
              <img
                src={previewMedia.url}
                alt={previewMedia.name}
                className="max-w-full max-h-[70vh] mx-auto object-contain"
              />
            ) : previewMedia?.type === "pdf" ? (
              <iframe
                src={previewMedia.url}
                className="w-full h-[70vh] border rounded"
                title={previewMedia.name}
              />
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => window.open(previewMedia?.url, "_blank")}
            >
              Ouvrir dans un nouvel onglet
            </Button>
            <Button type="button" onClick={() => setPreviewMedia(null)}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default DescriptionEditorDialog;
