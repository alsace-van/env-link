import { useEffect, useState, useRef } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, Text, Box, Grid, Line } from "@react-three/drei";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Maximize2, RotateCcw, RefreshCw, Ruler } from "lucide-react";
import * as THREE from "three";
import { toast } from "sonner";

interface Layout3DViewProps {
  projectId: string;
  loadAreaLength?: number; // mm
  loadAreaWidth?: number; // mm
  loadAreaHeight?: number; // mm
}

interface FurnitureItem {
  id: string;
  longueur_mm: number;
  largeur_mm: number;
  hauteur_mm: number;
  poids_kg: number;
  position?: { x: number; y: number };
}

interface FurnitureBoxProps {
  furniture: FurnitureItem;
  mmToUnits3D: number;
  canvasScale: number;
}

const FurnitureBox = ({ furniture, mmToUnits3D, canvasScale }: FurnitureBoxProps) => {
  // ==========================================
  // DIMENSIONS: Conversion directe mm → unités 3D
  // ==========================================
  const widthMm = furniture.longueur_mm || 100;
  const depthMm = furniture.largeur_mm || 100;
  const heightMm = furniture.hauteur_mm || 100;

  const width3D = widthMm * mmToUnits3D; // longueur → X
  const depth3D = depthMm * mmToUnits3D; // largeur → Z
  const height3D = heightMm * mmToUnits3D; // hauteur → Y

  console.log(`\n=== MEUBLE ${furniture.id} ===`);
  console.log(`Dimensions (mm): ${widthMm} × ${depthMm} × ${heightMm}`);
  console.log(`Dimensions (3D): ${width3D.toFixed(2)} × ${depth3D.toFixed(2)} × ${height3D.toFixed(2)} unités`);

  // ==========================================
  // POSITION: pixels canvas → mm → unités 3D
  // ==========================================
  const posXpixels = furniture.position?.x || 0;
  const posYpixels = furniture.position?.y || 0;

  // 1. Pixels canvas → mm
  const posXmm = posXpixels / canvasScale;
  const posZmm = posYpixels / canvasScale;

  // 2. mm → unités 3D
  const posX3D = posXmm * mmToUnits3D;
  const posZ3D = posZmm * mmToUnits3D;
  const posY3D = height3D / 2; // Placer sur le sol

  console.log(`Position (pixels canvas): (${posXpixels.toFixed(1)}, ${posYpixels.toFixed(1)})`);
  console.log(`Position (mm): (${posXmm.toFixed(1)}, ${posZmm.toFixed(1)})`);
  console.log(`Position (3D): (${posX3D.toFixed(2)}, ${posY3D.toFixed(2)}, ${posZ3D.toFixed(2)}) unités`);

  // Taille de texte adaptative
  const textSize = Math.max(0.2, Math.min(0.5, 0.3));
  const textOffsetY = height3D / 2 + textSize * 1.2;

  return (
    <group position={[posX3D, posY3D, posZ3D]}>
      <Box args={[width3D, height3D, depth3D]} castShadow receiveShadow>
        <meshStandardMaterial color="#3b82f6" opacity={0.8} transparent />
      </Box>
      <Text position={[0, textOffsetY, 0]} fontSize={textSize} color="black" anchorX="center" anchorY="middle">
        {`${widthMm}×${depthMm}×${heightMm}mm`}
      </Text>
      <Text
        position={[0, textOffsetY + textSize * 1.3, 0]}
        fontSize={textSize * 0.85}
        color="black"
        anchorX="center"
        anchorY="middle"
      >
        {`${furniture.poids_kg}kg`}
      </Text>
    </group>
  );
};

const LoadArea = ({ length, width, mmToUnits3D }: { length: number; width: number; mmToUnits3D: number }) => {
  // Conversion directe: mm → unités 3D
  const length3D = length * mmToUnits3D;
  const width3D = width * mmToUnits3D;

  console.log("\n=== ZONE DE CHARGEMENT ===");
  console.log(`Dimensions (mm): ${length} × ${width}`);
  console.log(`Dimensions (3D): ${length3D.toFixed(2)} × ${width3D.toFixed(2)} unités`);

  // Points du rectangle pour le contour en pointillés
  const points: [number, number, number][] = [
    [-length3D / 2, 0.02, -width3D / 2],
    [length3D / 2, 0.02, -width3D / 2],
    [length3D / 2, 0.02, width3D / 2],
    [-length3D / 2, 0.02, width3D / 2],
    [-length3D / 2, 0.02, -width3D / 2],
  ];

  return (
    <group>
      {/* Rectangle plat au sol représentant la surface utile */}
      <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[length3D, width3D]} />
        <meshStandardMaterial color="#e2e8f0" opacity={0.3} transparent side={THREE.DoubleSide} />
      </mesh>

      {/* Contour en pointillés */}
      <Line points={points} color="#3b82f6" lineWidth={3} dashed={true} dashScale={50} dashSize={1} gapSize={0.5} />
    </group>
  );
};

// Helper pour visualiser les axes
const AxisHelper = () => {
  return (
    <group>
      {/* Axe X - Rouge */}
      <arrowHelper args={[new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 0), 5, 0xff0000]} />
      {/* Axe Y - Vert */}
      <arrowHelper args={[new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 0), 5, 0x00ff00]} />
      {/* Axe Z - Bleu */}
      <arrowHelper args={[new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, 0), 5, 0x0000ff]} />
    </group>
  );
};

interface MeasureLine {
  id: string;
  start: THREE.Vector3;
  end: THREE.Vector3;
  distance: number;
}

const MeasurementTool = ({
  isActive,
  measureLines,
  onAddMeasure,
  scale3D,
}: {
  isActive: boolean;
  measureLines: MeasureLine[];
  onAddMeasure: (start: THREE.Vector3, end: THREE.Vector3, distance: number) => void;
  scale3D: number;
}) => {
  const { camera, raycaster, scene } = useThree();
  const [startPoint, setStartPoint] = useState<THREE.Vector3 | null>(null);
  const [currentPoint, setCurrentPoint] = useState<THREE.Vector3 | null>(null);

  useEffect(() => {
    if (!isActive) {
      setStartPoint(null);
      setCurrentPoint(null);
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (event.button !== 0) return; // Only left click

      const canvas = event.target as HTMLCanvasElement;
      const rect = canvas.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(new THREE.Vector2(x, y), camera);

      // Raycast on the ground plane (y = 0)
      const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      const intersectPoint = new THREE.Vector3();
      raycaster.ray.intersectPlane(groundPlane, intersectPoint);

      if (intersectPoint) {
        if (!startPoint) {
          setStartPoint(intersectPoint.clone());
        } else {
          // Calculate distance in mm
          const distance = startPoint.distanceTo(intersectPoint) / scale3D;
          onAddMeasure(startPoint.clone(), intersectPoint.clone(), distance);
          setStartPoint(null);
          setCurrentPoint(null);
        }
      }
    };

    const handlePointerMove = (event: MouseEvent) => {
      if (!startPoint) return;

      const canvas = event.target as HTMLCanvasElement;
      const rect = canvas.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(new THREE.Vector2(x, y), camera);

      const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      const intersectPoint = new THREE.Vector3();
      raycaster.ray.intersectPlane(groundPlane, intersectPoint);

      if (intersectPoint) {
        setCurrentPoint(intersectPoint.clone());
      }
    };

    const canvas = scene.children[0]?.parent as any;
    const domElement = canvas?.domElement || document.querySelector("canvas");

    if (domElement) {
      domElement.addEventListener("pointerdown", handlePointerDown);
      domElement.addEventListener("pointermove", handlePointerMove);

      return () => {
        domElement.removeEventListener("pointerdown", handlePointerDown);
        domElement.removeEventListener("pointermove", handlePointerMove);
      };
    }
  }, [isActive, startPoint, camera, raycaster, scene, onAddMeasure, scale3D]);

  return (
    <>
      {/* Existing measure lines */}
      {measureLines.map((measure) => {
        const midPoint = new THREE.Vector3()
          .addVectors(measure.start, measure.end)
          .multiplyScalar(0.5);

        return (
          <group key={measure.id}>
            <Line
              points={[measure.start, measure.end]}
              color="#ef4444"
              lineWidth={3}
              dashed
              dashScale={20}
              dashSize={0.5}
              gapSize={0.3}
            />
            <Text
              position={[midPoint.x, midPoint.y + 0.5, midPoint.z]}
              fontSize={0.4}
              color="#ef4444"
              anchorX="center"
              anchorY="middle"
              outlineWidth={0.05}
              outlineColor="#ffffff"
            >
              {`${Math.round(measure.distance)}mm`}
            </Text>
          </group>
        );
      })}

      {/* Current measuring line (preview) */}
      {startPoint && currentPoint && (
        <>
          <Line
            points={[startPoint, currentPoint]}
            color="#ef4444"
            lineWidth={2}
            dashed
            dashScale={20}
            dashSize={0.5}
            gapSize={0.3}
          />
          <Text
            position={[
              (startPoint.x + currentPoint.x) / 2,
              (startPoint.y + currentPoint.y) / 2 + 0.5,
              (startPoint.z + currentPoint.z) / 2,
            ]}
            fontSize={0.4}
            color="#ef4444"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.05}
            outlineColor="#ffffff"
          >
            {`${Math.round(startPoint.distanceTo(currentPoint) / scale3D)}mm`}
          </Text>
        </>
      )}
    </>
  );
};

const Scene = ({
  furniture,
  loadAreaLength,
  loadAreaWidth,
  measureMode,
  measureLines,
  onAddMeasure,
}: {
  furniture: FurnitureItem[];
  loadAreaLength: number;
  loadAreaWidth: number;
  measureMode: boolean;
  measureLines: MeasureLine[];
  onAddMeasure: (start: THREE.Vector3, end: THREE.Vector3, distance: number) => void;
}) => {
  // ==========================================
  // APPROCHE SIMPLIFIÉE ET CORRIGÉE
  // ==========================================

  // 1. Échelle pour convertir mm → unités 3D
  // On veut que la zone de chargement fasse environ 20 unités 3D sur sa plus grande dimension
  const maxDimension = Math.max(loadAreaLength, loadAreaWidth);
  const mmToUnits3D = 20 / maxDimension;

  console.log("=== ÉCHELLES 3D ===");
  console.log("Zone de chargement (mm):", loadAreaLength, "×", loadAreaWidth);
  console.log("Conversion mm → 3D:", mmToUnits3D, "unités 3D par mm");
  console.log(
    "Zone de chargement (3D):",
    (loadAreaLength * mmToUnits3D).toFixed(2),
    "×",
    (loadAreaWidth * mmToUnits3D).toFixed(2),
    "unités",
  );

  // 2. Pour les positions: les positions extraites sont EN PIXELS CANVAS
  // On a besoin de les convertir en unités 3D
  // Échelle du canvas 2D: identique à celle calculée dans LayoutCanvas.tsx
  const canvasWidth = 800;
  const canvasHeight = 600;
  const canvasScale = Math.min((canvasWidth - 100) / loadAreaLength, (canvasHeight - 100) / loadAreaWidth);

  console.log("=== CONVERSION POSITIONS ===");
  console.log("Échelle canvas (pixels/mm):", canvasScale.toFixed(6));
  console.log("Pour convertir pixels → 3D: diviser par", canvasScale, "puis multiplier par", mmToUnits3D);

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 10, 5]} intensity={1} castShadow />
      <directionalLight position={[-10, 10, -5]} intensity={0.5} />
      <pointLight position={[0, 10, 0]} intensity={0.5} />

      <LoadArea length={loadAreaLength} width={loadAreaWidth} mmToUnits3D={mmToUnits3D} />

      {furniture.map((item) => (
        <FurnitureBox key={item.id} furniture={item} mmToUnits3D={mmToUnits3D} canvasScale={canvasScale} />
      ))}

      <MeasurementTool
        isActive={measureMode}
        measureLines={measureLines}
        onAddMeasure={onAddMeasure}
        scale3D={mmToUnits3D}
      />

      <Grid
        args={[loadAreaLength * mmToUnits3D, loadAreaWidth * mmToUnits3D]}
        cellSize={1}
        cellThickness={0.5}
        cellColor="#cbd5e1"
        sectionSize={5}
        sectionThickness={1}
        sectionColor="#94a3b8"
        fadeDistance={50}
        fadeStrength={1}
        position={[0, -0.02, 0]}
      />

      <OrbitControls
        makeDefault
        minPolarAngle={0}
        maxPolarAngle={Math.PI / 2}
        enableDamping
        dampingFactor={0.05}
        enabled={!measureMode}
      />
    </>
  );
};

export const Layout3DView = ({
  projectId,
  loadAreaLength = 3000,
  loadAreaWidth = 1800,
  loadAreaHeight = 1800,
}: Layout3DViewProps) => {
  const [furniture, setFurniture] = useState<FurnitureItem[]>([]);
  const [canvasData, setCanvasData] = useState<any>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [cameraKey, setCameraKey] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [measureMode, setMeasureMode] = useState(false);
  const [measureLines, setMeasureLines] = useState<MeasureLine[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    loadProjectData();

    // 🔥 Subscription en temps réel pour écouter les changements
    const channel = supabase
      .channel(`project-3d-${projectId}`, {
        config: {
          broadcast: { self: true },
        },
      })
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "projects",
          filter: `id=eq.${projectId}`,
        },
        (payload) => {
          console.log("🔄 Changement détecté dans le projet, rechargement 3D...");
          console.log("Payload:", payload);
          // Recharger après un court délai pour s'assurer que les données sont bien écrites
          setTimeout(() => {
            loadProjectData();
          }, 500);
        },
      )
      .subscribe((status) => {
        console.log("📡 Statut de la subscription 3D:", status);

        // Si la subscription se ferme, réessayer après un délai
        if (status === "CLOSED") {
          console.log("⚠️ Subscription fermée, tentative de reconnexion dans 2s...");
          setTimeout(() => {
            loadProjectData();
          }, 2000);
        }
      });

    // Nettoyer la subscription au démontage
    return () => {
      console.log("🔌 Déconnexion de la subscription 3D");
      supabase.removeChannel(channel);
    };
  }, [projectId]);

  const loadProjectData = async () => {
    try {
      setIsRefreshing(true);
      const { data, error } = await supabase
        .from("projects")
        .select("furniture_data, layout_canvas_data")
        .eq("id", projectId)
        .single();

      if (error) throw error;

      console.log("Données chargées:", data);

      if (data?.furniture_data && Array.isArray(data.furniture_data)) {
        // Extraire les positions depuis layout_canvas_data si disponible
        const positions = extractPositions(data.layout_canvas_data, loadAreaLength, loadAreaWidth);

        console.log("Positions extraites:", positions);

        const furnitureWithPositions = (data.furniture_data as unknown as FurnitureItem[]).map(
          (item: FurnitureItem) => ({
            ...item,
            position: positions[item.id] || { x: 0, y: 0 },
          }),
        );

        console.log("Meubles avec positions:", furnitureWithPositions);
        setFurniture(furnitureWithPositions);
      } else {
        // Si pas de meubles, vider l'affichage
        setFurniture([]);
      }

      if (data?.layout_canvas_data) {
        setCanvasData(data.layout_canvas_data);
      }
    } catch (error) {
      console.error("Error loading 3D data:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const extractPositions = (canvasData: any, loadAreaLength: number, loadAreaWidth: number) => {
    const positions: Record<string, { x: number; y: number }> = {};

    if (!canvasData) {
      console.log("Pas de données canvas");
      return positions;
    }

    // S'assurer que les dimensions sont valides (éviter division par zéro)
    if (!loadAreaLength || loadAreaLength <= 0) {
      console.error("loadAreaLength invalide:", loadAreaLength);
      return positions;
    }
    if (!loadAreaWidth || loadAreaWidth <= 0) {
      console.error("loadAreaWidth invalide:", loadAreaWidth);
      return positions;
    }

    try {
      const data = typeof canvasData === "string" ? JSON.parse(canvasData) : canvasData;

      console.log("Données canvas parsées:", data);

      // La structure est: [["Layer", { children: [...] }]]
      if (data && Array.isArray(data) && data.length > 0) {
        const layer = data[0];

        if (Array.isArray(layer) && layer[0] === "Layer" && layer[1]?.children) {
          const children = layer[1].children;

          console.log("Enfants du Layer:", children);

          // Le canvas fait 800x600
          const canvasWidth = 800;
          const canvasHeight = 600;

          // Calculer l'échelle utilisée dans le canvas (même calcul que dans LayoutCanvas.tsx)
          // IMPORTANT: Dans LayoutCanvas, loadAreaLength est mappé sur la largeur du canvas (X)
          // et loadAreaWidth est mappé sur la hauteur du canvas (Y)
          const scale = Math.min((canvasWidth - 100) / loadAreaLength, (canvasHeight - 100) / loadAreaWidth);

          console.log(`Dimensions zone chargement: ${loadAreaLength}mm x ${loadAreaWidth}mm`);
          console.log(`Scale calculée: ${scale}`);
          const scaledLoadAreaLength = loadAreaLength * scale;
          const scaledLoadAreaWidth = loadAreaWidth * scale;

          // Centre du canvas
          const centerX = canvasWidth / 2;
          const centerY = canvasHeight / 2;

          children.forEach((child: any, index: number) => {
            if (Array.isArray(child) && child.length > 1) {
              const childType = child[0];
              const childData = child[1];

              // Chercher les groupes de meubles
              if (childType === "Group" && childData?.data?.isFurniture && childData?.data?.furnitureId) {
                const furnitureId = childData.data.furnitureId;

                console.log(`Meuble trouvé: ${furnitureId}`, childData);

                // Le groupe contient un Path comme premier enfant avec les segments du rectangle
                if (childData.children && Array.isArray(childData.children) && childData.children.length > 0) {
                  const pathChild = childData.children[0];

                  if (Array.isArray(pathChild) && pathChild[0] === "Path" && pathChild[1]?.segments) {
                    const segments = pathChild[1].segments;

                    console.log(`Segments du meuble ${furnitureId}:`, segments);

                    // Calculer le centre du rectangle à partir des segments
                    // segments: [[x1, y1], [x2, y2], [x3, y3], [x4, y4]]
                    if (segments.length >= 4) {
                      const x1 = segments[0][0];
                      const y1 = segments[0][1];
                      const x3 = segments[2][0];
                      const y3 = segments[2][1];

                      // Centre du rectangle dans le canvas
                      const rectCenterX = (x1 + x3) / 2;
                      const rectCenterY = (y1 + y3) / 2;

                      console.log(`Centre canvas pour ${furnitureId}: (${rectCenterX}, ${rectCenterY})`);

                      // Position relative au centre de la zone de chargement en pixels canvas
                      const relativeX = rectCenterX - centerX;
                      const relativeY = rectCenterY - centerY;

                      console.log(`Scale utilisée: ${scale}`);
                      console.log(`Relative X: ${relativeX}, Relative Y: ${relativeY}`);

                      // Les positions sont déjà en pixels canvas relatifs au centre
                      // On les garde comme ça pour la 3D (pas de conversion en mm)
                      console.log(`Position canvas pour ${furnitureId}: (${relativeX}, ${relativeY}) pixels`);

                      positions[furnitureId] = {
                        x: relativeX,
                        y: relativeY,
                      };

                      console.log(`Position 3D pour ${furnitureId}: (${relativeX}, ${relativeY}) pixels canvas`);
                      console.log(`Positions stockées:`, positions);
                    }
                  }
                }
              }
            }
          });
        }
      }
    } catch (error) {
      console.error("Error extracting positions:", error);
    }

    return positions;
  };

  const resetCamera = () => {
    setCameraKey((prev) => prev + 1); // Force la réinitialisation du Canvas
  };

  const handleAddMeasure = (start: THREE.Vector3, end: THREE.Vector3, distance: number) => {
    setMeasureLines((prev) => [
      ...prev,
      {
        id: `measure-${Date.now()}`,
        start,
        end,
        distance,
      },
    ]);
  };

  const clearAllMeasures = () => {
    setMeasureLines([]);
    toast.success("Mesures effacées");
  };

  // Handle right click to clear measures
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      if (measureMode) {
        e.preventDefault();
        clearAllMeasures();
      }
    };

    const canvas = canvasRef.current;
    if (canvas) {
      canvas.addEventListener("contextmenu", handleContextMenu);
      return () => canvas.removeEventListener("contextmenu", handleContextMenu);
    }
  }, [measureMode]);

  return (
    <Card className="w-full">
      <div className="p-4 border-b flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Vue 3D de l'aménagement</h3>
          <p className="text-sm text-muted-foreground">Clic + glisser pour tourner, molette pour zoomer</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={measureMode ? "default" : "outline"}
            size="sm"
            onClick={() => setMeasureMode(!measureMode)}
          >
            <Ruler className="w-4 h-4 mr-2" />
            Mesure
          </Button>
          <Button variant="outline" size="sm" onClick={loadProjectData} disabled={isRefreshing}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
            {isRefreshing ? "Chargement..." : "Rafraîchir"}
          </Button>
          <Button variant="outline" size="sm" onClick={resetCamera}>
            <RotateCcw className="w-4 h-4 mr-2" />
            Réinitialiser
          </Button>
          <Button variant="outline" size="sm" onClick={() => setIsFullscreen(!isFullscreen)}>
            <Maximize2 className="w-4 h-4 mr-2" />
            {isFullscreen ? "Réduire" : "Plein écran"}
          </Button>
        </div>
      </div>

      <div className={isFullscreen ? "fixed inset-0 z-50 bg-background" : ""}>
        <div className={isFullscreen ? "h-screen" : "h-[600px]"}>
          <Canvas
            key={cameraKey}
            camera={{ position: [15, 10, 15], fov: 50 }}
            shadows
            className="bg-gradient-to-b from-slate-50 to-slate-100"
            ref={canvasRef as any}
          >
            <Scene
              furniture={furniture}
              loadAreaLength={loadAreaLength}
              loadAreaWidth={loadAreaWidth}
              measureMode={measureMode}
              measureLines={measureLines}
              onAddMeasure={handleAddMeasure}
            />
          </Canvas>
        </div>
      </div>

      {furniture.length === 0 && (
        <div className="p-8 text-center text-muted-foreground">
          <p>Aucun meuble à afficher.</p>
          <p className="text-sm mt-2">Ajoutez des meubles dans l'onglet "Plan d'aménagement" pour les voir en 3D.</p>
        </div>
      )}

      {furniture.length > 0 && (
        <div className="p-4 border-t">
          <div className="text-sm text-muted-foreground">
            <p>
              <strong>{furniture.length}</strong> meuble{furniture.length > 1 ? "s" : ""} affiché
              {furniture.length > 1 ? "s" : ""}
            </p>
            <p className="mt-1">
              Zone de chargement : {loadAreaLength}mm × {loadAreaWidth}mm × {loadAreaHeight}mm
            </p>
          </div>
        </div>
      )}
    </Card>
  );
};
