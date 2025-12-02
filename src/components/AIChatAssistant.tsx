// Composant Chat IA flottant
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAIConfig } from "@/hooks/useAIConfig";
import { supabase } from "@/integrations/supabase/client";
import { ChatMessage, SearchResult, ChatAction, processUserMessage } from "@/services/aiSearchService";
import { toast } from "sonner";

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
          <div className="mt-2 pt-2 border-t border-border/50 flex flex-wrap gap-2">
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

        {/* Timestamp */}
        <div className="mt-1 text-xs opacity-50">
          {message.timestamp.toLocaleTimeString("fr-FR", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
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
        return null;
    }
  };

  return (
    <div className="flex items-center gap-1 text-xs bg-background/50 rounded px-2 py-1">
      {getIcon()}
      <span className="truncate max-w-[150px]">{source.title}</span>
      {source.pageNumber && <span className="opacity-50">p.{source.pageNumber}</span>}
      {source.similarity && <span className="opacity-50">{Math.round(source.similarity * 100)}%</span>}
    </div>
  );
};

const SuggestionChips = ({ onSelect }: { onSelect: (text: string) => void }) => {
  const suggestions = [
    "Prépare le RTI pour ce projet",
    "Compare les prix des panneaux solaires",
    "Quelle section de câble pour 30A ?",
    "Quel fournisseur est le moins cher ?",
  ];

  return (
    <div className="flex flex-wrap gap-2 p-2">
      {suggestions.map((text, i) => (
        <button
          key={i}
          onClick={() => onSelect(text)}
          className="text-xs bg-muted hover:bg-muted/80 rounded-full px-3 py-1 transition-colors"
        >
          {text}
        </button>
      ))}
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

export const AIChatAssistant = ({ projectId, projectName }: AIChatAssistantProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { config, isConfigured } = useAIConfig();

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
    if (isOpen && !isMinimized && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen, isMinimized]);

  // Message d'accueil
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const welcomeMessage: ChatMessage = {
        role: "assistant",
        content: projectName
          ? `Bonjour ! Je suis prêt à vous aider sur le projet "${projectName}". Je peux :\n\n🔍 Rechercher dans vos notices et documents\n📊 Comparer les prix et fournisseurs\n📝 Préparer vos documents DREAL\n\nQue puis-je faire pour vous ?`
          : "Bonjour ! Je suis votre assistant Van Project. Je peux rechercher dans vos notices, comparer les prix du catalogue, et vous aider à préparer vos documents DREAL.\n\nComment puis-je vous aider ?",
        timestamp: new Date(),
      };
      setMessages([welcomeMessage]);
    }
  }, [isOpen, projectName]);

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

    const userMessage: ChatMessage = {
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await processUserMessage(
        userMessage.content,
        userId,
        {
          provider: config.provider,
          apiKey: config.apiKey,
        },
        messages,
      );

      setMessages((prev) => [...prev, response]);
    } catch (error: any) {
      console.error("Erreur chat:", error);
      const errorMessage: ChatMessage = {
        role: "assistant",
        content: `Désolé, une erreur s'est produite: ${error.message}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleActionClick = (action: ChatAction) => {
    switch (action.type) {
      case "generate_rti":
        toast.info(`Génération RTI pour ${action.data.projectName}...`);
        // TODO: Ouvrir le dialog de génération RTI
        break;
      case "change_supplier":
        toast.info("Changement de fournisseur...");
        // TODO: Implémenter le changement
        break;
      case "view_document":
        // TODO: Ouvrir le document
        break;
      case "view_accessory":
        // TODO: Ouvrir la fiche accessoire
        break;
    }
  };

  const handleSuggestionSelect = (text: string) => {
    setInput(text);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Bouton flottant
  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50"
        size="icon"
      >
        <Sparkles className="h-6 w-6" />
      </Button>
    );
  }

  // Fenêtre de chat
  return (
    <Card
      className={cn(
        "fixed bottom-6 right-6 z-50 shadow-xl transition-all duration-200",
        isMinimized ? "w-72 h-14" : "w-96 h-[500px]",
      )}
    >
      {/* Header */}
      <CardHeader className="p-3 border-b flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <CardTitle className="text-sm font-medium">
            Assistant IA
            {projectName && <span className="text-xs font-normal text-muted-foreground ml-2">{projectName}</span>}
          </CardTitle>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsMinimized(!isMinimized)}>
            {isMinimized ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      {/* Corps du chat */}
      {!isMinimized && (
        <CardContent className="p-0 flex flex-col h-[calc(100%-56px)]">
          {/* Messages */}
          <ScrollArea className="flex-1 p-4" ref={scrollRef}>
            <div className="space-y-4">
              {messages.map((msg, i) => (
                <MessageBubble key={i} message={msg} onActionClick={handleActionClick} />
              ))}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-lg px-4 py-2 flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Recherche en cours...</span>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Suggestions (si peu de messages) */}
          {messages.length <= 1 && !isLoading && <SuggestionChips onSelect={handleSuggestionSelect} />}

          {/* Alerte si pas configuré */}
          {!isConfigured && (
            <div className="px-4 py-2 bg-amber-50 dark:bg-amber-950 border-t">
              <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
                <AlertCircle className="h-4 w-4" />
                <span>Configurez votre clé API dans les paramètres IA</span>
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
                onKeyDown={handleKeyDown}
                placeholder="Posez votre question..."
                disabled={isLoading || !isConfigured}
                className="flex-1"
              />
              <Button size="icon" onClick={handleSend} disabled={!input.trim() || isLoading || !isConfigured}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
};

export default AIChatAssistant;
