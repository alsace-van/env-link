import { useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Text, Box, Grid } from "@react-three/drei";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Maximize2, RotateCcw } from "lucide-react";
import * as THREE from "three";

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
  scale: number;
}

const FurnitureBox = ({ furniture, scale }: FurnitureBoxProps) => {
  const width = (furniture.longueur_mm || 100) / scale;
  const depth = (furniture.largeur_mm || 100) / scale;
  const height = (furniture.hauteur_mm || 100) / scale;
  
  const posX = furniture.position?.x ? (furniture.position.x / scale) : 0;
  const posZ = furniture.position?.y ? (furniture.position.y / scale) : 0;
  const posY = height / 2;

  return (
    <group position={[posX, posY, posZ]}>
      <Box args={[width, height, depth]} castShadow receiveShadow>
        <meshStandardMaterial color="#3b82f6" opacity={0.8} transparent />
      </Box>
      <Text
        position={[0, height / 2 + 0.2, 0]}
        fontSize={0.3}
        color="black"
        anchorX="center"
        anchorY="middle"
      >
        {`${furniture.longueur_mm}×${furniture.largeur_mm}×${furniture.hauteur_mm}mm`}
      </Text>
      <Text
        position={[0, height / 2 + 0.5, 0]}
        fontSize={0.25}
        color="black"
        anchorX="center"
        anchorY="middle"
      >
        {`${furniture.poids_kg}kg`}
      </Text>
    </group>
  );
};

const LoadArea = ({ length, width, height, scale }: { length: number; width: number; height: number; scale: number }) => {
  const scaledLength = length / scale;
  const scaledWidth = width / scale;
  const scaledHeight = height / scale;

  return (
    <group>
      {/* Plancher */}
      <mesh position={[0, 0, 0]} receiveShadow>
        <boxGeometry args={[scaledLength, 0.05, scaledWidth]} />
        <meshStandardMaterial color="#94a3b8" />
      </mesh>
      
      {/* Contours de la zone de chargement */}
      <lineSegments>
        <edgesGeometry
          attach="geometry"
          args={[new THREE.BoxGeometry(scaledLength, scaledHeight, scaledWidth)]}
        />
        <lineBasicMaterial attach="material" color="#60a5fa" linewidth={2} />
      </lineSegments>
    </group>
  );
};

const Scene = ({ furniture, loadAreaLength, loadAreaWidth, loadAreaHeight }: {
  furniture: FurnitureItem[];
  loadAreaLength: number;
  loadAreaWidth: number;
  loadAreaHeight: number;
}) => {
  const scale = 100; // 100mm = 1 unité

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1} castShadow />
      <directionalLight position={[-10, 10, -5]} intensity={0.5} />
      
      <LoadArea 
        length={loadAreaLength} 
        width={loadAreaWidth} 
        height={loadAreaHeight}
        scale={scale} 
      />
      
      {furniture.map((item) => (
        <FurnitureBox key={item.id} furniture={item} scale={scale} />
      ))}
      
      <Grid
        args={[loadAreaLength / scale, loadAreaWidth / scale]}
        cellSize={1}
        cellThickness={0.5}
        cellColor="#cbd5e1"
        sectionSize={5}
        sectionThickness={1}
        sectionColor="#94a3b8"
        fadeDistance={50}
        fadeStrength={1}
        position={[0, -0.01, 0]}
      />
      
      <OrbitControls 
        makeDefault
        minPolarAngle={0}
        maxPolarAngle={Math.PI / 2}
        enableDamping
        dampingFactor={0.05}
      />
    </>
  );
};

export const Layout3DView = ({ 
  projectId, 
  loadAreaLength = 3000, 
  loadAreaWidth = 1800,
  loadAreaHeight = 1800
}: Layout3DViewProps) => {
  const [furniture, setFurniture] = useState<FurnitureItem[]>([]);
  const [canvasData, setCanvasData] = useState<any>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    loadProjectData();
  }, [projectId]);

  const loadProjectData = async () => {
    try {
      const { data, error } = await supabase
        .from("projects")
        .select("furniture_data, layout_canvas_data")
        .eq("id", projectId)
        .single();

      if (error) throw error;

      if (data?.furniture_data && Array.isArray(data.furniture_data)) {
        // Extraire les positions depuis layout_canvas_data si disponible
        const positions = extractPositions(data.layout_canvas_data);
        
        const furnitureWithPositions = (data.furniture_data as unknown as FurnitureItem[]).map((item: FurnitureItem) => ({
          ...item,
          position: positions[item.id] || { x: 0, y: 0 }
        }));
        
        setFurniture(furnitureWithPositions);
      }

      if (data?.layout_canvas_data) {
        setCanvasData(data.layout_canvas_data);
      }
    } catch (error) {
      console.error("Error loading 3D data:", error);
    }
  };

  const extractPositions = (canvasData: any) => {
    const positions: Record<string, { x: number; y: number }> = {};
    
    if (!canvasData) return positions;

    try {
      const data = typeof canvasData === "string" ? JSON.parse(canvasData) : canvasData;
      
      if (data && data[1]) {
        data[1].forEach((item: any) => {
          if (item[0] === "Group" && item[1]?.data?.furnitureId) {
            const furnitureId = item[1].data.furnitureId;
            const matrix = item[1].matrix;
            if (matrix && matrix.length >= 6) {
              positions[furnitureId] = {
                x: matrix[4] - 400, // Centrer par rapport au canvas
                y: matrix[5] - 300
              };
            }
          }
        });
      }
    } catch (error) {
      console.error("Error extracting positions:", error);
    }

    return positions;
  };

  const resetCamera = () => {
    window.location.reload(); // Simple reset pour repositionner la caméra
  };

  return (
    <Card className="w-full">
      <div className="p-4 border-b flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Vue 3D de l'aménagement</h3>
          <p className="text-sm text-muted-foreground">
            Clic + glisser pour tourner, molette pour zoomer
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={resetCamera}>
            <RotateCcw className="w-4 h-4 mr-2" />
            Réinitialiser
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setIsFullscreen(!isFullscreen)}
          >
            <Maximize2 className="w-4 h-4 mr-2" />
            {isFullscreen ? "Réduire" : "Plein écran"}
          </Button>
        </div>
      </div>
      
      <div className={isFullscreen ? "fixed inset-0 z-50 bg-background" : ""}>
        <div className={isFullscreen ? "h-screen" : "h-[600px]"}>
          <Canvas
            camera={{ position: [15, 10, 15], fov: 50 }}
            shadows
            className="bg-gradient-to-b from-slate-50 to-slate-100"
          >
            <Scene 
              furniture={furniture}
              loadAreaLength={loadAreaLength}
              loadAreaWidth={loadAreaWidth}
              loadAreaHeight={loadAreaHeight}
            />
          </Canvas>
        </div>
      </div>
      
      {furniture.length === 0 && (
        <div className="p-8 text-center text-muted-foreground">
          <p>Aucun meuble à afficher.</p>
          <p className="text-sm mt-2">
            Ajoutez des meubles dans l'onglet "Plan d'aménagement" pour les voir en 3D.
          </p>
        </div>
      )}
    </Card>
  );
};
