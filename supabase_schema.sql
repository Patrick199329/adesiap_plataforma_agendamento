-- Plataforma de Gestão de Frotas - Supabase Schema
-- Execute este script no SQL Editor do Supabase Dashboard
-- ============================================================

-- 1. PROFILES (linked to auth.users)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nome TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    departamento TEXT DEFAULT '',
    tipo TEXT NOT NULL DEFAULT 'motorista' CHECK (tipo IN ('administrador', 'logistica', 'motorista')),
    ativo BOOLEAN NOT NULL DEFAULT true,
    trocar_senha BOOLEAN NOT NULL DEFAULT true,
    criado_em TIMESTAMPTZ DEFAULT now()
);

-- 2. VEHICLES
CREATE TABLE IF NOT EXISTS vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    placa TEXT NOT NULL,
    km INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo')),
    disponivel BOOLEAN NOT NULL DEFAULT true,
    consumption NUMERIC(5,2) DEFAULT 8.5,
    foto TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. PROJECTS
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    rubrica_abastecimento NUMERIC(12,2) NOT NULL DEFAULT 0,
    saldo NUMERIC(12,2) NOT NULL DEFAULT 0,
    ativo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. CHECKLIST_ITEMS
CREATE TABLE IF NOT EXISTS checklist_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT true,
    ordem INTEGER DEFAULT 0
);

-- 5. MAINTENANCE_RULES
CREATE TABLE IF NOT EXISTS maintenance_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    intervalo_km INTEGER NOT NULL DEFAULT 5000,
    icone TEXT DEFAULT 'handyman'
);

-- 6. BOOKINGS
CREATE TABLE IF NOT EXISTS bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    veiculo_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
    motorista_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    projeto_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    criado_por UUID REFERENCES profiles(id) ON DELETE SET NULL,
    data_saida TIMESTAMPTZ,
    data_chegada TIMESTAMPTZ,
    origem TEXT DEFAULT '',
    destino TEXT DEFAULT '',
    observacao TEXT DEFAULT '',
    km_inicial INTEGER DEFAULT 0,
    km_final INTEGER,
    distancia_prevista INTEGER DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'checklist_pendente'
        CHECK (status IN ('checklist_pendente', 'em_curso', 'concluido', 'cancelado')),
    data_conclusao TIMESTAMPTZ,
    checklist_saida JSONB,
    checklist_retorno JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. MAINTENANCE_LOGS
CREATE TABLE IF NOT EXISTS maintenance_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    veiculo_id UUID REFERENCES vehicles(id) ON DELETE CASCADE,
    regra_id UUID REFERENCES maintenance_rules(id) ON DELETE SET NULL,
    projeto_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    tipo TEXT DEFAULT 'preventiva',
    km_realizada INTEGER DEFAULT 0,
    valor NUMERIC(12,2) DEFAULT 0,
    observacao TEXT DEFAULT '',
    usuario_nome TEXT DEFAULT '',
    data TIMESTAMPTZ DEFAULT now()
);

-- 8. FUEL_LOGS
CREATE TABLE IF NOT EXISTS fuel_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    veiculo_id UUID REFERENCES vehicles(id) ON DELETE CASCADE,
    booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
    projeto_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    km INTEGER DEFAULT 0,
    valor NUMERIC(12,2) DEFAULT 0,
    data TIMESTAMPTZ DEFAULT now()
);

-- 9. CORRECTIONS
CREATE TABLE IF NOT EXISTS corrections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    veiculo_id UUID REFERENCES vehicles(id) ON DELETE CASCADE,
    responsavel TEXT DEFAULT '',
    has_inconformity BOOLEAN DEFAULT false,
    results JSONB DEFAULT '[]'::jsonb,
    data_registro TIMESTAMPTZ DEFAULT now(),
    data_correcao TIMESTAMPTZ
);

-- 10. SETTINGS (singleton)
CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    preco_combustivel NUMERIC(6,2) DEFAULT 5.85,
    google_maps_key TEXT DEFAULT '',
    nome_sistema TEXT DEFAULT 'Gestão de Frotas',
    subtitulo_sistema TEXT DEFAULT '',
    logo_url TEXT DEFAULT '',
    favicon_url TEXT DEFAULT ''
);


-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_bookings_veiculo ON bookings(veiculo_id);
CREATE INDEX IF NOT EXISTS idx_bookings_motorista ON bookings(motorista_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_data_saida ON bookings(data_saida);
CREATE INDEX IF NOT EXISTS idx_maintenance_logs_veiculo ON maintenance_logs(veiculo_id);
CREATE INDEX IF NOT EXISTS idx_fuel_logs_veiculo ON fuel_logs(veiculo_id);
CREATE INDEX IF NOT EXISTS idx_corrections_veiculo ON corrections(veiculo_id);


-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE fuel_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Políticas: Qualquer usuário autenticado pode ler e escrever
-- (O controle de acesso por role é feito na camada de aplicação)

CREATE POLICY "Authenticated can read profiles" ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert profiles" ON profiles FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update profiles" ON profiles FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated full access vehicles" ON vehicles FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access projects" ON projects FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access checklist_items" ON checklist_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access maintenance_rules" ON maintenance_rules FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access bookings" ON bookings FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access maintenance_logs" ON maintenance_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access fuel_logs" ON fuel_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access corrections" ON corrections FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access settings" ON settings FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Public read settings" ON settings FOR SELECT TO anon USING (true);


-- ============================================================
-- TRIGGER: Criar perfil automaticamente ao signup
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
    INSERT INTO public.profiles (id, nome, email, departamento, tipo, ativo, trocar_senha)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'nome', ''),
        COALESCE(NEW.email, ''),
        COALESCE(NEW.raw_user_meta_data->>'departamento', ''),
        COALESCE(NEW.raw_user_meta_data->>'tipo', 'motorista'),
        true,
        COALESCE((NEW.raw_user_meta_data->>'trocarSenha')::boolean, true)
    );
    RETURN NEW;
END;
$$;

-- Drop trigger if exists (for re-runs)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ============================================================
-- SEED DATA
-- ============================================================

-- Vehicles
INSERT INTO vehicles (nome, placa, km, status, disponivel, consumption, foto) VALUES
    ('Volvo FH 540', 'ABC-1234', 125400, 'ativo', true, 8.5, 'https://images.unsplash.com/photo-1586191582151-f7396654df42?q=80&w=400'),
    ('Scania R 450', 'XYZ-9876', 89200, 'ativo', true, 9.0, 'https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?q=80&w=400'),
    ('Mercedes-Benz Actros', 'DEF-5678', 45000, 'ativo', true, 7.5, 'https://images.unsplash.com/photo-1591768793355-74d7c514c337?q=80&w=400'),
    ('VW Constellation', 'GHI-9012', 210000, 'inativo', true, 10.0, 'https://images.unsplash.com/photo-1542441526-78c92ba3052c?q=80&w=400')
ON CONFLICT DO NOTHING;

-- Projects
INSERT INTO projects (nome, rubrica_abastecimento, saldo, ativo) VALUES
    ('Logística Agrícola', 50000, 42400, true),
    ('Distribuição Urbana', 30000, 28150, true),
    ('Mineração Sul', 20000, 15900, true)
ON CONFLICT DO NOTHING;

-- Checklist Items
INSERT INTO checklist_items (nome, ativo, ordem) VALUES
    ('Nível de Óleo', true, 1),
    ('Pressão dos Pneus', true, 2),
    ('Luzes de Freio', true, 3),
    ('Estado do Estepe', true, 4),
    ('Limpeza Interna', true, 5)
ON CONFLICT DO NOTHING;

-- Maintenance Rules
INSERT INTO maintenance_rules (nome, intervalo_km, icone) VALUES
    ('Óleo do Motor', 5000, 'oil_barrel'),
    ('Filtro de Óleo', 5000, 'filter_alt'),
    ('Filtro de Combustível', 5000, 'gas_meter'),
    ('Filtro de Ar', 5000, 'air'),
    ('Alinhamento', 1000, 'straighten'),
    ('Balanceamento', 1000, 'settings_backup_restore'),
    ('Cambagem', 1000, 'architecture'),
    ('Correia Dentada / Corrente', 45000, 'handyman'),
    ('Velas / Cabo de Vela', 30000, 'electric_bolt')
ON CONFLICT DO NOTHING;

INSERT INTO settings (id, preco_combustivel, google_maps_key, nome_sistema, subtitulo_sistema, logo_url, favicon_url)
VALUES (1, 5.85, '', 'Gestão de Frotas', '', '', '')
ON CONFLICT (id) DO NOTHING;
