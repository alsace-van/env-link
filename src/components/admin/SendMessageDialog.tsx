import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Mail, Users } from "lucide-react";
import { Switch } from "@/components/ui/switch";

interface SendMessageDialogProps {
  recipientId?: string;
  recipientEmail?: string;
}

export const SendMessageDialog = ({ recipientId, recipientEmail }: SendMessageDialogProps) => {
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [isGlobal, setIsGlobal] = useState(!recipientId);
  const [loading, setLoading] = useState(false);

  const handleSendMessage = async () => {
    if (!subject || !message) {
      toast.error("Sujet et message requis");
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      const { error } = await supabase.from("admin_messages").insert({
        sender_id: user.id,
        recipient_id: isGlobal ? null : recipientId,
        subject,
        message,
        is_global: isGlobal,
      });

      if (error) throw error;

      // Logger l'action
      await supabase.from("admin_actions_log").insert({
        admin_id: user.id,
        action: "send_message",
        target_user_id: isGlobal ? null : recipientId,
        details: { 
          subject, 
          is_global: isGlobal,
          recipient_email: recipientEmail 
        },
      });

      toast.success(
        isGlobal 
          ? "Message envoyé à tous les utilisateurs" 
          : `Message envoyé à ${recipientEmail}`
      );
      
      setSubject("");
      setMessage("");
      setOpen(false);
    } catch (error: any) {
      toast.error(error.message || "Erreur lors de l'envoi du message");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {recipientId ? (
          <Button variant="ghost" size="sm">
            <Mail className="h-4 w-4" />
          </Button>
        ) : (
          <Button variant="outline">
            <Users className="h-4 w-4 mr-2" />
            Message global
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {recipientId ? `Envoyer un message à ${recipientEmail}` : "Envoyer un message"}
          </DialogTitle>
          <DialogDescription>
            {isGlobal 
              ? "Ce message sera visible par tous les utilisateurs" 
              : "Ce message sera envoyé uniquement à cet utilisateur"}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {!recipientId && (
            <div className="flex items-center space-x-2">
              <Switch
                id="global"
                checked={isGlobal}
                onCheckedChange={setIsGlobal}
              />
              <Label htmlFor="global">Message global (tous les utilisateurs)</Label>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="subject">Sujet</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Objet du message"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="message">Message</Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Votre message..."
              rows={8}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Annuler
          </Button>
          <Button onClick={handleSendMessage} disabled={loading}>
            {loading ? "Envoi..." : "Envoyer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};