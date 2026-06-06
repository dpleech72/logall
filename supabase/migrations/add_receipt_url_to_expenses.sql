-- Add receipt_url column to store a link to the uploaded receipt photo
-- (Google Drive or OneDrive shareable URL)
ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS receipt_url TEXT DEFAULT NULL;
