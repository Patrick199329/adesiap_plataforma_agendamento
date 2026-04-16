/**
 * FrotaFlow Storage & Data Manager
 * Gerencia a persistência no LocalStorage e provê dados iniciais.
 */

const STORAGE_KEYS = {
    VEHICLES: 'ff_vehicles',
    USERS: 'ff_users',
    PROJECTS: 'ff_projects',
    BOOKINGS: 'ff_bookings',
    CHECKLIST_ITEMS: 'ff_checklist_items',
    MAINTENANCE_LOGS: 'ff_maintenance_logs',
    FUEL_LOGS: 'ff_fuel_logs',
    CORRECTIONS: 'ff_corrections',
    SESSION: 'ff_session',
    SETTINGS: 'ff_settings'
};

const DEFAULT_DATA = {
    veiculos: [
        { id: 'v1', nome: 'Volvo FH 540', placa: 'ABC-1234', km: 125400, status: 'ativo', disponivel: true, consumption: 8.5, foto: 'https://images.unsplash.com/photo-1586191582151-f7396654df42?q=80&w=400' },
        { id: 'v2', nome: 'Scania R 450', placa: 'XYZ-9876', km: 89200, status: 'ativo', disponivel: false, consumption: 9.0, foto: 'https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?q=80&w=400' },
        { id: 'v3', nome: 'Mercedes-Benz Actros', placa: 'DEF-5678', km: 45000, status: 'ativo', disponivel: true, consumption: 7.5, foto: 'https://images.unsplash.com/photo-1591768793355-74d7c514c337?q=80&w=400' },
        { id: 'v4', nome: 'VW Constellation', placa: 'GHI-9012', km: 210000, status: 'inativo', disponivel: true, consumption: 10.0, foto: 'https://images.unsplash.com/photo-1542441526-78c92ba3052c?q=80&w=400' }
    ],
    usuarios: [
        { id: 'u1', nome: 'Patrick Chieza', email: 'patrick@frotaflow.com.br', senha: 'Adesiap@123', departamento: 'Gestão', tipo: 'administrador', ativo: true, trocarSenha: false, criadoEm: '2023-10-01' },
        { id: 'u2', nome: 'Ricardo Alves', email: 'ricardo@frotaflow.com.br', senha: 'FF@123', departamento: 'Logística', tipo: 'logistica', ativo: true, trocarSenha: true, criadoEm: '2023-11-15' },
        { id: 'u3', nome: 'Claudio Santos', email: 'claudio@frotaflow.com.br', senha: 'FF@123', departamento: 'Operacional', tipo: 'motorista', ativo: true, trocarSenha: true, criadoEm: '2024-01-20' }
    ],
    projetos: [
        { id: 'p1', nome: 'Logística Agrícola', rubricaAbastecimento: 50000, saldo: 42400, ativo: true },
        { id: 'p2', nome: 'Distribuição Urbana', rubricaAbastecimento: 30000, saldo: 28150, ativo: true },
        { id: 'p3', nome: 'Mineração Sul', rubricaAbastecimento: 20000, saldo: 15900, ativo: true }
    ],
    checklistItems: [
        { id: 'c1', nome: 'Nível de Óleo', ativo: true },
        { id: 'c2', nome: 'Pressão dos Pneus', ativo: true },
        { id: 'c3', nome: 'Luzes de Freio', ativo: true },
        { id: 'c4', nome: 'Estado do Estepe', ativo: true },
        { id: 'c5', nome: 'Limpeza Interna', ativo: true }
    ],
    maintenanceRules: [
        { id: 'r1', nome: 'Óleo do Motor', intervaloKM: 5000, icone: 'oil_barrel' },
        { id: 'r2', nome: 'Filtro de Óleo', intervaloKM: 5000, icone: 'filter_alt' },
        { id: 'r3', nome: 'Filtro de Combustível', intervaloKM: 5000, icone: 'gas_meter' },
        { id: 'r4', nome: 'Filtro de Ar', intervaloKM: 5000, icone: 'air' },
        { id: 'r5', nome: 'Alinhamento', intervaloKM: 1000, icone: 'straighten' },
        { id: 'r6', nome: 'Balanceamento', intervaloKM: 1000, icone: 'settings_backup_restore' },
        { id: 'r7', nome: 'Cambagem', intervaloKM: 1000, icone: 'architecture' },
        { id: 'r8', nome: 'Correia Dentada / Corrente', intervaloKM: 45000, icone: 'handyman' },
        { id: 'r9', nome: 'Velas / Cabo de Vela', intervaloKM: 30000, icone: 'electric_bolt' }
    ],
    bookings: [
        { 
            id: 'b1', 
            veiculoId: 'v2', 
            motoristaId: 'u3', 
            dataSaida: '2024-05-24T08:00', 
            dataChegada: '2024-05-24T18:00',
            origem: 'Curitiba, PR',
            destino: 'São Paulo, SP',
            kmInicial: 89000,
            kmFinalPrevisto: 89800,
            status: 'em_curso'
        }
    ],
    settings: {
        precoCombustivel: 5.85,
        googleMapsKey: '',
        nomeSistema: 'FrotaFlow',
        subtituloSistema: '',
        logoUrl: '',
        faviconUrl: ''
    }
};

const Storage = {
    init() {
        // Se não houver veículos (primeira vez) ou se o admin novo não existir (migração)
        const vehiclesRaw = localStorage.getItem(STORAGE_KEYS.VEHICLES);
        const usersRaw = localStorage.getItem(STORAGE_KEYS.USERS);
        
        const needsInit = !vehiclesRaw;
        const needsUserMigration = usersRaw && !usersRaw.includes('patrick@frotaflow.com.br');

        if (needsInit) {
            this.setVehicles(DEFAULT_DATA.veiculos);
            this.setUsers(DEFAULT_DATA.usuarios);
            this.setProjects(DEFAULT_DATA.projetos);
            this.setChecklistItems(DEFAULT_DATA.checklistItems);
            this.setBookings(DEFAULT_DATA.bookings);
            this.setData(STORAGE_KEYS.MAINTENANCE_LOGS, []);
            this.setData(STORAGE_KEYS.FUEL_LOGS, []);
            this.setData(STORAGE_KEYS.CORRECTIONS, []);
            this.setData('ff_maintenance_rules', DEFAULT_DATA.maintenanceRules);
            this.setSettings(DEFAULT_DATA.settings);
        } else if (needsUserMigration) {
            this.setUsers(DEFAULT_DATA.usuarios);
            console.log('FrotaFlow: Usuários migrados.');
        }

        // Automação: Fechar viagens em atraso
        this.autoCloseLateBookings();
    },

    autoCloseLateBookings() {
        const bookings = this.getBookings();
        const vehicles = this.getVehicles();
        const now = new Date().getTime();
        const twentyFourHours = 24 * 60 * 60 * 1000;
        let changed = false;

        bookings.forEach(b => {
            if (b.status === 'em_curso') {
                const arrivalTime = new Date(b.dataChegada).getTime();
                if (now > (arrivalTime + twentyFourHours)) {
                    b.status = 'concluido';
                    b.kmFinal = b.kmInicial + (b.distanciaPrevista || 0);
                    b.dataConclusao = new Date().toISOString();
                    
                    // Atualizar KM do veículo
                    const vIndex = vehicles.findIndex(v => v.id === b.veiculoId);
                    if (vIndex >= 0) {
                        vehicles[vIndex].km = b.kmFinal;
                        vehicles[vIndex].disponivel = true;
                    }
                    changed = true;
                }
            }
        });

        if (changed) {
            this.setBookings(bookings);
            this.setVehicles(vehicles);
            console.log('FrotaFlow: Agendamentos em atraso finalizados automaticamente.');
        }
    },

    // Generic Getters/Setters
    getData(key) {
        return JSON.parse(localStorage.getItem(key)) || [];
    },
    setData(key, data) {
        localStorage.setItem(key, JSON.stringify(data));
    },

    // Vehicles
    getVehicles() { return this.getData(STORAGE_KEYS.VEHICLES); },
    setVehicles(data) { this.setData(STORAGE_KEYS.VEHICLES, data); },
    saveVehicle(vehicle) {
        const vehicles = this.getVehicles();
        const index = vehicles.findIndex(v => v.id === vehicle.id);
        if (index >= 0) vehicles[index] = { ...vehicles[index], ...vehicle };
        else vehicles.push({ ...vehicle, id: 'v' + Date.now() });
        this.setVehicles(vehicles);
    },

    deleteVehicle(id) {
        const vehicles = this.getVehicles().filter(v => v.id !== id);
        this.setVehicles(vehicles);
    },

    updateVehicleStatus(id, disponivel) {
        const vehicles = this.getVehicles();
        const index = vehicles.findIndex(v => v.id === id);
        if (index >= 0) {
            vehicles[index].disponivel = disponivel;
            this.setVehicles(vehicles);
        }
    },

    // Users
    getUsers() { return this.getData(STORAGE_KEYS.USERS); },
    setUsers(data) { this.setData(STORAGE_KEYS.USERS, data); },

    // Projects
    getProjects() { return this.getData(STORAGE_KEYS.PROJECTS); },
    setProjects(data) { this.setData(STORAGE_KEYS.PROJECTS, data); },
    deleteProject(id) {
        const projects = this.getProjects().filter(p => p.id !== id);
        this.setProjects(projects);
    },

    // Bookings
    getBookings() { return this.getData(STORAGE_KEYS.BOOKINGS); },
    setBookings(data) { this.setData(STORAGE_KEYS.BOOKINGS, data); },

    // Fuel Logs
    getFuelLogs() { return this.getData(STORAGE_KEYS.FUEL_LOGS) || []; },
    saveFuelEntry(entry) {
        const logs = this.getFuelLogs();
        logs.push({ ...entry, id: 'f' + Date.now(), data: new Date().toISOString() });
        this.setData(STORAGE_KEYS.FUEL_LOGS, logs);

        // Subtrair do Saldo do Projeto
        const projects = this.getProjects();
        const pIndex = projects.findIndex(p => p.id === entry.projetoId);
        if (pIndex >= 0) {
            projects[pIndex].saldo -= entry.valor;
            this.setProjects(projects);
        }

        // Atualizar KM do Veículo
        const vehicles = this.getVehicles();
        const vIndex = vehicles.findIndex(v => v.id === entry.veiculoId);
        if (vIndex >= 0) {
            vehicles[vIndex].km = entry.km;
            this.setVehicles(vehicles);
        }
    },
    updateBooking(id, data) {
        const bookings = this.getBookings();
        const index = bookings.findIndex(b => b.id === id);
        if (index >= 0) {
            bookings[index] = { ...bookings[index], ...data };
            this.setBookings(bookings);
        }
    },

    cancelBooking(id) {
        const bookings = this.getBookings();
        const index = bookings.findIndex(b => b.id === id);
        if (index >= 0) {
            const booking = bookings[index];
            bookings[index].status = 'cancelado';
            this.setBookings(bookings);
            
            // Liberar Veículo
            this.updateVehicleStatus(booking.veiculoId, true);
            return true;
        }
        return false;
    },

    getChecklistItems() { return this.getData(STORAGE_KEYS.CHECKLIST_ITEMS); },
    setChecklistItems(data) { this.setData(STORAGE_KEYS.CHECKLIST_ITEMS, data); },

    // Corrections
    getCorrections() { return this.getData(STORAGE_KEYS.CORRECTIONS) || []; },
    saveCorrection(entry) {
        const corrections = this.getCorrections();
        corrections.push({ 
            ...entry, 
            id: 'cor' + Date.now(), 
            dataRegistro: new Date().toISOString(),
            hasInconformity: entry.results?.some(r => r.status === 'nok') || false
        });
        this.setData(STORAGE_KEYS.CORRECTIONS, corrections);
    },

    deleteCorrection(id) {
        let corrections = this.getCorrections();
        corrections = corrections.filter(c => c.id !== id);
        this.setData(STORAGE_KEYS.CORRECTIONS, corrections);
    },

    getPendingInconformities(vehicleId) {
        const bookings = this.getBookings().filter(b => b.veiculoId === vehicleId);
        const corrections = this.getCorrections().filter(c => c.veiculoId === vehicleId);
        const nokItems = {};
        
        // Coletar todos os eventos cronologicamente
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

    // Session Management
    getLoggedInUser() {
        const session = localStorage.getItem(STORAGE_KEYS.SESSION);
        if (!session) return null;
        const userId = JSON.parse(session).userId;
        return this.getUsers().find(u => u.id === userId);
    },
    setLoggedInUser(user) {
        this.setData(STORAGE_KEYS.SESSION, { userId: user.id, timestamp: Date.now() });
    },
    logout() {
        localStorage.removeItem(STORAGE_KEYS.SESSION);
    },

    // Maintenance
    getMaintenanceRules() { return this.getData('ff_maintenance_rules') || []; },
    setMaintenanceRules(rules) { this.setData('ff_maintenance_rules', rules); },
    getMaintenanceLogs() { return this.getData(STORAGE_KEYS.MAINTENANCE_LOGS) || []; },
    
    saveMaintenanceLog(log) {
        const logs = this.getMaintenanceLogs();
        logs.push({ 
            ...log, 
            id: 'm' + Date.now(), 
            data: log.data || new Date().toISOString() 
        });
        this.setData(STORAGE_KEYS.MAINTENANCE_LOGS, logs);

        // Atualizar KM do veículo
        if (log.kmRealizada && log.veiculoId) {
            const vehicles = this.getVehicles();
            const vIndex = vehicles.findIndex(v => v.id === log.veiculoId);
            if (vIndex >= 0) {
                // Só atualiza se o KM informado for maior que o atual (evita retrocessos acidentais)
                if (log.kmRealizada > vehicles[vIndex].km) {
                    vehicles[vIndex].km = log.kmRealizada;
                    this.setVehicles(vehicles);
                }
            }
        }

        // Se houver valor e projeto, abater do saldo do projeto
        if (log.valor && log.projetoId) {
            const projects = this.getProjects();
            const pIndex = projects.findIndex(p => p.id === log.projetoId);
            if (pIndex >= 0) {
                projects[pIndex].saldo -= parseFloat(log.valor);
                this.setProjects(projects);
            }
        }
    },

    saveMaintenanceRule(rule) {
        const rules = this.getMaintenanceRules();
        const index = rules.findIndex(r => r.id === rule.id);
        if (index >= 0) {
            rules[index] = { ...rules[index], ...rule };
        } else {
            rules.push({ ...rule, id: 'r' + Date.now() });
        }
        this.setMaintenanceRules(rules);
    },

    deleteMaintenanceRule(id) {
        const rules = this.getMaintenanceRules().filter(r => r.id !== id);
        this.setMaintenanceRules(rules);
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
            
            let status = 'success'; // OK
            if (kmRemaining <= 0) status = 'error'; // Crítico
            else if (kmRemaining <= 500) status = 'warning'; // Próximo

            return {
                ...rule,
                kmSinceLast,
                kmRemaining,
                status
            };
        });
    },

    // Settings
    getSettings() {
        const stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.SETTINGS)) || {};
        return { ...DEFAULT_DATA.settings, ...stored };
    },
    setSettings(data) {
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(data));
    }
};

// Initialize on load
Storage.init();
