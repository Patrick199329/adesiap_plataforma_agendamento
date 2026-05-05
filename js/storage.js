/**
 * FrotaFlow Storage & Data Manager — Supabase Edition
 * Camada de dados com cache local para leitura síncrona
 * e escrita assíncrona via Supabase.
 */

// ============================================================
// Helpers: snake_case ↔ camelCase
// ============================================================
// Special field name mappings (snake → camel) for edge cases
const FIELD_REMAP_TO_CAMEL = {
    'intervalo_km': 'intervaloKM',
    'km_realizada': 'kmRealizada',
    'usuario_nome': 'usuarioNome',
    'regra_id': 'regraId',
    'checklist_saida': 'checklistSaida',
    'checklist_retorno': 'checklistRetorno',
    'data_saida': 'dataSaida',
    'data_chegada': 'dataChegada',
    'data_conclusao': 'dataConclusao',
    'data_registro': 'dataRegistro',
    'data_correcao': 'dataCorrecao',
    'km_inicial': 'kmInicial',
    'km_final': 'kmFinal',
    'distancia_prevista': 'distanciaPrevista',
    'has_inconformity': 'hasInconformity',
    'veiculo_id': 'veiculoId',
    'motorista_id': 'motoristaId',
    'projeto_id': 'projetoId',
    'booking_id': 'bookingId',
    'criado_por': 'criadoPor',
    'rubrica_abastecimento': 'rubricaAbastecimento',
    'trocar_senha': 'trocarSenha',
    'criado_em': 'criadoEm',
    'preco_combustivel': 'precoCombustivel',
    'google_maps_key': 'googleMapsKey',
    'nome_sistema': 'nomeSistema',
    'subtitulo_sistema': 'subtituloSistema',
    'logo_url': 'logoUrl',
    'favicon_url': 'faviconUrl',
    'foto_url': 'fotoUrl',
    'created_at': 'createdAt'
};

const FIELD_REMAP_TO_SNAKE = {};
for (const [snake, camel] of Object.entries(FIELD_REMAP_TO_CAMEL)) {
    FIELD_REMAP_TO_SNAKE[camel] = snake;
}

function _toCamel(obj) {
    if (Array.isArray(obj)) return obj.map(_toCamel);
    if (obj === null || obj === undefined || typeof obj !== 'object') return obj;
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
        const camelKey = FIELD_REMAP_TO_CAMEL[key] || key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
        result[camelKey] = value;
    }
    return result;
}

function _toSnake(obj) {
    if (obj === null || obj === undefined || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(_toSnake);
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
        const snakeKey = FIELD_REMAP_TO_SNAKE[key] || key.replace(/[A-Z]/g, c => '_' + c.toLowerCase());
        result[snakeKey] = value;
    }
    return result;
}

// ============================================================
// Storage Object (Cache + Supabase)
// ============================================================
const Storage = {
    _cache: {
        vehicles: [],
        users: [],
        projects: [],
        bookings: [],
        checklistItems: [],
        maintenanceRules: [],
        maintenanceLogs: [],
        fuelLogs: [],
        corrections: [],
        settings: {},
        currentUser: null
    },

    // ----------------------------------------------------------
    // Initialization
    // ----------------------------------------------------------
    async init() {
        try {
            await this.loadSettings(); // First thing: load branding
            await this._loadCurrentUser();
            if (this._cache.currentUser) {
                await this._loadAllData();
                this.autoCloseLateBookings();
            }
            console.log('FrotaFlow: Storage inicializado via Supabase.');
        } catch (error) {
            console.error('FrotaFlow: Erro na inicializaçao:', error);
        }
    },

    async loadSettings() {
        try {
            const { data, error } = await supabaseClient.from('settings').select('*').eq('id', 1).single();
            if (error) throw error;
            this._cache.settings = data ? _toCamel(data) : this._defaultSettings();
        } catch (error) {
            console.warn('Storage: Usando configurações padrão.', error.message);
            this._cache.settings = this._defaultSettings();
        }
    },

    async _loadCurrentUser() {
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (user) {
            const { data: profile } = await supabaseClient
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();
            this._cache.currentUser = profile ? _toCamel(profile) : null;
        } else {
            this._cache.currentUser = null;
        }
    },

    async _loadAllData() {
        console.log('Storage: Carregando dados do banco...');
        try {
            // Executamos as queries em paralelo, mas com tratamento individual para evitar que uma falha trave tudo
            const fetchTable = async (table, orderCol, ascending = true) => {
                const { data, error } = await supabaseClient.from(table).select('*').order(orderCol, { ascending });
                if (error) {
                    console.error(`Storage: Erro ao carregar tabela ${table}:`, error);
                    return [];
                }
                return data || [];
            };

            const [vehicles, users, projects, bookings, checklistItems, maintenanceRules, maintenanceLogs, fuelLogs, corrections] = await Promise.all([
                fetchTable('vehicles', 'nome'),
                fetchTable('profiles', 'nome'),
                fetchTable('projects', 'nome'),
                fetchTable('bookings', 'data_saida', false),
                fetchTable('checklist_items', 'ordem'),
                fetchTable('maintenance_rules', 'nome'),
                fetchTable('maintenance_logs', 'data', false),
                fetchTable('fuel_logs', 'data', false),
                fetchTable('corrections', 'data_registro', false)
            ]);

            this._cache.vehicles = _toCamel(vehicles);
            this._cache.users = _toCamel(users);
            this._cache.projects = _toCamel(projects);
            this._cache.bookings = _toCamel(bookings);
            this._cache.checklistItems = _toCamel(checklistItems);
            this._cache.maintenanceRules = _toCamel(maintenanceRules);
            this._cache.maintenanceLogs = _toCamel(maintenanceLogs);
            this._cache.fuelLogs = _toCamel(fuelLogs);
            this._cache.corrections = _toCamel(corrections);
            
            console.log('Storage: Todos os dados carregados com sucesso.');
        } catch (error) {
            console.error('Storage: Falha inesperada ao carregar dados:', error);
            throw error; // Repassa para o init() tratar
        }
    },

    _defaultSettings() {
        return {
            precoCombustivel: 5.85,
            googleMapsKey: '',
            nomeSistema: 'Gestão de Frotas',
            subtituloSistema: '',
            logoUrl: '',
            faviconUrl: ''
        };
    },

    // ----------------------------------------------------------
    // Auto-close late bookings (runs client-side on init)
    // ----------------------------------------------------------
    async autoCloseLateBookings() {
        const now = new Date().getTime();
        const twentyFourHours = 24 * 60 * 60 * 1000;
        let changed = false;

        for (const b of this._cache.bookings) {
            if (b.status === 'em_curso') {
                const arrivalTime = new Date(b.dataChegada).getTime();
                if (now > (arrivalTime + twentyFourHours)) {
                    const kmFinal = b.kmInicial + (b.distanciaPrevista || 0);
                    const dataConclusao = new Date().toISOString();

                    await supabaseClient.from('bookings').update(_toSnake({
                        status: 'concluido',
                        kmFinal: kmFinal,
                        dataConclusao: dataConclusao
                    })).eq('id', b.id);

                    // Update vehicle
                    await supabaseClient.from('vehicles').update({
                        km: kmFinal,
                        disponivel: true
                    }).eq('id', b.veiculoId);

                    changed = true;
                }
            }
        }

        if (changed) {
            await this._loadAllData();
            console.log('FrotaFlow: Agendamentos em atraso finalizados automaticamente.');
        }
    },

    // ----------------------------------------------------------
    // SYNC Getters (read from cache)
    // ----------------------------------------------------------
    getVehicles() { return this._cache.vehicles; },
    getUsers() { return this._cache.users; },
    getProjects() { return this._cache.projects; },
    getBookings() { return this._cache.bookings; },
    getChecklistItems() { return this._cache.checklistItems; },
    getMaintenanceRules() { return this._cache.maintenanceRules; },
    getMaintenanceLogs() { return this._cache.maintenanceLogs; },
    getFuelLogs() { return this._cache.fuelLogs; },
    getCorrections() { return this._cache.corrections; },

    getSettings() {
        return { ...this._defaultSettings(), ...this._cache.settings };
    },

    getLoggedInUser() {
        return this._cache.currentUser;
    },

    // ----------------------------------------------------------
    // ASYNC Mutators — Vehicles
    // ----------------------------------------------------------
    async saveVehicle(vehicle) {
        if (vehicle.id) {
            await supabaseClient.from('vehicles')
                .update(_toSnake(vehicle))
                .eq('id', vehicle.id);
        } else {
            await supabaseClient.from('vehicles')
                .insert(_toSnake(vehicle));
        }
        await this._refreshTable('vehicles');
    },

    async deleteVehicle(id) {
        await supabaseClient.from('vehicles').delete().eq('id', id);
        await this._refreshTable('vehicles');
    },

    async updateVehicleStatus(id, disponivel) {
        await supabaseClient.from('vehicles').update({ disponivel }).eq('id', id);
        await this._refreshTable('vehicles');
    },

    async setVehicles(data) {
        // Batch update — used internally for km updates etc.
        for (const v of data) {
            await supabaseClient.from('vehicles').update(_toSnake(v)).eq('id', v.id);
        }
        await this._refreshTable('vehicles');
    },

    // ----------------------------------------------------------
    // ASYNC Mutators — Users/Profiles
    // ----------------------------------------------------------
    async setUsers(data) {
        for (const u of data) {
            const snake = _toSnake(u);
            delete snake.senha; // Never store password in profiles
            delete snake.email; // Email is managed by auth.users
            await supabaseClient.from('profiles').update(snake).eq('id', u.id);
        }
        await this._refreshTable('users');
    },

    async saveProfile(profile) {
        const snake = _toSnake(profile);
        delete snake.senha;
        await supabaseClient.from('profiles').update(snake).eq('id', profile.id);
        await this._refreshTable('users');
    },

    async createUser(userData) {
        // Create auth user with a non-persistent client (won't log out admin)
        const { createClient: createTempClient } = supabase;
        const tempClient = createTempClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            auth: { persistSession: false }
        });

        const { data, error } = await tempClient.auth.signUp({
            email: userData.email,
            password: userData.senha || 'FF@123',
            options: {
                data: {
                    nome: userData.nome,
                    departamento: userData.departamento,
                    tipo: userData.tipo,
                    trocarSenha: true
                }
            }
        });

        if (error) throw error;

        // Wait briefly for the trigger to create the profile
        await new Promise(r => setTimeout(r, 1000));
        await this._refreshTable('users');
        return data;
    },

    // Session -- now handled by Supabase Auth
    setLoggedInUser(user) {
        this._cache.currentUser = user;
    },

    async logout() {
        await supabaseClient.auth.signOut();
        this._cache.currentUser = null;
        // Clear all caches
        Object.keys(this._cache).forEach(key => {
            if (Array.isArray(this._cache[key])) this._cache[key] = [];
            else if (key === 'settings') this._cache[key] = this._defaultSettings();
            else this._cache[key] = null;
        });
    },

    // ----------------------------------------------------------
    // ASYNC Mutators — Projects
    // ----------------------------------------------------------
    async setProjects(data) {
        for (const p of data) {
            await supabaseClient.from('projects').update(_toSnake(p)).eq('id', p.id);
        }
        await this._refreshTable('projects');
    },

    async saveProject(project) {
        if (project.id) {
            await supabaseClient.from('projects').update(_toSnake(project)).eq('id', project.id);
        } else {
            await supabaseClient.from('projects').insert(_toSnake(project));
        }
        await this._refreshTable('projects');
    },

    async deleteProject(id) {
        await supabaseClient.from('projects').delete().eq('id', id);
        await this._refreshTable('projects');
    },

    // ----------------------------------------------------------
    // ASYNC Mutators — Bookings
    // ----------------------------------------------------------
    async setBookings(data) {
        for (const b of data) {
            await supabaseClient.from('bookings').update(_toSnake(b)).eq('id', b.id);
        }
        await this._refreshTable('bookings');
    },

    async createBooking(bookingData) {
        const { data, error } = await supabaseClient.from('bookings')
            .insert(_toSnake(bookingData))
            .select()
            .single();
        if (error) console.error('Erro ao criar agendamento:', error);
        await this._refreshTable('bookings');
        return data ? _toCamel(data) : null;
    },

    async updateBooking(id, updateData) {
        await supabaseClient.from('bookings')
            .update(_toSnake(updateData))
            .eq('id', id);
        await this._refreshTable('bookings');
    },

    async cancelBooking(id) {
        const booking = this.getBookings().find(b => b.id === id);
        if (booking) {
            await supabaseClient.from('bookings')
                .update({ status: 'cancelado' })
                .eq('id', id);
            await supabaseClient.from('vehicles')
                .update({ disponivel: true })
                .eq('id', booking.veiculoId);
            await this._refreshTable('bookings');
            await this._refreshTable('vehicles');
            return true;
        }
        return false;
    },

    // ----------------------------------------------------------
    // ASYNC Mutators — Fuel Logs
    // ----------------------------------------------------------
    async saveFuelEntry(entry) {
        const fuelData = {
            veiculoId: entry.veiculoId,
            bookingId: entry.bookingId,
            projetoId: entry.projetoId,
            km: entry.km,
            valor: parseFloat(entry.valor),
            foto: entry.foto || ''
        };

        if (entry.id) {
            // Se for edição, precisamos ajustar o saldo do projeto (estornar o antigo e aplicar o novo)
            const oldEntry = this._cache.fuelLogs.find(f => f.id === entry.id);
            if (oldEntry && oldEntry.projetoId && oldEntry.valor) {
                const project = this.getProjects().find(p => p.id === oldEntry.projetoId);
                if (project) {
                    // Estorna o valor antigo
                    await supabaseClient.from('projects')
                        .update({ saldo: project.saldo + oldEntry.valor })
                        .eq('id', oldEntry.projetoId);
                }
            }
            
            await supabaseClient.from('fuel_logs')
                .update(_toSnake(fuelData))
                .eq('id', entry.id);
        } else {
            await supabaseClient.from('fuel_logs').insert(_toSnake(fuelData));
        }

        // Update project balance with the new value
        if (entry.projetoId && entry.valor) {
            const project = this.getProjects().find(p => p.id === entry.projetoId);
            if (project) {
                // Se acabamos de estornar acima, precisamos pegar o saldo atualizado do cache ou do banco?
                // O ideal é recarregar os projetos ou usar o valor que sabemos que mudou.
                // Para simplificar, vamos usar o valor direto no banco.
                const { data: updatedProj } = await supabaseClient.from('projects').select('saldo').eq('id', entry.projetoId).single();
                const currentSaldo = updatedProj ? updatedProj.saldo : project.saldo;
                
                await supabaseClient.from('projects')
                    .update({ saldo: currentSaldo - entry.valor })
                    .eq('id', entry.projetoId);
            }
        }

        // Update vehicle km (only if it's the latest KM)
        if (entry.veiculoId && entry.km) {
            const vehicle = this.getVehicles().find(v => v.id === entry.veiculoId);
            if (vehicle && entry.km > vehicle.km) {
                await supabaseClient.from('vehicles')
                    .update({ km: entry.km })
                    .eq('id', entry.veiculoId);
            }
        }

        await Promise.all([
            this._refreshTable('fuelLogs'),
            this._refreshTable('projects'),
            this._refreshTable('vehicles')
        ]);
    },

    async deleteFuelEntry(id) {
        const entry = this._cache.fuelLogs.find(f => f.id === id);
        if (entry) {
            // Estorna saldo do projeto
            if (entry.projetoId && entry.valor) {
                const project = this.getProjects().find(p => p.id === entry.projetoId);
                if (project) {
                    await supabaseClient.from('projects')
                        .update({ saldo: project.saldo + entry.valor })
                        .eq('id', entry.projetoId);
                }
            }
            await supabaseClient.from('fuel_logs').delete().eq('id', id);
            await Promise.all([
                this._refreshTable('fuelLogs'),
                this._refreshTable('projects')
            ]);
            return true;
        }
        return false;
    },

    // ----------------------------------------------------------
    // ASYNC Mutators — Checklist Items
    // ----------------------------------------------------------
    async setChecklistItems(data) {
        // For simple cases: delete all and re-insert
        // But safer: upsert each item
        for (const item of data) {
            const snake = _toSnake(item);
            if (item.id && !item.id.startsWith('chk_')) {
                await supabaseClient.from('checklist_items').update(snake).eq('id', item.id);
            } else {
                delete snake.id; // Let DB generate UUID
                await supabaseClient.from('checklist_items').insert(snake);
            }
        }
        await this._refreshTable('checklistItems');
    },

    async addChecklistItem(nome) {
        await supabaseClient.from('checklist_items').insert({
            nome: nome,
            ativo: true,
            ordem: this._cache.checklistItems.length + 1
        });
        await this._refreshTable('checklistItems');
    },

    async deleteChecklistItem(id) {
        await supabaseClient.from('checklist_items').delete().eq('id', id);
        await this._refreshTable('checklistItems');
    },

    // ----------------------------------------------------------
    // ASYNC Mutators — Corrections
    // ----------------------------------------------------------
    async saveCorrection(entry) {
        const correctionData = {
            veiculoId: entry.veiculoId,
            responsavel: entry.responsavel || '',
            results: entry.results || [],
            hasInconformity: entry.results?.some(r => r.status === 'nok') || false,
            dataCorrecao: entry.data || null
        };
        await supabaseClient.from('corrections').insert(_toSnake(correctionData));
        await this._refreshTable('corrections');
    },

    async deleteCorrection(id) {
        await supabaseClient.from('corrections').delete().eq('id', id);
        await this._refreshTable('corrections');
    },

    getPendingInconformities(vehicleId) {
        const bookings = this.getBookings().filter(b => b.veiculoId === vehicleId);
        const corrections = this.getCorrections().filter(c => c.veiculoId === vehicleId);
        const nokItems = {};

        // Collect all events chronologically
        const events = [];
        bookings.forEach(b => {
            if (b.checklistSaida) events.push({ data: b.checklistSaida.data, results: b.checklistSaida.results });
            if (b.checklistRetorno) events.push({ data: b.checklistRetorno.data, results: b.checklistRetorno.results });
        });
        corrections.forEach(c => {
            events.push({ data: c.dataRegistro, results: c.results });
        });

        events.sort((a, b) => new Date(a.data) - new Date(b.data));

        events.forEach(event => {
            if (event.results) {
                event.results.forEach(r => {
                    if (r.status === 'nok') {
                        nokItems[r.nome] = {
                            data: event.data,
                            observacao: r.observacao,
                            foto: r.fotoData
                        };
                    } else if (r.status === 'ok') {
                        delete nokItems[r.nome];
                    }
                });
            }
        });

        return Object.entries(nokItems).map(([nome, details]) => ({ nome, ...details }));
    },

    // ----------------------------------------------------------
    // ASYNC Mutators — Maintenance
    // ----------------------------------------------------------
    async saveMaintenanceRule(rule) {
        const snake = _toSnake(rule);
        if (rule.id) {
            await supabaseClient.from('maintenance_rules').update(snake).eq('id', rule.id);
        } else {
            delete snake.id;
            await supabaseClient.from('maintenance_rules').insert(snake);
        }
        await this._refreshTable('maintenanceRules');
    },

    async deleteMaintenanceRule(id) {
        await supabaseClient.from('maintenance_rules').delete().eq('id', id);
        await this._refreshTable('maintenanceRules');
    },

    async saveMaintenanceLog(log) {
        const logData = { ...log };
        delete logData.id; // Let DB generate UUID
        await supabaseClient.from('maintenance_logs').insert(_toSnake(logData));

        // Update vehicle km
        if (log.kmRealizada && log.veiculoId) {
            const vehicle = this.getVehicles().find(v => v.id === log.veiculoId);
            if (vehicle && log.kmRealizada > vehicle.km) {
                await supabaseClient.from('vehicles')
                    .update({ km: log.kmRealizada })
                    .eq('id', log.veiculoId);
            }
        }

        // Deduct from project balance
        if (log.valor && log.projetoId) {
            const project = this.getProjects().find(p => p.id === log.projetoId);
            if (project) {
                await supabaseClient.from('projects')
                    .update({ saldo: project.saldo - parseFloat(log.valor) })
                    .eq('id', log.projetoId);
            }
        }

        await Promise.all([
            this._refreshTable('maintenanceLogs'),
            this._refreshTable('vehicles'),
            this._refreshTable('projects')
        ]);
    },

    calculateMaintenanceStatus(vehicleId) {
        const vehicle = this.getVehicles().find(v => v.id === vehicleId);
        if (!vehicle) return [];

        const rules = this.getMaintenanceRules();
        const logs = this.getMaintenanceLogs().filter(l => l.veiculoId === vehicleId);

        return rules.map(rule => {
            const lastService = logs
                .filter(l => l.regraId === rule.id)
                .sort((a, b) => b.kmRealizada - a.kmRealizada)[0];

            const kmSinceLast = lastService ? (vehicle.km - lastService.kmRealizada) : vehicle.km;
            const kmRemaining = rule.intervaloKM - kmSinceLast;

            let status = 'success';
            if (kmRemaining <= 0) status = 'error';
            else if (kmRemaining <= 500) status = 'warning';

            return {
                ...rule,
                kmSinceLast,
                kmRemaining,
                status
            };
        });
    },

    // ----------------------------------------------------------
    // ASYNC Mutators — Settings
    // ----------------------------------------------------------
    async setSettings(data) {
        const snake = _toSnake(data);
        snake.id = 1;
        await supabaseClient.from('settings').upsert(snake);
        await this._refreshTable('settings');
    },

    // ----------------------------------------------------------
    // Legacy compatibility — setData (used by some app.js actions)
    // ----------------------------------------------------------
    async setData(key, data) {
        // Map legacy localStorage keys to Supabase table operations
        const keyMap = {
            'ff_bookings': 'bookings',
            'ff_users': 'users',
            'ff_projects': 'projects',
            'ff_vehicles': 'vehicles',
            'ff_checklist_items': 'checklistItems',
            'ff_maintenance_rules': 'maintenanceRules',
            'ff_maintenance_logs': 'maintenanceLogs',
            'ff_fuel_logs': 'fuelLogs',
            'ff_corrections': 'corrections'
        };

        console.warn('FrotaFlow: setData() called with legacy key:', key, '— use specific methods instead.');

        const tableName = keyMap[key];
        if (!tableName) return;

        // For array-based setData, we need to handle creates vs updates
        if (Array.isArray(data)) {
            const existingIds = this._cache[tableName].map(item => item.id);
            for (const item of data) {
                const snake = _toSnake(item);
                if (existingIds.includes(item.id)) {
                    await supabaseClient.from(this._tableNameForKey(tableName)).update(snake).eq('id', item.id);
                } else {
                    delete snake.id; // Remove non-UUID ids like 'b1234567'
                    await supabaseClient.from(this._tableNameForKey(tableName)).insert(snake);
                }
            }
            await this._refreshTable(tableName);
        }
    },

    _tableNameForKey(cacheKey) {
        const map = {
            'vehicles': 'vehicles',
            'users': 'profiles',
            'projects': 'projects',
            'bookings': 'bookings',
            'checklistItems': 'checklist_items',
            'maintenanceRules': 'maintenance_rules',
            'maintenanceLogs': 'maintenance_logs',
            'fuelLogs': 'fuel_logs',
            'corrections': 'corrections'
        };
        return map[cacheKey] || cacheKey;
    },

    // ----------------------------------------------------------
    // Cache Refresh
    // ----------------------------------------------------------
    async _refreshTable(tableName) {
        const fetchMap = {
            vehicles: async () => {
                const { data } = await supabaseClient.from('vehicles').select('*').order('nome');
                this._cache.vehicles = _toCamel(data || []);
            },
            users: async () => {
                const { data } = await supabaseClient.from('profiles').select('*').order('nome');
                this._cache.users = _toCamel(data || []);
            },
            projects: async () => {
                const { data } = await supabaseClient.from('projects').select('*').order('nome');
                this._cache.projects = _toCamel(data || []);
            },
            bookings: async () => {
                const { data } = await supabaseClient.from('bookings').select('*').order('data_saida', { ascending: false });
                this._cache.bookings = _toCamel(data || []);
            },
            checklistItems: async () => {
                const { data } = await supabaseClient.from('checklist_items').select('*').order('ordem');
                this._cache.checklistItems = _toCamel(data || []);
            },
            maintenanceRules: async () => {
                const { data } = await supabaseClient.from('maintenance_rules').select('*').order('nome');
                this._cache.maintenanceRules = _toCamel(data || []);
            },
            maintenanceLogs: async () => {
                const { data } = await supabaseClient.from('maintenance_logs').select('*').order('data', { ascending: false });
                this._cache.maintenanceLogs = _toCamel(data || []);
            },
            fuelLogs: async () => {
                const { data } = await supabaseClient.from('fuel_logs').select('*').order('data', { ascending: false });
                this._cache.fuelLogs = _toCamel(data || []);
            },
            corrections: async () => {
                const { data } = await supabaseClient.from('corrections').select('*').order('data_registro', { ascending: false });
                this._cache.corrections = _toCamel(data || []);
            },
            settings: async () => {
                const { data } = await supabaseClient.from('settings').select('*').eq('id', 1).single();
                this._cache.settings = data ? _toCamel(data) : this._defaultSettings();
            }
        };

        if (fetchMap[tableName]) {
            await fetchMap[tableName]();
        }
    }
};

// Note: init() is called by App.init() — NOT here anymore
// (since init is async and depends on auth state)
