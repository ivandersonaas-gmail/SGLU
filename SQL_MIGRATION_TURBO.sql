-- ⚠️ RODE ESTE SCRIPT NO "SQL EDITOR" DO SEU SUPABASE ⚠️

-- 1. Adiciona a coluna de texto na tabela de documentos do processo
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS extracted_text TEXT;

-- 2. Adiciona a coluna de texto na tabela de leis (biblioteca)
ALTER TABLE legislation_files 
ADD COLUMN IF NOT EXISTS extracted_text TEXT;

-- 3. (Opcional) Cria um índice para busca textual futura
CREATE INDEX IF NOT EXISTS idx_legislation_text ON legislation_files USING gin(to_tsvector('portuguese', extracted_text));
