// Composant Chat IA flottant avec conversations organisées
// Assistant pour recherche, comparaison et génération de documents

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  MessageCircle,
  X,
  Send,
  Sparkles,
  FileText,
  Package,
  FolderOpen,
  Loader2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  AlertCircle,
  Plus,
  Trash2,
  Edit2,
  Check,
  ChevronLeft,
  MessageSquare,
  History,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAIConfig } from "@/hooks/useAIConfig";
import { supabase } from "@/integrations/supabase/client";
import { ChatMessage, SearchResult, ChatAction, processUserMessage } from "@/services/aiSearchService";
import { toast } from "sonner";

// ============================================
// TYPES
// ============================================

interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
  projectId?: string;
}

// ============================================
// SOUS-COMPOSANTS
// ============================================

interface MessageBubbleProps {
  message: ChatMessage;
  onActionClick: (action: ChatAction) => void;
}

const MessageBubble = ({ message, onActionClick }: MessageBubbleProps) => {
  const [showSources, setShowSources] = useState(false);
  const isUser = message.role === "user";

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn("max-w-[85%] rounded-lg px-4 py-2", isUser ? "bg-primary text-primary-foreground" : "bg-muted")}
      >
        {/* Contenu du message */}
        <div className="whitespace-pre-wrap text-sm">{message.content}</div>

        {/* Sources */}
        {message.sources && message.sources.length > 0 && (
          <div className="mt-2 pt-2 border-t border-border/50">
            <button
              onClick={() => setShowSources(!showSources)}
              className="flex items-center gap-1 text-xs opacity-70 hover:opacity-100"
            >
              {showSources ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {message.sources.length} source(s)
            </button>

            {showSources && (
              <div className="mt-2 space-y-1">
                {message.sources.map((source, i) => (
                  <SourceBadge key={i} source={source} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        {message.actions && message.actions.length > 0 && (
          <div className="mt-2 pt-2 border-t border-border/50 flex flex-wrap gap-1">
            {message.actions.map((action, i) => (
              <Button
                key={i}
                size="sm"
                variant="secondary"
                className="h-7 text-xs"
                onClick={() => onActionClick(action)}
              >
                {action.label}
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const SourceBadge = ({ source }: { source: SearchResult }) => {
  const getIcon = () => {
    switch (source.type) {
      case "document":
        return <FileText className="h-3 w-3" />;
      case "accessory":
        return <Package className="h-3 w-3" />;
      case "project":
        return <FolderOpen className="h-3 w-3" />;
      default:
        return <FileText className="h-3 w-3" />;
    }
  };

  const getLabel = () => {
    if (source.type === "document" && source.pageNumber) {
      return `${source.title} (p.${source.pageNumber})`;
    }
    return source.title;
  };

  return (
    <Badge variant="outline" className="text-xs flex items-center gap-1 font-normal">
      {getIcon()}
      <span className="truncate max-w-[150px]">{getLabel()}</span>
      {source.similarity && <span className="opacity-60">{Math.round(source.similarity * 100)}%</span>}
    </Badge>
  );
};

// Liste des conversations
interface ConversationListProps {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
}

const ConversationList = ({ conversations, activeId, onSelect, onNew, onDelete, onRename }: ConversationListProps) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");

  const handleStartEdit = (conv: Conversation) => {
    setEditingId(conv.id);
    setEditTitle(conv.title);
  };

  const handleSaveEdit = () => {
    if (editingId && editTitle.trim()) {
      onRename(editingId, editTitle.trim());
    }
    setEditingId(null);
  };

  // Grouper par date
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const lastWeek = new Date(today);
  lastWeek.setDate(lastWeek.getDate() - 7);

  const groups: { label: string; items: Conversation[] }[] = [];

  const todayItems = conversations.filter((c) => c.updatedAt.toDateString() === today.toDateString());
  const yesterdayItems = conversations.filter((c) => c.updatedAt.toDateString() === yesterday.toDateString());
  const lastWeekItems = conversations.filter(
    (c) =>
      c.updatedAt > lastWeek &&
      c.updatedAt.toDateString() !== today.toDateString() &&
      c.updatedAt.toDateString() !== yesterday.toDateString(),
  );
  const olderItems = conversations.filter((c) => c.updatedAt <= lastWeek);

  if (todayItems.length > 0) groups.push({ label: "Aujourd'hui", items: todayItems });
  if (yesterdayItems.length > 0) groups.push({ label: "Hier", items: yesterdayItems });
  if (lastWeekItems.length > 0) groups.push({ label: "Cette semaine", items: lastWeekItems });
  if (olderItems.length > 0) groups.push({ label: "Plus ancien", items: olderItems });

  return (
    <div className="flex flex-col h-full">
      <div className="p-2 border-b">
        <Button onClick={onNew} size="sm" className="w-full" variant="outline">
          <Plus className="h-4 w-4 mr-2" />
          Nouvelle conversation
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-3">
          {groups.length === 0 ? (
            <div className="text-center text-muted-foreground text-sm py-4">Aucune conversation</div>
          ) : (
            groups.map((group) => (
              <div key={group.label}>
                <div className="text-xs font-medium text-muted-foreground px-2 mb-1">{group.label}</div>
                <div className="space-y-1">
                  {group.items.map((conv) => (
                    <div
                      key={conv.id}
                      className={cn(
                        "group flex items-center gap-2 p-2 rounded-md cursor-pointer hover:bg-muted/50 transition-colors",
                        activeId === conv.id && "bg-muted",
                      )}
                      onClick={() => onSelect(conv.id)}
                    >
                      <MessageSquare className="h-4 w-4 text-muted-foreground shrink-0" />

                      {editingId === conv.id ? (
                        <div className="flex-1 flex items-center gap-1">
                          <Input
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            className="h-6 text-sm"
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleSaveEdit();
                              if (e.key === "Escape") setEditingId(null);
                            }}
                            autoFocus
                          />
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSaveEdit();
                            }}
                          >
                            <Check className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{conv.title}</div>
                            <div className="text-xs text-muted-foreground">{conv.messages.length - 1} messages</div>
                          </div>

                          <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStartEdit(conv);
                              }}
                            >
                              <Edit2 className="h-3 w-3" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 text-destructive hover:text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDelete(conv.id);
                              }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

// ============================================
// COMPOSANT PRINCIPAL
// ============================================

interface AIChatAssistantProps {
  projectId?: string;
  projectName?: string;
}

const AIChatAssistant = ({ projectId, projectName }: AIChatAssistantProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Conversations
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);

  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { config, isConfigured } = useAIConfig();

  // Conversation active
  const activeConversation = conversations.find((c) => c.id === activeConversationId);
  const messages = activeConversation?.messages || [];

  // Clé localStorage
  const getStorageKey = () => `ai-chat-conversations-${userId || "guest"}`;

  // Charger les conversations depuis localStorage
  useEffect(() => {
    if (userId) {
      const stored = localStorage.getItem(getStorageKey());
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          // Convertir les dates
          const convs = parsed.map((c: any) => ({
            ...c,
            createdAt: new Date(c.createdAt),
            updatedAt: new Date(c.updatedAt),
            messages: c.messages.map((m: any) => ({
              ...m,
              timestamp: new Date(m.timestamp),
            })),
          }));
          setConversations(convs);

          // Activer la dernière conversation mise à jour
          if (convs.length > 0) {
            const sorted = [...convs].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
            setActiveConversationId(sorted[0].id);
          }
        } catch (e) {
          console.error("Erreur chargement conversations:", e);
        }
      }
    }
  }, [userId]);

  // Sauvegarder les conversations
  useEffect(() => {
    if (userId && conversations.length > 0) {
      localStorage.setItem(getStorageKey(), JSON.stringify(conversations));
    }
  }, [conversations, userId]);

  // Récupérer l'utilisateur
  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUserId(user?.id || null);
    };
    getUser();
  }, []);

  // Scroll automatique
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus input quand ouvert
  useEffect(() => {
    if (isOpen && !isMinimized && !showHistory && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen, isMinimized, showHistory]);

  // Créer nouvelle conversation
  const createNewConversation = () => {
    const welcomeMessage: ChatMessage = {
      role: "assistant",
      content: projectName
        ? `Bonjour ! Je suis prêt à vous aider sur le projet "${projectName}". Je peux :\n\n🔍 Rechercher dans vos notices et documents\n📊 Comparer les prix et fournisseurs\n📝 Préparer vos documents DREAL\n\nQue puis-je faire pour vous ?`
        : "Bonjour ! Je suis votre assistant Van Project. Je peux rechercher dans vos notices, comparer les prix du catalogue, et vous aider à préparer vos documents DREAL.\n\nComment puis-je vous aider ?",
      timestamp: new Date(),
    };

    const newConv: Conversation = {
      id: crypto.randomUUID(),
      title: projectName ? `Projet ${projectName}` : "Nouvelle conversation",
      messages: [welcomeMessage],
      createdAt: new Date(),
      updatedAt: new Date(),
      projectId,
    };

    setConversations((prev) => [newConv, ...prev]);
    setActiveConversationId(newConv.id);
    setShowHistory(false);
  };

  // Créer conversation au premier ouverture si aucune
  useEffect(() => {
    if (isOpen && conversations.length === 0 && userId) {
      createNewConversation();
    }
  }, [isOpen, userId]);

  // Supprimer conversation
  const deleteConversation = (id: string) => {
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeConversationId === id) {
      const remaining = conversations.filter((c) => c.id !== id);
      setActiveConversationId(remaining.length > 0 ? remaining[0].id : null);
    }
  };

  // Renommer conversation
  const renameConversation = (id: string, title: string) => {
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, title } : c)));
  };

  // Auto-générer titre après premier message utilisateur
  const autoGenerateTitle = (userMessage: string): string => {
    // Prendre les premiers mots significatifs
    const words = userMessage
      .replace(/[?!.,;:]/g, "")
      .split(" ")
      .filter((w) => w.length > 2)
      .slice(0, 4);

    if (words.length > 0) {
      return words.join(" ").substring(0, 40);
    }
    return "Conversation";
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    if (!isConfigured || !config.provider || !config.apiKey) {
      toast.error("Configurez votre clé API dans les paramètres IA");
      return;
    }

    if (!userId) {
      toast.error("Vous devez être connecté");
      return;
    }

    // Créer conversation si nécessaire
    if (!activeConversationId) {
      createNewConversation();
      return;
    }

    const userMessage: ChatMessage = {
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };

    // Mise à jour des messages
    setConversations((prev) =>
      prev.map((c) => {
        if (c.id === activeConversationId) {
          const isFirstUserMessage = c.messages.filter((m) => m.role === "user").length === 0;
          return {
            ...c,
            messages: [...c.messages, userMessage],
            updatedAt: new Date(),
            // Auto-renommer si premier message et titre par défaut
            title:
              isFirstUserMessage && c.title.startsWith("Nouvelle") ? autoGenerateTitle(userMessage.content) : c.title,
          };
        }
        return c;
      }),
    );

    setInput("");
    setIsLoading(true);

    try {
      const currentMessages = activeConversation?.messages || [];
      const response = await processUserMessage(
        userMessage.content,
        userId,
        {
          provider: config.provider,
          apiKey: config.apiKey,
        },
        currentMessages,
        projectId,
      );

      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeConversationId ? { ...c, messages: [...c.messages, response], updatedAt: new Date() } : c,
        ),
      );
    } catch (error: any) {
      console.error("Erreur chat:", error);
      const errorMessage: ChatMessage = {
        role: "assistant",
        content: `Désolé, une erreur s'est produite: ${error.message}`,
        timestamp: new Date(),
      };
      setConversations((prev) =>
        prev.map((c) => (c.id === activeConversationId ? { ...c, messages: [...c.messages, errorMessage] } : c)),
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleActionClick = (action: ChatAction) => {
    switch (action.type) {
      case "generate_rti":
        toast.info("Génération RTI en cours...");
        // TODO: Appeler le service de génération RTI
        break;
      case "change_supplier":
        toast.info("Changement de fournisseur...");
        break;
      case "view_document":
        window.open(action.data.url, "_blank");
        break;
      default:
        console.log("Action non gérée:", action);
    }
  };

  // Suggestions
  const suggestions = projectId
    ? ["Prépare le RTI", "Résumé du projet", "État des poids", "Liste des équipements"]
    : ["Compare les frigos", "Notices Webasto", "Documents DREAL"];

  // ============================================
  // RENDU
  // ============================================

  // Bouton flottant
  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        size="icon"
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50"
      >
        <Sparkles className="h-6 w-6" />
      </Button>
    );
  }

  return (
    <Card
      className={cn(
        "fixed bottom-6 right-6 z-50 shadow-xl transition-all duration-200",
        isMinimized ? "w-80 h-14" : "w-[500px] h-[600px]",
      )}
    >
      {/* Header */}
      <CardHeader className="p-3 border-b flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2">
          {showHistory && !isMinimized && (
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setShowHistory(false)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
          <Sparkles className="h-5 w-5 text-primary" />
          <CardTitle className="text-sm font-medium">
            {showHistory ? "Historique" : activeConversation?.title || "Assistant IA"}
          </CardTitle>
        </div>
        <div className="flex items-center gap-1">
          {!isMinimized && !showHistory && (
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={() => setShowHistory(true)}
              title="Historique des conversations"
            >
              <History className="h-4 w-4" />
            </Button>
          )}
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setIsMinimized(!isMinimized)}>
            {isMinimized ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setIsOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      {/* Contenu */}
      {!isMinimized && (
        <CardContent className="p-0 flex flex-col h-[calc(100%-56px)]">
          {showHistory ? (
            // Liste des conversations
            <ConversationList
              conversations={conversations}
              activeId={activeConversationId}
              onSelect={(id) => {
                setActiveConversationId(id);
                setShowHistory(false);
              }}
              onNew={createNewConversation}
              onDelete={deleteConversation}
              onRename={renameConversation}
            />
          ) : (
            <>
              {/* Alerte si non configuré */}
              {!isConfigured && (
                <div className="p-3 bg-amber-50 border-b border-amber-200">
                  <div className="flex items-center gap-2 text-amber-700 text-sm">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>Configurez votre clé API IA dans les paramètres</span>
                  </div>
                </div>
              )}

              {/* Messages */}
              <ScrollArea ref={scrollRef} className="flex-1 p-4">
                <div className="space-y-4">
                  {messages.map((msg, i) => (
                    <MessageBubble key={i} message={msg} onActionClick={handleActionClick} />
                  ))}

                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="bg-muted rounded-lg px-4 py-2 flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm">Réflexion...</span>
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>

              {/* Suggestions */}
              {messages.length <= 1 && (
                <div className="px-4 pb-2">
                  <div className="flex flex-wrap gap-1">
                    {suggestions.map((s, i) => (
                      <Badge
                        key={i}
                        variant="secondary"
                        className="cursor-pointer hover:bg-secondary/80"
                        onClick={() => setInput(s)}
                      >
                        {s}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Input */}
              <div className="p-3 border-t">
                <div className="flex gap-2">
                  <Input
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={isConfigured ? "Posez votre question..." : "Configurez d'abord l'IA"}
                    disabled={!isConfigured || isLoading}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                  />
                  <Button size="icon" onClick={handleSend} disabled={!input.trim() || isLoading || !isConfigured}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      )}
    </Card>
  );
};

export default AIChatAssistant;
export { AIChatAssistant };
