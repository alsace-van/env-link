import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PhotoUploadStep } from "./wizard/PhotoUploadStep";
import { MarkerDetectionStep } from "./wizard/MarkerDetectionStep";
import { ImageCorrectionStep } from "./wizard/ImageCorrectionStep";
import { ScaleCalibrationStep } from "./wizard/ScaleCalibrationStep";
import { TemplateInfoStep } from "./wizard/TemplateInfoStep";

interface PhotoTemplateCreationWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
}

export function PhotoTemplateCreationWizard({
  open,
  onOpenChange,
  projectId,
}: PhotoTemplateCreationWizardProps) {
  const [currentStep, setCurrentStep] = useState("upload");
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [markersData, setMarkersData] = useState<any>(null);
  const [correctedImage, setCorrectedImage] = useState<string | null>(null);
  const [calibrationData, setCalibrationData] = useState<any>(null);

  const steps = [
    { value: "upload", label: "1. Upload" },
    { value: "markers", label: "2. Détection", disabled: !uploadedImage },
    { value: "correction", label: "3. Correction", disabled: !markersData },
    { value: "calibration", label: "4. Calibration", disabled: !correctedImage },
    { value: "info", label: "5. Informations", disabled: !calibrationData },
  ];

  const handleReset = () => {
    setCurrentStep("upload");
    setUploadedImage(null);
    setMarkersData(null);
    setCorrectedImage(null);
    setCalibrationData(null);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) handleReset(); }}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Créer un nouveau gabarit</DialogTitle>
        </DialogHeader>

        <Tabs value={currentStep} onValueChange={setCurrentStep}>
          <TabsList className="grid w-full grid-cols-5">
            {steps.map((step) => (
              <TabsTrigger
                key={step.value}
                value={step.value}
                disabled={step.disabled}
              >
                {step.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="upload">
            <PhotoUploadStep
              onImageUploaded={(imageUrl) => {
                setUploadedImage(imageUrl);
                setCurrentStep("markers");
              }}
            />
          </TabsContent>

          <TabsContent value="markers">
            <MarkerDetectionStep
              imageUrl={uploadedImage!}
              onMarkersDetected={(data) => {
                setMarkersData(data);
                setCurrentStep("correction");
              }}
              onBack={() => setCurrentStep("upload")}
            />
          </TabsContent>

          <TabsContent value="correction">
            <ImageCorrectionStep
              imageUrl={uploadedImage!}
              markersData={markersData}
              onCorrectionComplete={(correctedUrl, correctionData) => {
                setCorrectedImage(correctedUrl);
                setCurrentStep("calibration");
              }}
              onBack={() => setCurrentStep("markers")}
            />
          </TabsContent>

          <TabsContent value="calibration">
            <ScaleCalibrationStep
              imageUrl={correctedImage!}
              markersData={markersData}
              onCalibrationComplete={(data) => {
                setCalibrationData(data);
                setCurrentStep("info");
              }}
              onBack={() => setCurrentStep("correction")}
            />
          </TabsContent>

          <TabsContent value="info">
            <TemplateInfoStep
              projectId={projectId}
              originalImageUrl={uploadedImage!}
              correctedImageUrl={correctedImage!}
              markersData={markersData}
              calibrationData={calibrationData}
              onSaved={() => {
                onOpenChange(false);
                handleReset();
              }}
              onBack={() => setCurrentStep("calibration")}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
