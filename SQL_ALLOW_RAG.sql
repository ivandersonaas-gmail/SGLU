-- ⚠️ RODE ESTE SCRIPT NO "SQL EDITOR" DO SEU SUPABASE ⚠️

-- GARANTE QUE A TABELA DE LEIS SEJA PÚBLICA PARA LEITURA (NECESSÁRIO PARA O RAG NO BROWSER)

-- 1. Habilita RLS na tabela (se não estiver)
ALTER TABLE legislation_files ENABLE ROW LEVEL SECURITY;

-- 2. Remove política antiga se existir (para evitar conflito)
DROP POLICY IF EXISTS "Leitura pública de leis" ON legislation_files;
DROP POLICY IF EXISTS "Public Read Access" ON legislation_files;

-- 3. Cria nova política permissiva para SELECT
CREATE POLICY "Leitura pública de leis"
ON legislation_files
FOR SELECT
USING (true); -- Permite leitura irrestrita (Público/Anon)

-- 4. Confirmação (Check)
SELECT COUNT(*) as total_leis_acessiveis FROM legislation_files;
