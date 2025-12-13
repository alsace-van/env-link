// ============================================
// taskSync.ts
// Utilitaires pour synchroniser le statut des tâches
// entre project_todos et daily_notes
// ============================================

import { supabase } from "@/integrations/supabase/client";

/**
 * Synchronise le statut completed d'une tâche partout :
 * - Dans project_todos
 * - Dans tous les blocs daily_notes qui contiennent cette tâche
 */
export const syncTaskCompleted = async (
  taskId: string,
  newCompleted: boolean,
  userId: string
): Promise<boolean> => {
  try {
    // 1. Mettre à jour project_todos
    const { error: todosError } = await supabase
      .from("project_todos")
      .update({
        completed: newCompleted,
        completed_at: newCompleted ? new Date().toISOString() : null,
      })
      .eq("id", taskId);

    if (todosError) {
      console.error("Erreur mise à jour project_todos:", todosError);
      return false;
    }

    // 2. Synchroniser dans tous les daily_notes qui contiennent cette tâche
    const { data: notes } = await supabase
      .from("daily_notes")
      .select("id, blocks_data")
      .eq("user_id", userId);

    if (notes) {
      for (const note of notes) {
        if (!note.blocks_data) continue;

        try {
          const blocks = JSON.parse(note.blocks_data);
          let modified = false;

          blocks.forEach((block: any) => {
            // Mettre à jour linkedTask (ancien format)
            if (block.linkedTask?.id === taskId) {
              block.linkedTask.completed = newCompleted;
              block.taskStatus = newCompleted ? "completed" : "pending";
              modified = true;
            }

            // Mettre à jour linkedTasks (nouveau format)
            if (block.linkedTasks) {
              block.linkedTasks.forEach((task: any) => {
                if (task.id === taskId) {
                  task.completed = newCompleted;
                  modified = true;
                }
              });

              // Recalculer le statut du bloc basé sur toutes les tâches
              if (block.linkedTasks.length > 0) {
                const allCompleted = block.linkedTasks.every((t: any) => t.completed);
                const anyInProgress = block.linkedTasks.some((t: any) => !t.completed);
                
                if (allCompleted && block.taskStatus !== "completed") {
                  block.taskStatus = "completed";
                  modified = true;
                } else if (anyInProgress && block.taskStatus === "completed") {
                  block.taskStatus = "pending";
                  modified = true;
                }
              }
            }
          });

          // Sauvegarder si modifié
          if (modified) {
            await supabase
              .from("daily_notes")
              .update({
                blocks_data: JSON.stringify(blocks),
                updated_at: new Date().toISOString(),
              })
              .eq("id", note.id);
            
            console.log("🔄 Tâche synchronisée dans daily_notes:", note.id);
          }
        } catch (e) {
          // Ignorer les erreurs de parsing JSON
        }
      }
    }

    return true;
  } catch (error) {
    console.error("Erreur syncTaskCompleted:", error);
    return false;
  }
};

/**
 * Récupère l'ID de l'utilisateur courant
 */
export const getCurrentUserId = async (): Promise<string | null> => {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id || null;
};
