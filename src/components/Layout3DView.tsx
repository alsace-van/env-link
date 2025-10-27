import { useEffect, useState, useRef, useCallback } from "react";
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
  canvasDimensions?: { widthPx: number; heightPx: number };
}

interface FurnitureBoxProps {
  furniture: FurnitureItem;
  mmToUnits3D: number;
  canvasScale: number;
}

const FurnitureBox = ({ furniture, mmToUnits3D, canvasScale }: FurnitureBoxProps) => {
  let widthMm, depthMm;
  
  // Vérifier si les dimensions du canvas sont valides (non nulles et > 10px)
  const hasValidCanvasDimensions = furniture.canvasDimensions 
    && furniture.canvasDimensions.widthPx > 10 
    && furniture.canvasDimensions.heightPx > 10;
  
  if (hasValidCanvasDimensions) {
    widthMm = furniture.canvasDimensions!.widthPx / canvasScale;
    depthMm = furniture.canvasDimensions!.heightPx / canvasScale;
    
    console.log(`\n=== MEUBLE ${furniture.id} (DIMENSIONS DU CANVAS) ===`);
    console.log(`Canvas: ${furniture.canvasDimensions!.widthPx.toFixed(1)}px × ${furniture.canvasDimensions!.heightPx.toFixed(1)}px`);
    console.log(`Converties: ${widthMm.toFixed(1)}mm × ${depthMm.toFixed(1)}mm`);
  } else {
    widthMm = furniture.longueur_mm || 100;
    depthMm = furniture.largeur_mm || 100;
    
    console.log(`\n=== MEUBLE ${furniture.id} (DIMENSIONS STOCKÉES) ===`);
    console.log(`Dimensions: ${widthMm}mm × ${depthMm}mm`);
    if (furniture.canvasDimensions) {
      console.log(`⚠️ Dimensions canvas invalides: ${furniture.canvasDimensions.widthPx}px × ${furniture.canvasDimensions.heightPx}px`);
    }
  }
  
  const heightMm = furniture.hauteur_mm || 100;

  const width3D = widthMm * mmToUnits3D;
  const depth3D = depthMm * mmToUnits3D;
  const height3D = heightMm * mmToUnits3D;

  console.log(`Dimensions 3D finales: ${width3D.toFixed(2)} × ${depth3D.toFixed(2)} × ${height3D.toFixed(2)} unités`);

  const posXpixelsRel = furniture.position?.x || 0;
  const posYpixelsRel = furniture.position?.y || 0;

  const posXmm = posXpixelsRel / canvasScale;
  const posZmm = posYpixelsRel / canvasScale;

  const posX3D = posXmm * mmToUnits3D;
  const posZ3D = posZmm * mmToUnits3D;
  const posY3D = height3D / 2;

  console.log(`Position (pixels relatifs): (${posXpixelsRel.toFixed(1)}, ${posYpixelsRel.toFixed(1)})`);
  console.log(`Position (mm): (${posXmm.toFixed(1)}, ${posZmm.toFixed(1)})`);
  console.log(`Position (3D): (${posX3D.toFixed(2)}, ${posY3D.toFixed(2)}, ${posZ3D.toFixed(2)})`);

  const textSize = Math.max(0.2, Math.min(0.5, 0.3));
  const textOffsetY = height3D / 2 + textSize * 1.2;

  return (
    <group position={[posX3D, posY3D, posZ3D]}>
      <Box args={[width3D, height3D, depth3D]} castShadow receiveShadow>
        <meshStandardMaterial color="#3b82f6" opacity={0.8} transparent />
      </Box>
      <Text position={[0, textOffsetY, 0]} fontSize={textSize} color="black" anchorX="center" anchorY="middle">
        {`${Math.round(widthMm)}×${Math.round(depthMm)}×${heightMm}mm`}
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
  const length3D = length * mmToUnits3D;
  const width3D = width * mmToUnits3D;

  console.log("\n=== ZONE DE CHARGEMENT ===");
  console.log(`Dimensions (mm): ${length} × ${width}`);
  console.log(`Dimensions (3D): ${length3D.toFixed(2)} × ${width3D.toFixed(2)} unités`);

  const points: [number, number, number][] = [
    [-length3D / 2, 0.02, -width3D / 2],
    [length3D / 2, 0.02, -width3D / 2],
    [length3D / 2, 0.02, width3D / 2],
    [-length3D / 2, 0.02, width3D / 2],
    [-length3D / 2, 0.02, -width3D / 2],
  ];

  return (
    <group>
      <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[length3D, width3D]} />
        <meshStandardMaterial color="#e2e8f0" opacity={0.3} transparent side={THREE.DoubleSide} />
      </mesh>
      <Line points={points} color="#3b82f6" lineWidth={3} dashed={true} dashScale={50} dashSize={1} gapSize={0.5} />
    </group>
  );
};

const AxisHelper = () => {
  return (
    <group>
      <arrowHelper args={[new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 0), 5, 0xff0000]} />
      <arrowHelper args={[new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 0), 5, 0x00ff00]} />
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
      const intersects = raycaster.intersectObjects(scene.children, true);
      const validIntersects = intersects.filter((intersect) => {
        const obj = intersect.object;
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

      const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      const intersectPoint = new THREE.Vector3();
      const hasGroundIntersection = raycaster.ray.intersectPlane(groundPlane, intersectPoint);

      if (hasGroundIntersection) {
        return intersectPoint.clone();
      }

      return null;
    };

    const handlePointerDown = (event: MouseEvent) => {
      if (event.button !== 0) return;

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
  const mmToUnits3D = 1 / 100;
  const scale3D = mmToUnits3D;

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
  loadAreaLength: propLoadAreaLength,
  loadAreaWidth: propLoadAreaWidth,
  loadAreaHeight = 1800,
}: Layout3DViewProps) => {
  const [furniture, setFurniture] = useState<FurnitureItem[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [cameraKey, setCameraKey] = useState(0);
  const [measureMode, setMeasureMode] = useState(false);
  const [measureLines, setMeasureLines] = useState<MeasureLine[]>([]);
  const [loadAreaLength, setLoadAreaLength] = useState<number>(propLoadAreaLength || 3000);
  const [loadAreaWidth, setLoadAreaWidth] = useState<number>(propLoadAreaWidth || 1800);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  /**
   * Fonction d'extraction stable - définie en dehors du composant pour éviter les re-créations
   */
  const extractFurniturePositionsAndDimensions = useCallback(
    (canvasJSON: any): {
      positions: { [furnitureId: string]: { x: number; y: number } };
      dimensions: { [furnitureId: string]: { widthPx: number; heightPx: number } };
      scale: number;
      canvasWidth: number;
      canvasHeight: number;
    } => {
      const positions: { [furnitureId: string]: { x: number; y: number } } = {};
      const dimensions: { [furnitureId: string]: { widthPx: number; heightPx: number } } = {};

      const CANVAS_WIDTH = 800;
      const CANVAS_HEIGHT = 600;

      const scale = Math.min((CANVAS_WIDTH - 100) / loadAreaLength, (CANVAS_HEIGHT - 100) / loadAreaWidth);

      console.log("\n=== EXTRACTION DES POSITIONS ET DIMENSIONS ===");
      console.log(`Canvas: ${CANVAS_WIDTH}px × ${CANVAS_HEIGHT}px`);
      console.log(`Zone de chargement: ${loadAreaLength}mm × ${loadAreaWidth}mm`);
      console.log(`Scale calculé: ${scale.toFixed(4)} pixels/mm`);
      console.log("=== FIN EXTRACTION ===\n");

      try {
        // Trouver les children dans le canvasJSON
        let children = null;
        
        if (canvasJSON && Array.isArray(canvasJSON)) {
          console.log(`\nStructure canvasJSON: Array avec ${canvasJSON.length} élément(s)`);
          
          // Essayer différents emplacements
          if (canvasJSON.length > 1 && canvasJSON[1]?.children) {
            children = canvasJSON[1].children;
            console.log(`✓ Trouvé children dans canvasJSON[1]`);
          } else if (canvasJSON.length > 0 && canvasJSON[0]?.children) {
            children = canvasJSON[0].children;
            console.log(`✓ Trouvé children dans canvasJSON[0]`);
          } else if (canvasJSON.length > 0 && Array.isArray(canvasJSON[0]) && canvasJSON[0].length > 1 && canvasJSON[0][1]?.children) {
            children = canvasJSON[0][1].children;
            console.log(`✓ Trouvé children dans canvasJSON[0][1]`);
          }
        }

        if (children && Array.isArray(children)) {
          console.log(`✓ Analyse de ${children.length} enfant(s) du canvas`);
          
          const centerX = CANVAS_WIDTH / 2;
          const centerY = CANVAS_HEIGHT / 2;

          children.forEach((child: any) => {
              if (Array.isArray(child) && child.length > 1) {
                const childType = child[0];
                const childData = child[1];

                if (childType === "Group" && childData?.data?.isFurniture && childData?.data?.furnitureId) {
                  const furnitureId = childData.data.furnitureId;

                  console.log(`\n*** MEUBLE: ${furnitureId} ***`);

                  if (childData.children && Array.isArray(childData.children) && childData.children.length > 0) {
                    const pathChild = childData.children[0];

                    if (Array.isArray(pathChild) && pathChild[0] === "Path" && pathChild[1]?.segments) {
                      const segments = pathChild[1].segments;

                      if (segments.length >= 4) {
                        const getPoint = (seg: any) => {
                          if (Array.isArray(seg)) {
                            if (Array.isArray(seg[0])) {
                              return { x: seg[0][0], y: seg[0][1] };
                            }
                            return { x: seg[0], y: seg[1] };
                          }
                          return { x: 0, y: 0 };
                        };

                        const p1 = getPoint(segments[0]);
                        const p2 = getPoint(segments[1]);
                        const p3 = getPoint(segments[2]);
                        const p4 = getPoint(segments[3]);

                        console.log(`  Segments bruts:`);
                        console.log(`    p1: (${p1.x}, ${p1.y})`);
                        console.log(`    p2: (${p2.x}, ${p2.y})`);
                        console.log(`    p3: (${p3.x}, ${p3.y})`);
                        console.log(`    p4: (${p4.x}, ${p4.y})`);

                        let x1 = p1.x, y1 = p1.y;
                        let x2 = p2.x, y2 = p2.y;
                        let x3 = p3.x, y3 = p3.y;
                        let x4 = p4.x, y4 = p4.y;

                        const pathMatrix = pathChild[1]?.matrix;
                        if (pathMatrix && Array.isArray(pathMatrix) && pathMatrix.length === 6) {
                          const [a, b, c, d, tx, ty] = pathMatrix;

                          const transform = (x: number, y: number) => ({
                            x: a * x + c * y + tx,
                            y: b * x + d * y + ty,
                          });

                          const t1 = transform(x1, y1);
                          const t2 = transform(x2, y2);
                          const t3 = transform(x3, y3);
                          const t4 = transform(x4, y4);

                          x1 = t1.x; y1 = t1.y;
                          x2 = t2.x; y2 = t2.y;
                          x3 = t3.x; y3 = t3.y;
                          x4 = t4.x; y4 = t4.y;

                          console.log(`  Après matrice Path: [${pathMatrix}]`);
                        }

                        const groupMatrix = childData.matrix;
                        if (groupMatrix && Array.isArray(groupMatrix) && groupMatrix.length === 6) {
                          const [a, b, c, d, tx, ty] = groupMatrix;

                          const transform = (x: number, y: number) => ({
                            x: a * x + c * y + tx,
                            y: b * x + d * y + ty,
                          });

                          const t1 = transform(x1, y1);
                          const t2 = transform(x2, y2);
                          const t3 = transform(x3, y3);
                          const t4 = transform(x4, y4);

                          x1 = t1.x; y1 = t1.y;
                          x2 = t2.x; y2 = t2.y;
                          x3 = t3.x; y3 = t3.y;
                          x4 = t4.x; y4 = t4.y;

                          console.log(`  Après matrice Group: [${groupMatrix}]`);
                        }

                        const rectCenterX = (x1 + x3) / 2;
                        const rectCenterY = (y1 + y3) / 2;

                        const widthPx = Math.abs(x2 - x1);
                        const heightPx = Math.abs(y3 - y1);

                        console.log(`  Centre: (${rectCenterX.toFixed(1)}, ${rectCenterY.toFixed(1)}) pixels`);
                        console.log(`  Dimensions: ${widthPx.toFixed(1)}px × ${heightPx.toFixed(1)}px`);

                        const relativeX = rectCenterX - centerX;
                        const relativeY = rectCenterY - centerY;

                        console.log(`  Position relative: (${relativeX.toFixed(1)}, ${relativeY.toFixed(1)}) pixels`);

                        const widthMm = widthPx / scale;
                        const heightMm = heightPx / scale;
                        console.log(`  Dimensions en mm: ${widthMm.toFixed(1)}mm × ${heightMm.toFixed(1)}mm`);

                        positions[furnitureId] = {
                          x: relativeX,
                          y: relativeY,
                        };

                        dimensions[furnitureId] = {
                          widthPx: widthPx,
                          heightPx: heightPx,
                        };
                      }
                    }
                  }
                }
              }
            });
        } else {
          console.log("⚠️ Aucun enfant trouvé dans le canvas");
        }
      } catch (error) {
        console.error("Error extracting positions and dimensions:", error);
      }

      console.log("\n=== RÉSUMÉ EXTRACTION ===");
      console.log(`Meubles trouvés: ${Object.keys(positions).length}`);
      console.log(`Scale: ${scale.toFixed(4)} pixels/mm`);
      console.log("========================\n");

      return {
        positions,
        dimensions,
        scale,
        canvasWidth: CANVAS_WIDTH,
        canvasHeight: CANVAS_HEIGHT,
      };
    },
    [loadAreaLength, loadAreaWidth]
  );

  const loadProjectData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      console.log("🔄 Chargement des données du projet:", projectId);

      const { data: projectData, error: projectError } = await supabase
        .from("projects")
        .select("furniture_data, layout_canvas_data, longueur_chargement_mm, largeur_chargement_mm")
        .eq("id", projectId)
        .single();

      if (projectError) {
        console.error("❌ Erreur Supabase:", projectError);
        throw projectError;
      }

      if (!projectData) {
        console.error("❌ Aucune donnée de projet trouvée");
        throw new Error("Aucune donnée de projet trouvée");
      }

      // Mettre à jour les dimensions de la zone de chargement depuis la DB
      if (projectData.longueur_chargement_mm) {
        setLoadAreaLength(projectData.longueur_chargement_mm);
        console.log(`✓ Longueur zone de chargement mise à jour: ${projectData.longueur_chargement_mm}mm`);
      }
      if (projectData.largeur_chargement_mm) {
        setLoadAreaWidth(projectData.largeur_chargement_mm);
        console.log(`✓ Largeur zone de chargement mise à jour: ${projectData.largeur_chargement_mm}mm`);
      }

      console.log("\n==========================================");
      console.log("CHARGEMENT DES DONNÉES PROJET");
      console.log("==========================================");
      console.log("Données brutes:", { 
        hasFurnitureData: !!projectData.furniture_data,
        hasLayoutCanvasData: !!projectData.layout_canvas_data
      });

      let furnitureData: FurnitureItem[] = [];
      
      if (projectData.furniture_data && Array.isArray(projectData.furniture_data)) {
        furnitureData = projectData.furniture_data.map((item: any) => ({
          id: item.id,
          longueur_mm: item.longueur_mm || 0,
          largeur_mm: item.largeur_mm || 0,
          hauteur_mm: item.hauteur_mm || 0,
          poids_kg: item.poids_kg || 0,
        }));

        console.log(`✅ Meubles chargés: ${furnitureData.length}`);
      } else {
        console.log("⚠️ Aucune donnée de meuble trouvée");
      }

      const canvasDataToUse = projectData.layout_canvas_data;
      
      if (canvasDataToUse) {
        try {
          const canvasJSON = typeof canvasDataToUse === 'string' 
            ? JSON.parse(canvasDataToUse) 
            : canvasDataToUse;
          
          console.log("✅ Canvas data parsée avec succès");
          
          const extractedData = extractFurniturePositionsAndDimensions(canvasJSON);

          console.log("\n✅ Positions et dimensions extraites:", {
            positionsCount: Object.keys(extractedData.positions).length,
            dimensionsCount: Object.keys(extractedData.dimensions).length,
          });

          furnitureData = furnitureData.map((item) => ({
            ...item,
            position: extractedData.positions[item.id] || { x: 0, y: 0 },
            canvasDimensions: extractedData.dimensions[item.id],
          }));

          console.log("\n✅ Meubles avec positions et dimensions:");
          furnitureData.forEach((f) => {
            console.log(`  - ${f.id}:`);
            console.log(`    Position: (${f.position?.x.toFixed(1)}, ${f.position?.y.toFixed(1)}) pixels`);
            if (f.canvasDimensions) {
              console.log(`    Dimensions canvas: ${f.canvasDimensions.widthPx.toFixed(1)}px × ${f.canvasDimensions.heightPx.toFixed(1)}px`);
            }
          });
        } catch (parseError) {
          console.error("❌ Erreur de parsing du canvas JSON:", parseError);
          console.log("⚠️ Utilisation des meubles sans positions");
        }
      } else {
        console.log("⚠️ Aucune donnée canvas trouvée");
      }

      setFurniture(furnitureData);
      toast.success(`${furnitureData.length} meuble(s) chargé(s)`);
      console.log("==========================================\n");
    } catch (error: any) {
      console.error("❌ Error loading project data:", error);
      toast.error(`Erreur: ${error.message || "Erreur de chargement"}`);
      setFurniture([]);
    } finally {
      setIsRefreshing(false);
    }
  }, [projectId, extractFurniturePositionsAndDimensions]);

  useEffect(() => {
    loadProjectData();
  }, [loadProjectData]);

  const resetCamera = () => {
    setCameraKey((prev) => prev + 1);
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