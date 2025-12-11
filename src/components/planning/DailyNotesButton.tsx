// components/planning/DailyNotesButton.tsx
// Bouton pour ouvrir le planning visuel depuis le planning

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CalendarDays } from "lucide-react";
import VisualPlanningCanvas from "./VisualPlanningCanvas";

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
  showLabel = true 
}: DailyNotesButtonProps) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={variant}
              size={size}
              onClick={() => setIsOpen(true)}
              className="gap-2"
            >
              <CalendarDays className="h-4 w-4" />
              {showLabel && "Planning visuel"}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Ouvrir le planning visuel</p>
            <p className="text-xs text-gray-400">Canvas avec tâches liées entre jours</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <VisualPlanningCanvas
        open={isOpen}
        onOpenChange={setIsOpen}
        projectId={projectId}
      />
    </>
  );
};

export default DailyNotesButton;
