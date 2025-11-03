import { ProjectPlanning } from "@/components/ProjectPlanning";

interface CompactAgendaProps {
  projectId: string | null;
}

const CompactAgenda = ({ projectId }: CompactAgendaProps) => {
  return <ProjectPlanning projectId={projectId} />;
};

export default CompactAgenda;
