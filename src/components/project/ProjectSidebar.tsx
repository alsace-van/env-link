import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { ProjectTodoList } from "./ProjectTodoList";
import { ProjectNotes } from "./ProjectNotes";
import { GlobalTodoList } from "./GlobalTodoList";
import { GlobalNotes } from "./GlobalNotes";
import { ClipboardList, FileText } from "lucide-react";

interface ProjectSidebarProps {
  projectId: string | null;
}

export const ProjectSidebar = ({ projectId }: ProjectSidebarProps) => {
  return (
    <Card className="h-full flex flex-col overflow-hidden">
      <Tabs defaultValue="project" className="h-full flex flex-col">
        <TabsList className="grid w-full grid-cols-2 flex-shrink-0">
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
          <div className="h-full overflow-auto p-4 space-y-4">
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
          <div className="h-full overflow-auto p-4 space-y-4">
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
    </Card>
  );
};
