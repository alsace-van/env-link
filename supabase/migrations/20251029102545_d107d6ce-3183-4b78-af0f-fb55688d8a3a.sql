-- Fix STORAGE_EXPOSURE: Make public storage buckets private
-- This ensures files can only be accessed through signed URLs with expiration times

-- Make the three public buckets private
UPDATE storage.buckets 
SET public = false 
WHERE id IN ('project-photos', 'notice-files', 'project-invoices');