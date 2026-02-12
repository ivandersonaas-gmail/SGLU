-- ⚠️ SCRIPT DE CORREÇÃO DE PERMISSÕES (RLS) ⚠️

-- 1. Habilita segurança (boa prática)
ALTER TABLE legislation_files ENABLE ROW LEVEL SECURITY;

-- 2. Permite LEITURA para todos (público/anon)
-- Isso resolve o problema de "NÃO CONSTA" pois a IA conseguirá ler o arquivo.
DROP POLICY IF EXISTS "Public Read Laws" ON legislation_files;
CREATE POLICY "Public Read Laws" 
ON legislation_files 
FOR SELECT 
USING (true);

-- 3. Permite INSERT/UPDATE/DELETE para todos (simplificado para seu uso interno)
-- Se quiser restringir depois, podemos mudar. Por enquanto deixa aberto para você conseguir apagar e subir de novo.
DROP POLICY IF EXISTS "Public Write Laws" ON legislation_files;
CREATE POLICY "Public Write Laws" 
ON legislation_files 
FOR ALL 
USING (true) 
WITH CHECK (true);
