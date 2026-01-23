// ============================================
// COMPOSANT: StretchHandles
// Poignées d'étirement fixes au viewport (toujours visibles)
// VERSION: 1.0.0
// ============================================
//
// Changelog (3 dernières versions) :
// - v1.0.0 (2025-01-23) : Création initiale
//
// Historique complet : voir REFACTORING_PHOTO_PREPARATION.md
// ============================================

import React, { useCallback, useState, useRef, useEffect } from "react";
import { StretchHandleType, STRETCH_INCREMENT_NORMAL } from "./types";

interface StretchHandlesProps {
  // Dimensions actuelles de l'image dans le viewport (en pixels écran)
  imageRect: {
    left: number;
    top: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
  };
  
  // Dimensions du container
  containerWidth: number;
  containerHeight: number;
  
  // Dimensions actuelles en mm
  widthMm: number;
  heightMm: number;
  
  // Callbacks
  onStretchX: (deltaMm: number) => void;
  onStretchY: (deltaMm: number) => void;
  
  // Scale pour conversion pixels -> mm
  pixelsPerMm: number;
  
  // Désactivé pendant le pan/zoom
  disabled?: boolean;
}

interface HandleState {
  isDragging: boolean;
  type: StretchHandleType | null;
  startPos: number;
  startValue: number;
}

const HANDLE_SIZE = 8; // Largeur des poignées en pixels
const HANDLE_MARGIN = 20; // Marge minimale du bord
const HANDLE_COLOR = "rgba(59, 130, 246, 0.8)"; // Bleu
const HANDLE_COLOR_ACTIVE = "rgba(59, 130, 246, 1)";
const HANDLE_COLOR_HOVER = "rgba(59, 130, 246, 0.9)";

export const StretchHandles: React.FC<StretchHandlesProps> = ({
  imageRect,
  containerWidth,
  containerHeight,
  widthMm,
  heightMm,
  onStretchX,
  onStretchY,
  pixelsPerMm,
  disabled = false,
}) => {
  const [handleState, setHandleState] = useState<HandleState>({
    isDragging: false,
    type: null,
    startPos: 0,
    startValue: 0,
  });
  
  const [hoveredHandle, setHoveredHandle] = useState<StretchHandleType | null>(null);
  const [currentDelta, setCurrentDelta] = useState<number>(0);
  
  const containerRef = useRef<HTMLDivElement>(null);

  // Calculer les positions des poignées (toujours visibles dans le viewport)
  const getHandlePositions = useCallback(() => {
    // Poignées horizontales (gauche/droite) - pour étirer X
    const leftX = Math.max(HANDLE_MARGIN, Math.min(imageRect.left - 30, containerWidth / 2 - 100));
    const rightX = Math.min(containerWidth - HANDLE_MARGIN - HANDLE_SIZE, Math.max(imageRect.right + 10, containerWidth / 2 + 100));
    
    // Poignées verticales (haut/bas) - pour étirer Y
    const topY = Math.max(HANDLE_MARGIN, Math.min(imageRect.top - 30, containerHeight / 2 - 100));
    const bottomY = Math.min(containerHeight - HANDLE_MARGIN - HANDLE_SIZE, Math.max(imageRect.bottom + 10, containerHeight / 2 + 100));
    
    // Centre vertical pour les poignées horizontales
    const centerY = Math.max(HANDLE_MARGIN + 50, Math.min(containerHeight - HANDLE_MARGIN - 50, (imageRect.top + imageRect.bottom) / 2));
    
    // Centre horizontal pour les poignées verticales
    const centerX = Math.max(HANDLE_MARGIN + 50, Math.min(containerWidth - HANDLE_MARGIN - 50, (imageRect.left + imageRect.right) / 2));
    
    return {
      left: { x: leftX, y: centerY - 40, height: 80 },
      right: { x: rightX, y: centerY - 40, height: 80 },
      top: { x: centerX - 40, y: topY, width: 80 },
      bottom: { x: centerX - 40, y: bottomY, width: 80 },
    };
  }, [imageRect, containerWidth, containerHeight]);

  const positions = getHandlePositions();

  // Démarrer le drag
  const handleMouseDown = useCallback(
    (type: StretchHandleType, e: React.MouseEvent) => {
      if (disabled) return;
      
      e.preventDefault();
      e.stopPropagation();
      
      const isHorizontal = type === "left" || type === "right";
      const startPos = isHorizontal ? e.clientX : e.clientY;
      const startValue = isHorizontal ? widthMm : heightMm;
      
      setHandleState({
        isDragging: true,
        type,
        startPos,
        startValue,
      });
      setCurrentDelta(0);
    },
    [disabled, widthMm, heightMm]
  );

  // Pendant le drag
  useEffect(() => {
    if (!handleState.isDragging || !handleState.type) return;

    const handleMouseMove = (e: MouseEvent) => {
      const isHorizontal = handleState.type === "left" || handleState.type === "right";
      const currentPos = isHorizontal ? e.clientX : e.clientY;
      const deltaPixels = currentPos - handleState.startPos;
      
      // Inverser pour left et top
      const direction = handleState.type === "left" || handleState.type === "top" ? -1 : 1;
      const deltaMm = (deltaPixels * direction) / pixelsPerMm;
      
      setCurrentDelta(deltaMm);
    };

    const handleMouseUp = () => {
      if (handleState.type && currentDelta !== 0) {
        const isHorizontal = handleState.type === "left" || handleState.type === "right";
        if (isHorizontal) {
          onStretchX(currentDelta);
        } else {
          onStretchY(currentDelta);
        }
      }
      
      setHandleState({
        isDragging: false,
        type: null,
        startPos: 0,
        startValue: 0,
      });
      setCurrentDelta(0);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [handleState, currentDelta, pixelsPerMm, onStretchX, onStretchY]);

  // Ne pas afficher si désactivé
  if (disabled) return null;

  const renderHandle = (type: StretchHandleType) => {
    const isHorizontal = type === "left" || type === "right";
    const pos = positions[type];
    const isActive = handleState.isDragging && handleState.type === type;
    const isHovered = hoveredHandle === type;
    
    const style: React.CSSProperties = {
      position: "absolute",
      backgroundColor: isActive ? HANDLE_COLOR_ACTIVE : isHovered ? HANDLE_COLOR_HOVER : HANDLE_COLOR,
      borderRadius: 4,
      cursor: isHorizontal ? "ew-resize" : "ns-resize",
      transition: isActive ? "none" : "background-color 0.15s",
      zIndex: 100,
    };

    if (isHorizontal) {
      // Poignée verticale (pour étirer X)
      const handlePos = pos as { x: number; y: number; height: number };
      Object.assign(style, {
        left: handlePos.x,
        top: handlePos.y,
        width: HANDLE_SIZE,
        height: handlePos.height,
      });
    } else {
      // Poignée horizontale (pour étirer Y)
      const handlePos = pos as { x: number; y: number; width: number };
      Object.assign(style, {
        left: handlePos.x,
        top: handlePos.y,
        width: handlePos.width,
        height: HANDLE_SIZE,
      });
    }

    // Afficher le delta pendant le drag
    const showDelta = isActive && currentDelta !== 0;
    const deltaDisplay = showDelta ? (
      <div
        style={{
          position: "absolute",
          left: isHorizontal ? (type === "left" ? -60 : HANDLE_SIZE + 10) : "50%",
          top: isHorizontal ? "50%" : (type === "top" ? -25 : HANDLE_SIZE + 5),
          transform: isHorizontal ? "translateY(-50%)" : "translateX(-50%)",
          backgroundColor: "rgba(0, 0, 0, 0.8)",
          color: currentDelta > 0 ? "#4ade80" : "#f87171",
          padding: "2px 6px",
          borderRadius: 4,
          fontSize: 12,
          fontWeight: "bold",
          whiteSpace: "nowrap",
        }}
      >
        {currentDelta > 0 ? "+" : ""}{currentDelta.toFixed(1)} mm
      </div>
    ) : null;

    return (
      <div
        key={type}
        style={style}
        onMouseDown={(e) => handleMouseDown(type, e)}
        onMouseEnter={() => setHoveredHandle(type)}
        onMouseLeave={() => setHoveredHandle(null)}
      >
        {/* Indicateur visuel */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            width: isHorizontal ? 2 : 20,
            height: isHorizontal ? 20 : 2,
            backgroundColor: "white",
            borderRadius: 1,
            opacity: 0.8,
          }}
        />
        {deltaDisplay}
      </div>
    );
  };

  // Labels des dimensions actuelles
  const renderLabels = () => {
    const isStretchingX = handleState.isDragging && (handleState.type === "left" || handleState.type === "right");
    const isStretchingY = handleState.isDragging && (handleState.type === "top" || handleState.type === "bottom");
    
    const displayWidthMm = widthMm + (isStretchingX ? currentDelta : 0);
    const displayHeightMm = heightMm + (isStretchingY ? currentDelta : 0);

    return (
      <>
        {/* Label X (en bas) */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            bottom: 10,
            transform: "translateX(-50%)",
            backgroundColor: isStretchingX ? "rgba(59, 130, 246, 0.9)" : "rgba(0, 0, 0, 0.6)",
            color: "white",
            padding: "4px 12px",
            borderRadius: 4,
            fontSize: 13,
            fontWeight: 500,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span style={{ opacity: 0.7 }}>X:</span>
          <span style={{ fontWeight: "bold" }}>{displayWidthMm.toFixed(1)} mm</span>
        </div>
        
        {/* Label Y (à droite) */}
        <div
          style={{
            position: "absolute",
            right: 10,
            top: "50%",
            transform: "translateY(-50%)",
            backgroundColor: isStretchingY ? "rgba(59, 130, 246, 0.9)" : "rgba(0, 0, 0, 0.6)",
            color: "white",
            padding: "4px 12px",
            borderRadius: 4,
            fontSize: 13,
            fontWeight: 500,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span style={{ opacity: 0.7 }}>Y:</span>
          <span style={{ fontWeight: "bold" }}>{displayHeightMm.toFixed(1)} mm</span>
        </div>
      </>
    );
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
      }}
    >
      <div style={{ pointerEvents: "auto" }}>
        {renderHandle("left")}
        {renderHandle("right")}
        {renderHandle("top")}
        {renderHandle("bottom")}
      </div>
      {renderLabels()}
    </div>
  );
};

export default StretchHandles;
