import { useEffect, useState, useRef } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, Text, Box, Grid, Line } from "@react-three/drei";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Maximize2, RotateCcw, RefreshCw, Ruler, MousePointer2 } from "lucide-react";
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
  // POSITION: pixels canvas relatifs → mm → unités 3D
  // ==========================================
  // Les positions extraites sont déjà RELATIVES AU CENTRE en pixels canvas
  const posXpixelsRel = furniture.position?.x || 0;
  const posYpixelsRel = furniture.position?.y || 0;

  // 1. Pixels canvas relatifs → mm relatifs
  // On divise par canvasScale pour obtenir la distance en mm
  const posXmm = posXpixelsRel / canvasScale;
  const posZmm = posYpixelsRel / canvasScale;

  // 2. mm → unités 3D
  const posX3D = posXmm * mmToUnits3D;
  const posZ3D = posZmm * mmToUnits3D;
  const posY3D = height3D / 2; // Placer sur le sol

  console.log(`Position (pixels canvas relatifs): (${posXpixelsRel.toFixed(1)}, ${posYpixelsRel.toFixed(1)})`);
  console.log(`Position (mm relatifs): (${posXmm.toFixed(1)}, ${posZmm.toFixed(1)})`);
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

    const getIntersectionPoint = (x: number, y: number): THREE.Vector3 | null => {
      raycaster.setFromCamera(new THREE.Vector2(x, y), camera);

      // Raycast sur tous les objets de la scène (meubles, plans, etc.)
      const intersects = raycaster.intersectObjects(scene.children, true);

      // Filtrer les objets invisibles ou les helpers
      const validIntersects = intersects.filter((intersect) => {
        const obj = intersect.object;
        // Ignorer les grilles, les textes et les lignes de mesure
        return (
          obj.visible &&
          !(obj as any).isLine &&
          obj.type !== "GridHelper" &&
          obj.type !== "Sprite" &&
          !obj.userData?.isMeasure
        );
      });

      if (validIntersects.length > 0) {
        return validIntersects[0].point.clone();
      }

      // Si pas d'intersection avec des objets, utiliser le plan au sol comme fallback
      const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      const intersectPoint = new THREE.Vector3();
      const hasGroundIntersection = raycaster.ray.intersectPlane(groundPlane, intersectPoint);

      if (hasGroundIntersection) {
        return intersectPoint.clone();
      }

      return null;
    };

    const handlePointerDown = (event: MouseEvent) => {
      if (event.button !== 0) return; // Only left click

      const canvas = event.target as HTMLCanvasElement;
      const rect = canvas.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      const intersectPoint = getIntersectionPoint(x, y);

      if (intersectPoint) {
        if (!startPoint) {
          setStartPoint(intersectPoint);
        } else {
          const distance = startPoint.distanceTo(intersectPoint);
          const distanceMM = distance / scale3D;
          onAddMeasure(startPoint, intersectPoint, distanceMM);
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

      const intersectPoint = getIntersectionPoint(x, y);
      if (intersectPoint) {
        setCurrentPoint(intersectPoint);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("pointermove", handlePointerMove);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("pointermove", handlePointerMove);
    };
  }, [isActive, startPoint, camera, raycaster, scene, onAddMeasure, scale3D]);

  return (
    <>
      {/* Preview line */}
      {startPoint && currentPoint && (
        <Line
          points={[startPoint, currentPoint]}
          color="yellow"
          lineWidth={2}
          dashed={true}
          dashScale={10}
          dashSize={0.5}
          gapSize={0.3}
        />
      )}

      {/* Saved measurement lines */}
      {measureLines.map((line) => (
        <group key={line.id}>
          <Line points={[line.start, line.end]} color="red" lineWidth={3} />
          <Text
            position={[
              (line.start.x + line.end.x) / 2,
              (line.start.y + line.end.y) / 2 + 0.5,
              (line.start.z + line.end.z) / 2,
            ]}
            fontSize={0.3}
            color="red"
            anchorX="center"
            anchorY="middle"
          >
            {`${line.distance.toFixed(0)}mm`}
          </Text>
        </group>
      ))}
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
  // PARAMÈTRES DE CONVERSION
  // ==========================================

  // 1. Échelle 3D: 1 unité 3D = 100mm (pour garder des chiffres raisonnables)
  const mmToUnits3D = 1 / 100;
  const scale3D = mmToUnits3D;

  // 2. Échelle canvas: pixels par mm (doit correspondre exactement au canvas 2D)
  // IMPORTANT: Cette valeur DOIT être la même que celle calculée dans LayoutCanvas
  const CANVAS_WIDTH = 800;
  const CANVAS_HEIGHT = 600;
  const canvasScale = Math.min((CANVAS_WIDTH - 100) / loadAreaLength, (CANVAS_HEIGHT - 100) / loadAreaWidth);

  console.log("\n==========================================");
  console.log("PARAMÈTRES DE CONVERSION 3D");
  console.log("==========================================");
  console.log(`mmToUnits3D: ${mmToUnits3D} (1 unité 3D = ${1 / mmToUnits3D}mm)`);
  console.log(`canvasScale: ${canvasScale.toFixed(4)} pixels/mm`);
  console.log(`Zone de chargement: ${loadAreaLength}mm × ${loadAreaWidth}mm`);
  console.log(`Canvas: ${CANVAS_WIDTH}px × ${CANVAS_HEIGHT}px`);
  console.log("==========================================\n");

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 10, 5]} intensity={0.8} castShadow />
      <directionalLight position={[-10, 10, -5]} intensity={0.3} />

      <LoadArea length={loadAreaLength} width={loadAreaWidth} mmToUnits3D={mmToUnits3D} />

      {furniture.map((item) => (
        <FurnitureBox key={item.id} furniture={item} mmToUnits3D={mmToUnits3D} canvasScale={canvasScale} />
      ))}

      <MeasurementTool
        isActive={measureMode}
        measureLines={measureLines}
        onAddMeasure={onAddMeasure}
        scale3D={scale3D}
      />

      <Grid
        args={[50, 50]}
        cellSize={1}
        cellThickness={0.5}
        cellColor="#94a3b8"
        sectionSize={5}
        sectionColor="#475569"
        fadeDistance={30}
        infiniteGrid
      />

      <OrbitControls enableDamping dampingFactor={0.05} minDistance={5} maxDistance={100} enabled={!measureMode} />
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
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [cameraKey, setCameraKey] = useState(0);
  const [measureMode, setMeasureMode] = useState(false);
  const [measureLines, setMeasureLines] = useState<MeasureLine[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const loadProjectData = async () => {
    setIsRefreshing(true);
    try {
      const { data: projectData, error: projectError } = await supabase
        .from("projects")
        .select("canvas_data, furniture_data")
        .eq("id", projectId)
        .single();

      if (projectError) throw projectError;

      console.log("\n==========================================");
      console.log("CHARGEMENT DES DONNÉES PROJET");
      console.log("==========================================");

      // Charger les données des meubles
      let furnitureData: FurnitureItem[] = [];
      if (projectData.furniture_data && Array.isArray(projectData.furniture_data)) {
        furnitureData = projectData.furniture_data.map((item: any) => ({
          id: item.id,
          longueur_mm: item.longueur_mm,
          largeur_mm: item.largeur_mm,
          hauteur_mm: item.hauteur_mm,
          poids_kg: item.poids_kg,
        }));

        console.log(`Meubles chargés: ${furnitureData.length}`);
        furnitureData.forEach((f) => {
          console.log(`  - ${f.id}: ${f.longueur_mm}×${f.largeur_mm}×${f.hauteur_mm}mm, ${f.poids_kg}kg`);
        });
      }

      // Extraire les positions depuis canvas_data
      if (projectData.canvas_data) {
        const canvasJSON = JSON.parse(projectData.canvas_data);
        const extractedData = extractFurniturePositions(canvasJSON, loadAreaLength, loadAreaWidth);

        console.log("\nPositions extraites:", extractedData);

        // Associer les positions aux meubles
        furnitureData = furnitureData.map((item) => ({
          ...item,
          position: extractedData.positions[item.id] || { x: 0, y: 0 },
        }));

        console.log("\nMeubles avec positions:");
        furnitureData.forEach((f) => {
          console.log(`  - ${f.id}: position (${f.position?.x.toFixed(1)}, ${f.position?.y.toFixed(1)}) pixels`);
        });
      }

      setFurniture(furnitureData);
      toast.success("Données chargées avec succès");
      console.log("==========================================\n");
    } catch (error) {
      console.error("Error loading project data:", error);
      toast.error("Erreur lors du chargement des données");
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadProjectData();
  }, [projectId, loadAreaLength, loadAreaWidth]);

  /**
   * FONCTION CORRIGÉE : Extraction des positions avec les informations de scale
   */
  const extractFurniturePositions = (
    canvasJSON: any,
    loadAreaLength: number,
    loadAreaWidth: number,
  ): {
    positions: { [furnitureId: string]: { x: number; y: number } };
    scale: number;
    canvasWidth: number;
    canvasHeight: number;
  } => {
    const positions: { [furnitureId: string]: { x: number; y: number } } = {};

    // Dimensions du canvas (doivent correspondre à LayoutCanvas)
    const CANVAS_WIDTH = 800;
    const CANVAS_HEIGHT = 600;

    // Calcul du scale (doit être identique à LayoutCanvas ligne 148)
    const scale = Math.min((CANVAS_WIDTH - 100) / loadAreaLength, (CANVAS_HEIGHT - 100) / loadAreaWidth);

    console.log("\n=== EXTRACTION DES POSITIONS ===");
    console.log(`Canvas: ${CANVAS_WIDTH}px × ${CANVAS_HEIGHT}px`);
    console.log(`Zone de chargement: ${loadAreaLength}mm × ${loadAreaWidth}mm`);
    console.log(`Scale calculé: ${scale.toFixed(4)} pixels/mm`);

    try {
      if (canvasJSON && Array.isArray(canvasJSON) && canvasJSON.length > 1) {
        const children = canvasJSON[1]?.children;

        if (children && Array.isArray(children)) {
          const scaledLoadAreaLength = loadAreaLength * scale;
          const scaledLoadAreaWidth = loadAreaWidth * scale;

          // Centre du canvas
          const centerX = CANVAS_WIDTH / 2;
          const centerY = CANVAS_HEIGHT / 2;

          children.forEach((child: any) => {
            if (Array.isArray(child) && child.length > 1) {
              const childType = child[0];
              const childData = child[1];

              // Chercher les groupes de meubles
              if (childType === "Group" && childData?.data?.isFurniture && childData?.data?.furnitureId) {
                const furnitureId = childData.data.furnitureId;

                console.log(`\nMeuble trouvé: ${furnitureId}`);

                // Récupérer la matrice de transformation du groupe s'il y en a une
                const matrix = childData.matrix;

                // Le groupe contient un Path comme premier enfant avec les segments du rectangle
                if (childData.children && Array.isArray(childData.children) && childData.children.length > 0) {
                  const pathChild = childData.children[0];

                  if (Array.isArray(pathChild) && pathChild[0] === "Path" && pathChild[1]?.segments) {
                    const segments = pathChild[1].segments;

                    // Calculer le centre du rectangle à partir des segments
                    if (segments.length >= 4) {
                      let x1 = segments[0][0];
                      let y1 = segments[0][1];
                      let x3 = segments[2][0];
                      let y3 = segments[2][1];

                      // Appliquer la matrice de transformation si elle existe
                      if (matrix && Array.isArray(matrix) && matrix.length === 6) {
                        const [a, b, c, d, tx, ty] = matrix;

                        // Transformer les coins
                        const x1Global = a * x1 + c * y1 + tx;
                        const y1Global = b * x1 + d * y1 + ty;
                        const x3Global = a * x3 + c * y3 + tx;
                        const y3Global = b * x3 + d * y3 + ty;

                        x1 = x1Global;
                        y1 = y1Global;
                        x3 = x3Global;
                        y3 = y3Global;

                        console.log(`  Matrice appliquée:`, matrix);
                      }

                      // Centre du rectangle dans le canvas (coordonnées globales)
                      const rectCenterX = (x1 + x3) / 2;
                      const rectCenterY = (y1 + y3) / 2;

                      console.log(`  Centre canvas: (${rectCenterX.toFixed(1)}, ${rectCenterY.toFixed(1)}) pixels`);

                      // Position relative au centre de la zone de chargement en pixels canvas
                      const relativeX = rectCenterX - centerX;
                      const relativeY = rectCenterY - centerY;

                      console.log(`  Position relative: (${relativeX.toFixed(1)}, ${relativeY.toFixed(1)}) pixels`);

                      positions[furnitureId] = {
                        x: relativeX,
                        y: relativeY,
                      };
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

    console.log("\n=== RÉSUMÉ EXTRACTION ===");
    console.log(`Meubles trouvés: ${Object.keys(positions).length}`);
    console.log(`Scale retourné: ${scale.toFixed(4)} pixels/mm`);
    console.log("========================\n");

    return {
      positions,
      scale,
      canvasWidth: CANVAS_WIDTH,
      canvasHeight: CANVAS_HEIGHT,
    };
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
          <Button variant={!measureMode ? "default" : "outline"} size="sm" onClick={() => setMeasureMode(false)}>
            <MousePointer2 className="w-4 h-4 mr-2" />
            Navigation
          </Button>
          <Button variant={measureMode ? "default" : "outline"} size="sm" onClick={() => setMeasureMode(true)}>
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
