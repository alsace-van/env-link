import { useState, useRef, useEffect } from "react";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

interface DraggableToolbarProps {
  children: React.ReactNode;
  defaultPosition?: { x: number; y: number };
  className?: string;
}

export function DraggableToolbar({ 
  children, 
  defaultPosition = { x: 20, y: 20 },
  className 
}: DraggableToolbarProps) {
  const [position, setPosition] = useState(defaultPosition);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const toolbarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      
      const deltaX = e.clientX - dragStart.x;
      const deltaY = e.clientY - dragStart.y;
      
      setPosition(prev => ({
        x: prev.x + deltaX,
        y: prev.y + deltaY
      }));
      
      setDragStart({ x: e.clientX, y: e.clientY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, dragStart]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  return (
    <div
      ref={toolbarRef}
      className={cn(
        "fixed bg-background/98 backdrop-blur-md shadow-2xl rounded-lg border-2 border-primary/20 z-50",
        className
      )}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        cursor: isDragging ? "grabbing" : "default"
      }}
    >
      <div
        className="flex items-center gap-2 p-2 bg-primary/10 rounded-t-lg cursor-grab active:cursor-grabbing border-b"
        onMouseDown={handleMouseDown}
      >
        <GripVertical className="h-4 w-4 text-primary" />
        <span className="text-xs font-semibold text-primary">Outils de traçage (déplaçable)</span>
      </div>
      <div className="p-3">
        {children}
      </div>
    </div>
  );
}
