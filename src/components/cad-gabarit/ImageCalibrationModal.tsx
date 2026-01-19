// ============================================
// COMPONENT: ImageCalibrationModal
// Modale de calibration affichée après drop d'une image
// VERSION: 1.0
// ============================================

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { X, Plus, Trash2, Ruler, Check, SkipForward } from "lucide-react";
import type { BackgroundImage, CalibrationPoint, CalibrationPair } from "./types";
import { generateId } from "./types";

interface ImageCalibrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  image: BackgroundImage | null;
  onSkip: () => void;
  onCalibrate: (calibrationData: BackgroundImage["calibrationData"]) => void;
}

export function ImageCalibrationModal({
  isOpen,
  onClose,
  image,
  onSkip,
  onCalibrate,
}: ImageCalibrationModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // État local pour la calibration
  const [points, setPoints] = useState<Map<string, CalibrationPoint>>(new Map());
  const [pairs, setPairs] = useState<Map<string, CalibrationPair>>(new Map());
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
  const [editingPairId, setEditingPairId] = useState<string | null>(null);
  const [editingDistance, setEditingDistance] = useState<string>("");

  // Viewport pour le canvas de prévisualisation
  const [previewViewport, setPreviewViewport] = useState({
    scale: 1,
    offsetX: 0,
    offsetY: 0,
  });

  // Reset quand l'image change
  useEffect(() => {
    if (image) {
      setPoints(new Map());
      setPairs(new Map());
      setSelectedPointId(null);
      setEditingPairId(null);

      // Calculer le scale initial pour que l'image rentre dans le canvas
      if (image.image && containerRef.current) {
        const containerWidth = containerRef.current.clientWidth || 600;
        const containerHeight = 400;
        const imgWidth = image.image.width;
        const imgHeight = image.image.height;

        const scaleX = (containerWidth - 40) / imgWidth;
        const scaleY = (containerHeight - 40) / imgHeight;
        const scale = Math.min(scaleX, scaleY, 1);

        setPreviewViewport({
          scale,
          offsetX: (containerWidth - imgWidth * scale) / 2,
          offsetY: (containerHeight - imgHeight * scale) / 2,
        });
      }
    }
  }, [image]);

  // Dessiner le canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image?.image) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { scale, offsetX, offsetY } = previewViewport;

    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Background
    ctx.fillStyle = "#1a1a2e";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw image
    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);
    ctx.drawImage(image.image, 0, 0);
    ctx.restore();

    // Draw calibration points
    const pointsArray = Array.from(points.values());
    pointsArray.forEach((point, index) => {
      const screenX = point.x * scale + offsetX;
      const screenY = point.y * scale + offsetY;

      const isSelected = point.id === selectedPointId;

      // Circle
      ctx.beginPath();
      ctx.arc(screenX, screenY, isSelected ? 10 : 8, 0, Math.PI * 2);
      ctx.fillStyle = isSelected ? "#3B82F6" : "#EF4444";
      ctx.fill();
      ctx.strokeStyle = "white";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Label
      ctx.fillStyle = "white";
      ctx.font = "bold 12px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(point.label, screenX, screenY);
    });

    // Draw pairs (lines between points)
    pairs.forEach((pair) => {
      const p1 = points.get(pair.point1Id);
      const p2 = points.get(pair.point2Id);
      if (!p1 || !p2) return;

      const x1 = p1.x * scale + offsetX;
      const y1 = p1.y * scale + offsetY;
      const x2 = p2.x * scale + offsetX;
      const y2 = p2.y * scale + offsetY;

      // Line
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = "#10B981";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Distance label at midpoint
      const midX = (x1 + x2) / 2;
      const midY = (y1 + y2) / 2;
      const label = pair.distanceMm > 0 ? `${pair.distanceMm} mm` : "? mm";

      ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
      const textWidth = ctx.measureText(label).width;
      ctx.fillRect(midX - textWidth / 2 - 4, midY - 10, textWidth + 8, 20);

      ctx.fillStyle = pair.distanceMm > 0 ? "#10B981" : "#F59E0B";
      ctx.font = "bold 12px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, midX, midY);
    });
  }, [image, points, pairs, selectedPointId, previewViewport]);

  // Handle click on canvas to add point
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const { scale, offsetX, offsetY } = previewViewport;

    // Convert to image coordinates
    const imageX = (clickX - offsetX) / scale;
    const imageY = (clickY - offsetY) / scale;

    // Check if clicking on existing point
    const pointsArray = Array.from(points.values());
    const clickedPoint = pointsArray.find((p) => {
      const px = p.x * scale + offsetX;
      const py = p.y * scale + offsetY;
      const dist = Math.sqrt((clickX - px) ** 2 + (clickY - py) ** 2);
      return dist < 15;
    });

    // Couleurs pour les paires
    const pairColors = ["#10B981", "#3B82F6", "#F59E0B", "#8B5CF6", "#EC4899"];

    if (clickedPoint) {
      // If already have a selected point, create a pair
      if (selectedPointId && selectedPointId !== clickedPoint.id) {
        const pairId = generateId();
        const newPair: CalibrationPair = {
          id: pairId,
          point1Id: selectedPointId,
          point2Id: clickedPoint.id,
          distanceMm: 0,
          color: pairColors[pairs.size % pairColors.length],
        };
        setPairs((prev) => new Map(prev).set(pairId, newPair));
        setSelectedPointId(null);
        setEditingPairId(pairId);
        setEditingDistance("");
      } else {
        // Select this point
        setSelectedPointId(clickedPoint.id);
      }
    } else {
      // Add new point
      const pointId = generateId();
      const label = String(points.size + 1);
      const newPoint: CalibrationPoint = {
        id: pointId,
        x: imageX,
        y: imageY,
        label,
      };
      setPoints((prev) => new Map(prev).set(pointId, newPoint));

      // If we had a selected point, create a pair with the new one
      if (selectedPointId) {
        const pairId = generateId();
        const newPair: CalibrationPair = {
          id: pairId,
          point1Id: selectedPointId,
          point2Id: pointId,
          distanceMm: 0,
          color: pairColors[pairs.size % pairColors.length],
        };
        setPairs((prev) => new Map(prev).set(pairId, newPair));
        setSelectedPointId(null);
        setEditingPairId(pairId);
        setEditingDistance("");
      } else {
        setSelectedPointId(pointId);
      }
    }
  }, [points, selectedPointId, previewViewport]);

  // Delete a point
  const deletePoint = useCallback((pointId: string) => {
    // Remove all pairs using this point
    setPairs((prev) => {
      const newPairs = new Map(prev);
      prev.forEach((pair, id) => {
        if (pair.point1Id === pointId || pair.point2Id === pointId) {
          newPairs.delete(id);
        }
      });
      return newPairs;
    });

    // Remove the point
    setPoints((prev) => {
      const newPoints = new Map(prev);
      newPoints.delete(pointId);
      return newPoints;
    });

    if (selectedPointId === pointId) {
      setSelectedPointId(null);
    }
  }, [selectedPointId]);

  // Update pair distance
  const updatePairDistance = useCallback((pairId: string, distance: number) => {
    setPairs((prev) => {
      const newPairs = new Map(prev);
      const pair = newPairs.get(pairId);
      if (pair) {
        newPairs.set(pairId, { ...pair, distanceMm: distance });
      }
      return newPairs;
    });
  }, []);

  // Calculate scale from pairs
  const calculateScale = useCallback(() => {
    const pairsWithDistance = Array.from(pairs.values()).filter((p) => p.distanceMm > 0);
    if (pairsWithDistance.length === 0) return null;

    let totalScale = 0;
    pairsWithDistance.forEach((pair) => {
      const p1 = points.get(pair.point1Id);
      const p2 = points.get(pair.point2Id);
      if (!p1 || !p2) return;

      const distancePx = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
      const scale = pair.distanceMm / distancePx;
      totalScale += scale;
    });

    return totalScale / pairsWithDistance.length;
  }, [points, pairs]);

  // Handle calibrate
  const handleCalibrate = useCallback(() => {
    const scale = calculateScale();

    const calibrationData: BackgroundImage["calibrationData"] = {
      mode: "simple",
      points: new Map(points),
      pairs: new Map(pairs),
      scale: scale || undefined,
      applied: scale !== null,
    };

    onCalibrate(calibrationData);
  }, [points, pairs, calculateScale, onCalibrate]);

  const scale = calculateScale();
  const hasValidCalibration = scale !== null && scale > 0;
  const pairsArray = Array.from(pairs.values());

  if (!image) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ruler className="h-5 w-5" />
            Calibrer l'image : {image.name}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex gap-4">
          {/* Canvas de prévisualisation */}
          <div
            ref={containerRef}
            className="flex-1 bg-gray-900 rounded-lg overflow-hidden relative"
          >
            <canvas
              ref={canvasRef}
              width={600}
              height={400}
              onClick={handleCanvasClick}
              className="cursor-crosshair"
            />

            {/* Instructions */}
            <div className="absolute bottom-2 left-2 right-2 bg-black/70 text-white text-xs p-2 rounded">
              <p><strong>Cliquez</strong> pour ajouter des points de calibration.</p>
              <p><strong>Cliquez sur 2 points</strong> pour créer une paire et saisir la distance réelle.</p>
            </div>
          </div>

          {/* Panel de droite */}
          <div className="w-64 flex flex-col gap-4">
            {/* Points */}
            <div className="bg-gray-100 rounded-lg p-3">
              <h4 className="font-medium text-sm mb-2">Points ({points.size})</h4>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {Array.from(points.values()).map((point) => (
                  <div
                    key={point.id}
                    className={`flex items-center justify-between p-1.5 rounded text-sm ${
                      selectedPointId === point.id ? "bg-blue-100" : "bg-white"
                    }`}
                  >
                    <span
                      className="cursor-pointer flex-1"
                      onClick={() => setSelectedPointId(point.id)}
                    >
                      Point {point.label}
                    </span>
                    <button
                      onClick={() => deletePoint(point.id)}
                      className="p-1 hover:bg-red-100 rounded text-red-500"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {points.size === 0 && (
                  <p className="text-gray-400 text-xs">Cliquez sur l'image pour ajouter des points</p>
                )}
              </div>
            </div>

            {/* Paires */}
            <div className="bg-gray-100 rounded-lg p-3 flex-1">
              <h4 className="font-medium text-sm mb-2">Paires de calibration ({pairs.size})</h4>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {pairsArray.map((pair) => {
                  const p1 = points.get(pair.point1Id);
                  const p2 = points.get(pair.point2Id);
                  const isEditing = editingPairId === pair.id;

                  return (
                    <div
                      key={pair.id}
                      className="bg-white p-2 rounded text-sm"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-gray-600">
                          {p1?.label} → {p2?.label}
                        </span>
                        <button
                          onClick={() => {
                            setPairs((prev) => {
                              const newPairs = new Map(prev);
                              newPairs.delete(pair.id);
                              return newPairs;
                            });
                          }}
                          className="p-1 hover:bg-red-100 rounded text-red-500"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>

                      {isEditing ? (
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            value={editingDistance}
                            onChange={(e) => setEditingDistance(e.target.value)}
                            placeholder="Distance"
                            className="h-7 text-sm"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                const val = parseFloat(editingDistance);
                                if (!isNaN(val) && val > 0) {
                                  updatePairDistance(pair.id, val);
                                }
                                setEditingPairId(null);
                              }
                            }}
                          />
                          <span className="text-xs text-gray-500">mm</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            onClick={() => {
                              const val = parseFloat(editingDistance);
                              if (!isNaN(val) && val > 0) {
                                updatePairDistance(pair.id, val);
                              }
                              setEditingPairId(null);
                            }}
                          >
                            <Check className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <div
                          className="cursor-pointer text-green-600 font-medium"
                          onClick={() => {
                            setEditingPairId(pair.id);
                            setEditingDistance(pair.distanceMm > 0 ? String(pair.distanceMm) : "");
                          }}
                        >
                          {pair.distanceMm > 0 ? `${pair.distanceMm} mm` : "Cliquez pour saisir la distance"}
                        </div>
                      )}
                    </div>
                  );
                })}
                {pairs.size === 0 && (
                  <p className="text-gray-400 text-xs">
                    Cliquez sur 2 points pour créer une paire
                  </p>
                )}
              </div>
            </div>

            {/* Résultat de calibration */}
            {hasValidCalibration && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <h4 className="font-medium text-sm text-green-700 mb-1">
                  ✓ Calibration valide
                </h4>
                <p className="text-xs text-green-600">
                  Échelle: {scale!.toFixed(4)} mm/px
                </p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex justify-between">
          <Button variant="outline" onClick={onSkip}>
            <SkipForward className="h-4 w-4 mr-2" />
            Passer (sans calibration)
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button
              onClick={handleCalibrate}
              disabled={points.size < 2}
            >
              <Check className="h-4 w-4 mr-2" />
              {hasValidCalibration ? "Appliquer la calibration" : "Continuer sans calibration"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ImageCalibrationModal;
