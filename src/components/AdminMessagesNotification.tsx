import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Bell } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface AdminMessage {
  id: string;
  subject: string;
  message: string;
  created_at: string;
  read_at: string | null;
  is_global: boolean;
}

export const AdminMessagesNotification = () => {
  const [messages, setMessages] = useState<AdminMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    loadMessages();
    
    // Subscribe to new messages
    const channel = supabase
      .channel("admin-messages-changes")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "admin_messages",
        },
        () => {
          loadMessages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadMessages = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("admin_messages")
      .select("*")
      .or(`recipient_id.eq.${user.id},is_global.eq.true`)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      return;
    }

    setMessages(data || []);
    setUnreadCount(data?.filter((m) => !m.read_at).length || 0);
  };

  const markAsRead = async (messageId: string) => {
    const { error } = await supabase
      .from("admin_messages")
      .update({ read_at: new Date().toISOString() })
      .eq("id", messageId);

    if (!error) {
      loadMessages();
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
            >
              {unreadCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Messages de l'administration</SheetTitle>
          <SheetDescription>
            {unreadCount > 0
              ? `Vous avez ${unreadCount} message${unreadCount > 1 ? "s" : ""} non lu${unreadCount > 1 ? "s" : ""}`
              : "Aucun nouveau message"}
          </SheetDescription>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-120px)] mt-4">
          <div className="space-y-4">
            {messages.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Aucun message pour le moment
              </p>
            ) : (
              messages.map((message) => (
                <Card
                  key={message.id}
                  className={message.read_at ? "opacity-60" : ""}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1 flex-1">
                        <CardTitle className="text-base">
                          {message.subject}
                          {message.is_global && (
                            <Badge variant="outline" className="ml-2 text-xs">
                              Global
                            </Badge>
                          )}
                        </CardTitle>
                        <CardDescription className="text-xs">
                          {new Date(message.created_at).toLocaleDateString("fr-FR", {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </CardDescription>
                      </div>
                      {!message.read_at && (
                        <Badge variant="default" className="text-xs">
                          Nouveau
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm whitespace-pre-wrap">{message.message}</p>
                    {!message.read_at && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3"
                        onClick={() => markAsRead(message.id)}
                      >
                        Marquer comme lu
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};