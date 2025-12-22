// ============================================
// SchemaAnnotations.tsx
// Composant pour les annotations/notes sur le schéma
// VERSION: 1.1 - Utilise le viewport ReactFlow
// ============================================

import React, { useState, useCallback, useRef, useEffect } from "react";
import { StickyNote, X, Move, Trash2, Palette, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useViewport } from "@xyflow/react";

export interface Annotation {
  id: string;
  text: string;
  position: { x: number; y: number };
  color: string;
  width: number;
  height: number;
  layerId?: string;
  createdAt: string;
}

interface SchemaAnnotationProps {
  annotation: Annotation;
  zoom: number;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (updates: Partial<Annotation>) => void;
  onDelete: () => void;
}

const ANNOTATION_COLORS = [
  { value: "#fef3c7", label: "Jaune" },
  { value: "#dbeafe", label: "Bleu" },
  { value: "#dcfce7", label: "Vert" },
  { value: "#fce7f3", label: "Rose" },
  { value: "#f3e8ff", label: "Violet" },
  { value: "#fff7ed", label: "Orange" },
];

export function SchemaAnnotationNode({
  annotation,
  zoom,
  isSelected,
  onSelect,
  onUpdate,
  onDelete,
}: SchemaAnnotationProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [localText, setLocalText] = useState(annotation.text);
  const nodeRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ x: number; y: number; posX: number; posY: number } | null>(null);
  const resizeStartRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);

  // Sync local text with annotation
  useEffect(() => {
    setLocalText(annotation.text);
  }, [annotation.text]);

  // Handle drag start
  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      if (isEditing) return;
      e.stopPropagation();
      setIsDragging(true);
      dragStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        posX: annotation.position.x,
        posY: annotation.position.y,
      };
    },
    [isEditing, annotation.position],
  );

  // Handle resize start
  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setIsResizing(true);
      resizeStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        width: annotation.width,
        height: annotation.height,
      };
    },
    [annotation.width, annotation.height],
  );

  // Handle mouse move for drag/resize
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging && dragStartRef.current) {
        const dx = (e.clientX - dragStartRef.current.x) / zoom;
        const dy = (e.clientY - dragStartRef.current.y) / zoom;
        onUpdate({
          position: {
            x: dragStartRef.current.posX + dx,
            y: dragStartRef.current.posY + dy,
          },
        });
      }
      if (isResizing && resizeStartRef.current) {
        const dx = (e.clientX - resizeStartRef.current.x) / zoom;
        const dy = (e.clientY - resizeStartRef.current.y) / zoom;
        onUpdate({
          width: Math.max(120, resizeStartRef.current.width + dx),
          height: Math.max(60, resizeStartRef.current.height + dy),
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
      dragStartRef.current = null;
      resizeStartRef.current = null;
    };

    if (isDragging || isResizing) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, isResizing, zoom, onUpdate]);

  // Save text on blur
  const handleTextBlur = useCallback(() => {
    setIsEditing(false);
    if (localText !== annotation.text) {
      onUpdate({ text: localText });
    }
  }, [localText, annotation.text, onUpdate]);

  return (
    <div
      ref={nodeRef}
      className={`absolute select-none ${isSelected ? "ring-2 ring-blue-500" : ""}`}
      style={{
        left: annotation.position.x,
        top: annotation.position.y,
        width: annotation.width,
        minHeight: annotation.height,
        zIndex: isSelected ? 1000 : 100,
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      onDoubleClick={() => setIsEditing(true)}
    >
      {/* Note container */}
      <div className="rounded-lg shadow-md overflow-hidden" style={{ backgroundColor: annotation.color }}>
        {/* Header with drag handle */}
        <div
          className="flex items-center justify-between px-2 py-1 cursor-move"
          style={{ backgroundColor: `${annotation.color}dd` }}
          onMouseDown={handleDragStart}
        >
          <div className="flex items-center gap-1 text-gray-600">
            <GripVertical className="w-3 h-3" />
            <StickyNote className="w-3 h-3" />
          </div>

          {isSelected && (
            <div className="flex items-center gap-0.5">
              <Button
                variant="ghost"
                size="sm"
                className="h-5 w-5 p-0 hover:bg-white/50"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowColorPicker(!showColorPicker);
                }}
              >
                <Palette className="w-3 h-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 w-5 p-0 hover:bg-red-100 text-red-500"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          )}
        </div>

        {/* Color picker dropdown */}
        {showColorPicker && (
          <div className="absolute top-8 right-0 bg-white rounded-lg shadow-lg border p-2 z-50 flex gap-1">
            {ANNOTATION_COLORS.map((c) => (
              <button
                key={c.value}
                className={`w-6 h-6 rounded border-2 ${
                  annotation.color === c.value ? "border-blue-500" : "border-transparent"
                }`}
                style={{ backgroundColor: c.value }}
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdate({ color: c.value });
                  setShowColorPicker(false);
                }}
                title={c.label}
              />
            ))}
          </div>
        )}

        {/* Content */}
        <div className="p-2">
          {isEditing ? (
            <Textarea
              value={localText}
              onChange={(e) => setLocalText(e.target.value)}
              onBlur={handleTextBlur}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setLocalText(annotation.text);
                  setIsEditing(false);
                }
              }}
              autoFocus
              className="w-full min-h-[40px] text-sm bg-transparent border-none focus:ring-0 resize-none p-0"
              style={{ backgroundColor: "transparent" }}
              placeholder="Ajouter une note..."
            />
          ) : (
            <div className="text-sm whitespace-pre-wrap min-h-[40px]" style={{ color: "#374151" }}>
              {annotation.text || <span className="text-gray-400 italic">Double-clic pour éditer</span>}
            </div>
          )}
        </div>

        {/* Resize handle */}
        {isSelected && (
          <div className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize" onMouseDown={handleResizeStart}>
            <svg viewBox="0 0 16 16" className="w-full h-full text-gray-400" fill="currentColor">
              <path d="M14 14H12V12H14V14ZM14 10H12V8H14V10ZM10 14H8V12H10V14Z" />
            </svg>
          </div>
        )}
      </div>
    </div>
  );
}

interface SchemaAnnotationsLayerProps {
  annotations: Annotation[];
  zoom: number;
  selectedAnnotationId: string | null;
  onSelectAnnotation: (id: string | null) => void;
  onUpdateAnnotation: (id: string, updates: Partial<Annotation>) => void;
  onDeleteAnnotation: (id: string) => void;
  onAddAnnotation: (position: { x: number; y: number }) => void;
}

export function SchemaAnnotationsLayer({
  annotations,
  zoom,
  selectedAnnotationId,
  onSelectAnnotation,
  onUpdateAnnotation,
  onDeleteAnnotation,
  onAddAnnotation,
}: SchemaAnnotationsLayerProps) {
  // Utiliser le viewport ReactFlow pour suivre les transformations
  const viewport = useViewport();

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 5 }}>
      {/* Conteneur transformé selon le viewport */}
      <div
        style={{
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
          transformOrigin: "0 0",
          position: "absolute",
          top: 0,
          left: 0,
        }}
      >
        {annotations.map((annotation) => (
          <div key={annotation.id} className="pointer-events-auto">
            <SchemaAnnotationNode
              annotation={annotation}
              zoom={viewport.zoom}
              isSelected={selectedAnnotationId === annotation.id}
              onSelect={() => onSelectAnnotation(annotation.id)}
              onUpdate={(updates) => onUpdateAnnotation(annotation.id, updates)}
              onDelete={() => onDeleteAnnotation(annotation.id)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// Helper function to create a new annotation
export function createAnnotation(position: { x: number; y: number }, layerId?: string): Annotation {
  return {
    id: `annotation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    text: "",
    position,
    color: "#fef3c7", // Yellow by default
    width: 200,
    height: 100,
    layerId,
    createdAt: new Date().toISOString(),
  };
}
