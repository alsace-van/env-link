import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ProjectTodoList } from "./ProjectTodoList";
import { ProjectNotes } from "./ProjectNotes";
import { GlobalTodoList } from "./GlobalTodoList";
import { GlobalNotes } from "./GlobalNotes";
import { ClipboardList, FileText } from "lucide-react";

interface ProjectSidebarProps {
  projectId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export const ProjectSidebar = ({ projectId, isOpen, onClose }: ProjectSidebarProps) => {
  return (
    <>
      {/* Overlay semi-transparent */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px] transition-opacity" 
          onClick={onClose}
        />
      )}
      
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent side="right" className="w-[450px] sm:w-[500px] p-0 overflow-hidden z-50">
          <SheetHeader className="px-6 py-4 border-b">
            <SheetTitle>Tâches et Notes</SheetTitle>
          </SheetHeader>

          <div className="h-[calc(100vh-80px)]">
            <Tabs defaultValue="project" className="h-full flex flex-col">
              <TabsList className="grid w-full grid-cols-2 flex-shrink-0 mx-6 mt-4">
                <TabsTrigger value="project">
                  <ClipboardList className="h-4 w-4 mr-2 text-blue-600" />
                  Ce projet
                </TabsTrigger>
                <TabsTrigger value="global">
                  <FileText className="h-4 w-4 mr-2 text-green-600" />
                  Tous les projets
                </TabsTrigger>
              </TabsList>

              <TabsContent value="project" className="flex-1 m-0 overflow-hidden">
                <div className="h-full overflow-auto px-6 py-4 space-y-4">
                  <div>
                    <h3 className="font-semibold mb-3">Tâches à faire</h3>
                    <ProjectTodoList projectId={projectId} />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-3">Notes</h3>
                    <ProjectNotes projectId={projectId} />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="global" className="flex-1 m-0 overflow-hidden">
                <div className="h-full overflow-auto px-6 py-4 space-y-4">
                  <div>
                    <h3 className="font-semibold mb-3">Toutes les tâches</h3>
                    <GlobalTodoList />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-3">Toutes les notes</h3>
                    <GlobalNotes />
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};
