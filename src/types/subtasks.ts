export interface ProjectTodoSubtask {
  id: string;
  todo_id: string;
  title: string;
  completed: boolean;
  display_order: number;
  created_at?: string;
}
