// components/planning/DailyNotesButton.tsx
// Bouton pour ouvrir les notes journalières depuis le planning

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { BookOpen } from "lucide-react";
import DailyNotesCanvas from "./DailyNotesCanvas";

interface DailyNotesButtonProps {
  projectId: string;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  showLabel?: boolean;
}

const DailyNotesButton = ({
  projectId,
  variant = "outline",
  size = "default",
  showLabel = true,
}: DailyNotesButtonProps) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant={variant} size={size} onClick={() => setIsOpen(true)} className="gap-2">
              <BookOpen className="h-4 w-4" />
              {showLabel && "Notes du jour"}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Notes journalières</p>
            <p className="text-xs text-gray-400">Dessinez et prenez des notes</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <DailyNotesCanvas open={isOpen} onOpenChange={setIsOpen} projectId={projectId} />
    </>
  );
};

export default DailyNotesButton;
