-- Add archived column to project_notes table
ALTER TABLE project_notes 
ADD COLUMN archived boolean NOT NULL DEFAULT false;