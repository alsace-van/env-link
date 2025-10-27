import { useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Text, Box, Grid } from "@react-three/drei";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Maximize2, RotateCcw, RefreshCw } from "lucide-react";
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
  // Dimensions en unités 3D
  const width = (furniture.longueur_mm || 100) / scale;
  const depth = (furniture.largeur_mm || 100) / scale;
  const height = (furniture.hauteur_mm || 100) / scale;

  // Position relative au centre de la zone de chargement
  // En 3D: X = largeur (left/right), Y = hauteur (up/down), Z = profondeur (forward/back)
  // En 2D canvas: x = largeur, y = profondeur
  const posX = furniture.position?.x ? furniture.position.x / scale : 0;
  const posZ = furniture.position?.y ? furniture.position.y / scale : 0;
  const posY = height / 2; // Placer le meuble sur le sol

  return (
    <group position={[posX, posY, posZ]}>
      <Box args={[width, height, depth]} castShadow receiveShadow>
        <meshStandardMaterial color="#3b82f6" opacity={0.8} transparent />
      </Box>
      <Text position={[0, height / 2 + 0.2, 0]} fontSize={0.3} color="black" anchorX="center" anchorY="middle">
        {`${furniture.longueur_mm}×${furniture.largeur_mm}×${furniture.hauteur_mm}mm`}
      </Text>
      <Text position={[0, height / 2 + 0.5, 0]} fontSize={0.25} color="black" anchorX="center" anchorY="middle">
        {`${furniture.poids_kg}kg`}
      </Text>
    </group>
  );
};

const LoadArea = ({
  length,
  width,
  scale,
}: {
  length: number;
  width: number;
  scale: number;
}) => {
  const scaledLength = length / scale;
  const scaledWidth = width / scale;

  return (
    <group>
      {/* Rectangle plat au sol représentant la surface utile */}
      <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[scaledLength, scaledWidth]} />
        <meshStandardMaterial color="#e2e8f0" opacity={0.5} transparent side={THREE.DoubleSide} />
      </mesh>
      
      {/* Contour du rectangle */}
      <lineSegments position={[0, 0.01, 0]}>
        <edgesGeometry 
          attach="geometry" 
          args={[new THREE.PlaneGeometry(scaledLength, scaledWidth)]} 
        />
        <lineBasicMaterial attach="material" color="#3b82f6" linewidth={2} />
      </lineSegments>
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

const Scene = ({
  furniture,
  loadAreaLength,
  loadAreaWidth,
}: {
  furniture: FurnitureItem[];
  loadAreaLength: number;
  loadAreaWidth: number;
}) => {
  const scale = 100; // 100mm = 1 unité

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 10, 5]} intensity={1} castShadow />
      <directionalLight position={[-10, 10, -5]} intensity={0.5} />
      <pointLight position={[0, 10, 0]} intensity={0.5} />

      <LoadArea length={loadAreaLength} width={loadAreaWidth} scale={scale} />

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
        position={[0, -0.02, 0]}
      />

      <OrbitControls makeDefault minPolarAngle={0} maxPolarAngle={Math.PI / 2} enableDamping dampingFactor={0.05} />
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
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'projects',
          filter: `id=eq.${projectId}`,
        },
        (payload) => {
          console.log('🔄 Changement détecté dans le projet, rechargement 3D...');
          console.log('Payload:', payload);
          // Recharger après un court délai pour s'assurer que les données sont bien écrites
          setTimeout(() => {
            loadProjectData();
          }, 500);
        }
      )
      .subscribe((status) => {
        console.log('📡 Statut de la subscription 3D:', status);
        
        // Si la subscription se ferme, réessayer après un délai
        if (status === 'CLOSED') {
          console.log('⚠️ Subscription fermée, tentative de reconnexion dans 2s...');
          setTimeout(() => {
            loadProjectData();
          }, 2000);
        }
      });

    // Nettoyer la subscription au démontage
    return () => {
      console.log('🔌 Déconnexion de la subscription 3D');
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

    try {
      const data = typeof canvasData === "string" ? JSON.parse(canvasData) : canvasData;

      console.log("Données canvas parsées:", data);

      if (data && Array.isArray(data) && data.length > 1) {
        const items = data[1];

        if (Array.isArray(items)) {
          items.forEach((item: any, index: number) => {
            // Chercher les rectangles avec des données de meuble
            if (item && Array.isArray(item) && item.length > 1) {
              const itemType = item[0];
              const itemData = item[1];

              console.log(`Item ${index}:`, itemType, itemData);

              // Vérifier si c'est un groupe avec un furnitureId
              if (itemType === "Group" && itemData?.data?.furnitureId) {
                const furnitureId = itemData.data.furnitureId;
                const matrix = itemData.matrix;

                if (matrix && Array.isArray(matrix) && matrix.length >= 6) {
                  // Les positions dans Paper.js sont stockées dans la matrice de transformation
                  // matrix[4] = translation X, matrix[5] = translation Y
                  // Le canvas fait 800x600, et la zone de chargement est centrée
                  const canvasWidth = 800;
                  const canvasHeight = 600;

                  // Calculer l'échelle utilisée dans le canvas
                  const scale = Math.min((canvasWidth - 100) / loadAreaLength, (canvasHeight - 100) / loadAreaWidth);
                  const scaledLoadAreaLength = loadAreaLength * scale;
                  const scaledLoadAreaWidth = loadAreaWidth * scale;

                  // Centre du canvas
                  const centerX = canvasWidth / 2;
                  const centerY = canvasHeight / 2;

                  // Centre de la zone de chargement dans le canvas
                  const loadAreaCenterX = centerX;
                  const loadAreaCenterY = centerY;

                  // Position du meuble dans le canvas
                  const canvasPosX = matrix[4];
                  const canvasPosY = matrix[5];

                  // Position relative au centre de la zone de chargement en pixels canvas
                  const relativeX = canvasPosX - loadAreaCenterX;
                  const relativeY = canvasPosY - loadAreaCenterY;

                  // Conversion en millimètres réels
                  const realX = relativeX / scale;
                  const realY = relativeY / scale;

                  positions[furnitureId] = {
                    x: realX,
                    y: realY,
                  };

                  console.log(`Position pour ${furnitureId}:`, positions[furnitureId]);
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

  return (
    <Card className="w-full">
      <div className="p-4 border-b flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Vue 3D de l'aménagement</h3>
          <p className="text-sm text-muted-foreground">Clic + glisser pour tourner, molette pour zoomer</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={loadProjectData}
            disabled={isRefreshing}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Chargement...' : 'Rafraîchir'}
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
            key={cameraKey} // Force le remontage pour réinitialiser la caméra
            camera={{ position: [15, 10, 15], fov: 50 }}
            shadows
            className="bg-gradient-to-b from-slate-50 to-slate-100"
          >
            <Scene
              furniture={furniture}
              loadAreaLength={loadAreaLength}
              loadAreaWidth={loadAreaWidth}
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