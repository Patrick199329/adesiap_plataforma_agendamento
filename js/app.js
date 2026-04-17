/**
 * FrotaFlow Main Application Logic
 * Gerencia o roteamento, renderização de views e interações globais.
 */

const App = {
    currentPath: '',
    state: {},
    
    async init() {
        await Storage.init();
        this.utils.applyBranding(); // Aplicar branding o mais rápido possível
        this.loadGoogleMaps();
        window.addEventListener('hashchange', () => this.handleRouting());
        this.handleRouting();
    },

    loadGoogleMaps() {
        const key = Storage.getSettings().googleMapsKey;
        if (key && !window.google) {
            const script = document.createElement('script');
            script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places`;
            script.async = true;
            document.head.appendChild(script);
            console.log('Sistema: Google Maps SDK Injetado.');
        }
    },

    handleRouting() {
        const user = Storage.getLoggedInUser();
        const hash = window.location.hash || '#agendamentos';
        const [path, queryString] = hash.replace('#', '').split('?');
        const params = new URLSearchParams(queryString);

        // UI Prep
        this.updateShellVisibility(user);

        if (!user && path !== 'login') {
            window.location.hash = '#login';
            return;
        }

        if (user && path === 'login') {
            window.location.hash = '#agendamentos';
            return;
        }

        // Check Change Password Force
        if (user && user.trocarSenha && path !== 'trocar-senha' && path !== 'login') {
             window.location.hash = '#trocar-senha';
             return;
        }

        // RBAC Check
        if (user && user.tipo && !this.canAccess(user.tipo, path)) {
            window.location.hash = '#agendamentos';
            return;
        }

        this.currentPath = path;
        
        // Update Sidebar Active State
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.toggle('active', item.getAttribute('data-page') === path);
        });

        this.renderView(path, params);
    },

    canAccess(role, path) {
        if (!path || path === 'agendamentos' || path === 'login' || path === 'trocar-senha') return true;
        if (role === 'administrador') return true;
        
        const restrictions = {
            motorista: ['veiculos', 'usuarios', 'projetos', 'manutencao', 'relatorios', 'custos'],
            logistica: ['usuarios', 'projetos', 'custos']
        };

        if (restrictions[role] && restrictions[role].includes(path)) return false;
        return true;
    },

    updateShellVisibility(user) {
        const sidebar = document.getElementById('sidebar');
        const main = document.querySelector('main');
        const header = document.querySelector('header');

        if (!user) {
            sidebar?.classList.add('hidden');
            if (main) main.classList.remove('lg:ml-64');
            if (header) header.classList.add('hidden');
            document.body.classList.remove('flex'); // Allow login to center
        } else {
            sidebar?.classList.remove('hidden');
            if (main) main.classList.add('lg:ml-64');
            if (header) header.classList.remove('hidden');
            document.body.classList.add('flex');
            
            // Update User Info
            const safeName = user.nome || 'Usuário';
            const safeRole = user.tipo || 'motorista';
            document.getElementById('user-name').textContent = safeName;
            document.getElementById('user-role').textContent = safeRole.charAt(0).toUpperCase() + safeRole.slice(1);

            // Update Avatar with Initials
            const avatar = document.getElementById('user-avatar');
            if (avatar) {
                const names = (user.nome || 'Usuário').split(' ');
                const initials = names.length > 1 
                    ? ((names[0]?.[0] || 'U') + (names[names.length - 1]?.[0] || ''))
                    : (user.nome || 'UU').substring(0, 2);
                avatar.textContent = initials.toUpperCase();
            }

            // Filter Sidebar Items
            document.querySelectorAll('.nav-item').forEach(item => {
                const page = item.getAttribute('data-page');
                item.style.display = this.canAccess(user.tipo, page) ? 'flex' : 'none';
            });
        }
    },

    renderView(path, params) {
        const contentArea = document.getElementById('view-content');
        if (!contentArea) return;

        try {
            // Preservar foco e posição do cursor de forma segura
            const activeElement = document.activeElement;
            const activeId = activeElement ? activeElement.id : null;
            let selectionStart = null;
            let selectionEnd = null;

            try {
                if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
                    selectionStart = activeElement.selectionStart;
                    selectionEnd = activeElement.selectionEnd;
                }
            } catch (e) { /* Ignorar erros de acesso a seleção */ }

            contentArea.innerHTML = ''; // Limpar anterior
            switch(path) {
                case 'login':
                    this.renderLogin(contentArea);
                    break;
                case 'trocar-senha':
                    this.renderTrocarSenha(contentArea);
                    break;
                case 'veiculos':
                    this.renderVehicles(contentArea);
                    break;
                case 'usuarios':
                    this.renderUsers(contentArea);
                    break;
                case 'agendamentos':
                    this.renderAgendamentos(contentArea);
                    break;
                case 'novo-agendamento':
                case 'editar-agendamento':
                    this.renderBookingForm(contentArea, params);
                    break;
                case 'checklist':
                    this.renderChecklist(contentArea, params);
                    break;
                case 'projetos':
                    this.renderProjetos(contentArea);
                    break;
                case 'manutencao':
                    this.renderMaintenance(contentArea);
                    break;
                case 'relatorios':
                    this.renderReports(contentArea);
                    break;
                case 'inspecoes':
                    this.renderAuditoriaChecklist(contentArea);
                    break;
                case 'configuracoes':
                    this.renderSettings(contentArea);
                    break;
                case 'lancamento-correcao':
                    this.renderCorrectionForm(contentArea, params);
                    break;
                default:
                    this.renderAgendamentos(contentArea);
            }

            // Restaurar foco após renderização
            if (activeId) {
                setTimeout(() => {
                    const el = document.getElementById(activeId);
                    if (el) {
                        el.focus();
                        if (selectionStart !== null && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) {
                            el.setSelectionRange(selectionStart, selectionEnd);
                        }
                    }
                }, 0);
            }
        } catch (error) {
            console.error('Erro de renderização:', error);
            contentArea.innerHTML = `
                <div class="h-full flex flex-col items-center justify-center text-center p-10 bg-error/5 rounded-3xl border border-error/10 border-dashed">
                    <div class="w-20 h-20 bg-error/10 text-error rounded-full flex items-center justify-center mb-6">
                        <span class="material-symbols-outlined text-4xl">warning</span>
                    </div>
                    <h2 class="text-2xl font-black text-primary tracking-tight">Ops! Algo deu errado ao carregar esta página.</h2>
                    <p class="text-on-surface-variant max-w-sm mt-3 font-medium opacity-60">
                        Ocorreu um erro técnico na renderização. Tente atualizar a página ou use o botão abaixo para resetar os dados do sistema.
                    </p>
                    <button onclick="App.actions.resetSystem()" class="mt-8 px-8 py-4 bg-error text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-xl shadow-error/20 hover:scale-105 transition-all">
                        Resetar Sistema (Cuidado!)
                    </button>
                    <p class="mt-4 text-[9px] font-bold text-error uppercase tracking-widest">Erro: ${error.message}</p>
                </div>
            `;
        }

        // Restaurar foco após renderização
        if (activeId) {
            const el = document.getElementById(activeId);
            if (el) {
                el.focus();
                // Restaurar cursor se for um campo de texto
                if (selectionStart !== null && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) {
                    el.setSelectionRange(selectionStart, selectionEnd);
                }
            }
        }
    },

    // --- SHARED UI ACTIONS ---

    showModal(title, contentHtml, onConfirm) {
        const modalId = 'app-modal';
        let modal = document.getElementById(modalId);
        if (!modal) {
            modal = document.createElement('div');
            modal.id = modalId;
            modal.className = 'fixed inset-0 z-[100] flex items-center justify-center p-4 bg-primary/40 backdrop-blur-sm animate-in fade-in duration-300';
            document.body.appendChild(modal);
        }

        modal.innerHTML = `
            <div class="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                <div class="p-8 border-b border-surface-container flex justify-between items-center">
                    <h3 class="text-xl font-extrabold text-primary tracking-tight">${title}</h3>
                    <button onclick="App.closeModal()" class="text-on-surface-variant hover:text-primary transition-colors">
                        <span class="material-symbols-outlined">close</span>
                    </button>
                </div>
                <div class="p-8 max-h-[70vh] overflow-y-auto">
                    ${contentHtml}
                </div>
                <div class="p-8 bg-surface-container-low flex justify-end gap-3">
                    <button onclick="App.closeModal()" class="px-6 py-2.5 rounded-xl font-bold text-sm text-on-surface-variant hover:bg-surface-container-high transition-colors uppercase tracking-widest">Cancelar</button>
                    <button id="modal-confirm-btn" class="px-8 py-2.5 bg-primary text-white rounded-xl font-bold text-sm hover:bg-primary-container transition-all shadow-lg shadow-primary/20 uppercase tracking-widest">Confirmar</button>
                </div>
            </div>
        `;

        modal.style.display = 'flex';
        const confirmBtn = document.getElementById('modal-confirm-btn');
        confirmBtn.onclick = async () => {
            const originalText = confirmBtn.innerText;
            confirmBtn.disabled = true;
            confirmBtn.innerText = 'Processando...';
            confirmBtn.classList.add('opacity-50', 'cursor-not-allowed');

            try {
                const result = await onConfirm();
                if (result === true) {
                    App.closeModal();
                } else {
                    // Re-enable if failed validation or intentionally kept open
                    confirmBtn.disabled = false;
                    confirmBtn.innerText = originalText;
                    confirmBtn.classList.remove('opacity-50', 'cursor-not-allowed');
                }
            } catch (error) {
                console.error('Modal Action Error:', error);
                alert('Erro ao processar ação: ' + error.message);
                confirmBtn.disabled = false;
                confirmBtn.innerText = originalText;
                confirmBtn.classList.remove('opacity-50', 'cursor-not-allowed');
            }
        };
    },

    closeModal() {
        const modal = document.getElementById('app-modal');
        if (modal) modal.style.display = 'none';
    },

    // --- AUTH VIEWS ---

    renderLogin(container) {
        const settings = Storage.getSettings();
        container.innerHTML = `
            <div class="min-h-screen md:min-h-[85vh] flex items-center justify-center p-0 md:p-4">
                <div class="w-full max-w-[1000px] h-screen md:h-auto bg-white md:rounded-[2.5rem] shadow-2xl shadow-primary/10 overflow-hidden flex animate-in zoom-in-95 duration-700 border border-outline-variant/5">
                    
                    <!-- Esquerda: Brand Area (Desktop Only) -->
                    <div class="hidden md:flex w-1/2 signature-gradient p-12 flex-col justify-center text-white relative overflow-hidden">
                        <div class="relative z-10">
                            ${settings.loginLogoUrl || settings.logoUrl ? `<img src="${settings.loginLogoUrl || settings.logoUrl}" class="h-16 w-auto mb-8 animate-in slide-in-from-left duration-700">` : `<h1 class="text-4xl font-black tracking-tighter mb-4 text-white">${settings.nomeSistema || 'Sistema'}</h1>`}
                            <h2 class="text-4xl font-extrabold leading-tight tracking-tighter text-white opacity-80">${settings.subtituloSistema || 'Portal de Gestão'}</h2>
                        </div>

                        <!-- Abstract Background Decoration -->
                        <span class="material-symbols-outlined absolute -right-20 -bottom-20 text-[300px] opacity-10 rotate-12 pointer-events-none text-white">local_shipping</span>
                    </div>

                    <!-- Direita: Form Area (Full on mobile) -->
                    <div class="w-full md:w-1/2 p-8 md:p-16 flex flex-col justify-center bg-white">
                        <div class="mb-10 md:hidden text-center">
                             ${settings.logoUrl || settings.loginLogoUrl ? `<img src="${settings.logoUrl || settings.loginLogoUrl}" class="h-12 w-auto mx-auto mb-4">` : `<h1 class="text-3xl font-black text-primary">${settings.nomeSistema}</h1>`}
                        </div>

                        <div class="space-y-2 mb-10">
                            <h3 class="text-2xl font-black text-primary tracking-tight">Login de Usuário</h3>
                            <p class="text-xs font-semibold text-on-surface-variant opacity-60 uppercase tracking-widest leading-relaxed">Acesse o sistema com suas credenciais de acesso</p>
                        </div>

                        <form id="login-form" class="space-y-6">
                            <div class="space-y-2">
                                <label class="text-[10px] font-black text-on-surface-variant uppercase tracking-widest ml-1">Identificador</label>
                                <div class="relative group">
                                    <span class="material-symbols-outlined absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">person</span>
                                    <input id="login-identifier" name="identifier" type="text" placeholder="Usuário ou e-mail" class="w-full bg-surface-container-low border-none rounded-2xl pl-14 pr-5 py-4 text-sm font-bold text-primary focus:ring-4 focus:ring-primary/5 transition-all outline-none" required>
                                </div>
                            </div>

                            <div class="space-y-2">
                                <label class="text-[10px] font-black text-on-surface-variant uppercase tracking-widest ml-1">Senha</label>
                                <div class="relative group">
                                    <span class="material-symbols-outlined absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">lock</span>
                                    <input id="login-password" name="password" type="password" placeholder="••••••••" class="w-full bg-surface-container-low border-none rounded-2xl pl-14 pr-5 py-4 text-sm font-bold text-primary focus:ring-4 focus:ring-primary/5 transition-all outline-none" required>
                                </div>
                            </div>

                            <button type="submit" id="login-submit" class="w-full signature-gradient text-white py-5 rounded-2xl font-black text-xs shadow-2xl shadow-primary/20 hover:scale-[1.01] transition-all uppercase tracking-[0.2em] mt-4">
                                Entrar
                            </button>
                        </form>

                        <div class="mt-12 text-center">
                            <p class="text-[10px] font-bold text-on-surface-variant/40 uppercase tracking-widest leading-loose">
                                Desenvolvido por<br>
                                <span class="text-primary/60">Innovation Consultoria</span>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        setTimeout(() => {
            const form = document.getElementById('login-form');
            if (form) {
                form.onsubmit = (e) => {
                    e.preventDefault();
                    this.actions.login(new FormData(form));
                };
            }
        }, 0);
    },

    renderTrocarSenha(container) {
        container.innerHTML = `
            <div class="h-full flex items-center justify-center -mt-20">
                <div class="bg-white p-12 rounded-3xl shadow-2xl w-full max-w-md space-y-8 animate-in slide-in-from-bottom-8 duration-500">
                    <div class="text-center">
                        <h2 class="text-3xl font-black text-primary tracking-tight">Primeiro Acesso</h2>
                        <p class="text-on-surface-variant font-medium mt-2">Para sua segurança, defina uma nova senha.</p>
                    </div>

                    <form id="change-pwd-form" class="space-y-6">
                        <div class="space-y-2">
                            <label class="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Nova Senha</label>
                            <input name="newPassword" type="password" class="w-full bg-surface-container-low border-none rounded-2xl px-5 py-4 text-sm outline-none" required>
                        </div>
                        <div class="space-y-2">
                            <label class="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Confirmar Senha</label>
                            <input name="confirmPassword" type="password" class="w-full bg-surface-container-low border-none rounded-2xl px-5 py-4 text-sm outline-none" required>
                        </div>
                        <button type="submit" class="w-full bg-emerald-600 text-white py-5 rounded-2xl font-black text-sm shadow-lg hover:bg-emerald-700 transition-all uppercase tracking-widest">
                            Salvar e Continuar
                        </button>
                    </form>
                </div>
            </div>
        `;
        document.getElementById('change-pwd-form').onsubmit = (e) => {
            e.preventDefault();
            this.actions.changePassword(new FormData(e.target));
        };
    },

    // --- VIEWS ---


    renderVehicles(container) {
        const vehicles = Storage.getVehicles();
        const html = `
            <div class="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
                <header class="flex justify-between items-end">
                    <div>
                        <h2 class="text-3xl font-extrabold text-primary tracking-tight">Gestão de Veículos</h2>
                        <p class="text-on-surface-variant font-medium mt-1">Total de ${vehicles.length} veículos cadastrados</p>
                    </div>
                    <button onclick="App.actions.openAddVehicle()" class="bg-primary text-white px-8 py-3 rounded-xl font-bold text-sm flex items-center gap-3 hover:bg-primary-container transition-all shadow-xl shadow-primary/10 uppercase tracking-widest">
                        <span class="material-symbols-outlined">add</span>
                        Cadastrar Veículo
                    </button>
                </header>

                <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                    ${vehicles.length > 0 ? vehicles.map(v => this.components.vehicleCard(v)).join('') : `
                        <div class="md:col-span-2 xl:col-span-3 py-20 text-center space-y-4 opacity-40 italic">
                            <span class="material-symbols-outlined text-6xl mb-2 text-primary/20">minor_crash</span>
                            <p class="text-sm font-bold uppercase tracking-widest">Nenhum veículo cadastrado na frota</p>
                        </div>
                    `}
                </div>
            </div>
        `;
        container.innerHTML = html;
    },

    renderUsers(container) {
        const users = Storage.getUsers();
        const html = `
            <div class="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
                <header class="flex justify-between items-end">
                    <div>
                        <h2 class="text-3xl font-extrabold text-primary tracking-tight">Gestão de Usuários</h2>
                        <p class="text-on-surface-variant font-medium mt-1">Controle de motoristas e administrativos</p>
                    </div>
                    <button onclick="App.actions.openAddUser()" class="bg-primary text-white px-8 py-3 rounded-xl font-bold text-sm flex items-center gap-3 hover:bg-primary-container transition-all uppercase tracking-widest shadow-lg shadow-primary/20">
                        <span class="material-symbols-outlined">person_add</span>
                        Novo Usuário
                    </button>
                </header>

                <div class="bg-white rounded-2xl shadow-sm border border-outline-variant/10 overflow-hidden">
                    <table class="w-full text-left">
                        <thead class="bg-surface-container-low">
                            <tr class="text-on-surface-variant text-[10px] font-black uppercase tracking-[0.2em]">
                                <th class="py-5 px-8">Nome / Departamento</th>
                                <th class="py-5 px-8">Nível de Acesso</th>
                                <th class="py-5 px-8">Status</th>
                                <th class="py-5 px-8 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-surface-container">
                            ${users.map(u => this.components.tableRowUser(u)).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        container.innerHTML = html;
    },

    renderProjetos(container) {
        // Inicializar filtros se não existirem
        if (!this.state.projetosFilters) {
            this.state.projetosFilters = {
                busca: '',
                status: 'all',
                showFilters: false
            };
        }

        const applyFilters = () => {
            let filtered = Storage.getProjects();
            
            if (this.state.projetosFilters.busca) {
                const search = this.state.projetosFilters.busca.toLowerCase();
                filtered = filtered.filter(p => p.nome.toLowerCase().includes(search));
            }

            if (this.state.projetosFilters.status !== 'all') {
                const isActive = this.state.projetosFilters.status === 'ativo';
                filtered = filtered.filter(p => p.ativo === isActive);
            }

            return filtered;
        };

        const projects = applyFilters();
        const html = `
            <div class="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
                <header class="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                    <div>
                        <h2 class="text-3xl font-extrabold text-primary tracking-tight">Gestão de Projetos</h2>
                        <p class="text-on-surface-variant font-medium mt-1">Controle de rubricas e orçamentos operacionais</p>
                    </div>
                    <div class="flex items-center gap-3 w-full md:w-auto">
                        <button onclick="App.utils.toggleProjetosFilterVisibility()" class="flex-1 md:flex-none h-12 w-12 rounded-xl flex items-center justify-center border-2 ${this.state.projetosFilters.showFilters ? 'bg-primary text-white border-primary' : 'bg-white text-primary border-outline-variant/20'} hover:scale-105 transition-all outline-none" title="Filtros">
                            <span class="material-symbols-outlined">filter_list</span>
                        </button>
                        <button onclick="App.actions.openAddProject()" class="flex-[3] md:flex-none bg-primary text-white px-8 py-3 h-12 rounded-xl font-bold text-sm flex items-center gap-3 hover:bg-primary-container transition-all uppercase tracking-widest shadow-lg shadow-primary/20 justify-center">
                            <span class="material-symbols-outlined">account_balance_wallet</span>
                            Novo Projeto
                        </button>
                    </div>
                </header>

                <!-- Barra de Filtros Padronizada -->
                <section class="${this.state.projetosFilters.showFilters ? 'block animate-in slide-in-from-top-4 duration-300' : 'hidden'} bg-surface-container-low p-6 rounded-[2rem] border border-outline-variant/10">
                    <div class="flex flex-wrap items-center gap-6">
                        <div class="flex-1 min-w-[250px] space-y-1.5">
                            <label class="text-[9px] font-black text-on-surface-variant uppercase tracking-widest opacity-40 ml-1">Buscar Projeto</label>
                            <input type="text" id="filter-projetos-search" placeholder="Ex: Logística Norte..." value="${this.state.projetosFilters.busca}" class="w-full bg-white border border-outline-variant/20 rounded-xl px-4 py-2.5 text-xs font-bold text-primary outline-none focus:ring-2 focus:ring-primary/10 transition-all">
                        </div>

                        <div class="flex-1 min-w-[200px] space-y-1.5">
                            <label class="text-[9px] font-black text-on-surface-variant uppercase tracking-widest opacity-40 ml-1">Status</label>
                            <select id="filter-projetos-status" class="w-full bg-white border border-outline-variant/20 rounded-xl px-4 py-2.5 text-xs font-bold text-primary outline-none focus:ring-2 focus:ring-primary/10 transition-all">
                                <option value="all" ${this.state.projetosFilters.status === 'all' ? 'selected' : ''}>Todos os Estados</option>
                                <option value="ativo" ${this.state.projetosFilters.status === 'ativo' ? 'selected' : ''}>Somente Ativos</option>
                                <option value="inativo" ${this.state.projetosFilters.status === 'inativo' ? 'selected' : ''}>Somente Inativos</option>
                            </select>
                        </div>

                        <button onclick="App.utils.resetProjetosFilters()" class="self-end mb-1 p-2.5 text-on-surface-variant hover:text-error transition-all" title="Resetar Filtros">
                            <span class="material-symbols-outlined text-xl">filter_list_off</span>
                        </button>
                    </div>
                </section>

                <div class="bg-white rounded-3xl shadow-sm border border-outline-variant/10 overflow-hidden">
                    <table class="w-full text-left">
                        <thead class="bg-surface-container-low">
                            <tr class="text-on-surface-variant text-[10px] font-black uppercase tracking-[0.2em]">
                                <th class="py-5 px-8">Projeto / Responsável</th>
                                <th class="py-5 px-8">Orçamento Total</th>
                                <th class="py-5 px-8">Saldo Disponível</th>
                                <th class="py-5 px-8">KPI Consumido</th>
                                <th class="py-5 px-8">Status</th>
                                <th class="py-5 px-8 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-surface-container">
                            ${projects.length > 0 ? projects.map(p => this.components.tableRowProject(p)).join('') : `
                                <tr>
                                    <td colspan="6" class="py-20 text-center space-y-4 opacity-40 italic">
                                        <span class="material-symbols-outlined text-5xl mb-2">work_off</span>
                                        <p class="text-sm font-bold uppercase tracking-widest">Nenhum projeto encontrado</p>
                                    </td>
                                </tr>
                            `}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        container.innerHTML = html;

        // Listeners
        if (this.state.projetosFilters.showFilters) {
            const searchInput = document.getElementById('filter-projetos-search');
            if (searchInput) {
                searchInput.oninput = (e) => {
                    this.state.projetosFilters.busca = e.target.value;
                    this.renderView('projetos');
                };
            }
            const statusSelect = document.getElementById('filter-projetos-status');
            if (statusSelect) {
                statusSelect.onchange = (e) => {
                    this.state.projetosFilters.status = e.target.value;
                    this.renderView('projetos');
                };
            }
        }
    },

    renderAgendamentos(container) {
        const user = Storage.getLoggedInUser();
        const users = Storage.getUsers();
        
        // Inicializar filtros padrão se não existirem
        if (!this.state.filters) {
            this.state.filters = {
                motoristaBusca: '',
                dataInicio: '',
                dataFim: '',
                status: ['checklist_pendente', 'em_curso', 'concluido_recent'],
                showFilters: false
            };
        }

        const applyFilters = () => {
            let filtered = Storage.getBookings();
            const now = new Date().getTime();
            const fortyEightHours = 48 * 60 * 60 * 1000;

            return filtered.filter(b => {
                // Filtro de Motorista (Busca Textual)
                if (this.state.filters.motoristaBusca) {
                    const driver = users.find(u => u.id === b.motoristaId);
                    if (!driver || !driver.nome.toLowerCase().includes(this.state.filters.motoristaBusca.toLowerCase())) return false;
                }
                
                // Filtro de Data (Range)
                if (this.state.filters.dataInicio || this.state.filters.dataFim) {
                    const date = b.dataSaida.split('T')[0];
                    if (this.state.filters.dataInicio && date < this.state.filters.dataInicio) return false;
                    if (this.state.filters.dataFim && date > this.state.filters.dataFim) return false;
                }

                // Filtro de Status Complexo
                const isRecent = b.status === 'concluido' && (now - new Date(b.dataConclusao || b.dataChegada).getTime() < fortyEightHours);
                
                const matchStatus = this.state.filters.status.some(s => {
                    if (s === 'concluido_recent') return isRecent;
                    if (s === 'concluido_old') return b.status === 'concluido' && !isRecent;
                    return b.status === s;
                });

                return matchStatus;
            }).sort((a, b) => new Date(b.dataSaida) - new Date(a.dataSaida));
        };

        const filteredBookings = applyFilters();

        const html = `
            <div class="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
                <header class="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                    <div>
                        <h2 class="text-3xl font-extrabold text-primary tracking-tight">Fluxo de Viagens</h2>
                        <p class="text-on-surface-variant font-medium mt-1">Gestão operacional de saídas e retornos</p>
                    </div>
                    <div class="flex items-center gap-3 w-full md:w-auto">
                        <button onclick="App.utils.toggleFilterVisibility()" class="flex-1 md:flex-none h-12 w-12 rounded-xl flex items-center justify-center border-2 ${this.state.filters.showFilters ? 'bg-primary text-white border-primary' : 'bg-white text-primary border-outline-variant/20'} hover:scale-105 transition-all outline-none" title="Filtros">
                            <span class="material-symbols-outlined">filter_list</span>
                        </button>
                        <button onclick="window.location.hash='#novo-agendamento'" class="flex-[3] md:flex-none bg-primary text-white px-8 py-3 h-12 rounded-xl font-bold text-sm flex items-center gap-3 hover:bg-primary-container transition-all uppercase tracking-widest shadow-lg shadow-primary/20 justify-center">
                            <span class="material-symbols-outlined">add_road</span>
                            Nova Viagem
                        </button>
                    </div>
                </header>

                <!-- Barra de Filtros Premium (Condicional) -->
                <section class="${this.state.filters.showFilters ? 'block animate-in slide-in-from-top-4 duration-300' : 'hidden'} bg-surface-container-low p-6 rounded-[2rem] border border-outline-variant/10">
                    <div class="flex flex-wrap items-center gap-6">
                        <div class="flex-1 min-w-[200px] space-y-1.5">
                            <label class="text-[9px] font-black text-on-surface-variant uppercase tracking-widest opacity-40 ml-1">Filtrar Motorista</label>
                            <input type="text" id="filter-user-search" placeholder="Buscar por nome..." value="${this.state.filters.motoristaBusca}" class="w-full bg-white border border-outline-variant/20 rounded-xl px-4 py-2.5 text-xs font-bold text-primary outline-none focus:ring-2 focus:ring-primary/10 transition-all">
                        </div>

                        <div class="flex-1 min-w-[150px] space-y-1.5">
                            <label class="text-[9px] font-black text-on-surface-variant uppercase tracking-widest opacity-40 ml-1">Data Início</label>
                            <input type="date" id="filter-date-start" value="${this.state.filters.dataInicio}" class="w-full bg-white border border-outline-variant/20 rounded-xl px-4 py-2.5 text-xs font-bold text-primary outline-none focus:ring-2 focus:ring-primary/10 transition-all">
                        </div>

                        <div class="flex-1 min-w-[150px] space-y-1.5">
                            <label class="text-[9px] font-black text-on-surface-variant uppercase tracking-widest opacity-40 ml-1">Data Fim</label>
                            <input type="date" id="filter-date-end" value="${this.state.filters.dataFim}" class="w-full bg-white border border-outline-variant/20 rounded-xl px-4 py-2.5 text-xs font-bold text-primary outline-none focus:ring-2 focus:ring-primary/10 transition-all">
                        </div>

                        <div class="flex-[2] min-w-[300px] space-y-1.5">
                            <label class="text-[9px] font-black text-on-surface-variant uppercase tracking-widest opacity-40 ml-1">Status da Operação</label>
                            <div class="flex flex-wrap gap-2">
                                ${[
                                    {id: 'checklist_pendente', label: 'Agendado'},
                                    {id: 'em_curso', label: 'Em Viagem'},
                                    {id: 'concluido_recent', label: 'Finalizado (48h)'},
                                    {id: 'concluido_old', label: 'Histórico'},
                                    {id: 'cancelado', label: 'Cancelado'}
                                ].map(s => `
                                    <button onclick="App.utils.toggleFilterStatus('${s.id}')" class="px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${this.state.filters.status.includes(s.id) ? 'bg-primary text-white shadow-md' : 'bg-white text-on-surface-variant/40 hover:bg-surface-container-high'}">
                                        ${s.label}
                                    </button>
                                `).join('')}
                            </div>
                        </div>

                        <button onclick="App.utils.resetFilters()" class="self-end mb-1 p-2.5 text-on-surface-variant hover:text-error transition-all" title="Resetar Filtros">
                            <span class="material-symbols-outlined text-xl">filter_list_off</span>
                        </button>
                    </div>
                </section>

                ${filteredBookings.length > 0 ? `
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-20">
                        ${filteredBookings.map(b => this.components.bookingCard(b, user)).join('')}
                    </div>
                ` : `
                    <div class="py-20 text-center space-y-4 opacity-40 pointer-events-none">
                        <span class="material-symbols-outlined text-6xl">travel_explore</span>
                        <p class="text-sm font-black uppercase tracking-[0.2em]">Nenhuma viagem encontrada para os filtros selecionados</p>
                    </div>
                `}
            </div>
        `;
        container.innerHTML = html;

        // Listeners para filtros
        if (this.state.filters.showFilters) {
            const searchInput = document.getElementById('filter-user-search');
            if (searchInput) {
                searchInput.oninput = (e) => {
                    this.state.filters.motoristaBusca = e.target.value;
                    this.renderView('agendamentos');
                };
            }
            
            const startInput = document.getElementById('filter-date-start');
            if (startInput) {
                startInput.onchange = (e) => {
                    this.state.filters.dataInicio = e.target.value;
                    this.renderView('agendamentos');
                };
            }

            const endInput = document.getElementById('filter-date-end');
            if (endInput) {
                endInput.onchange = (e) => {
                    this.state.filters.dataFim = e.target.value;
                    this.renderView('agendamentos');
                };
            }
        }
    },

    renderBookingForm(container, params) {
        const bookingId = params?.get('id');
        const booking = bookingId ? Storage.getBookings().find(b => b.id === bookingId) : null;
        
        const vehicles = Storage.getVehicles().filter(v => v.status === 'ativo');
        const users = Storage.getUsers().filter(u => u.ativo);
        const projects = Storage.getProjects();

        // Se estiver editando e a viagem não estiver pendente, restringir campos
        const isRestricted = booking && booking.status !== 'checklist_pendente';

        const html = `
            <div class="max-w-4xl mx-auto space-y-10 animate-in fade-in zoom-in-95 duration-500 pb-20">
                <header>
                    <button onclick="window.history.back()" class="text-on-surface-variant hover:text-primary mb-6 flex items-center gap-2 font-bold text-xs uppercase tracking-widest transition-colors">
                        <span class="material-symbols-outlined text-sm">arrow_back</span>
                        Voltar
                    </button>
                    <h2 class="text-4xl font-extrabold text-primary tracking-tighter">
                        ${booking ? 'Editar Agendamento' : 'Solicitar Veículo'}
                    </h2>
                    <p class="text-on-surface-variant font-medium mt-1">
                        ${booking ? `Editando viagem #${booking.id}` : 'Preencha os detalhes para validar a disponibilidade da frota.'}
                    </p>
                </header>

                <form id="booking-form" class="space-y-12">
                    ${booking ? `<input type="hidden" name="id" value="${booking.id}">` : ''}
                    
                    <!-- Sessão 1: Quando e Quem -->
                    <section class="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div class="space-y-6">
                            <h3 class="text-sm font-black text-primary uppercase tracking-[0.2em] opacity-40">Cronograma</h3>
                            <div class="grid grid-cols-1 gap-4">
                                <div class="space-y-2">
                                    <label class="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Data/Hora Saída</label>
                                    <input name="dataSaida" type="datetime-local" value="${booking ? booking.dataSaida : ''}" 
                                        ${isRestricted ? 'disabled' : ''}
                                        class="w-full bg-white border border-outline-variant/30 rounded-xl px-5 py-4 text-sm focus:ring-4 focus:ring-primary/5 transition-all outline-none" required>
                                </div>
                                <div class="space-y-2">
                                    <label class="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Data/Hora Chegada (Prevista)</label>
                                    <input name="dataChegada" type="datetime-local" value="${booking ? booking.dataChegada : ''}"
                                        ${isRestricted ? 'disabled' : ''}
                                        class="w-full bg-white border border-outline-variant/30 rounded-xl px-5 py-4 text-sm focus:ring-4 focus:ring-primary/5 transition-all outline-none" required>
                                </div>
                            </div>
                        </div>

                        <div class="space-y-6">
                            <h3 class="text-sm font-black text-primary uppercase tracking-[0.2em] opacity-40">Responsável</h3>
                            <div class="space-y-2">
                                <label class="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Motorista</label>
                                <select name="motoristaId" class="w-full bg-white border border-outline-variant/30 rounded-xl px-5 py-4 text-sm focus:ring-4 focus:ring-primary/5 transition-all outline-none appearance-none" ${isRestricted ? 'disabled' : ''}>
                                    ${users.map(u => `<option value="${u.id}" ${booking?.motoristaId === u.id ? 'selected' : ''}>${u.nome} (${u.departamento})</option>`).join('')}
                                </select>
                            </div>
                            <div class="space-y-2">
                                <label class="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Projeto / Centro de Custo</label>
                                <select name="projetoId" class="w-full bg-white border border-outline-variant/30 rounded-xl px-5 py-4 text-sm focus:ring-4 focus:ring-primary/5 transition-all outline-none appearance-none">
                                    ${projects.map(p => `<option value="${p.id}" ${booking?.projetoId === p.id ? 'selected' : ''}>${p.nome}</option>`).join('')}
                                </select>
                            </div>
                        </div>
                    </section>

                    <!-- Sessão 2: Veículo -->
                    <section class="space-y-6 ${isRestricted ? 'opacity-50 pointer-events-none' : ''}">
                         <h3 class="text-sm font-black text-primary uppercase tracking-[0.2em] opacity-40">Seleção de Veículo</h3>
                         <div id="vehicle-availability-list" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            <!-- JS vai preencher baseado na data -->
                            <div class="col-span-full py-8 text-center bg-surface-container-low rounded-2xl border-2 border-dashed border-outline-variant/30">
                                <p class="text-xs font-bold text-on-surface-variant">Consultando disponibilidade...</p>
                            </div>
                         </div>
                    </section>

                    <!-- Sessão 3: Rota e Obs -->
                    <section class="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div class="space-y-6">
                            <h3 class="text-sm font-black text-primary uppercase tracking-[0.2em] opacity-40">Trajeto e Observações</h3>
                            <div class="space-y-4">
                                <div class="space-y-2">
                                    <label class="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Origem</label>
                                    <input id="input-origem" name="origem" type="text" value="${booking ? booking.origem : ''}" 
                                        ${isRestricted ? 'disabled' : ''}
                                        placeholder="Buscar endereço..." class="w-full bg-white border border-outline-variant/30 rounded-xl px-5 py-4 text-sm focus:ring-4 focus:ring-primary/5 transition-all outline-none">
                                </div>
                                <div class="space-y-2">
                                    <label class="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Destino</label>
                                    <input id="input-destino" name="destino" type="text" value="${booking ? booking.destino : ''}" 
                                        ${isRestricted ? 'disabled' : ''}
                                        placeholder="Local de destino..." class="w-full bg-white border border-outline-variant/30 rounded-xl px-5 py-4 text-sm focus:ring-4 focus:ring-primary/5 transition-all outline-none">
                                </div>
                                <div class="space-y-2">
                                    <label class="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Observações da Viagem</label>
                                    <textarea name="observacao" rows="3" placeholder="Detalhes adicionais..." class="w-full bg-white border border-outline-variant/30 rounded-xl px-5 py-4 text-sm focus:ring-4 focus:ring-primary/5 transition-all outline-none resize-none">${booking ? booking.observacao : ''}</textarea>
                                </div>
                            </div>
                        </div>

                        <div class="space-y-6">
                            <h3 class="text-sm font-black text-primary uppercase tracking-[0.2em] opacity-40">Estimativa de Uso</h3>
                            <div class="bg-surface-container-low p-6 rounded-2xl space-y-4 border border-outline-variant/10">
                                <div class="flex justify-between items-center">
                                    <span class="text-xs font-bold text-on-surface-variant">Distância (Ida e Volta)</span>
                                    <span id="calc-km" class="text-sm font-black text-primary">~ ${booking ? booking.distanciaPrevista : '--'} KM</span>
                                    <input type="hidden" name="distanciaPrevista" id="input-distancia" value="${booking ? booking.distanciaPrevista : 0}">
                                </div>
                                <div class="flex justify-between items-center">
                                    <span class="text-xs font-bold text-on-surface-variant">Consumo Estimado</span>
                                    <span id="calc-litros" class="text-sm font-black text-primary">-- L</span>
                                </div>
                                <div class="pt-4 border-t border-outline-variant/20 flex justify-between items-center">
                                    <span class="text-[10px] font-black text-on-surface-variant uppercase tracking-widest opacity-60">Custo Total de Serviço</span>
                                    <span id="calc-custo" class="text-xl font-extrabold text-emerald-600 tracking-tight">R$ --,--</span>
                                </div>
                            </div>
                            <!-- Observação de Trajeto -->
                            <div class="flex gap-3 p-4 bg-primary/5 rounded-xl border border-primary/10 items-start">
                                <span class="material-symbols-outlined text-primary text-lg">info</span>
                                <p class="text-[10px] font-semibold text-primary/70 leading-relaxed italic">
                                    Nota: Os valores de distância e combustível são estimativas para o trajeto de **ida e volta** ao ponto de origem, facilitando o provisionamento de recursos pelo setor financeiro.
                                </p>
                            </div>
                        </div>
                    </section>

                    <footer class="pt-8 border-t border-surface-container flex justify-end gap-4">
                         <button type="button" onclick="window.history.back()" class="px-10 py-4 rounded-xl font-bold text-sm text-on-surface-variant hover:bg-surface-container-high transition-all uppercase tracking-widest">Cancelar</button>
                         <button type="submit" class="px-12 py-4 signature-gradient text-white rounded-xl font-black text-sm hover:scale-[1.02] transition-all shadow-2xl shadow-primary/30 uppercase tracking-[0.1em]">
                            ${booking ? 'Salvar Alterações' : 'Confirmar Solicitação'}
                         </button>
                    </footer>
                </form>
            </div>
        `;
        container.innerHTML = html;

        // Logic for availability
        const form = document.getElementById('booking-form');
        const dateInputs = form.querySelectorAll('input[type="datetime-local"]');
        
        dateInputs.forEach(input => {
            input.addEventListener('change', () => this.utils.updateVehicleAvailability(bookingId));
        });

        // Chamada inicial para preencher disponibilidade se estiver editando
        if (booking) {
            this.utils.updateVehicleAvailability(bookingId, booking.veiculoId);
            setTimeout(() => this.utils.updatePricingEstimates(), 500);
        }

        // --- MAPS & ESTIMATES INTEGRATION ---
        document.addEventListener('change', (e) => {
            if (e.target.name === 'selectedVehicle') {
                this.utils.updatePricingEstimates();
            }
        });

        if (window.google && window.google.maps && window.google.maps.places) {
            const inputOrig = document.getElementById('input-origem');
            const inputDest = document.getElementById('input-destino');
            
            if (inputOrig && inputDest) {
                const autoOrigem = new google.maps.places.Autocomplete(inputOrig, { types: ['geocode', 'establishment'] });
                const autoDestino = new google.maps.places.Autocomplete(inputDest, { types: ['geocode', 'establishment'] });
                
                const calculateRoute = () => {
                    const origin = inputOrig.value;
                    const destination = inputDest.value;
                    if (origin && destination) {
                        const directionsService = new google.maps.DirectionsService();
                        directionsService.route({
                            origin: origin,
                            destination: destination,
                            travelMode: google.maps.TravelMode.DRIVING
                        }, (response, status) => {
                            if (status === 'OK') {
                                // Pega a distância em metros e converte para KM ida e volta (*2)
                                const distanceKm = (response.routes[0].legs[0].distance.value / 1000) * 2;
                                document.getElementById('input-distancia').value = Math.ceil(distanceKm);
                                this.utils.updatePricingEstimates();
                            }
                        });
                    }
                };

                autoOrigem.addListener('place_changed', calculateRoute);
                autoDestino.addListener('place_changed', calculateRoute);
            }
        }

        form.onsubmit = (e) => {
            e.preventDefault();
            this.actions.saveBooking(new FormData(form));
        };
    },

    renderChecklist(container, params) {
        const bookingId = params?.get('id');
        const type = params?.get('type') || 'out'; // 'out' for Saída, 'in' for Retorno
        
        const booking = bookingId ? Storage.getBookings().find(b => b.id === bookingId) : null;
        const vehicle = booking ? Storage.getVehicles().find(v => v.id === booking.veiculoId) : null;
        const items = Storage.getChecklistItems();

        const title = type === 'out' ? 'Checklist de Saída' : 'Checklist de Retorno';
        const subtitle = type === 'out' 
            ? 'Valide as condições do veículo antes de iniciar a jornada.' 
            : 'Registre o estado do veículo ao finalizar a viagem.';

        const html = `
            <div class="max-w-2xl mx-auto space-y-10 animate-in slide-in-from-bottom-8 duration-600 pb-20">
                <header class="text-center relative">
                    <button onclick="window.history.back()" class="absolute left-0 top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center rounded-2xl bg-surface-container-low text-primary hover:bg-primary-container transition-all">
                        <span class="material-symbols-outlined">arrow_back</span>
                    </button>
                    <h2 class="text-4xl font-black text-primary tracking-tighter">${title}</h2>
                    <p class="text-on-surface-variant font-medium mt-2">${subtitle}</p>
                    ${booking ? `
                        <div class="inline-flex items-center gap-4 mt-6 bg-surface-container-low px-6 py-3 rounded-2xl border border-outline-variant/10">
                            <span class="material-symbols-outlined text-primary">local_shipping</span>
                            <div class="text-left leading-tight">
                                <p class="text-xs font-black text-primary uppercase">${vehicle.nome}</p>
                                <p class="text-[10px] font-bold text-on-surface-variant opacity-60">${vehicle.placa}</p>
                            </div>
                        </div>
                    ` : ''}
                </header>

                <form id="checklist-form" class="bg-white rounded-3xl shadow-2xl border border-outline-variant/10 p-10 space-y-8">
                    <input type="hidden" name="bookingId" value="${bookingId || ''}">
                    <input type="hidden" name="type" value="${type}">
                    
                    <div class="grid grid-cols-1 gap-6">
                        <div class="space-y-2">
                             <label class="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">${type === 'out' ? 'KM Inicial (Leitura Atual)' : 'KM Final (Leitura do Painel)'}</label>
                             <input name="km" type="number" value="${type === 'out' ? (vehicle?.km || 0) : ''}" placeholder="Digite o KM atual..." class="w-full bg-surface-container-low border-none rounded-2xl px-5 py-4 text-sm font-bold focus:ring-4 focus:ring-primary/5 transition-all outline-none" required>
                             ${type === 'in' ? `<p class="text-[9px] font-bold text-primary/40 px-2 italic text-right">* KM Estimado via GPS: ${parseInt(booking.kmInicial) + 180}</p>` : ''}
                        </div>
                    </div>

                    <div class="grid grid-cols-1 gap-4">
                         <h3 class="text-[10px] font-black text-on-surface-variant uppercase tracking-[0.2em] mb-2">Ponto de Fiscalização</h3>
                        ${items.map(item => `
                            <div class="border border-outline-variant/10 rounded-2xl overflow-hidden bg-white shadow-sm transition-all has-[.chk-nok:checked]:border-error/50 has-[.chk-nok:checked]:bg-error/5 group">
                                <div class="flex items-center justify-between p-4 bg-surface hover:bg-surface-container-lowest transition-colors">
                                    <span class="text-sm font-bold text-primary max-w-[50%] leading-tight">${item.nome}</span>
                                    <div class="flex items-center gap-3">
                                        <label class="relative cursor-pointer" title="Conforme">
                                            <input type="radio" name="item_${item.id}" value="ok" required class="peer sr-only">
                                            <div class="w-12 h-12 rounded-xl bg-surface-container flex items-center justify-center text-on-surface-variant/40 peer-checked:bg-emerald-100 peer-checked:text-emerald-600 transition-all hover:bg-emerald-50">
                                                <span class="material-symbols-outlined text-xl">thumb_up</span>
                                            </div>
                                        </label>
                                        <label class="relative cursor-pointer" title="Inconforme">
                                            <input type="radio" name="item_${item.id}" value="nok" required class="peer sr-only chk-nok">
                                            <div class="w-12 h-12 rounded-xl bg-surface-container flex items-center justify-center text-on-surface-variant/40 peer-checked:bg-error/10 peer-checked:text-error transition-all hover:bg-error/5">
                                                <span class="material-symbols-outlined text-xl">thumb_down</span>
                                            </div>
                                        </label>
                                    </div>
                                </div>
                                
                                <!-- Evidence block (hidden by default) -->
                                <div class="hidden group-has-[.chk-nok:checked]:block p-5 border-t border-error/10 space-y-4 animate-in slide-in-from-top-2 duration-300">
                                    <div class="space-y-2">
                                        <label class="text-[10px] font-black text-error uppercase tracking-widest flex items-center gap-2">
                                            <span class="material-symbols-outlined text-sm">warning</span>
                                            O que há de errado?
                                        </label>
                                        <textarea name="obs_${item.id}" placeholder="Detalhe a inconformidade encontrada..." class="w-full bg-white border border-error/20 rounded-xl px-5 py-4 text-sm focus:ring-4 focus:ring-error/10 transition-all outline-none resize-none h-24"></textarea>
                                    </div>
                                    <div class="space-y-2">
                                        <label class="text-[10px] font-black text-error uppercase tracking-widest flex items-center gap-2 cursor-pointer w-fit">
                                            <input type="file" name="foto_${item.id}" accept="image/*" capture="environment" class="sr-only">
                                            <div class="bg-white border-2 border-dashed border-error/20 text-center rounded-xl px-6 py-4 text-xs font-black hover:bg-error/10 transition-all text-error flex items-center gap-2 w-full justify-center">
                                                <span class="material-symbols-outlined text-xl">photo_camera</span>
                                                Tirar Foto do Problema
                                            </div>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>

                    <button type="submit" class="w-full signature-gradient text-white py-5 rounded-2xl font-black text-sm shadow-2xl shadow-primary/20 hover:scale-[1.01] transition-all uppercase tracking-[0.2em]">
                        ${type === 'out' ? 'FINALIZAR E INICIAR VIAGEM' : 'CONCLUIR E LIBERAR VEÍCULO'}
                    </button>
                </form>
            </div>
        `;
        container.innerHTML = html;

        const form = document.getElementById('checklist-form');
        
        // Listeners para dar feedback visual na captura de foto
        form.querySelectorAll('input[type="file"]').forEach(input => {
            input.addEventListener('change', (e) => {
                const labelDiv = e.target.nextElementSibling;
                if (e.target.files && e.target.files.length > 0) {
                    // Feedback de Sucesso
                    labelDiv.innerHTML = '<span class="material-symbols-outlined text-xl">check_circle</span> Foto Registrada!';
                    labelDiv.className = 'bg-emerald-50 border-2 border-dashed border-emerald-500 text-center rounded-xl px-6 py-4 text-xs font-black text-emerald-600 flex items-center gap-2 w-full justify-center transition-all';
                } else {
                    // Volta ao Padrão de Erro
                    labelDiv.innerHTML = '<span class="material-symbols-outlined text-xl">photo_camera</span> Tirar Foto do Problema';
                    labelDiv.className = 'bg-white border-2 border-dashed border-error/20 text-center rounded-xl px-6 py-4 text-xs font-black hover:bg-error/10 transition-all text-error flex items-center gap-2 w-full justify-center';
                }
            });
        });

        form.onsubmit = (e) => {
            e.preventDefault();
            this.actions.saveChecklist(new FormData(form));
        };
    },

    // --- COMPONENTS ---

    components: {
        kpiCard(label, value, icon, borderColor) {
            return `
                <div class="bg-white p-8 rounded-2xl border-l-4 ${borderColor} shadow-sm transition-transform hover:scale-[1.02] cursor-default">
                    <div class="flex justify-between items-start mb-4">
                        <p class="text-[10px] font-extrabold text-on-surface-variant uppercase tracking-[0.2em] opacity-60">${label}</p>
                        <span class="material-symbols-outlined text-primary/10 text-4xl">${icon}</span>
                    </div>
                    <div class="flex items-baseline gap-2">
                        <span class="text-5xl font-extrabold text-primary leading-none tracking-tighter">${value}</span>
                        <span class="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">+4%</span>
                    </div>
                </div>
            `;
        },

        alertCard(title, subtitle, icon, type, tag) {
            const colors = type === 'error' ? 'bg-error-container text-on-error-container' : 'bg-surface-container-highest text-primary';
            const tagColors = type === 'error' ? 'bg-error text-white' : 'bg-primary text-white';
            return `
                <div class="bg-white p-5 rounded-xl border border-outline-variant/10 flex items-start gap-5 group hover:bg-surface-container-low transition-colors">
                    <div class="${colors} p-3 rounded-xl">
                        <span class="material-symbols-outlined">${icon}</span>
                    </div>
                    <div class="flex-1">
                        <div class="flex justify-between items-start mb-1">
                            <h4 class="font-extrabold text-primary text-sm">${title}</h4>
                            <span class="${tagColors} text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest">${tag}</span>
                        </div>
                        <p class="text-xs font-semibold text-on-surface-variant">${subtitle}</p>
                        <p class="text-[10px] font-bold text-outline uppercase tracking-wider mt-3 opacity-60">LOG: FLEET-772</p>
                    </div>
                </div>
            `;
        },

        tableRowBooking(booking, vehicles) {
            const vehicle = vehicles.find(v => v.id === booking.veiculoId);
            const statusClass = booking.status === 'em_curso' ? 'bg-blue-50 text-blue-700' : 'bg-surface-container text-on-surface-variant';
            return `
                <tr class="group hover:bg-surface-container-lowest transition-colors">
                    <td class="py-5 px-4">
                        <div class="flex items-center gap-4">
                            <div class="w-10 h-10 rounded-xl bg-surface-container-low flex items-center justify-center text-primary group-hover:bg-white transition-colors">
                                <span class="material-symbols-outlined">local_shipping</span>
                            </div>
                            <div>
                                <p class="text-sm font-extrabold text-primary">${vehicle?.nome || 'Veículo'}</p>
                                <p class="text-xs font-semibold text-on-surface-variant opacity-60">Motorista ID #292</p>
                            </div>
                        </div>
                    </td>
                    <td class="py-5 px-4 text-sm font-bold text-primary">
                        ${booking.destino}
                        <p class="text-[10px] font-semibold text-on-surface-variant opacity-60">ETA: 14:30h</p>
                    </td>
                    <td class="py-5 px-4">
                        <span class="inline-flex items-center px-3 py-1 rounded-full ${statusClass} text-[9px] font-black uppercase tracking-widest">
                            <span class="w-1.5 h-1.5 rounded-full bg-current mr-2 animate-pulse"></span>
                            ${booking.status.replace('_', ' ')}
                        </span>
                    </td>
                    <td class="py-5 px-4">
                        <button class="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-surface-container-low transition-colors">
                            <span class="material-symbols-outlined text-outline">more_vert</span>
                        </button>
                    </td>
                </tr>
            `;
        },

        projectCostRow(project) {
            const rubrica = project.rubricaAbastecimento || 1;
            const saldo = typeof project.saldo === 'number' ? project.saldo : rubrica;
            const usagePercent = Math.min(100, Math.max(0, ((rubrica - saldo) / rubrica) * 100));
            
            return `
                <div>
                    <div class="flex justify-between items-center mb-2">
                        <span class="text-xs font-extrabold opacity-70 uppercase tracking-wider">${project.nome || 'Projeto'}</span>
                        <span class="text-sm font-black text-white">R$ ${(rubrica - saldo).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div class="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                        <div class="h-full bg-white rounded-full transition-all duration-1000" style="width: ${usagePercent}%"></div>
                    </div>
                </div>
            `;
        },

        vehicleCard(vehicle) {
            const statusColor = vehicle.status === 'ativo' ? 'text-emerald-600 bg-emerald-50' : 'text-error bg-error-container';
            const km = (typeof vehicle.km === 'number' && !isNaN(vehicle.km)) ? vehicle.km : 0;
            
            return `
                <div class="bg-white rounded-2xl overflow-hidden shadow-sm border border-outline-variant/10 group hover:shadow-xl transition-all duration-300">
                    <div class="h-48 overflow-hidden relative">
                        <img class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" src="${vehicle.foto || 'https://images.unsplash.com/photo-1542441526-78c92ba3052c?q=80&w=400'}" alt="${vehicle.nome || 'Veículo'}"/>
                        <div class="absolute top-4 right-4">
                            <span class="px-2 py-1 rounded-lg ${statusColor} text-[10px] font-black uppercase tracking-widest border border-white/20 backdrop-blur-md">
                                ${vehicle.status || 'inativo'}
                            </span>
                        </div>
                    </div>
                    <div class="p-6">
                        <div class="flex justify-between items-start mb-4">
                            <div>
                                <h4 class="text-xl font-extrabold text-primary tracking-tight">${vehicle.nome || 'Sem Nome'}</h4>
                                <p class="text-xs font-bold text-on-surface-variant opacity-60">Placa: ${vehicle.placa || '---'}</p>
                            </div>
                            <span class="px-2 py-1 bg-surface-container-low rounded-lg text-primary text-[10px] font-extrabold font-mono">${km.toLocaleString('pt-BR')} KM</span>
                        </div>
                        <div class="flex items-center gap-2 mt-6">
                            <button onclick="App.actions.openEditVehicle('${vehicle.id}')" class="flex-1 bg-surface-container-low text-primary py-3 rounded-xl font-bold text-xs hover:bg-primary hover:text-white transition-all uppercase tracking-widest">Editar</button>
                            <button onclick="App.actions.deleteVehicle('${vehicle.id}')" class="w-12 h-12 bg-surface-container-low rounded-xl flex items-center justify-center text-error hover:bg-error hover:text-white transition-all">
                                <span class="material-symbols-outlined text-lg">delete</span>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        },

        bookingCard(booking, user) {
            const vehicle = Storage.getVehicles().find(v => v.id === booking.veiculoId);
            const project = Storage.getProjects().find(p => p.id === booking.projetoId);
            const driver = Storage.getUsers().find(u => u.id === booking.motoristaId);
            
            const canEdit = user.tipo === 'administrador' || user.id === booking.userId;
            
            let statusBadge = '';
            let actions = '';

            const canOperate = user.tipo === 'administrador' || user.id === booking.userId || user.id === booking.motoristaId;

            switch(booking.status) {
                case 'checklist_pendente':
                    statusBadge = '<span class="bg-amber-100 text-amber-900 px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest">Aguardando Saída</span>';
                    if (canOperate) {
                        actions = `
                            <button onclick="window.location.hash='#checklist?id=${booking.id}&type=out'" class="flex-1 bg-primary text-white py-4 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-primary-container transition-all shadow-lg shadow-primary/20">Checklist Saída</button>
                        `;
                    }
                    break;
                case 'em_curso':
                    statusBadge = '<span class="bg-emerald-100 text-emerald-900 px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest animate-pulse">Viagem em Curso</span>';
                    if (canOperate) {
                        actions = `
                            <button onclick="App.actions.openFuelModal('${booking.id}')" class="flex-1 bg-surface-container-highest text-primary py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-primary hover:text-white transition-all">Abastecer</button>
                            <button onclick="App.actions.finishTrip('${booking.id}')" class="flex-1 border-2 border-primary text-primary py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-primary/5 transition-all">Encerrar</button>
                        `;
                    }
                    break;
                case 'concluido':
                    statusBadge = '<span class="bg-surface-container text-on-surface-variant px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest opacity-60">Finalizado</span>';
                    break;
                case 'cancelado':
                    statusBadge = '<span class="bg-error/10 text-error px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest opacity-60">Cancelado</span>';
                    break;
            }

            const startDate = new Date(booking.dataSaida);
            const endDate = new Date(booking.dataChegada);

            return `
                <div class="bg-white rounded-3xl p-6 shadow-sm border border-outline-variant/10 flex flex-col space-y-6 group hover:shadow-2xl transition-all duration-500 relative overflow-hidden">
                    <header class="flex justify-between items-start">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 rounded-xl bg-surface-container-low flex items-center justify-center text-primary/40 group-hover:text-primary transition-colors">
                                <span class="material-symbols-outlined text-2xl">local_shipping</span>
                            </div>
                            <div>
                                <h4 class="text-[8px] font-black text-on-surface-variant uppercase tracking-[0.2em] opacity-40">Veículo vinculado</h4>
                                <p class="text-[11px] font-black text-primary uppercase leading-tight opacity-60">${vehicle?.nome} <span class="ml-1 px-1.5 py-0.5 bg-surface-container rounded text-[8px] opacity-60 font-medium">${vehicle?.placa}</span></p>
                            </div>
                        </div>
                        <div class="flex flex-col items-end gap-2">
                            ${statusBadge}
                            ${canEdit ? `
                                <div class="flex gap-1.5">
                                    ${booking.status === 'checklist_pendente' ? `
                                        <button onclick="App.actions.cancelBooking('${booking.id}')" class="w-8 h-8 rounded-lg hover:bg-emerald-50 text-on-surface-variant/20 hover:text-emerald-600 transition-all flex items-center justify-center" title="Cancelar Agendamento">
                                            <span class="material-symbols-outlined text-base">cancel</span>
                                        </button>
                                    ` : ''}
                                    <button onclick="App.actions.openEditBooking('${booking.id}')" class="w-8 h-8 rounded-lg hover:bg-primary/10 text-on-surface-variant/20 hover:text-primary transition-all flex items-center justify-center" title="Editar">
                                        <span class="material-symbols-outlined text-base">edit</span>
                                    </button>
                                    <button onclick="App.actions.deleteBooking('${booking.id}')" class="w-8 h-8 rounded-lg hover:bg-error/10 text-on-surface-variant/20 hover:text-error transition-all flex items-center justify-center" title="Excluir">
                                        <span class="material-symbols-outlined text-base">delete</span>
                                    </button>
                                </div>
                            ` : ''}
                        </div>
                    </header>

                    <div class="grid grid-cols-2 gap-4 relative">
                        <!-- Divider visual -->
                        <div class="absolute left-1/2 top-2 bottom-2 w-px bg-outline-variant/10 -ml-px"></div>
                        
                        <div class="space-y-3">
                            <div class="flex items-center gap-1.5">
                                <div class="w-1 h-1 rounded-full bg-emerald-500"></div>
                                <h5 class="text-[8px] font-black uppercase tracking-widest text-on-surface-variant opacity-60">Saída</h5>
                            </div>
                            <div class="pl-1">
                                <p class="text-xl font-black text-primary tracking-tighter leading-none">${startDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).toUpperCase()}</p>
                                <p class="text-[10px] font-bold text-on-surface-variant tracking-tight mt-1 opacity-60">${startDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}h</p>
                            </div>
                            <div class="pt-2 flex items-start gap-1.5">
                                 <span class="material-symbols-outlined text-primary/30 text-xs mt-0.5">location_on</span>
                                 <p class="text-[10px] font-black text-primary uppercase leading-tight tracking-tight">${booking.origem}</p>
                            </div>
                        </div>

                        <div class="space-y-3">
                            <div class="flex items-center gap-1.5">
                                <div class="w-1 h-1 rounded-full bg-amber-500"></div>
                                <h5 class="text-[8px] font-black uppercase tracking-widest text-on-surface-variant opacity-60">Retorno</h5>
                            </div>
                            <div class="pl-1">
                                <p class="text-xl font-black text-primary tracking-tighter leading-none">${endDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).toUpperCase()}</p>
                                <p class="text-[10px] font-bold text-on-surface-variant tracking-tight mt-1 opacity-60">${endDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}h</p>
                            </div>
                            <div class="pt-2 flex items-start gap-1.5">
                                 <span class="material-symbols-outlined text-primary/30 text-xs mt-0.5">location_on</span>
                                 <p class="text-[10px] font-black text-primary uppercase leading-tight tracking-tight">${booking.destino}</p>
                            </div>
                        </div>
                    </div>

                    ${booking.observacao ? `
                        <div class="bg-surface-container-low p-6 rounded-3xl border border-outline-variant/10 relative">
                             <span class="material-symbols-outlined absolute -top-3 left-6 bg-white px-2 text-primary/20 text-lg">chat_bubble</span>
                            <p class="text-[11px] font-medium text-primary/80 leading-relaxed italic">"${booking.observacao}"</p>
                        </div>
                    ` : ''}

                    <div class="flex items-center justify-between pt-4 border-t border-outline-variant/10">
                         <div class="flex items-center gap-3">
                            <div class="w-9 h-9 rounded-full bg-primary-container flex items-center justify-center text-[10px] font-black text-primary shadow-inner">${(driver?.nome || 'U').charAt(0)}</div>
                            <div>
                                <p class="text-[9px] font-black text-on-surface-variant/30 uppercase tracking-widest leading-none mb-0.5">Responsável</p>
                                <p class="text-[10px] font-black text-primary uppercase">${driver?.nome}</p>
                            </div>
                         </div>
                         <div class="text-right">
                             <p class="text-[9px] font-black text-on-surface-variant/30 uppercase tracking-widest leading-none mb-0.5">Centro de Custo</p>
                             <p class="text-[10px] font-black text-primary uppercase">${project?.nome}</p>
                         </div>
                    </div>

                    ${actions ? `<div class="flex gap-4 pt-2">${actions}</div>` : ''}
                </div>
            `;
        },

        tableRowUser(user) {
            const typeColors = {
                administrador: 'bg-primary text-white',
                logistica: 'bg-secondary-container text-primary',
                motorista: 'bg-surface-container-highest text-on-surface-variant'
            };
            return `
                <tr class="hover:bg-surface-container-lowest transition-colors group">
                    <td class="py-6 px-8 flex items-center gap-4">
                        <div class="w-10 h-10 rounded-xl bg-primary-container flex items-center justify-center text-primary font-black text-xs uppercase">
                            ${(user.nome || 'U').charAt(0)}
                        </div>
                        <div>
                            <p class="text-sm font-extrabold text-primary leading-tight">${user.nome}</p>
                            <p class="text-[10px] font-bold text-on-surface-variant opacity-60">${user.email || 'sem e-mail'}</p>
                        </div>
                    </td>
                    <td class="py-6 px-8">
                        <span class="px-2 py-1 rounded text-[10px] font-black uppercase tracking-tighter ${typeColors[user.tipo]}">
                            ${user.tipo}
                        </span>
                        <p class="text-[9px] font-bold text-on-surface-variant opacity-40 mt-1 uppercase tracking-widest">${user.departamento}</p>
                    </td>
                    <td class="py-6 px-8">
                        <span class="flex items-center gap-2 text-[10px] font-black ${user.ativo ? 'text-emerald-600' : 'text-error'} uppercase">
                            <span class="w-2 h-2 rounded-full bg-current"></span>
                            ${user.ativo ? 'ATIVO' : 'INATIVO'}
                        </span>
                    </td>
                    <td class="py-6 px-8 text-right space-x-2">
                         <button onclick="App.actions.openEditUser('${user.id}')" class="px-4 py-2 bg-white text-primary rounded-lg font-black text-[9px] uppercase tracking-widest border border-outline-variant/30 hover:bg-surface-container-low transition-all shadow-sm">Editar</button>
                         <button onclick="App.actions.resetPassword('${user.id}')" class="px-4 py-2 bg-surface-container-low text-on-surface-variant rounded-lg font-black text-[9px] uppercase tracking-widest hover:bg-surface-container-high transition-all">Reset</button>
                    </td>
                </tr>
            `;
        },
        
        tableRowProject(project) {
            const percentage = Math.max(0, Math.min(100, (project.saldo / project.rubricaAbastecimento) * 100));
            const consumedPercent = (100 - percentage).toFixed(1);
            const statusColor = project.ativo ? 'text-emerald-600' : 'text-on-surface-variant opacity-40';
            
            // Determinar cor da barra de progresso baseada no consumo
            let progressColor = 'signature-gradient';
            if (consumedPercent > 90) progressColor = 'bg-error';
            else if (consumedPercent > 70) progressColor = 'bg-amber-500';

            return `
                <tr class="hover:bg-surface-container-lowest transition-colors group">
                    <td class="py-6 px-8 flex items-center gap-4">
                        <div class="w-10 h-10 rounded-xl bg-surface-container-low flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all">
                            <span class="material-symbols-outlined text-xl">folder_managed</span>
                        </div>
                        <div>
                            <p class="text-sm font-extrabold text-primary leading-tight uppercase tracking-tight">${project.nome}</p>
                            <p class="text-[9px] font-bold text-on-surface-variant opacity-40 uppercase tracking-widest">ID: ${project.id}</p>
                        </div>
                    </td>
                    <td class="py-6 px-8">
                        <p class="text-[10px] font-black text-on-surface-variant opacity-40 uppercase tracking-widest leading-none mb-1">Total</p>
                        <p class="text-xs font-black text-primary tracking-tight">R$ ${project.rubricaAbastecimento.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    </td>
                    <td class="py-6 px-8">
                        <p class="text-[10px] font-black text-on-surface-variant opacity-40 uppercase tracking-widest leading-none mb-1">Disponível</p>
                        <p class="text-xs font-black ${project.saldo < 100 ? 'text-error animate-pulse' : 'text-emerald-600'} tracking-tight">R$ ${project.saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    </td>
                    <td class="py-6 px-8 w-[200px]">
                        <div class="flex justify-between items-end text-[9px] font-black uppercase tracking-widest text-on-surface-variant mb-2">
                            <span>Consumo</span>
                            <span class="${consumedPercent > 90 ? 'text-error' : 'text-primary'}">${consumedPercent}%</span>
                        </div>
                        <div class="h-1.5 bg-surface-container-low rounded-full overflow-hidden">
                            <div class="h-full ${progressColor} rounded-full transition-all duration-1000" style="width: ${consumedPercent}%"></div>
                        </div>
                    </td>
                    <td class="py-6 px-8">
                        <span class="flex items-center gap-2 text-[10px] font-black ${statusColor} uppercase">
                            <span class="w-1.5 h-1.5 rounded-full bg-current"></span>
                            ${project.ativo ? 'ATIVO' : 'INATIVO'}
                        </span>
                    </td>
                    <td class="py-6 px-8 text-right space-x-1.5">
                         <button onclick="App.actions.openEditProject('${project.id}')" class="px-4 py-2 bg-white text-primary rounded-lg font-black text-[9px] uppercase tracking-widest border border-outline-variant/30 hover:bg-surface-container-low transition-all">Editar</button>
                         <button onclick="App.actions.deleteProject('${project.id}')" class="w-8 h-8 bg-surface-container-low text-on-surface-variant/40 rounded-lg hover:bg-error hover:text-white transition-all">
                            <span class="material-symbols-outlined text-sm">delete</span>
                         </button>
                    </td>
                </tr>
            `;
        },

        projectCard(project) {
            const percentage = Math.max(0, Math.min(100, (project.saldo / project.rubricaAbastecimento) * 100));
            const statusColor = project.ativo ? 'text-emerald-600 bg-emerald-50' : 'text-on-surface-variant bg-surface-container';
            
            return `
                <div class="bg-white p-8 rounded-3xl shadow-sm border border-outline-variant/10 space-y-8 group hover:shadow-2xl transition-all duration-500 relative overflow-hidden">
                    <div class="absolute top-0 left-0 w-1 h-full bg-primary opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    
                    <header class="flex justify-between items-start">
                        <div>
                            <span class="px-2 py-1 rounded-lg ${statusColor} text-[9px] font-black uppercase tracking-widest mb-3 inline-block">
                                ${project.ativo ? 'Ativo' : 'Inativo'}
                            </span>
                            <h4 class="text-xl font-extrabold text-primary tracking-tight leading-tight">${project.nome}</h4>
                        </div>
                        <div class="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onclick="App.actions.openEditProject('${project.id}')" class="w-8 h-8 rounded-lg bg-surface-container-low flex items-center justify-center text-primary hover:bg-primary hover:text-white transition-all">
                                <span class="material-symbols-outlined text-sm">edit</span>
                            </button>
                            <button onclick="App.actions.deleteProject('${project.id}')" class="w-8 h-8 rounded-lg bg-surface-container-low flex items-center justify-center text-error hover:bg-error hover:text-white transition-all">
                                <span class="material-symbols-outlined text-sm">delete</span>
                            </button>
                        </div>
                    </header>

                    <div class="space-y-1">
                        <p class="text-[10px] font-black text-on-surface-variant uppercase tracking-[0.2em] opacity-40">Rubrica Disponível</p>
                        <p class="text-3xl font-black text-primary tracking-tighter">R$ ${project.saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    </div>

                    <div class="space-y-3">
                        <div class="flex justify-between items-end text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                            <span>Consumido</span>
                            <span class="text-primary font-black">${(100 - percentage).toFixed(1)}%</span>
                        </div>
                        <div class="h-2 bg-surface-container-low rounded-full overflow-hidden">
                            <div class="h-full signature-gradient rounded-full transition-all duration-1000" style="width: ${100 - percentage}%"></div>
                        </div>
                        <p class="text-[9px] font-bold text-on-surface-variant opacity-40">Orçamento Total: R$ ${project.rubricaAbastecimento.toLocaleString('pt-BR')}</p>
                    </div>
                </div>
            `;
        },

        placeholder(path) {
            return `
                <div class="h-full flex flex-col items-center justify-center text-center p-20 animate-in zoom-in duration-300">
                    <div class="w-24 h-24 bg-surface-container-high rounded-3xl flex items-center justify-center mb-6">
                        <span class="material-symbols-outlined text-5xl text-primary/20">construction</span>
                    </div>
                    <h2 class="text-3xl font-extrabold text-primary tracking-tight capitalize">${path.replace('-', ' ')}</h2>
                    <p class="text-on-surface-variant max-w-sm mt-3 font-medium">Esta funcionalidade está em desenvolvimento seguindo os padrões do Architectural Command.</p>
                </div>
            `;
        },

        maintenanceItem(vehicle, item, detail, severity) {
            const sevColors = severity === 'CRÍTICO' ? 'text-error' : 'text-primary';
            return `
                <div class="flex items-center justify-between p-4 bg-surface rounded-xl border border-outline-variant/5">
                    <div>
                        <p class="text-xs font-black text-primary uppercase tracking-wider">${vehicle}</p>
                        <p class="text-[10px] font-bold text-on-surface-variant opacity-60">${item}</p>
                    </div>
                    <div class="text-right">
                        <p class="text-[10px] font-black ${sevColors} uppercase tracking-tighter">${severity}</p>
                        <p class="text-[9px] font-bold text-on-surface-variant opacity-60">${detail}</p>
                    </div>
                </div>
            `;
        },

        correctionRow(correction) {
            const hasInconformity = correction.results ? correction.results.some(r => r.status === 'nok') : false;
            const statusText = hasInconformity ? 'INCONFORME' : 'CONFORME';
            const statusColorClass = hasInconformity ? 'text-error' : 'text-emerald-600';
            const cardBorderClass = hasInconformity ? 'border-error/20 bg-error/[0.02]' : 'border-emerald-500/10 bg-emerald-[0.01]';
            
            return `
                <div class="space-y-4 animate-in fade-in duration-500">
                    <div class="flex justify-between items-center px-2">
                        <h4 class="text-[10px] font-black text-primary uppercase tracking-[0.2em] flex items-center gap-2">
                            <span class="material-symbols-outlined text-sm text-emerald-500">build_circle</span>
                            Correção de Logística
                        </h4>
                        <div class="flex items-center gap-3">
                            <span class="text-[9px] font-bold text-on-surface-variant opacity-40">${new Date(correction.dataRegistro).toLocaleString('pt-BR')}</span>
                            <button onclick="App.actions.deleteCorrection('${correction.id}')" class="text-on-surface-variant/40 hover:text-error transition-colors flex items-center" title="Excluir Lançamento">
                                <span class="material-symbols-outlined text-sm">delete</span>
                            </button>
                        </div>
                    </div>

                    <div class="bg-white rounded-[2rem] border ${cardBorderClass} overflow-hidden shadow-sm">
                        <div class="px-6 py-4 border-b border-outline-variant/5 flex justify-between items-center ${hasInconformity ? 'bg-error/[0.03]' : 'bg-emerald-[0.03]'}">
                            <span class="text-[10px] font-black uppercase tracking-[0.2em] ${statusColorClass} flex items-center gap-2">
                                <span class="w-1.5 h-1.5 rounded-full bg-current"></span>
                                ${statusText}
                            </span>
                            <span class="text-[10px] font-bold text-on-surface-variant opacity-60">Logado: ${(correction.responsavel || 'Logística').split(' ')[0]}</span>
                        </div>
                        
                        <div class="p-6 space-y-4">
                            ${correction.results.map(r => `
                                <div class="space-y-2">
                                    <div class="flex justify-between items-center">
                                        <span class="text-[11px] font-bold text-primary/80 uppercase tracking-tight">${r.nome}</span>
                                        <div class="w-6 h-6 rounded-full flex items-center justify-center ${r.status === 'ok' ? 'bg-white text-emerald-600 border border-emerald-500/30' : 'bg-white text-error border border-error/50'}">
                                            <span class="material-symbols-outlined text-[14px] font-black">${r.status === 'ok' ? 'check_circle' : 'error'}</span>
                                        </div>
                                    </div>
                                    ${r.status === 'nok' || r.observacao ? `
                                        <div class="ml-2 pl-4 border-l-2 ${r.status === 'nok' ? 'border-error/20' : 'border-emerald-500/20'} py-1 space-y-2">
                                            <p class="text-[10px] ${r.status === 'nok' ? 'text-error' : 'text-emerald-700'} font-semibold italic">Obs: ${r.observacao || 'N/A'}</p>
                                            ${r.fotoData ? `
                                                <div class="relative w-16 h-16 rounded-xl overflow-hidden border border-outline-variant/10 cursor-zoom-in group/img mt-1" onclick="App.utils.viewImage('${r.fotoData}')">
                                                    <img src="${r.fotoData}" class="w-full h-full object-cover group-hover/img:scale-110 transition-transform duration-500">
                                                    <div class="absolute inset-0 bg-primary/0 group-hover/img:bg-primary/20 flex items-center justify-center transition-all opacity-0 group-hover/img:opacity-100">
                                                        <span class="material-symbols-outlined text-white text-sm">fullscreen</span>
                                                    </div>
                                                </div>
                                            ` : ''}
                                        </div>
                                    ` : ''}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            `;
        }
    },

    renderMaintenance(container) {
        const vehicles = Storage.getVehicles().filter(v => v.status === 'ativo');
        const logs = Storage.getMaintenanceLogs();
        const rules = Storage.getMaintenanceRules();

        // Calcular Métricas Rápidas
        let totalCrítico = 0;
        let totalAtenção = 0;
        let investimento30d = 0;
        const trintaDiasAtras = new Date();
        trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30);

        vehicles.forEach(v => {
            const status = Storage.calculateMaintenanceStatus(v.id);
            totalCrítico += status.filter(s => s.status === 'error').length;
            totalAtenção += status.filter(s => s.status === 'warning').length;
        });

        logs.forEach(l => {
            if (l.valor && new Date(l.data) > trintaDiasAtras) {
                investimento30d += parseFloat(l.valor);
            }
        });

        const html = `
            <div class="space-y-10 animate-in fade-in duration-700">
                <header class="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                    <div>
                        <h2 class="text-4xl font-extrabold text-primary tracking-tighter">Gestão de Manutenções</h2>
                        <p class="text-on-surface-variant font-medium mt-1">Controle preditivo de frota e lançamentos corretivos.</p>
                    </div>
                    <div class="flex items-center gap-3 w-full md:w-auto">
                        <button onclick="App.actions.openCorrectiveMaintenanceModal()" class="flex-1 md:flex-none bg-white text-primary border-2 border-outline-variant/20 px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-surface-container-low transition-all">
                            Lançar Corretiva
                        </button>
                        <button onclick="App.actions.openPreventiveMaintenanceModal()" class="flex-1 md:flex-none bg-primary text-white px-8 py-4 rounded-2xl font-black text-[10px] flex items-center justify-center gap-3 hover:bg-primary-container transition-all uppercase tracking-widest shadow-xl shadow-primary/20">
                            <span class="material-symbols-outlined text-sm">build</span>
                            Registrar Preventiva
                        </button>
                    </div>
                </header>

                <!-- Cards de Resumo (KPIs) -->
                <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div class="bg-error/5 border border-error/10 p-6 rounded-[2rem] flex items-center gap-5">
                        <div class="w-14 h-14 rounded-2xl bg-error text-white flex items-center justify-center shadow-lg shadow-error/20">
                            <span class="material-symbols-outlined text-3xl">emergency_home</span>
                        </div>
                        <div>
                            <p class="text-[10px] font-black text-error uppercase tracking-widest opacity-60">Itens Críticos</p>
                            <p class="text-3xl font-black text-error">${totalCrítico}</p>
                        </div>
                    </div>
                    <div class="bg-amber-50 border border-amber-200 p-6 rounded-[2rem] flex items-center gap-5">
                        <div class="w-14 h-14 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-lg shadow-amber-200">
                            <span class="material-symbols-outlined text-3xl">notification_important</span>
                        </div>
                        <div>
                            <p class="text-[10px] font-black text-amber-700 uppercase tracking-widest opacity-60">Em Atenção</p>
                            <p class="text-3xl font-black text-amber-700">${totalAtenção}</p>
                        </div>
                    </div>
                    <div class="bg-emerald-50 border border-emerald-100 p-6 rounded-[2rem] flex items-center gap-5">
                        <div class="w-14 h-14 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-100">
                            <span class="material-symbols-outlined text-3xl">payments</span>
                        </div>
                        <div>
                            <p class="text-[10px] font-black text-emerald-700 uppercase tracking-widest opacity-60">Investimento (30d)</p>
                            <p class="text-2xl font-black text-emerald-700">R$ ${investimento30d.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                        </div>
                    </div>
                </div>

                <!-- Grid de Veículos e Saúde -->
                <div class="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-8">
                    ${vehicles.map(v => {
                        const status = Storage.calculateMaintenanceStatus(v.id);
                        const sortedStatus = status.sort((a,b) => (a.kmRemaining - b.kmRemaining));
                        
                        return `
                            <div class="bg-white rounded-[2.5rem] border border-outline-variant/10 shadow-sm overflow-hidden flex flex-col group hover:shadow-2xl transition-all duration-500">
                                <div class="p-8 pb-6 flex justify-between items-start">
                                    <div class="flex items-center gap-5">
                                        <div class="w-14 h-14 rounded-2xl bg-surface-container-low flex items-center justify-center text-primary/40 group-hover:text-primary transition-colors">
                                            <span class="material-symbols-outlined text-3xl">local_shipping</span>
                                        </div>
                                        <div>
                                            <h4 class="text-lg font-black text-primary uppercase leading-tight">${v.nome}</h4>
                                            <div class="flex items-center gap-2 mt-1">
                                                <span class="text-[10px] font-bold text-on-surface-variant bg-surface-container px-2 py-0.5 rounded-full uppercase">${v.placa}</span>
                                                <span class="text-[10px] font-black text-primary">${v.km.toLocaleString()} KM</span>
                                            </div>
                                        </div>
                                    </div>
                                    <button onclick="App.actions.openMaintenanceHistory('${v.id}')" class="w-10 h-10 rounded-xl bg-surface-container-high text-primary flex items-center justify-center hover:bg-primary hover:text-white transition-all shadow-sm" title="Ver Histórico Completo">
                                        <span class="material-symbols-outlined">history</span>
                                    </button>
                                </div>

                                <div class="px-8 pb-8 space-y-5 flex-1 overflow-y-auto max-h-[350px] scrollbar-hide">
                                    <p class="text-[9px] font-black text-on-surface-variant uppercase tracking-[0.2em] opacity-40 sticky top-0 bg-white py-2 z-10">Status de Manutenção Preventiva</p>
                                    
                                    ${sortedStatus.map(s => {
                                        const pct = Math.min(100, Math.max(0, ((s.intervaloKM - s.kmRemaining) / s.intervaloKM) * 100));
                                        const isOverdue = s.kmRemaining <= 0;
                                        const isWarning = s.kmRemaining <= 500 && !isOverdue;
                                        
                                        const colorClass = isOverdue ? 'bg-error' : (isWarning ? 'bg-amber-500' : 'bg-emerald-500');
                                        const textClass = isOverdue ? 'text-error' : (isWarning ? 'text-amber-600' : 'text-emerald-700');
                                        const bgClass = isOverdue ? 'bg-error/5' : (isWarning ? 'bg-amber-50' : 'bg-emerald-50');

                                        return `
                                            <div class="space-y-2 p-3 rounded-2xl ${bgClass} border border-transparent hover:border-outline-variant/10 transition-all">
                                                <div class="flex justify-between items-center">
                                                    <div class="flex items-center gap-2">
                                                        <span class="material-symbols-outlined text-lg ${textClass}">${s.icone || 'build'}</span>
                                                        <span class="text-[11px] font-black text-primary uppercase">${s.nome}</span>
                                                    </div>
                                                    <span class="text-[10px] font-black ${textClass} uppercase tracking-tight">
                                                        ${isOverdue ? `${Math.abs(s.kmRemaining).toLocaleString()} KM ATRASADO` : `${s.kmRemaining.toLocaleString()} KM RESTANTE`}
                                                    </span>
                                                </div>
                                                <div class="h-1.5 w-full bg-surface-container-high rounded-full overflow-hidden">
                                                    <div class="h-full ${colorClass} transition-all duration-1000 shadow-sm shadow-black/5" style="width: ${pct}%"></div>
                                                </div>
                                            </div>
                                        `;
                                    }).join('')}
                                </div>

                                <div class="p-4 bg-surface-container-lowest border-t border-outline-variant/10 flex gap-2">
                                    <button onclick="App.actions.openPreventiveMaintenanceModal('${v.id}')" class="flex-1 py-3 rounded-xl bg-primary text-white text-[10px] font-black uppercase tracking-widest hover:bg-primary-container transition-all">
                                        Fiz Preventiva
                                    </button>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
        container.innerHTML = html;
    },

    renderReports(container) {
        const vehicles = Storage.getVehicles();
        const projects = Storage.getProjects();

        const html = `
            <div class="space-y-12 animate-in fade-in duration-500 pb-20 no-print">
                <header>
                    <h2 class="text-4xl font-extrabold text-primary tracking-tighter">Centro de Inteligência</h2>
                    <p class="text-on-surface-variant font-medium mt-1">Geração de relatórios técnicos e financeiros para auditoria.</p>
                </header>

                <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <!-- Relatório 1: Manutenção -->
                    <div class="bg-white p-10 rounded-[2.5rem] border border-outline-variant/10 shadow-sm space-y-8 group hover:shadow-2xl transition-all duration-500">
                        <div class="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 transition-transform group-hover:scale-110">
                            <span class="material-symbols-outlined text-4xl">engineering</span>
                        </div>
                        <div>
                            <h3 class="text-xl font-black text-primary uppercase tracking-tight">Manutenção Preventiva</h3>
                            <p class="text-xs font-semibold text-on-surface-variant opacity-60 mt-2">Consolidado de serviços e custos por veículo.</p>
                        </div>
                        <form onsubmit="event.preventDefault(); App.actions.generateReport('manutencao', new FormData(event.target))" class="space-y-4">
                            <select name="veiculoId" class="w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-xs font-bold text-primary outline-none" required>
                                <option value="all">Todos os Veículos</option>
                                ${vehicles.map(v => `<option value="${v.id}">${v.nome}</option>`).join('')}
                            </select>
                            <div class="flex gap-4">
                                <div class="flex-1 space-y-1">
                                    <label class="text-[9px] font-black uppercase text-on-surface-variant opacity-60">Data Inicial</label>
                                    <input type="date" name="dataInicio" class="w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-xs font-bold text-primary outline-none focus:ring-2 focus:ring-primary/20">
                                </div>
                                <div class="flex-1 space-y-1">
                                    <label class="text-[9px] font-black uppercase text-on-surface-variant opacity-60">Data Final</label>
                                    <input type="date" name="dataFim" class="w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-xs font-bold text-primary outline-none focus:ring-2 focus:ring-primary/20">
                                </div>
                            </div>
                            <button type="submit" class="w-full bg-primary text-white py-4 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-primary-container transition-all">Gerar Relatório</button>
                        </form>
                    </div>

                    <!-- Relatório 2: Inspeções -->
                    <div class="bg-white p-10 rounded-[2.5rem] border border-outline-variant/10 shadow-sm space-y-8 group hover:shadow-2xl transition-all duration-500">
                        <div class="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 transition-transform group-hover:scale-110">
                            <span class="material-symbols-outlined text-4xl">fact_check</span>
                        </div>
                        <div>
                            <h3 class="text-xl font-black text-primary uppercase tracking-tight">Auditoria de Checklist</h3>
                            <p class="text-xs font-semibold text-on-surface-variant opacity-60 mt-2">Log de saídas, retornos e conformidades.</p>
                        </div>
                        <form onsubmit="event.preventDefault(); App.actions.generateReport('checklists', new FormData(event.target))" class="space-y-4">
                            <select name="veiculoId" class="w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-xs font-bold text-primary outline-none" required>
                                <option value="all">Todos os Veículos</option>
                                ${vehicles.map(v => `<option value="${v.id}">${v.nome}</option>`).join('')}
                            </select>
                            <div class="flex gap-4">
                                <div class="flex-1 space-y-1">
                                    <label class="text-[9px] font-black uppercase text-on-surface-variant opacity-60">Data Inicial</label>
                                    <input type="date" name="dataInicio" class="w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-xs font-bold text-primary outline-none focus:ring-2 focus:ring-primary/20">
                                </div>
                                <div class="flex-1 space-y-1">
                                    <label class="text-[9px] font-black uppercase text-on-surface-variant opacity-60">Data Final</label>
                                    <input type="date" name="dataFim" class="w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-xs font-bold text-primary outline-none focus:ring-2 focus:ring-primary/20">
                                </div>
                            </div>
                            <div class="flex items-center gap-3 px-2">
                                <input type="checkbox" name="onlyInconformities" class="w-4 h-4 rounded text-primary border-outline-variant/30">
                                <label class="text-[10px] font-bold text-primary uppercase">Apenas Ocorrências</label>
                            </div>
                            <button type="submit" class="w-full bg-primary text-white py-4 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-primary-container transition-all">Gerar Relatório</button>
                        </form>
                    </div>

                    <!-- Relatório 3: Financeiro -->
                    <div class="bg-white p-10 rounded-[2.5rem] border border-outline-variant/10 shadow-sm space-y-8 group hover:shadow-2xl transition-all duration-500">
                        <div class="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600 transition-transform group-hover:scale-110">
                            <span class="material-symbols-outlined text-4xl">payments</span>
                        </div>
                        <div>
                            <h3 class="text-xl font-black text-primary uppercase tracking-tight">Prestação de Contas</h3>
                            <p class="text-xs font-semibold text-on-surface-variant opacity-60 mt-2">Viagens e despesas vinculadas a projetos.</p>
                        </div>
                        <form onsubmit="event.preventDefault(); App.actions.generateReport('financeiro', new FormData(event.target))" class="space-y-4">
                            <select name="projetoId" class="w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-xs font-bold text-primary outline-none" required>
                                <option value="all">Todos os Projetos</option>
                                ${projects.map(p => `<option value="${p.id}">${p.nome}</option>`).join('')}
                            </select>
                            <div class="flex gap-4">
                                <div class="flex-1 space-y-1">
                                    <label class="text-[9px] font-black uppercase text-on-surface-variant opacity-60">Data Inicial</label>
                                    <input type="date" name="dataInicio" class="w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-xs font-bold text-primary outline-none focus:ring-2 focus:ring-primary/20">
                                </div>
                                <div class="flex-1 space-y-1">
                                    <label class="text-[9px] font-black uppercase text-on-surface-variant opacity-60">Data Final</label>
                                    <input type="date" name="dataFim" class="w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-xs font-bold text-primary outline-none focus:ring-2 focus:ring-primary/20">
                                </div>
                            </div>
                            <button type="submit" class="w-full bg-primary text-white py-4 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-primary-container transition-all">Gerar Relatório</button>
                        </form>
                    </div>
                </div>
            </div>
        `;
        container.innerHTML = html;
    },

    renderCorrectionForm(container, params) {
        const vehicleId = params.get('vehicleId');
        const vehicles = Storage.getVehicles();
        const selectedVehicle = vehicleId ? vehicles.find(v => v.id === vehicleId) : null;
        const pendingNok = vehicleId ? Storage.getPendingInconformities(vehicleId) : [];
        const loggedUser = Storage.getLoggedInUser();

        const html = `
            <div class="max-w-4xl mx-auto space-y-10 animate-in slide-in-from-bottom-4 duration-500">
                <header class="flex items-center gap-4">
                    <button onclick="window.history.back()" class="w-12 h-12 rounded-xl border-2 border-outline-variant/20 flex items-center justify-center text-primary bg-white hover:bg-surface-container-low transition-colors outline-none">
                        <span class="material-symbols-outlined">arrow_back</span>
                    </button>
                    <div>
                        <h2 class="text-4xl font-extrabold text-primary tracking-tighter">Lançamento de Correção</h2>
                        <p class="text-on-surface-variant font-medium mt-1">Registrar reparos e ações corretivas para a frota.</p>
                    </div>
                </header>

                <form id="correction-form" class="space-y-8 pb-20">
                    <div class="bg-white rounded-[2.5rem] p-10 border border-outline-variant/10 shadow-sm space-y-10">
                        <!-- Seleção de Veículo -->
                        <section class="space-y-6">
                            <div class="flex items-center gap-4">
                                <div class="w-10 h-10 bg-primary/5 rounded-xl flex items-center justify-center text-primary">
                                    <span class="material-symbols-outlined">local_shipping</span>
                                </div>
                                <h3 class="text-lg font-black text-primary uppercase tracking-tight">Qual o veículo?</h3>
                            </div>
                            
                            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                ${vehicles.filter(v => v.status === 'ativo').map(v => `
                                    <label class="cursor-pointer group">
                                        <input type="radio" name="veiculoId" value="${v.id}" class="peer hidden" ${v.id === vehicleId ? 'checked' : ''} onchange="App.renderView('lancamento-correcao', new URLSearchParams('vehicleId=' + this.value))">
                                        <div class="p-6 rounded-2xl border-2 border-outline-variant/10 bg-white group-hover:border-primary/20 peer-checked:border-primary peer-checked:bg-primary/5 transition-all h-full">
                                            <p class="text-[10px] font-black uppercase text-on-surface-variant opacity-40 mb-1">Placa: ${v.placa}</p>
                                            <p class="text-sm font-black text-primary uppercase">${v.nome}</p>
                                        </div>
                                    </label>
                                `).join('')}
                            </div>
                        </section>

                        <!-- Itens com Pendência -->
                        <section class="space-y-6">
                            <div class="flex items-center gap-4">
                                <div class="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600">
                                    <span class="material-symbols-outlined">report_problem</span>
                                </div>
                                <h3 class="text-lg font-black text-primary uppercase tracking-tight">Ocorrências Pendentes</h3>
                            </div>

                            ${pendingNok.length > 0 ? `
                                <div class="grid grid-cols-1 gap-3">
                                    ${pendingNok.map(item => `
                                        <div class="p-4 bg-amber-50/50 rounded-xl border border-amber-500/10 flex items-center justify-between">
                                            <div class="flex-1">
                                                <p class="text-xs font-black text-primary uppercase tracking-wider">${item.nome}</p>
                                                <p class="text-[10px] font-bold text-error mt-0.5">Motivo: ${item.observacao || 'N/A'}</p>
                                            </div>
                                            <div class="text-right">
                                                <p class="text-[8px] font-black text-on-surface-variant uppercase tracking-widest opacity-40">Identificado em</p>
                                                <p class="text-[10px] font-bold text-primary">${new Date(item.data).toLocaleDateString('pt-BR')}</p>
                                            </div>
                                        </div>
                                    `).join('')}
                                </div>
                                <p class="text-[11px] font-bold text-amber-700 italic px-4">Nota: Os itens acima serão mantidos como "NOK" no histórico original para fins de auditoria.</p>
                            ` : `
                                <div class="p-8 text-center bg-emerald-50/50 rounded-2xl border border-emerald-500/10">
                                    <span class="material-symbols-outlined text-emerald-500 text-3xl mb-2">verified</span>
                                    <p class="text-xs font-black text-emerald-700 uppercase">Nenhuma ocorrência técnica pendente.</p>
                                    <p class="text-[10px] text-emerald-600/60 font-medium">Você ainda pode registrar uma manutenção preventiva ou corretiva geral.</p>
                                </div>
                            `}
                        </section>

                        <hr class="border-outline-variant/10">

                        <hr class="border-outline-variant/10">

                        <!-- Checklist de Logística -->
                        <section class="space-y-8">
                            <div class="flex items-center gap-4">
                                <div class="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
                                    <span class="material-symbols-outlined">fact_check</span>
                                </div>
                                <h3 class="text-lg font-black text-primary uppercase tracking-tight">Verificação Técnica</h3>
                            </div>

                            <div class="grid grid-cols-1 gap-4">
                                ${Storage.getChecklistItems().map(item => {
                                    const wasNok = pendingNok.some(p => p.nome === item.nome);
                                    return `
                                        <div class="border border-outline-variant/10 rounded-[2rem] overflow-hidden bg-white shadow-sm transition-all group ${wasNok ? 'border-amber-500/30 bg-amber-[0.01]' : ''}" data-was-nok="${wasNok}">
                                            <div class="flex items-center justify-between p-6 bg-surface hover:bg-surface-container-low transition-colors">
                                                <div class="flex items-center gap-5">
                                                    <div class="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-primary shadow-sm border border-outline-variant/5">
                                                        <span class="material-symbols-outlined text-[20px]">${wasNok ? 'build' : 'fact_check'}</span>
                                                    </div>
                                                    <div>
                                                        <p class="text-[11px] font-bold text-primary uppercase tracking-tight">${item.nome}</p>
                                                        ${wasNok ? '<p class="text-[8px] font-black text-amber-600 uppercase tracking-widest mt-0.5 flex items-center gap-1"><span class="w-1 h-1 rounded-full bg-current"></span> Requer Correção</p>' : ''}
                                                    </div>
                                                </div>
                                                <div class="flex items-center gap-4">
                                                    <label class="relative cursor-pointer group/radio">
                                                        <input type="radio" name="item_${item.id}" value="ok" required class="peer sr-only logistic-item-status" data-item-id="${item.id}">
                                                        <div class="w-14 h-14 rounded-2xl bg-surface-container flex items-center justify-center text-on-surface-variant/40 peer-checked:bg-emerald-500 peer-checked:text-white transition-all hover:bg-emerald-50 active:scale-90 shadow-sm">
                                                            <span class="material-symbols-outlined text-2xl">thumb_up</span>
                                                        </div>
                                                    </label>
                                                    <label class="relative cursor-pointer group/radio">
                                                        <input type="radio" name="item_${item.id}" value="nok" required class="peer sr-only logistic-item-status" data-item-id="${item.id}">
                                                        <div class="w-14 h-14 rounded-2xl bg-surface-container flex items-center justify-center text-on-surface-variant/40 peer-checked:bg-error peer-checked:text-white transition-all hover:bg-error/5 active:scale-90 shadow-sm">
                                                            <span class="material-symbols-outlined text-2xl">thumb_down</span>
                                                        </div>
                                                    </label>
                                                </div>
                                            </div>

                                            <div id="fields-${item.id}" class="hidden p-8 border-t border-outline-variant/10 space-y-6 bg-white animate-in slide-in-from-top-4 duration-500">
                                                <div class="space-y-3">
                                                    <label class="text-[10px] font-black text-primary uppercase tracking-[0.2em] flex items-center gap-2 opacity-60">
                                                        <span class="material-symbols-outlined text-sm">notes</span>
                                                        Detalhamento da ${wasNok ? 'Correção' : 'Observação'}
                                                    </label>
                                                    <textarea name="obs_${item.id}" placeholder="Descreva o que foi realizado..." class="w-full bg-surface-container-low border border-outline-variant/10 rounded-2xl px-5 py-4 text-xs font-bold text-primary outline-none focus:ring-4 focus:ring-primary/5 transition-all resize-none h-24"></textarea>
                                                </div>
                                                <div class="space-y-3">
                                                    <label class="block cursor-pointer group/photo">
                                                        <input type="file" name="foto_${item.id}" accept="image/*" capture="environment" class="sr-only logistic-photo-input">
                                                        <div class="bg-surface-container-low border-2 border-dashed border-outline-variant/20 text-center rounded-2xl p-6 text-[10px] font-black hover:border-primary/50 transition-all text-primary/40 flex flex-col items-center gap-3 justify-center group-hover/photo:text-primary min-h-[100px] photo-preview-container">
                                                            <span class="material-symbols-outlined text-3xl">add_a_photo</span>
                                                            ANEXAR EVIDÊNCIA DA CORREÇÃO
                                                        </div>
                                                    </label>
                                                </div>
                                            </div>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        </section>

                        <button type="submit" class="w-full signature-gradient text-white py-6 rounded-[2rem] font-black text-sm shadow-2xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all uppercase tracking-[0.3em]">
                            Finalizar e Salvar Correção
                        </button>
                    </div>
                </form>
            </div>
        `;
        container.innerHTML = html;

        // Listeners
        const form = document.getElementById('correction-form');
        
        // Logica condicional de campos
        form.querySelectorAll('.logistic-item-status').forEach(radio => {
            radio.addEventListener('change', (e) => {
                const itemId = e.target.dataset.itemId;
                const wasNok = e.target.closest('[data-was-nok]').dataset.wasNok === 'true';
                const status = e.target.value;
                const fieldsDiv = document.getElementById(`fields-${itemId}`);
                
                // Mostrar campos se (marcou NOK) OU (marcou OK mas era anteriormente NOK)
                if (status === 'nok' || (status === 'ok' && wasNok)) {
                    fieldsDiv.classList.remove('hidden');
                } else {
                    fieldsDiv.classList.add('hidden');
                }
            });
        });

        // Feedback de foto com Preview em Tempo Real
        form.querySelectorAll('.logistic-photo-input').forEach(input => {
            input.addEventListener('change', async (e) => {
                const previewContainer = e.target.nextElementSibling;
                const file = e.target.files[0];
                
                if (file) {
                    previewContainer.innerHTML = `
                        <div class="flex flex-col items-center gap-3 animate-in zoom-in-95 duration-300">
                            <div class="w-12 h-12 rounded-full border-2 border-emerald-500 flex items-center justify-center text-emerald-500 animate-pulse">
                                <span class="material-symbols-outlined">hourglass_empty</span>
                            </div>
                            <p class="text-[8px] font-black text-emerald-600 uppercase tracking-widest">Processando Imagem...</p>
                        </div>
                    `;

                    try {
                        const compressedBase64 = await App.utils.compressImage(file, 400); // Preview médio
                        previewContainer.innerHTML = `
                            <div class="flex items-center gap-4 text-left w-full p-2 animate-in fade-in slide-in-from-bottom-2 duration-500">
                                <img src="${compressedBase64}" class="w-20 h-20 rounded-xl object-cover shadow-lg border-2 border-white">
                                <div>
                                    <p class="text-emerald-600 font-extrabold text-[10px] uppercase tracking-tight">Evidência Carregada</p>
                                    <p class="text-[8px] text-on-surface-variant font-bold opacity-60 uppercase tracking-widest mt-0.5">Clique para alterar a foto</p>
                                </div>
                                <span class="material-symbols-outlined ml-auto text-emerald-500 text-2xl">check_circle</span>
                            </div>
                        `;
                        previewContainer.classList.add('bg-emerald-50', 'border-emerald-500/30', 'border-solid');
                        previewContainer.classList.remove('border-dashed');
                    } catch (err) {
                        previewContainer.innerHTML = `
                            <span class="material-symbols-outlined text-3xl text-error">error</span>
                            <p class="uppercase text-error font-black">Erro ao processar imagem</p>
                        `;
                    }
                }
            });
        });

        form.onsubmit = async (e) => {
            e.preventDefault();
            const submitBtn = form.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.innerText = 'PROCESSANDO...';
            
            await this.actions.saveCorrection(new FormData(form));
        };
    },

    renderAuditoriaChecklist(container) {
        if (!this.state.inspecoesFilters) {
            this.state.inspecoesFilters = {
                dataInicio: '',
                dataFim: '',
                apenasOcorrencias: false,
                showFilters: false
            };
        }

        const applyFilters = () => {
            let filtered = Storage.getBookings().filter(b => b.checklistSaida || b.checklistRetorno);

            if (this.state.inspecoesFilters.dataInicio || this.state.inspecoesFilters.dataFim) {
                filtered = filtered.filter(b => {
                    const checkDateRange = (dateStr) => {
                        if (!dateStr) return false;
                        const date = dateStr.split('T')[0]; // Pegar apenas a parte YYYY-MM-DD
                        const startMatch = !this.state.inspecoesFilters.dataInicio || date >= this.state.inspecoesFilters.dataInicio;
                        const endMatch = !this.state.inspecoesFilters.dataFim || date <= this.state.inspecoesFilters.dataFim;
                        return startMatch && endMatch;
                    };

                    const dataSaidaMatch = checkDateRange(b.checklistSaida?.data);
                    const dataRetornoMatch = checkDateRange(b.checklistRetorno?.data);
                    return dataSaidaMatch || dataRetornoMatch;
                });
            }

            if (this.state.inspecoesFilters.apenasOcorrencias) {
                filtered = filtered.filter(b => 
                    b.checklistSaida?.hasInconformity || b.checklistRetorno?.hasInconformity
                );
            }

            return filtered;
        };

        const bookings = applyFilters();
        const corrections = Storage.getCorrections();
        const vehicles = Storage.getVehicles();
        const users = Storage.getUsers();

        // Agrupar tudo por veículo (Misturar Checklists e Correções)
        const grouped = {};
        
        // Adicionar Bookings (Viagens)
        bookings.forEach(b => {
            if (!grouped[b.veiculoId]) grouped[b.veiculoId] = [];
            grouped[b.veiculoId].push({ type: 'booking', data: b, date: b.checklistRetorno?.data || b.checklistSaida?.data || b.dataSaida });
        });

        // Adicionar Correções Técnicas
        corrections.forEach(c => {
            if (!grouped[c.veiculoId]) grouped[c.veiculoId] = [];
            grouped[c.veiculoId].push({ type: 'correction', data: c, date: c.dataRegistro });
        });

        // Ordenar cada grupo por data decrescente
        Object.keys(grouped).forEach(vId => {
            grouped[vId].sort((a,b) => new Date(b.date) - new Date(a.date));
        });

        const html = `
            <div class="space-y-10 animate-in fade-in duration-500">
                <header class="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                    <div>
                        <h2 class="text-4xl font-extrabold text-primary tracking-tighter">Histórico de Inspeções</h2>
                        <p class="text-on-surface-variant font-medium mt-1">Auditoria completa de saídas e retornos da frota.</p>
                    </div>
                    <div class="flex items-center gap-3 w-full md:w-auto no-print">
                        <button onclick="App.utils.toggleInspecoesFilterVisibility()" class="flex-1 md:flex-none h-12 w-12 rounded-xl flex items-center justify-center border-2 ${this.state.inspecoesFilters.showFilters ? 'bg-primary text-white border-primary' : 'bg-white text-primary border-outline-variant/20'} hover:scale-105 transition-all outline-none" title="Filtros">
                            <span class="material-symbols-outlined">filter_list</span>
                        </button>
                        <button onclick="App.renderView('inspecoes')" class="flex-1 md:flex-none bg-white text-primary border-2 border-outline-variant/20 px-6 py-3 h-12 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-surface-container-low transition-colors outline-none">Atualizar</button>
                    </div>
                </header>

                <section class="${this.state.inspecoesFilters.showFilters ? 'block animate-in slide-in-from-top-4 duration-300' : 'hidden'} bg-surface-container-low p-6 rounded-[2rem] border border-outline-variant/10">
                    <div class="flex flex-wrap items-center gap-6">
                        <div class="flex-1 min-w-[150px] space-y-1.5">
                            <label class="text-[9px] font-black text-on-surface-variant uppercase tracking-widest opacity-40 ml-1">Data Inicial</label>
                            <input type="date" id="filter-inspecoes-start" value="${this.state.inspecoesFilters.dataInicio}" class="w-full bg-white border border-outline-variant/20 rounded-xl px-4 py-2.5 text-xs font-bold text-primary outline-none focus:ring-2 focus:ring-primary/10 transition-all">
                        </div>

                        <div class="flex-1 min-w-[150px] space-y-1.5">
                            <label class="text-[9px] font-black text-on-surface-variant uppercase tracking-widest opacity-40 ml-1">Data Final</label>
                            <input type="date" id="filter-inspecoes-end" value="${this.state.inspecoesFilters.dataFim}" class="w-full bg-white border border-outline-variant/20 rounded-xl px-4 py-2.5 text-xs font-bold text-primary outline-none focus:ring-2 focus:ring-primary/10 transition-all">
                        </div>

                        <div class="flex-[2] min-w-[300px] space-y-1.5">
                            <label class="text-[9px] font-black text-on-surface-variant uppercase tracking-widest opacity-40 ml-1">Filtro de Conformidade</label>
                            <div class="flex flex-wrap gap-2">
                                <button onclick="App.utils.updateInspecoesOcorrencias(false)" class="px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${!this.state.inspecoesFilters.apenasOcorrencias ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-white text-on-surface-variant/40 hover:bg-surface-container-high'}">
                                    Todas as Inspeções
                                </button>
                                <button onclick="App.utils.updateInspecoesOcorrencias(true)" class="px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${this.state.inspecoesFilters.apenasOcorrencias ? 'bg-error text-white shadow-lg shadow-error/20' : 'bg-white text-on-surface-variant/40 hover:bg-surface-container-high'}">
                                    Apenas Ocorrências
                                </button>
                            </div>
                        </div>

                        <button onclick="App.utils.resetInspecoesFilters()" class="self-end mb-1 p-2.5 text-on-surface-variant hover:text-error transition-all" title="Resetar Filtros">
                            <span class="material-symbols-outlined text-xl">filter_list_off</span>
                        </button>
                    </div>
                </section>

                <div class="space-y-6 pb-20">
                    ${Object.keys(grouped).length === 0 ? `
                        <div class="py-20 text-center space-y-4 opacity-40 italic">
                            <span class="material-symbols-outlined text-5xl mb-2">find_in_page</span>
                            <p class="text-sm font-bold uppercase tracking-widest">Nenhuma inspeção encontrada ${this.state.inspecoesFilters.showFilters ? 'para os filtros' : ''}</p>
                        </div>
                    ` : Object.entries(grouped).map(([vId, vEvents]) => {
                        const vehicle = vehicles.find(v => v.id === vId);
                        return `
                            <div class="bg-white rounded-[2rem] border border-outline-variant/10 shadow-sm overflow-hidden">
                                <div class="p-8 bg-surface-container-low flex justify-between items-center cursor-pointer" onclick="this.nextElementSibling.classList.toggle('hidden')">
                                    <div class="flex items-center gap-6">
                                        <div class="w-14 h-14 rounded-2xl bg-white flex items-center justify-center text-primary shadow-sm">
                                            <span class="material-symbols-outlined text-3xl">local_shipping</span>
                                        </div>
                                        <div>
                                            <h3 class="text-xl font-black text-primary uppercase tracking-tight">${vehicle?.nome || 'Veículo Desconhecido'}</h3>
                                            <p class="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest opacity-60">${vehicle?.placa || 'Sem placa'} • ${vEvents.length} eventos</p>
                                        </div>
                                    </div>
                                    <span class="material-symbols-outlined text-outline-variant">expand_more</span>
                                </div>
                                <div class="hidden divide-y divide-surface-container">
                                    <div class="p-8 bg-surface-container-low/30 space-y-10">
                                        ${vEvents.map(evt => {
                                            if (evt.type === 'correction') {
                                                return this.components.correctionRow(evt.data);
                                            }
                                            
                                            const b = evt.data;
                                            const driver = users.find(u => u.id === b.motoristaId);
                                            const proj = Storage.getProjects().find(p => p.id === b.projetoId);
                                            
                                            return `
                                                <div class="space-y-6">
                                                    <!-- Contexto da Reserva Adaptado -->
                                                    <div class="flex items-center justify-between p-6 bg-white rounded-[2rem] border border-outline-variant/10 shadow-sm">
                                                        <div class="flex items-center gap-5">
                                                            <div class="w-12 h-12 rounded-2xl bg-primary/5 flex items-center justify-center text-primary shadow-inner">
                                                                <span class="material-symbols-outlined text-2xl">route</span>
                                                            </div>
                                                            <div>
                                                                <p class="text-[9px] font-black text-on-surface-variant uppercase tracking-[0.2em] opacity-40">Destino e Projeto</p>
                                                                <p class="text-sm font-black text-primary uppercase">${b.destino}</p>
                                                                <p class="text-[10px] font-bold text-on-surface-variant opacity-60">${proj?.nome || 'Projeto N/A'}</p>
                                                            </div>
                                                        </div>
                                                        <div class="text-right flex items-center gap-4">
                                                            <div class="text-right">
                                                                <p class="text-[9px] font-black text-on-surface-variant uppercase tracking-[0.2em] opacity-40">Condutor</p>
                                                                <p class="text-xs font-extrabold text-primary">${driver?.nome || 'Sistema'}</p>
                                                            </div>
                                                            <div class="w-10 h-10 rounded-full bg-primary-container flex items-center justify-center text-[10px] font-black text-primary shadow-inner">
                                                                ${(driver?.nome || 'U').charAt(0)}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div class="flex flex-wrap gap-8 items-start">
                                                        ${['Saída', 'Retorno'].map(type => {
                                                            const log = type === 'Saída' ? b.checklistSaida : b.checklistRetorno;
                                                            if (!log) return '';
                                                            
                                                            return `
                                                                <div class="flex-1 min-w-[300px] space-y-4">
                                                                    <div class="flex justify-between items-center px-4">
                                                                        <h4 class="text-[10px] font-black text-primary uppercase tracking-[0.2em] flex items-center gap-2">
                                                                            <span class="material-symbols-outlined text-sm ${type === 'Saída' ? 'text-emerald-500' : 'text-amber-500'}">${type === 'Saída' ? 'upload' : 'download'}</span>
                                                                            Checklist ${type}
                                                                        </h4>
                                                                        <span class="text-[10px] font-bold text-on-surface-variant opacity-40">${new Date(log.data).toLocaleString('pt-BR')}</span>
                                                                    </div>
                                                                    
                                                                    <div class="bg-white rounded-[2rem] border ${log.hasInconformity ? 'border-error/20 bg-error/[0.01]' : 'border-outline-variant/10'} overflow-hidden shadow-sm">
                                                                        <div class="px-6 py-4 border-b border-outline-variant/5 flex justify-between items-center ${log.hasInconformity ? 'bg-error/[0.03]' : 'bg-emerald-[0.03]'}">
                                                                            <span class="text-[10px] font-black uppercase tracking-widest ${log.hasInconformity ? 'text-error' : 'text-emerald-600'} flex items-center gap-2">
                                                                                <span class="w-1.5 h-1.5 rounded-full bg-current"></span>
                                                                                ${log.hasInconformity ? 'INCONFORME' : 'CONFORME'}
                                                                            </span>
                                                                            <span class="text-[10px] font-bold text-on-surface-variant opacity-60">Log: ${(driver?.nome || 'U').split(' ')[0]}</span>
                                                                        </div>
                                                                        
                                                                        <div class="p-6 space-y-4">
                                                                            ${log.results.map(r => `
                                                                                <div class="space-y-2">
                                                                                    <div class="flex justify-between items-center text-xs">
                                                                                        <span class="text-primary font-bold uppercase tracking-tight text-[11px]">${r.nome}</span>
                                                                                        <div class="w-6 h-6 rounded-full flex items-center justify-center ${r.status === 'ok' ? 'bg-white text-emerald-600 border border-emerald-500/20' : 'bg-white text-error border border-error/50'}">
                                                                                            <span class="material-symbols-outlined text-[14px] font-black">${r.status === 'ok' ? 'check_circle' : 'error'}</span>
                                                                                        </div>
                                                                                    </div>
                                                                                    ${r.status === 'nok' ? `
                                                                                        <div class="ml-2 pl-4 border-l-2 border-error/20 py-1 space-y-2">
                                                                                            <p class="text-[10px] text-error font-semibold italic">Obs: ${r.observacao || 'N/A'}</p>
                                                                                            ${r.fotoData ? `
                                                                                                <div class="relative w-16 h-16 rounded-lg overflow-hidden border border-outline-variant/10 cursor-zoom-in mt-1" onclick="App.utils.viewImage('${r.fotoData}')">
                                                                                                    <img src="${r.fotoData}" class="w-full h-full object-cover">
                                                                                                </div>
                                                                                            ` : ''}
                                                                                        </div>
                                                                                    ` : ''}
                                                                                </div>
                                                                            `).join('')}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            `;
                                                        }).join('')}
                                                    </div>
                                                </div>
                                            `;
                                        }).join('')}
                                    </div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
        container.innerHTML = html;

        // Listeners para filtros
        if (this.state.inspecoesFilters.showFilters) {
            const startInput = document.getElementById('filter-inspecoes-start');
            const endInput = document.getElementById('filter-inspecoes-end');
            
            if (startInput) {
                startInput.onchange = (e) => {
                    this.state.inspecoesFilters.dataInicio = e.target.value;
                    this.renderView('inspecoes');
                };
            }
            if (endInput) {
                endInput.onchange = (e) => {
                    this.state.inspecoesFilters.dataFim = e.target.value;
                    this.renderView('inspecoes');
                };
            }
        }
    },

    renderSettings(container) {
        const settings = Storage.getSettings();
        const html = `
            <div class="max-w-4xl mx-auto space-y-12 animate-in slide-in-from-bottom-4 duration-500">
                <header>
                    <h2 class="text-4xl font-extrabold text-primary tracking-tighter">Configurações</h2>
                    <p class="text-on-surface-variant font-medium mt-1">Parâmetros globais e integrações do sistema</p>
                </header>

                <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <!-- Sessão Combustível -->
                    <section class="bg-white rounded-[2rem] p-8 shadow-sm border border-outline-variant/10 space-y-6 flex flex-col">
                        <div class="flex items-center gap-4">
                            <div class="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600">
                                <span class="material-symbols-outlined text-2xl">local_gas_station</span>
                            </div>
                            <div>
                                <h3 class="font-black text-primary uppercase tracking-widest text-xs">Custos de Operação</h3>
                                <p class="text-[10px] text-on-surface-variant font-bold">Valores base para cálculos automáticos</p>
                            </div>
                        </div>

                        <form id="settings-fuel-form" class="space-y-4 flex-1 flex flex-col justify-between">
                            <div class="space-y-2">
                                <label class="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Preço do Litro (R$)</label>
                                <div class="relative">
                                    <span class="absolute left-5 top-1/2 -translate-y-1/2 text-primary font-black text-sm">R$</span>
                                    <input name="precoCombustivel" type="number" step="0.01" value="${settings.precoCombustivel}" class="w-full bg-surface-container-low border-none rounded-2xl pl-12 pr-5 py-4 text-sm font-black text-primary focus:ring-4 focus:ring-primary/5 transition-all outline-none shadow-inner" required>
                                </div>
                            </div>
                            <button type="submit" class="w-full bg-primary text-white py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-primary-container transition-all shadow-lg shadow-primary/20 mt-4">Salvar Custos</button>
                        </form>
                    </section>

                    <!-- Sessão Identidade Visual -->
                    <section class="bg-white rounded-[2rem] p-8 shadow-sm border border-outline-variant/10 space-y-6 flex flex-col">
                        <div class="flex items-center gap-4">
                            <div class="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
                                <span class="material-symbols-outlined text-2xl">palette</span>
                            </div>
                            <div>
                                <h3 class="font-black text-primary uppercase tracking-widest text-xs">Identidade Visual</h3>
                                <p class="text-[10px] text-on-surface-variant font-bold">Customização de nome e logos</p>
                            </div>
                        </div>

                        <form id="settings-branding-form" class="space-y-4">
                            <div class="grid grid-cols-2 gap-4">
                                <div class="space-y-2">
                                    <label class="text-[10px] font-black text-on-surface-variant uppercase tracking-widest ml-1">Nome do Sistema</label>
                                    <input name="nomeSistema" type="text" value="${settings.nomeSistema}" class="w-full bg-surface-container-low border-none rounded-2xl px-5 py-4 text-sm font-black text-primary focus:ring-4 focus:ring-primary/5 transition-all outline-none shadow-inner" required>
                                </div>
                                <div class="space-y-2">
                                    <label class="text-[10px] font-black text-on-surface-variant uppercase tracking-widest ml-1">Subtítulo / Slogan</label>
                                    <input name="subtituloSistema" type="text" value="${settings.subtituloSistema}" class="w-full bg-surface-container-low border-none rounded-2xl px-5 py-4 text-sm font-bold text-primary focus:ring-4 focus:ring-primary/5 transition-all outline-none shadow-inner" required>
                                </div>
                            </div>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div class="space-y-3">
                                    <label class="text-[10px] font-black text-on-surface-variant uppercase tracking-widest ml-1">Logotipo (Sidebar)</label>
                                    <div class="flex items-center gap-4 p-4 bg-surface-container-low rounded-2xl border border-dashed border-outline-variant/30 hover:border-primary/30 transition-all group relative">
                                        <div class="w-16 h-16 bg-white rounded-xl flex items-center justify-center overflow-hidden border border-outline-variant/10">
                                            ${settings.logoUrl ? `<img src="${settings.logoUrl}" class="w-full h-full object-contain">` : `<span class="material-symbols-outlined text-outline-variant opacity-40">image</span>`}
                                        </div>
                                        <div class="flex-1">
                                            <input name="logoFile" type="file" accept="image/*" class="absolute inset-0 opacity-0 cursor-pointer">
                                            <p class="text-[10px] font-black text-primary uppercase">Escolher Arquivo</p>
                                            <p class="text-[9px] text-on-surface-variant opacity-60 font-medium">PNG ou JPG (Sugerido 200x80px)</p>
                                        </div>
                                        ${settings.logoUrl ? `<button type="button" onclick="App.actions.clearBranding('logo')" class="w-8 h-8 rounded-lg bg-error/10 text-error flex items-center justify-center hover:bg-error hover:text-white transition-all z-10"><span class="material-symbols-outlined text-sm">close</span></button>` : ''}
                                    </div>
                                </div>
                                <div class="space-y-3">
                                    <label class="text-[10px] font-black text-on-surface-variant uppercase tracking-widest ml-1">Favicon (Aba)</label>
                                    <div class="flex items-center gap-4 p-4 bg-surface-container-low rounded-2xl border border-dashed border-outline-variant/30 hover:border-primary/30 transition-all group relative">
                                        <div class="w-16 h-16 bg-white rounded-xl flex items-center justify-center overflow-hidden border border-outline-variant/10">
                                            ${settings.faviconUrl ? `<img src="${settings.faviconUrl}" class="w-8 h-8 object-contain">` : `<span class="material-symbols-outlined text-outline-variant opacity-40">shortcut</span>`}
                                        </div>
                                        <div class="flex-1">
                                            <input name="faviconFile" type="file" accept="image/*" class="absolute inset-0 opacity-0 cursor-pointer">
                                            <p class="text-[10px] font-black text-primary uppercase">Escolher Arquivo</p>
                                            <p class="text-[9px] text-on-surface-variant opacity-60 font-medium">PNG ou ICO (32x32px)</p>
                                        </div>
                                        ${settings.faviconUrl ? `<button type="button" onclick="App.actions.clearBranding('favicon')" class="w-8 h-8 rounded-lg bg-error/10 text-error flex items-center justify-center hover:bg-error hover:text-white transition-all z-10"><span class="material-symbols-outlined text-sm">close</span></button>` : ''}
                                    </div>
                                </div>
                                <div class="space-y-3">
                                    <label class="text-[10px] font-black text-on-surface-variant uppercase tracking-widest ml-1">Logotipo (Tela de Login)</label>
                                    <div class="flex items-center gap-4 p-4 bg-surface-container-low rounded-2xl border border-dashed border-outline-variant/30 hover:border-primary/30 transition-all group relative">
                                        <div class="w-16 h-16 bg-white rounded-xl flex items-center justify-center overflow-hidden border border-outline-variant/10">
                                            ${settings.loginLogoUrl ? `<img src="${settings.loginLogoUrl}" class="w-full h-full object-contain">` : `<span class="material-symbols-outlined text-outline-variant opacity-40">login</span>`}
                                        </div>
                                        <div class="flex-1">
                                            <input name="loginLogoFile" type="file" accept="image/*" class="absolute inset-0 opacity-0 cursor-pointer">
                                            <p class="text-[10px] font-black text-primary uppercase">Escolher Arquivo</p>
                                            <p class="text-[9px] text-on-surface-variant opacity-60 font-medium">Logo para fundo escuro</p>
                                        </div>
                                        ${settings.loginLogoUrl ? `<button type="button" onclick="App.actions.clearBranding('loginLogo')" class="w-8 h-8 rounded-lg bg-error/10 text-error flex items-center justify-center hover:bg-error hover:text-white transition-all z-10"><span class="material-symbols-outlined text-sm">close</span></button>` : ''}
                                    </div>
                                </div>
                            </div>
                            <button type="submit" class="w-full bg-primary text-white py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-primary-container transition-all shadow-lg shadow-primary/20 mt-4">Atualizar Identidade</button>
                        </form>
                    </section>

                    <!-- Sessão Integrações -->
                    <section class="bg-white rounded-[2rem] p-8 shadow-sm border border-outline-variant/10 space-y-6 flex flex-col">
                        <div class="flex items-center gap-4">
                            <div class="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
                                <span class="material-symbols-outlined text-2xl">map</span>
                            </div>
                            <div>
                                <h3 class="font-black text-primary uppercase tracking-widest text-xs">Google Maps API</h3>
                                <p class="text-[10px] text-on-surface-variant font-bold">Integração de trajetos e distâncias</p>
                            </div>
                        </div>

                        <form id="settings-maps-form" class="space-y-4 flex-1 flex flex-col justify-between">
                            <div>
                                <div class="space-y-2">
                                    <label class="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">API Key</label>
                                    <input name="googleMapsKey" type="password" value="${settings.googleMapsKey}" placeholder="AIzaSy..." class="w-full bg-surface-container-low border-none rounded-2xl px-5 py-4 text-sm font-medium text-primary focus:ring-4 focus:ring-primary/5 transition-all outline-none shadow-inner">
                                </div>
                                <p class="text-[9px] text-on-surface-variant/60 font-medium px-2 mt-2">A chave habilita autocomplete e cálculo automático de KM.</p>
                            </div>
                            <button type="submit" class="w-full bg-surface-container-high text-primary py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-primary hover:text-white transition-all mt-4">Configurar API</button>
                        </form>
                    </section>

                    <!-- Sessão Checklist -->
                    <section class="bg-white rounded-[2rem] p-8 shadow-sm border border-outline-variant/10 space-y-6 lg:col-span-2">
                        <div class="flex justify-between items-start">
                            <div class="flex items-center gap-4">
                                <div class="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
                                    <span class="material-symbols-outlined text-2xl">fact_check</span>
                                </div>
                                <div>
                                    <h3 class="font-black text-primary uppercase tracking-widest text-xs">Itens de Inspeção (Checklist)</h3>
                                    <p class="text-[10px] text-on-surface-variant font-bold">Pontos validados na saída/retorno do veículo</p>
                                </div>
                            </div>
                            <button onclick="App.actions.addChecklistItem()" class="bg-surface-container-high text-primary w-10 h-10 rounded-xl flex items-center justify-center hover:bg-primary hover:text-white transition-all shadow-sm">
                                <span class="material-symbols-outlined text-xl">add</span>
                            </button>
                        </div>
                        
                        <div class="space-y-3">
                            ${Storage.getChecklistItems().map(item => `
                                <div class="flex items-center justify-between p-4 bg-surface rounded-xl border border-outline-variant/10 hover:bg-surface-container-low transition-colors group">
                                    <span class="text-sm font-bold text-primary">${item.nome}</span>
                                    <button onclick="App.actions.deleteChecklistItem('${item.id}')" class="w-8 h-8 rounded-lg hover:bg-error/10 text-outline-variant hover:text-error transition-all flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100" title="Excluir Item">
                                        <span class="material-symbols-outlined text-sm">delete_forever</span>
                                    </button>
                                </div>
                            `).join('')}
                        </div>
                    </section>

                    <!-- Sessão Plano de Manutenção -->
                    <section class="bg-white rounded-[2rem] p-8 shadow-sm border border-outline-variant/10 space-y-6 lg:col-span-2">
                        <div class="flex justify-between items-start">
                            <div class="flex items-center gap-4">
                                <div class="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600">
                                    <span class="material-symbols-outlined text-2xl">event_repeat</span>
                                </div>
                                <div>
                                    <h3 class="font-black text-primary uppercase tracking-widest text-xs">Plano de Manutenção (Preventiva)</h3>
                                    <p class="text-[10px] text-on-surface-variant font-bold">Frequências de KM para alertas automáticos</p>
                                </div>
                            </div>
                            <button onclick="App.actions.addMaintenanceRule()" class="bg-surface-container-high text-primary w-10 h-10 rounded-xl flex items-center justify-center hover:bg-primary hover:text-white transition-all shadow-sm">
                                <span class="material-symbols-outlined text-xl">add_shopping_cart</span>
                            </button>
                        </div>
                        
                        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            ${Storage.getMaintenanceRules().map(item => `
                                <div class="flex items-center justify-between p-4 bg-surface rounded-2xl border border-outline-variant/10 hover:bg-surface-container-low transition-colors group">
                                    <div class="flex items-center gap-3">
                                        <div class="w-10 h-10 rounded-xl bg-white border border-outline-variant/10 flex items-center justify-center text-primary/60 group-hover:text-primary transition-colors">
                                            <span class="material-symbols-outlined">${item.icone || 'handyman'}</span>
                                        </div>
                                        <div>
                                            <p class="text-[10px] font-black text-primary uppercase leading-tight">${item.nome}</p>
                                            <p class="text-[9px] font-bold text-on-surface-variant opacity-60 uppercase tracking-widest">A cada ${item.intervaloKM.toLocaleString()} KM</p>
                                        </div>
                                    </div>
                                    <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onclick="App.actions.editMaintenanceRule('${item.id}')" class="w-8 h-8 rounded-lg hover:bg-primary/10 text-outline-variant hover:text-primary transition-all flex items-center justify-center" title="Editar">
                                            <span class="material-symbols-outlined text-sm">edit</span>
                                        </button>
                                        <button onclick="App.actions.deleteMaintenanceRule('${item.id}')" class="w-8 h-8 rounded-lg hover:bg-error/10 text-outline-variant hover:text-error transition-all flex items-center justify-center" title="Excluir">
                                            <span class="material-symbols-outlined text-sm">delete_forever</span>
                                        </button>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </section>
                </div>
            </div>
        `;
        container.innerHTML = html;

        // Listeners
        const fuelForm = document.getElementById('settings-fuel-form');
        if (fuelForm) {
            fuelForm.onsubmit = async (e) => {
                e.preventDefault();
                const data = new FormData(fuelForm);
                const s = Storage.getSettings();
                s.precoCombustivel = parseFloat(data.get('precoCombustivel'));
                await Storage.setSettings(s);
                this.actions.showToast('Preços atualizados com sucesso!');
            };
        }

        const mapsForm = document.getElementById('settings-maps-form');
        if (mapsForm) {
            mapsForm.onsubmit = async (e) => {
                e.preventDefault();
                const data = new FormData(mapsForm);
                const s = Storage.getSettings();
                s.googleMapsKey = data.get('googleMapsKey');
                await Storage.setSettings(s);
                this.actions.showToast('API Key configurada! Recarregando sistema...');
                setTimeout(() => window.location.reload(), 1500);
            };
        }

        const brandingForm = document.getElementById('settings-branding-form');
        if (brandingForm) {
            brandingForm.onsubmit = async (e) => {
                e.preventDefault();
                const btn = brandingForm.querySelector('button[type="submit"]');
                const originalText = btn.textContent;
                btn.disabled = true;
                btn.textContent = 'Processando Imagens...';

                try {
                    const data = new FormData(brandingForm);
                    const s = Storage.getSettings();
                    
                    s.nomeSistema = data.get('nomeSistema');
                    s.subtituloSistema = data.get('subtituloSistema');

                    const logoFile = data.get('logoFile');
                    if (logoFile && logoFile.size > 0) {
                        s.logoUrl = await this.utils.readFileAsDataURL(logoFile);
                    }

                    const faviconFile = data.get('faviconFile');
                    if (faviconFile && faviconFile.size > 0) {
                        s.faviconUrl = await this.utils.readFileAsDataURL(faviconFile);
                    }

                    const loginLogoFile = data.get('loginLogoFile');
                    if (loginLogoFile && loginLogoFile.size > 0) {
                        s.loginLogoUrl = await this.utils.readFileAsDataURL(loginLogoFile);
                    }

                    await Storage.setSettings(s);
                    this.utils.applyBranding();
                    this.actions.showToast('Identidade Visual personalizada com sucesso!');
                    this.renderView('configuracoes'); // Refresh view to show new previews
                } catch (error) {
                    console.error('Branding Save Error:', error);
                    this.actions.showToast('Erro ao processar imagens. Tente arquivos menores.');
                } finally {
                    btn.disabled = false;
                    btn.textContent = originalText;
                }
            };
        }
    },

    // --- ACTIONS ---

    actions: {
        async resetSystem() {
            if (confirm('ATENÇÃO: Isso irá apagar todos os dados registrados e restaurar o sistema para o padrão de fábrica. Continuar?')) {
                await Storage.logout();
                window.location.reload();
            }
        },

        async clearBranding(type) {
            const s = Storage.getSettings();
            if (type === 'logo') s.logoUrl = '';
            if (type === 'favicon') s.faviconUrl = '';
            if (type === 'loginLogo') s.loginLogoUrl = '';
            await Storage.setSettings(s);
            this.utils.applyBranding();
            this.actions.showToast('Branding removido com sucesso!');
            this.renderView('configuracoes');
        },

        async login(formData) {
            const identifier = formData.get('identifier');
            const password = formData.get('password');

            // Support login by name or email
            let email = identifier;
            if (!identifier.includes('@')) {
                const { data } = await supabaseClient.from('profiles').select('email').ilike('nome', identifier).maybeSingle();
                if (data) email = data.email;
            }

            const { data: authData, error } = await supabaseClient.auth.signInWithPassword({ email, password });
            console.log('Login attempt:', { email, error: error?.message, authData });
            if (error) {
                alert('Erro de login: ' + error.message);
                return;
            }

            // Load user profile and all data
            await Storage._loadCurrentUser();
            await Storage._loadAllData();

            const user = Storage.getLoggedInUser();
            if (user && !user.ativo) {
                await supabaseClient.auth.signOut();
                alert('Usuário inativo. Entre em contato com o administrador.');
                return;
            }

            window.location.hash = (user && user.trocarSenha) ? '#trocar-senha' : '#agendamentos';
        },

        openCorrectionForm(vehicleId) {
            window.location.hash = `#lancamento-correcao${vehicleId ? '?vehicleId=' + vehicleId : ''}`;
        },

        async saveCorrection(formData) {
            const veiculoId = formData.get('veiculoId');
            if (!veiculoId) {
                alert('Por favor, selecione um veículo.');
                this.renderView('lancamento-correcao');
                return;
            }

            const items = Storage.getChecklistItems();
            const results = await Promise.all(items.map(async item => {
                const status = formData.get(`item_${item.id}`);
                const obs = formData.get(`obs_${item.id}`);
                const file = formData.get(`foto_${item.id}`);
                
                let fotoData = null;
                if (file && file.size > 0) {
                    try {
                        fotoData = await App.utils.compressImage(file);
                    } catch (e) {
                        console.error('Erro ao processar imagem da correção:', e);
                    }
                }

                return {
                    id: item.id,
                    nome: item.nome,
                    status: status, // 'ok' or 'nok'
                    observacao: obs || '',
                    fotoData: fotoData
                };
            }));

            const data = {
                veiculoId: veiculoId,
                responsavel: formData.get('responsavel') || Storage.getLoggedInUser()?.nome || 'Logística',
                data: formData.get('data'),
                results: results
            };

            await Storage.saveCorrection(data);
            this.showToast('Checklist de correção salvo com sucesso!');
            window.location.hash = '#inspecoes';
        },

        async deleteCorrection(id) {
            if (confirm('Deseja realmente excluir este lançamento de correção? Esta ação não pode ser desfeita.')) {
                await Storage.deleteCorrection(id);
                App.renderView('inspecoes');
                this.showToast('Lançamento excluído com sucesso.');
            }
        },

        async logout() {
            await Storage.logout();
            window.location.hash = '#login';
        },

        async changePassword(formData) {
            const newPwd = formData.get('newPassword');
            const confirmPwd = formData.get('confirmPassword');

            if (newPwd !== confirmPwd) {
                alert('As senhas não coincidem.');
                return;
            }

            const { error } = await supabaseClient.auth.updateUser({ password: newPwd });
            if (error) {
                alert('Erro ao alterar senha: ' + error.message);
                return;
            }

            // Mark trocarSenha as false
            const user = Storage.getLoggedInUser();
            if (user) {
                await supabaseClient.from('profiles').update({ trocar_senha: false }).eq('id', user.id);
                await Storage._loadCurrentUser();
            }

            window.location.hash = '#agendamentos';
        },

        async saveBooking(formData) {
            const bookingId = formData.get('id');
            const vehicleId = document.querySelector('input[name="selectedVehicle"]:checked')?.value;
            
            if (!vehicleId && !bookingId) {
                alert('Selecione um veículo disponível.');
                return;
            }

            const currentUser = Storage.getLoggedInUser();
            const bookings = Storage.getBookings();
            const existingBooking = bookingId ? bookings.find(b => b.id === bookingId) : null;
            
            const data = {
                motoristaId: formData.get('motoristaId'),
                projetoId: formData.get('projetoId'),
                dataSaida: formData.get('dataSaida'),
                dataChegada: formData.get('dataChegada'),
                origem: formData.get('origem'),
                destino: formData.get('destino'),
                observacao: formData.get('observacao')
            };

            // Se for atualização
            if (bookingId && existingBooking) {
                if (existingBooking.status !== 'checklist_pendente') {
                    delete data.motoristaId;
                    delete data.dataSaida;
                    delete data.dataChegada;
                    delete data.origem;
                    delete data.destino;
                } else {
                    data.veiculoId = vehicleId;
                }

                await Storage.updateBooking(bookingId, data);
            } else {
                // Se for criação
                const vehicle = Storage.getVehicles().find(v => v.id === vehicleId);
                const distanciaPrevista = Math.floor(Math.random() * 200) + 50;

                const newBooking = {
                    ...data,
                    veiculoId: vehicleId,
                    criadoPor: currentUser.id,
                    kmInicial: vehicle.km,
                    distanciaPrevista: parseInt(formData.get('distanciaPrevista')) || distanciaPrevista,
                    status: 'checklist_pendente'
                };

                await Storage.createBooking(newBooking);
            }

            window.location.hash = '#agendamentos';
        },

        openAddVehicle() {
            const content = `
                <form id="vehicle-form" class="space-y-6">
                    <div class="space-y-2">
                        <label class="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Nome do Veículo</label>
                        <input name="nome" type="text" placeholder="Ex: Volvo FH 540" class="w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm focus:ring-4 focus:ring-primary/5 transition-all outline-none" required>
                    </div>
                    <div class="grid grid-cols-3 gap-4">
                         <div class="space-y-2">
                            <label class="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Placa</label>
                            <input name="placa" type="text" placeholder="ABC-1234" class="w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm focus:ring-4 focus:ring-primary/5 transition-all outline-none" required>
                        </div>
                        <div class="space-y-2">
                            <label class="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">KM Atual</label>
                            <input name="km" type="number" placeholder="Ex: 10000" class="w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm focus:ring-4 focus:ring-primary/5 transition-all outline-none" required>
                        </div>
                        <div class="space-y-2">
                            <label class="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Consumo (km/l)</label>
                            <input name="consumption" type="number" step="0.1" placeholder="Ex: 8.5" class="w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm focus:ring-4 focus:ring-primary/5 transition-all outline-none" required>
                        </div>
                    </div>
                    <div class="space-y-2">
                        <label class="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Foto (URL)</label>
                        <input name="foto" type="url" placeholder="https://..." class="w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm focus:ring-4 focus:ring-primary/5 transition-all outline-none">
                    </div>
                    <div class="flex items-center gap-3 py-2">
                        <input type="checkbox" name="ativo" checked class="w-5 h-5 rounded text-primary focus:ring-primary/20 bg-surface-container-high border-none transition-all">
                        <label class="text-xs font-bold text-primary">Veículo Ativo no Sistema</label>
                    </div>
                </form>
            `;

            App.showModal('Cadastrar Novo Veículo', content, async () => {
                const form = document.getElementById('vehicle-form');
                if (!form.checkValidity()) {
                    form.reportValidity();
                    return false;
                }
                const formData = new FormData(form);
                const vehicle = {
                    nome: formData.get('nome'),
                    placa: formData.get('placa'),
                    km: parseInt(formData.get('km')) || 0,
                    consumption: parseFloat(formData.get('consumption')) || 8.5,
                    foto: formData.get('foto') || 'https://images.unsplash.com/photo-1542441526-78c92ba3052c?q=80&w=400',
                    status: formData.get('ativo') === 'on' ? 'ativo' : 'inativo',
                    disponivel: true
                };

                try {
                    await Storage.saveVehicle(vehicle);
                    App.renderView('veiculos');
                    this.showToast('Veículo cadastrado com sucesso!');
                    return true;
                } catch (err) {
                    alert('Erro ao cadastrar veículo: ' + err.message);
                    return false;
                }
            });
        },

        openEditVehicle(id) {
            const vehicle = Storage.getVehicles().find(v => v.id === id);
            if (!vehicle) return;

            const content = `
                <form id="edit-vehicle-form" class="space-y-6">
                    <input type="hidden" name="id" value="${vehicle.id}">
                    <div class="space-y-2">
                        <label class="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Nome do Veículo</label>
                        <input name="nome" type="text" value="${vehicle.nome}" class="w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm focus:ring-4 focus:ring-primary/5 transition-all outline-none" required>
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                         <div class="space-y-2">
                            <label class="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Placa</label>
                            <input name="placa" type="text" value="${vehicle.placa}" class="w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm focus:ring-4 focus:ring-primary/5 transition-all outline-none" required>
                        </div>
                        <div class="space-y-2">
                            <label class="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Consumo (km/l)</label>
                            <input name="consumption" type="number" step="0.1" value="${vehicle.consumption || 8.5}" class="w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm focus:ring-4 focus:ring-primary/5 transition-all outline-none" required>
                        </div>
                    </div>
                    <div class="space-y-2">
                        <label class="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Foto (URL)</label>
                        <input name="foto" type="url" value="${vehicle.foto}" class="w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm focus:ring-4 focus:ring-primary/5 transition-all outline-none">
                    </div>
                    <div class="flex items-center gap-3 py-2">
                        <input type="checkbox" name="ativo" ${vehicle.status === 'ativo' ? 'checked' : ''} class="w-5 h-5 rounded text-primary focus:ring-primary/20 bg-surface-container-high border-none transition-all">
                        <label class="text-xs font-bold text-primary">Veículo Ativo no Sistema</label>
                    </div>
                </form>
            `;

            App.showModal('Editar Veículo', content, async () => {
                const form = document.getElementById('edit-vehicle-form');
                if (!form.checkValidity()) {
                    form.reportValidity();
                    return false;
                }
                const formData = new FormData(form);
                const updatedVehicle = {
                    id: formData.get('id'),
                    nome: formData.get('nome'),
                    placa: formData.get('placa'),
                    km: parseInt(formData.get('km')),
                    consumption: parseFloat(formData.get('consumption')),
                    foto: formData.get('foto'),
                    status: formData.get('ativo') ? 'ativo' : 'inativo'
                };

                try {
                    await Storage.saveVehicle(updatedVehicle);
                    App.renderView('veiculos');
                    this.showToast('Veículo atualizado com sucesso!');
                    return true;
                } catch (err) {
                    alert('Erro ao atualizar veículo: ' + err.message);
                    return false;
                }
            });
        },

        async deleteVehicle(id) {
            if (confirm('Tem certeza que deseja excluir este veículo? Esta ação não pode ser desfeita.')) {
                await Storage.deleteVehicle(id);
                App.renderView('veiculos');
            }
        },

        openAddUser() {
            const content = `
                <form id="user-form" class="space-y-6">
                    <div class="grid grid-cols-2 gap-4">
                        <div class="space-y-2">
                            <label class="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Nome Completo</label>
                            <input name="nome" type="text" class="w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm focus:ring-4 focus:ring-primary/5 outline-none" required>
                        </div>
                        <div class="space-y-2">
                            <label class="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">E-mail</label>
                            <input name="email" type="email" class="w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm focus:ring-4 focus:ring-primary/5 outline-none" required>
                        </div>
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div class="space-y-2">
                            <label class="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Departamento</label>
                            <input name="departamento" type="text" class="w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm outline-none transition-all focus:ring-4 focus:ring-primary/5" required>
                        </div>
                        <div class="space-y-2">
                            <label class="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Nível de Acesso</label>
                            <select name="tipo" class="w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm outline-none transition-all focus:ring-4 focus:ring-primary/5">
                                <option value="motorista">Motorista</option>
                                <option value="logistica">Logística</option>
                                <option value="administrador">Administrador</option>
                            </select>
                        </div>
                    </div>
                    <p class="text-[10px] font-bold text-on-surface-variant opacity-40 uppercase">A senha temporária será <span class="text-primary font-black">FF@123</span></p>
                </form>
            `;
            App.showModal('Novo Usuário', content, async () => {
                const form = document.getElementById('user-form');
                if (!form.checkValidity()) {
                    form.reportValidity();
                    return false;
                }
                const formData = new FormData(form);
                try {
                    await Storage.createUser({
                        nome: formData.get('nome'),
                        email: formData.get('email'),
                        senha: 'FF@123',
                        departamento: formData.get('departamento'),
                        tipo: formData.get('tipo')
                    });
                    App.renderView('usuarios');
                    this.showToast('Usuário cadastrado com sucesso!');
                    return true;
                } catch (err) {
                    alert('Erro ao criar usuário: ' + err.message);
                    return false;
                }
            });
        },

        openEditUser(id) {
            const user = Storage.getUsers().find(u => u.id === id);
            if (!user) return;

            const content = `
                <form id="edit-user-form" class="space-y-6">
                    <input type="hidden" name="id" value="${user.id}">
                    <div class="grid grid-cols-2 gap-4">
                        <div class="space-y-2">
                            <label class="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Nome Completo</label>
                            <input name="nome" type="text" value="${user.nome}" class="w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm outline-none" required>
                        </div>
                        <div class="space-y-2">
                            <label class="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">E-mail</label>
                            <input name="email" type="email" value="${user.email || ''}" class="w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm outline-none" required>
                        </div>
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div class="space-y-2">
                            <label class="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Departamento</label>
                            <input name="departamento" type="text" value="${user.departamento}" class="w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm outline-none" required>
                        </div>
                        <div class="space-y-2">
                            <label class="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Cargo / Nível</label>
                            <select name="tipo" class="w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm outline-none">
                                <option value="motorista" ${user.tipo === 'motorista' ? 'selected' : ''}>Motorista</option>
                                <option value="logistica" ${user.tipo === 'logistica' ? 'selected' : ''}>Logística</option>
                                <option value="administrador" ${user.tipo === 'administrador' ? 'selected' : ''}>Administrador</option>
                            </select>
                        </div>
                    </div>
                    <div class="flex items-center gap-3">
                         <input type="checkbox" name="ativo" ${user.ativo ? 'checked' : ''} class="w-5 h-5 rounded text-primary bg-surface-container-high border-none transition-all">
                         <label class="text-xs font-bold text-primary uppercase tracking-widest">Usuário Ativo</label>
                    </div>
                </form>
            `;
            App.showModal('Editar Usuário', content, async () => {
                const form = document.getElementById('edit-user-form');
                if (!form.checkValidity()) {
                    form.reportValidity();
                    return false;
                }
                const formData = new FormData(form);
                const profileUpdate = {
                    id: formData.get('id'),
                    nome: formData.get('nome'),
                    email: formData.get('email'),
                    departamento: formData.get('departamento'),
                    tipo: formData.get('tipo'),
                    ativo: formData.get('ativo') === 'on'
                };
                try {
                    await Storage.saveProfile(profileUpdate);
                    App.renderView('usuarios');
                    this.showToast('Usuário atualizado com sucesso!');
                    return true;
                } catch (err) {
                    alert('Erro ao atualizar usuário: ' + err.message);
                    return false;
                }
            });
        },

        async resetPassword(id) {
            if (confirm('Será enviado um e-mail de redefinição de senha para o usuário. Continuar?')) {
                const user = Storage.getUsers().find(u => u.id === id);
                if (user && user.email) {
                    const { error } = await supabaseClient.auth.resetPasswordForEmail(user.email);
                    if (error) {
                        alert('Erro: ' + error.message);
                    } else {
                        alert('E-mail de redefinição enviado com sucesso!');
                    }
                } else {
                    alert('Usuário sem e-mail cadastrado.');
                }
            }
        },

        openAddProject() {
            const content = `
                <form id="project-form" class="space-y-6">
                    <div class="space-y-2">
                        <label class="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Nome do Projeto</label>
                        <input name="nome" type="text" placeholder="Ex: Logística Norte" class="w-full bg-surface-container-low border-none rounded-2xl px-5 py-4 text-sm focus:ring-4 focus:ring-primary/5 transition-all outline-none" required>
                    </div>
                    <div class="space-y-2">
                        <label class="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Rubrica de Abastecimento (R$)</label>
                        <input name="rubrica" type="number" placeholder="0,00" class="w-full bg-surface-container-low border-none rounded-2xl px-5 py-4 text-sm focus:ring-4 focus:ring-primary/5 transition-all outline-none" required>
                    </div>
                    <div class="flex items-center gap-3 py-2">
                         <input type="checkbox" name="ativo" checked class="w-5 h-5 rounded text-primary focus:ring-primary/20 bg-surface-container-high border-none transition-all">
                         <label class="text-xs font-bold text-primary uppercase tracking-widest">Projeto Ativo</label>
                    </div>
                </form>
            `;
            App.showModal('Novo Projeto', content, async () => {
                const form = document.getElementById('project-form');
                if (!form.checkValidity()) {
                    form.reportValidity();
                    return false;
                }
                const formData = new FormData(form);
                const rubrica = parseFloat(formData.get('rubrica'));
                const project = {
                    nome: formData.get('nome'),
                    rubricaAbastecimento: rubrica,
                    saldo: rubrica,
                    ativo: formData.get('ativo') === 'on'
                };
                
                try {
                    await Storage.saveProject(project);
                    App.renderView('projetos');
                    this.showToast('Projeto criado com sucesso!');
                    return true;
                } catch (err) {
                    alert('Erro ao criar projeto: ' + err.message);
                    return false;
                }
            });
        },

        openEditProject(id) {
            const project = Storage.getProjects().find(p => p.id === id);
            if (!project) return;

            const content = `
                <form id="edit-project-form" class="space-y-6">
                    <input type="hidden" name="id" value="${project.id}">
                    <div class="space-y-2">
                        <label class="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Nome do Projeto</label>
                        <input name="nome" type="text" value="${project.nome}" class="w-full bg-surface-container-low border-none rounded-2xl px-5 py-4 text-sm focus:ring-4 focus:ring-primary/5 transition-all outline-none" required>
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div class="space-y-2">
                            <label class="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Rubrica Total (R$)</label>
                            <input name="rubrica" type="number" value="${project.rubricaAbastecimento}" class="w-full bg-surface-container-low border-none rounded-2xl px-5 py-4 text-sm focus:ring-4 focus:ring-primary/5 transition-all outline-none" required>
                        </div>
                        <div class="space-y-2">
                            <label class="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Saldo Atual (R$)</label>
                            <input name="saldo" type="number" value="${project.saldo}" class="w-full bg-surface-container-low border-none rounded-2xl px-5 py-4 text-sm focus:ring-4 focus:ring-primary/5 transition-all outline-none" required>
                        </div>
                    </div>
                    <div class="flex items-center gap-3 py-2">
                         <input type="checkbox" name="ativo" ${project.ativo ? 'checked' : ''} class="w-5 h-5 rounded text-primary focus:ring-primary/20 bg-surface-container-high border-none transition-all">
                         <label class="text-xs font-bold text-primary uppercase tracking-widest">Projeto Ativo</label>
                    </div>
                </form>
            `;

            App.showModal('Editar Projeto', content, async () => {
                const form = document.getElementById('edit-project-form');
                if (!form.checkValidity()) {
                    form.reportValidity();
                    return false;
                }
                const formData = new FormData(form);
                const projectUpdate = {
                    id: formData.get('id'),
                    nome: formData.get('nome'),
                    rubricaAbastecimento: parseFloat(formData.get('rubrica')),
                    saldo: parseFloat(formData.get('saldo')),
                    ativo: formData.get('ativo') === 'on'
                };
                
                try {
                    await Storage.saveProject(projectUpdate);
                    App.renderView('projetos');
                    this.showToast('Projeto atualizado com sucesso!');
                    return true;
                } catch (err) {
                    alert('Erro ao atualizar projeto: ' + err.message);
                    return false;
                }
            });
        },

        async deleteProject(id) {
            if (confirm('Tem certeza que deseja excluir este projeto? Esta ação não pode ser desfeita.')) {
                await Storage.deleteProject(id);
                App.renderView('projetos');
            }
        },

        async addChecklistItem() {
            const nome = prompt('Digite o nome do novo Item de Inspeção:');
            if (nome && nome.trim() !== '') {
                await Storage.addChecklistItem(nome.trim());
                App.renderView('configuracoes');
                this.showToast('Item de Inspeção adicionado.');
            }
        },

        async deleteChecklistItem(id) {
            if (confirm('Tem certeza que deseja excluir este item de inspeção? Isso afetará os próximos agendamentos.')) {
                await Storage.deleteChecklistItem(id);
                App.renderView('configuracoes');
                this.showToast('Item de Inspeção removido.');
            }
        },

        addMaintenanceRule() {
            this.openMaintenanceRuleModal();
        },

        editMaintenanceRule(id) {
            const rule = Storage.getMaintenanceRules().find(r => r.id === id);
            if (rule) this.openMaintenanceRuleModal(rule);
        },

        openMaintenanceRuleModal(rule = null) {
            const content = `
                <form id="maintenance-rule-form" class="space-y-6">
                    <input type="hidden" name="id" value="${rule?.id || ''}">
                    <div class="space-y-2">
                        <label class="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Nome do Item</label>
                        <input name="nome" type="text" value="${rule?.nome || ''}" placeholder="Ex: Óleo do Motor" class="w-full bg-surface-container-low border-none rounded-2xl px-5 py-4 text-sm font-black text-primary outline-none focus:ring-4 focus:ring-primary/5 transition-all" required>
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div class="space-y-2">
                            <label class="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Intervalo (KM)</label>
                            <input name="intervaloKM" type="number" value="${rule?.intervaloKM || 5000}" class="w-full bg-surface-container-low border-none rounded-2xl px-5 py-4 text-sm font-black text-primary outline-none focus:ring-4 focus:ring-primary/5 transition-all" required>
                        </div>
                        <div class="space-y-2">
                            <label class="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Ícone (Material Symbols)</label>
                            <input name="icone" type="text" value="${rule?.icone || 'handyman'}" placeholder="oil_barrel, build, etc" class="w-full bg-surface-container-low border-none rounded-2xl px-5 py-4 text-sm font-black text-primary outline-none focus:ring-4 focus:ring-primary/5 transition-all">
                        </div>
                    </div>
                </form>
            `;

            App.showModal(rule ? 'Editar Regra de Manutenção' : 'Nova Regra de Manutenção', content, async () => {
                const form = document.getElementById('maintenance-rule-form');
                if (!form.checkValidity()) {
                    form.reportValidity();
                    return false;
                }
                const formData = new FormData(form);
                const data = {
                    id: formData.get('id') || undefined,
                    nome: formData.get('nome'),
                    intervaloKM: parseInt(formData.get('intervaloKM')),
                    icone: formData.get('icone') || 'handyman'
                };
                
                try {
                    await Storage.saveMaintenanceRule(data);
                    App.renderView('configuracoes');
                    this.showToast(rule ? 'Regra atualizada com sucesso.' : 'Regra criada com sucesso.');
                    return true;
                } catch (err) {
                    alert('Erro ao salvar regra: ' + err.message);
                    return false;
                }
            });
        },

        async deleteMaintenanceRule(id) {
            if (confirm('Deseja excluir esta regra de manutenção preventiva?')) {
                await Storage.deleteMaintenanceRule(id);
                App.renderView('configuracoes');
                this.showToast('Regra excluída.');
            }
        },

        openCorrectiveMaintenanceModal(vehicleId = '') {
            const vehicles = Storage.getVehicles().filter(v => v.status === 'ativo');
            const projects = Storage.getProjects().filter(p => p.ativo);
            
            const content = `
                <form id="corrective-form" class="space-y-6">
                    <div class="space-y-2">
                        <label class="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Veículo</label>
                        <select name="veiculoId" class="w-full bg-surface-container-low border-none rounded-2xl px-5 py-4 text-sm font-black text-primary outline-none focus:ring-4 focus:ring-primary/5 transition-all appearance-none" required>
                            <option value="">Selecione...</option>
                            ${vehicles.map(v => `<option value="${v.id}" ${v.id === vehicleId ? 'selected' : ''}>${v.nome} (${v.placa})</option>`).join('')}
                        </select>
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                        <div class="space-y-2">
                            <label class="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Projeto Responsável</label>
                            <select name="projetoId" class="w-full bg-surface-container-low border-none rounded-2xl px-5 py-4 text-sm font-black text-primary outline-none focus:ring-4 focus:ring-primary/5 transition-all appearance-none" required>
                                <option value="">Selecione...</option>
                                ${projects.map(p => `<option value="${p.id}">${p.nome}</option>`).join('')}
                            </select>
                        </div>
                        <div class="space-y-2">
                            <label class="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Custo Total (R$)</label>
                            <input name="valor" type="number" step="0.01" placeholder="0,00" class="w-full bg-surface-container-low border-none rounded-2xl px-5 py-4 text-sm font-black text-primary outline-none focus:ring-4 focus:ring-primary/5 transition-all" required>
                        </div>
                    </div>

                    <div class="space-y-2">
                        <label class="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Descrição do Problema / Conserto</label>
                        <textarea name="observacao" rows="4" placeholder="Descreva o que foi consertado..." class="w-full bg-surface-container-low border-none rounded-3xl px-5 py-4 text-sm font-medium text-primary outline-none focus:ring-4 focus:ring-primary/5 transition-all resize-none" required></textarea>
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                        <div class="space-y-2">
                            <label class="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">KM no Momento</label>
                            <input name="kmRealizada" type="number" class="w-full bg-surface-container-low border-none rounded-2xl px-5 py-4 text-sm font-black text-primary outline-none focus:ring-4 focus:ring-primary/5 transition-all" required>
                        </div>
                        <div class="space-y-2">
                            <label class="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Data Realizada</label>
                            <input name="data" type="date" value="${new Date().toISOString().split('T')[0]}" class="w-full bg-surface-container-low border-none rounded-2xl px-5 py-4 text-sm font-black text-primary outline-none focus:ring-4 focus:ring-primary/5 transition-all" required>
                        </div>
                    </div>
                </form>
            `;

            App.showModal('Registrar Manutenção Corretiva', content, async () => {
                const form = document.getElementById('corrective-form');
                if (!form.checkValidity()) { form.reportValidity(); return false; }
                const formData = new FormData(form);
                const user = Storage.getLoggedInUser();
                const log = {
                    tipo: 'corretiva',
                    veiculoId: formData.get('veiculoId'),
                    projetoId: formData.get('projetoId'),
                    valor: formData.get('valor'),
                    observacao: formData.get('observacao'),
                    kmRealizada: parseInt(formData.get('kmRealizada')),
                    usuarioNome: user ? user.nome : 'Sistema',
                    data: formData.get('data') ? new Date(formData.get('data') + 'T12:00:00Z').toISOString() : new Date().toISOString()
                };
                
                try {
                    await Storage.saveMaintenanceLog(log);
                    App.renderView('manutencao');
                    this.showToast('Manutenção Corretiva registrada com sucesso!');
                    return true;
                } catch (err) {
                    alert('Erro ao registrar manutenção: ' + err.message);
                    return false;
                }
            });
        },

        openPreventiveMaintenanceModal(vehicleId = '') {
            const allVehicles = Storage.getVehicles().filter(v => v.status === 'ativo');
            const vehicle = allVehicles.find(v => v.id === vehicleId);
            const rules = Storage.getMaintenanceRules();
            const projects = Storage.getProjects().filter(p => p.ativo);

            const content = `
                <form id="preventive-form" class="space-y-6">
                    <div class="space-y-2">
                        <label class="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Veículo Alvo</label>
                        <select name="veiculoId" id="p-veh-select" class="w-full bg-surface-container-low border-none rounded-2xl px-5 py-4 text-sm font-black text-primary outline-none focus:ring-4 focus:ring-primary/5 transition-all appearance-none" required>
                            <option value="">Selecione o veículo...</option>
                            ${allVehicles.map(v => `<option value="${v.id}" data-km="${v.km}" ${v.id === vehicleId ? 'selected' : ''}>${v.nome} (${v.placa})</option>`).join('')}
                        </select>
                    </div>
                    
                    <div class="space-y-3">
                        <label class="text-[10px] font-black text-on-surface-variant uppercase tracking-widest ml-1">Itens Realizados</label>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-48 overflow-y-auto pr-2 scrollbar-hide">
                            ${rules.map(r => `
                                <label class="flex items-center gap-3 p-4 bg-surface-container-low rounded-2xl border-2 border-transparent cursor-pointer has-[:checked]:border-primary transition-all">
                                    <input type="checkbox" name="regraIds" value="${r.id}" class="w-5 h-5 accent-primary">
                                    <div class="flex flex-col">
                                        <span class="text-[10px] font-black text-primary uppercase">${r.nome}</span>
                                        <span class="text-[8px] font-bold text-on-surface-variant opacity-40 uppercase tracking-widest">${r.intervaloKM.toLocaleString()} KM</span>
                                    </div>
                                </label>
                            `).join('')}
                        </div>
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                        <div class="space-y-2">
                             <label class="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Projeto</label>
                             <select name="projetoId" class="w-full bg-surface-container-low border-none rounded-2xl px-5 py-4 text-sm font-black text-primary outline-none focus:ring-4 focus:ring-primary/5 transition-all appearance-none" required>
                                <option value="">Selecione...</option>
                                ${projects.map(p => `<option value="${p.id}">${p.nome}</option>`).join('')}
                            </select>
                        </div>
                        <div class="space-y-2">
                            <label class="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Custo Total (R$)</label>
                            <input name="valor" type="number" step="0.01" class="w-full bg-surface-container-low border-none rounded-2xl px-5 py-4 text-sm font-black text-primary outline-none focus:ring-4 focus:ring-primary/5 transition-all" required>
                        </div>
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                        <div class="space-y-2">
                            <label class="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">KM Atual no Painel</label>
                            <input name="kmRealizada" id="p-km-input" type="number" value="${vehicle?.km || ''}" class="w-full bg-surface-container-low border-none rounded-2xl px-5 py-4 text-sm font-black text-primary outline-none focus:ring-4 focus:ring-primary/5 transition-all" required>
                        </div>
                        <div class="space-y-2">
                            <label class="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Data Realizada</label>
                            <input name="data" type="date" value="${new Date().toISOString().split('T')[0]}" class="w-full bg-surface-container-low border-none rounded-2xl px-5 py-4 text-sm font-black text-primary outline-none focus:ring-4 focus:ring-primary/5 transition-all" required>
                        </div>
                    </div>
                </form>
            `;

            App.showModal('Realizar Manutenção Preventiva', content, async () => {
                const form = document.getElementById('preventive-form');
                const checked = form.querySelectorAll('input[name="regraIds"]:checked');
                if (checked.length === 0) {
                    alert('Selecione pelo menos um item realizado.');
                    return false;
                }
                if (!form.checkValidity()) { form.reportValidity(); return false; }
                
                const formData = new FormData(form);
                const valorRateado = parseFloat(formData.get('valor')) / checked.length;
                const user = Storage.getLoggedInUser();
                
                try {
                    for (const cb of checked) {
                        const log = {
                            tipo: 'preventiva',
                            veiculoId: formData.get('veiculoId'),
                            projetoId: formData.get('projetoId'),
                            regraId: cb.value,
                            valor: valorRateado,
                            kmRealizada: parseInt(formData.get('kmRealizada')),
                            usuarioNome: user ? user.nome : 'Sistema',
                            data: formData.get('data') ? new Date(formData.get('data') + 'T12:00:00Z').toISOString() : new Date().toISOString()
                        };
                        await Storage.saveMaintenanceLog(log);
                    }

                    App.renderView('manutencao');
                    this.showToast('Manutenção Preventiva registrada com sucesso!');
                    return true;
                } catch (err) {
                    alert('Erro ao registrar manutenção: ' + err.message);
                    return false;
                }
            });

            // Listener para atualizar KM ao trocar veículo
            document.getElementById('p-veh-select').addEventListener('change', (e) => {
                const opt = e.target.options[e.target.selectedIndex];
                const km = opt.getAttribute('data-km');
                if (km) document.getElementById('p-km-input').value = km;
            });
        },

        async saveChecklist(formData) {
            const bookingId = formData.get('bookingId');
            const type = formData.get('type');
            const km = parseInt(formData.get('km'));

            const booking = Storage.getBookings().find(b => b.id === bookingId);
            if (!booking) return;

            // Coletar resultados com processamento de imagem em paralelo
            const checklistResults = await Promise.all(Storage.getChecklistItems().map(async item => {
                const status = formData.get(`item_${item.id}`);
                const obs = formData.get(`obs_${item.id}`);
                const file = formData.get(`foto_${item.id}`);
                
                let fotoData = null;
                if (file && file.size > 0) {
                    try {
                        fotoData = await App.utils.compressImage(file);
                    } catch (e) {
                        console.error('Erro ao processar imagem:', e);
                    }
                }

                return {
                    id: item.id,
                    nome: item.nome,
                    status: status, // 'ok' or 'nok'
                    observacao: status === 'nok' ? obs : '',
                    hasFoto: !!fotoData,
                    fotoData: fotoData // Versão comprimida em Base64
                };
            }));

            const hasInconformity = checklistResults.some(r => r.status === 'nok');

            const newStatus = type === 'out' ? 'em_curso' : 'concluido';
            
            // Define keys based on type
            const logKey = type === 'out' ? 'checklistSaida' : 'checklistRetorno';
            
            // Update Booking
            await Storage.updateBooking(bookingId, { 
                status: newStatus,
                [logKey]: { 
                    results: checklistResults, 
                    hasInconformity, 
                    data: new Date().toISOString(),
                    resumo: {
                        destino: booking.destino,
                        projeto: Storage.getProjects().find(p => p.id === booking.projetoId)?.nome || 'N/A'
                    }
                },
                ...(type === 'in' ? { kmFinal: km } : { kmInicial: km })
            });

            // Update Vehicle
            await supabaseClient.from('vehicles').update({
                km: km,
                disponivel: (newStatus === 'concluido')
            }).eq('id', booking.veiculoId);
            await Storage._refreshTable('vehicles');

            if (hasInconformity) {
                this.showToast('Checklist salvo com Inconformidades registradas.', 'error');
            } else {
                this.showToast('Checklist 100% Conforme. Viagem atualizada!');
            }

            window.location.hash = '#agendamentos';
        },

        openFuelModal(bookingId) {
            const booking = Storage.getBookings().find(b => b.id === bookingId);
            const vehicle = Storage.getVehicles().find(v => v.id === booking.veiculoId);
            const project = Storage.getProjects().find(p => p.id === booking.projetoId);

            const content = `
                <div class="space-y-6">
                    <div class="p-6 bg-surface-container-low rounded-2xl border border-outline-variant/10 flex items-center gap-4">
                        <div class="w-12 h-12 bg-primary rounded-xl flex items-center justify-center text-white font-black">
                            <span class="material-symbols-outlined">local_gas_station</span>
                        </div>
                        <div>
                            <p class="text-[10px] font-black text-on-surface-variant uppercase tracking-widest leading-none mb-1">Projeto Vinculado</p>
                            <p class="text-sm font-black text-primary uppercase">${project?.nome}</p>
                        </div>
                    </div>

                    <form id="fuel-form" class="space-y-6">
                        <input type="hidden" name="bookingId" value="${bookingId}">
                        <input type="hidden" name="projetoId" value="${booking.projetoId}">
                        <input type="hidden" name="veiculoId" value="${booking.veiculoId}">
                        
                        <div class="grid grid-cols-2 gap-4">
                            <div class="space-y-2">
                                <label class="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">KM Atual</label>
                                <input name="km" type="number" value="${vehicle?.km}" class="w-full bg-surface-container-low border-none rounded-2xl px-5 py-4 text-sm focus:ring-4 focus:ring-primary/5 transition-all outline-none" required>
                            </div>
                            <div class="space-y-2">
                                <label class="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Valor Total (R$)</label>
                                <input name="valor" type="number" step="0.01" placeholder="0,00" class="w-full bg-surface-container-low border-none rounded-2xl px-5 py-4 text-sm focus:ring-4 focus:ring-primary/5 transition-all outline-none" required>
                            </div>
                        </div>

                        <div class="space-y-2">
                            <label class="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Cupom Fiscal / Recibo</label>
                            <div onclick="this.querySelector('input').click()" class="w-full h-40 border-2 border-dashed border-outline-variant/20 rounded-3xl flex flex-col items-center justify-center text-on-surface-variant bg-surface-container-lowest hover:border-primary/40 hover:bg-primary/5 transition-all cursor-pointer group">
                                <span class="material-symbols-outlined text-4xl opacity-30 group-hover:opacity-100 group-hover:scale-110 transition-all">add_a_photo</span>
                                <span class="text-[9px] font-black uppercase tracking-widest mt-3 opacity-40">Clique para anexar imagem</span>
                                <input type="file" class="hidden" accept="image/*">
                            </div>
                        </div>
                    </form>
                </div>
            `;

            App.showModal('Registrar Abastecimento', content, async () => {
                const form = document.getElementById('fuel-form');
                if (!form.checkValidity()) { form.reportValidity(); return false; }
                const formData = new FormData(form);
                
                try {
                    await this.saveFuelEntry(formData);
                    // O toast já é mostrado em saveFuelEntry, mas podemos reforçar aqui se necessário
                    return true;
                } catch (err) {
                    alert('Erro ao registrar abastecimento: ' + err.message);
                    return false;
                }
            });
        },

        async saveFuelEntry(formData) {
            const entry = {
                bookingId: formData.get('bookingId'),
                projetoId: formData.get('projetoId'),
                veiculoId: formData.get('veiculoId'),
                km: parseInt(formData.get('km')),
                valor: parseFloat(formData.get('valor'))
            };
            
            await Storage.saveFuelEntry(entry);
            App.renderView('agendamentos');
            // Notificação Premium
            const toast = document.createElement('div');
            toast.className = 'fixed bottom-8 right-8 bg-primary text-white px-8 py-4 rounded-2xl shadow-2xl z-50 animate-in slide-in-from-right duration-500 font-bold text-xs uppercase tracking-widest';
            toast.innerHTML = 'Abastecimento registrado. Saldo atualizado!';
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 3000);
        },

        finishTrip(bookingId) {
            const booking = Storage.getBookings().find(b => b.id === bookingId);
            const vehicle = Storage.getVehicles().find(v => v.id === booking.veiculoId);
            
            const content = `
                <div class="space-y-6">
                    <p class="text-sm font-medium text-on-surface-variant leading-relaxed">Você está encerrando a jornada do veículo <strong class="text-primary">${vehicle?.nome}</strong>. Informe o KM final para liberar a frota.</p>
                    <form id="finish-trip-form" class="space-y-4">
                        <div class="space-y-2">
                            <label class="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">KM Final no Painel</label>
                            <input id="final-km" type="number" value="${vehicle?.km}" class="w-full bg-surface-container-low border-none rounded-2xl px-5 py-4 text-sm outline-none focus:ring-4 focus:ring-primary/5 transition-all font-black text-primary" required>
                        </div>
                    </form>
                    <div class="p-5 bg-emerald-50 rounded-2xl border border-emerald-100 flex gap-4">
                         <div class="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600">
                            <span class="material-symbols-outlined">verified</span>
                         </div>
                         <div>
                            <p class="text-[10px] font-black text-emerald-700 uppercase tracking-widest mb-0.5">Disponibilidade</p>
                            <p class="text-xs text-emerald-600 font-medium"> veículo será liberado para novos agendamentos imediatamente.</p>
                         </div>
                    </div>
                </div>
            `;

            App.showModal('Finalizar Viagem', content, async () => {
                const kmFinal = parseInt(document.getElementById('final-km').value);
                
                try {
                    await Storage.updateBooking(bookingId, {
                        status: 'concluido',
                        kmFinal: kmFinal,
                        dataConclusao: new Date().toISOString()
                    });

                    // Atualizar Veículo
                    await supabaseClient.from('vehicles').update({
                        km: kmFinal,
                        disponivel: true
                    }).eq('id', booking.veiculoId);
                    await Storage._refreshTable('vehicles');

                    App.renderView('agendamentos');
                    this.showToast('Viagem finalizada com sucesso. Veículo disponível!');
                    return true;
                } catch (err) {
                    alert('Erro ao finalizar viagem: ' + err.message);
                    return false;
                }
            });
        },

        openEditBooking(id) { 
            window.location.hash = `#editar-agendamento?id=${id}`;
        },
        async deleteBooking(id) {
            if (confirm('Deseja excluir permanentemente este agendamento?')) {
                await supabaseClient.from('bookings').delete().eq('id', id);
                await Storage._refreshTable('bookings');
                App.renderView('agendamentos');
            }
        },
        async cancelBooking(id) {
            if (confirm('Deseja cancelar esta viagem? O veículo será liberado imediatamente.')) {
                await Storage.cancelBooking(id);
                App.renderView('agendamentos');
            }
        },

        openMaintenanceHistory(vehicleId) {
            const vehicle = Storage.getVehicles().find(v => v.id === vehicleId);
            const logs = Storage.getMaintenanceLogs()
                .filter(l => l.veiculoId === vehicleId)
                .sort((a, b) => new Date(b.data) - new Date(a.data));
            const rules = Storage.getMaintenanceRules();
            const projects = Storage.getProjects();

            const content = `
                <div class="space-y-6">
                    <header class="flex items-center gap-4 p-5 bg-surface-container-low rounded-[2rem] border border-outline-variant/10">
                        <div class="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-primary shadow-sm">
                            <span class="material-symbols-outlined text-3xl">local_shipping</span>
                        </div>
                        <div>
                            <h4 class="text-lg font-black text-primary uppercase leading-tight">${vehicle?.nome}</h4>
                            <p class="text-[10px] font-bold text-on-surface-variant opacity-60 uppercase tracking-widest leading-none mt-1">
                                ${vehicle?.placa} • <span class="text-primary">${vehicle?.km.toLocaleString()} KM</span> ATUAL
                            </p>
                        </div>
                    </header>

                    <div class="space-y-4 max-h-[500px] overflow-y-auto pr-2 scrollbar-hide">
                        ${logs.length === 0 ? `
                            <div class="py-20 text-center space-y-4 opacity-40">
                                <span class="material-symbols-outlined text-5xl">history_toggle_off</span>
                                <p class="text-xs font-black uppercase tracking-widest">Nenhum registro encontrado</p>
                            </div>
                        ` : logs.map(l => {
                            const isPreventive = l.tipo === 'preventiva';
                            const rule = rules.find(r => r.id === l.regraId);
                            const proj = projects.find(p => p.id === l.projetoId);
                            
                            const colorClass = isPreventive ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600';
                            const badgeClass = isPreventive ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800';

                            return `
                                <div class="bg-white rounded-3xl p-5 border border-outline-variant/10 hover:border-primary/20 transition-all space-y-4 group">
                                    <div class="flex justify-between items-start">
                                        <div class="flex items-center gap-4">
                                            <div class="w-10 h-10 rounded-xl ${colorClass} flex items-center justify-center transition-transform group-hover:scale-110">
                                                <span class="material-symbols-outlined">${isPreventive ? (rule?.icone || 'build') : 'handyman'}</span>
                                            </div>
                                            <div>
                                                <div class="flex items-center gap-2">
                                                    <span class="text-[11px] font-black text-primary uppercase">${isPreventive ? (rule?.nome || 'Manutenção Preventiva') : 'Correção Técnica'}</span>
                                                    <span class="px-2 py-0.5 rounded-full text-[8px] font-black uppercase ${badgeClass}">
                                                        ${isPreventive ? 'Preventiva' : 'Corretiva'}
                                                    </span>
                                                </div>
                                                <p class="text-[9px] font-bold text-on-surface-variant opacity-60 uppercase tracking-widest mt-0.5">
                                                    ${new Date(l.data).toLocaleDateString('pt-BR')} ${new Date(l.data).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})} • ${l.kmRealizada.toLocaleString()} KM
                                                </p>
                                            </div>
                                        </div>
                                        <div class="text-right">
                                            <p class="text-sm font-black text-primary">R$ ${parseFloat(l.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                            <p class="text-[8px] font-black text-on-surface-variant opacity-40 uppercase tracking-tighter">${proj?.nome || 'N/A'}</p>
                                        </div>
                                    </div>

                                    ${l.observacao ? `
                                        <div class="p-4 bg-surface-container-low rounded-2xl border border-outline-variant/5">
                                            <p class="text-[10px] text-on-surface-variant italic leading-relaxed">"${l.observacao}"</p>
                                        </div>
                                    ` : ''}

                                    <div class="flex items-center justify-between pt-2 border-t border-outline-variant/5">
                                        <div class="flex items-center gap-2">
                                            <div class="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                                <span class="material-symbols-outlined text-[10px]">person</span>
                                            </div>
                                            <span class="text-[9px] font-bold text-on-surface-variant uppercase tracking-widest">Responsável: <span class="text-primary">${l.usuarioNome || 'Sistema'}</span></span>
                                        </div>
                                        <div class="flex items-center gap-1 text-[9px] font-bold text-on-surface-variant opacity-40">
                                            <span class="material-symbols-outlined text-[12px]">calendar_today</span>
                                            <span>Entrada: ${new Date(l.data).toLocaleDateString('pt-BR')}</span>
                                        </div>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;

            App.showModal('Histórico de Atividades', content, () => true);
        },


        generateReport(type, formData) {
            const contentArea = document.getElementById('view-content');
            let reportHtml = '';
            let isLandscape = false;

            // Header Corporativo para o Impresso
            const headerHtml = `
                <div class="hidden print:block mb-10 border-b-4 border-primary pb-6">
                    <div class="flex justify-between items-end">
                        <div>
                            <h1 class="text-3xl font-black text-primary">${Storage.getSettings().nomeSistema}</h1>
                            <p class="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest leading-none">Relatórios de Gestão e Logística</p>
                        </div>
                        <div class="text-right">
                            <p class="text-xs font-bold text-primary">Emitido em: ${new Date().toLocaleString('pt-BR')}</p>
                            <p class="text-[9px] font-medium text-on-surface-variant opacity-60">ID Auditoria: ${Math.random().toString(36).substr(2, 9).toUpperCase()}</p>
                        </div>
                    </div>
                </div>
            `;

            if (type === 'manutencao') {
                const veiculoId = formData.get('veiculoId');
                const dataInicio = formData.get('dataInicio');
                const dataFim = formData.get('dataFim');
                const logs = Storage.getMaintenanceLogs().filter(l => {
                    const passVeiculo = veiculoId === 'all' || l.veiculoId === veiculoId;
                    const logDateObj = new Date(l.data || Date.now());
                    const logDate = isNaN(logDateObj) ? '' : logDateObj.toISOString().split('T')[0];
                    const passInicio = !dataInicio || logDate >= dataInicio;
                    const passFim = !dataFim || logDate <= dataFim;
                    return passVeiculo && passInicio && passFim;
                });
                const vehicles = Storage.getVehicles();
                const rules = Storage.getMaintenanceRules();

                reportHtml = `
                    <div class="space-y-8 animate-in fade-in duration-500">
                        <div class="flex justify-between items-center no-print bg-surface-container-low p-4 rounded-xl mb-8">
                            <button onclick="App.renderView('relatorios')" class="text-xs font-bold text-on-surface-variant hover:text-primary transition-colors flex items-center gap-2 uppercase tracking-widest">
                                <span class="material-symbols-outlined text-sm">arrow_back</span> Voltar
                            </button>
                            <button onclick="window.print()" class="bg-primary text-white px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-primary/20">Imprimir / Salvar PDF</button>
                        </div>

                        ${headerHtml}
                        <h2 class="text-2xl font-black text-primary mb-6">Relatório Consolidado de Manutenção</h2>

                        <div class="overflow-x-auto">
                            <table class="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr class="bg-primary text-white">
                                        <th class="py-4 px-4 font-black uppercase text-[9px]">Veículo</th>
                                        <th class="py-4 px-4 font-black uppercase text-[9px]">Serviço / Detalhes</th>
                                        <th class="py-4 px-4 font-black uppercase text-[9px]">Data / KM</th>
                                        <th class="py-4 px-4 font-black uppercase text-[9px]">Responsável</th>
                                        <th class="py-4 px-4 font-black uppercase text-[9px] text-right">Custo</th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y divide-outline-variant/20">
                                    ${logs.map(l => {
                                        const v = vehicles.find(veh => veh.id === l.veiculoId);
                                        const r = rules.find(rule => rule.id === l.regraId);
                                        const isPreventive = l.tipo === 'preventiva';
                                        
                                        return `
                                            <tr class="hover:bg-primary/5 transition-colors">
                                                <td class="py-4 px-4 font-bold text-primary">${v?.nome || 'Excluído'}<br><span class="text-[8px] opacity-40 uppercase">${v?.placa || ''}</span></td>
                                                <td class="py-4 px-4">
                                                    <p class="font-black ${isPreventive ? 'text-emerald-700' : 'text-amber-700'} uppercase text-[10px]">
                                                        ${isPreventive ? (r?.nome || 'Preventiva') : 'Corretiva'}
                                                    </p>
                                                    <p class="text-[9px] text-on-surface-variant opacity-60 leading-relaxed mt-1 max-w-xs">
                                                        ${l.observacao || (isPreventive ? 'Manutenção Preventiva de Rotina' : 'Serviço Corretivo')}
                                                    </p>
                                                </td>
                                                <td class="py-4 px-4">
                                                    <p class="font-bold">${new Date(l.data).toLocaleDateString('pt-BR')}</p>
                                                    <p class="text-[9px] opacity-40 uppercase tracking-widest">${(l.kmRealizada || 0).toLocaleString()} KM</p>
                                                </td>
                                                <td class="py-4 px-4 font-medium text-on-surface-variant opacity-60 uppercase text-[9px]">
                                                    ${l.usuarioNome || 'Sistema'}
                                                </td>
                                                <td class="py-4 px-4 text-right font-black text-primary">R$ ${parseFloat(l.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                            </tr>
                                        `;
                                    }).join('')}
                                </tbody>
                                <tfoot>
                                    <tr class="bg-surface-container-high font-black">
                                        <td colspan="4" class="py-4 px-4 text-right uppercase tracking-widest text-[9px]">Investimento Total no Período</td>
                                        <td class="py-4 px-4 text-right text-base text-primary">R$ ${logs.reduce((a,b) => a + parseFloat(b.valor || 0), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                `;
            } else if (type === 'checklists') {
                const onlyInconformities = formData.get('onlyInconformities') === 'on';
                const veiculoId = formData.get('veiculoId');
                const dataInicio = formData.get('dataInicio');
                const dataFim = formData.get('dataFim');
                const vehicles = Storage.getVehicles();
                const users = Storage.getUsers();

                // Unificar Eventos (Checklists e Correções)
                const bookings = Storage.getBookings();
                const corrections = Storage.getCorrections();
                let events = [];

                bookings.forEach(b => {
                    const passVeiculo = veiculoId === 'all' || b.veiculoId === veiculoId;
                    if (!passVeiculo) return;
                    const motorista = users.find(u => u.id === b.motoristaId);
                    const nomeStr = motorista ? motorista.nome : 'Motorista';
                    if (b.checklistSaida) events.push({ ...b.checklistSaida, veiculoId: b.veiculoId, responsavel: nomeStr, tipo: 'Checklist Saída' });
                    if (b.checklistRetorno) events.push({ ...b.checklistRetorno, veiculoId: b.veiculoId, responsavel: nomeStr, tipo: 'Checklist Retorno' });
                });

                corrections.forEach(c => {
                    const passVeiculo = veiculoId === 'all' || c.veiculoId === veiculoId;
                    if (passVeiculo) events.push({ ...c, tipo: 'Correção Técnica', data: c.dataRegistro });
                });

                // Filtrar por Datas
                events = events.filter(e => {
                    const logDateObj = new Date(e.data || e.dataRegistro || Date.now());
                    const logDate = isNaN(logDateObj) ? '' : logDateObj.toISOString().split('T')[0];
                    const passInicio = !dataInicio || logDate >= dataInicio;
                    const passFim = !dataFim || logDate <= dataFim;
                    return passInicio && passFim;
                });

                // Ordenar do mais novo para o mais antigo
                events.sort((a,b) => {
                    const dateA = new Date(a.data || a.dataRegistro || 0);
                    const dateB = new Date(b.data || b.dataRegistro || 0);
                    return dateB - dateA;
                });

                reportHtml = `
                    <div class="space-y-8 animate-in fade-in duration-500">
                        <div class="flex justify-between items-center no-print bg-surface-container-low p-4 rounded-xl mb-8">
                             <button onclick="App.renderView('relatorios')" class="text-xs font-bold text-on-surface-variant hover:text-primary transition-colors flex items-center gap-2 uppercase tracking-widest">
                                <span class="material-symbols-outlined text-sm">arrow_back</span> Voltar
                            </button>
                            <button onclick="window.print()" class="bg-primary text-white px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-primary/20">Imprimir / Salvar PDF</button>
                        </div>

                        ${headerHtml}
                        <h2 class="text-2xl font-black text-primary mb-6">Auditoria Geral de Inspeções</h2>
                        <div class="flex gap-4 mb-4">
                            <p class="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest bg-surface-container-low px-3 py-1 rounded-full">Filtro: ${onlyInconformities ? 'Apenas Inconformidades' : 'Histórico Completo'}</p>
                            ${dataInicio || dataFim ? `<p class="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest bg-surface-container-low px-3 py-1 rounded-full">Período Selecionado</p>` : ''}
                            ${veiculoId !== 'all' ? `<p class="text-[10px] font-bold text-primary uppercase tracking-widest bg-primary/10 px-3 py-1 rounded-full">Veículo Filtrado</p>` : ''}
                        </div>

                        <table class="w-full text-[11px] border-collapse">
                            <thead>
                                <tr class="bg-primary text-white text-left">
                                    <th class="py-4 px-4 font-black uppercase text-[10px]">Veículo</th>
                                    <th class="py-4 px-4 font-black uppercase text-[10px]">Tipo / Data</th>
                                    <th class="py-4 px-4 font-black uppercase text-[10px]">Status / Resp.</th>
                                    <th class="py-4 px-4 font-black uppercase text-[10px]">Observações / Evidências</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-outline-variant/20">
                                ${events.length === 0 ? `<tr><td colspan="4" class="py-8 text-center text-on-surface-variant opacity-60 italic text-xs">Nenhuma inspeção ou correção encontrada neste período.</td></tr>` : ''}
                                ${events.map(event => {
                                    if (onlyInconformities && !event.hasInconformity && event.tipo.includes('Checklist')) return '';

                                    const v = vehicles.find(veh => veh.id === event.veiculoId);
                                    const isCorrection = event.tipo === 'Correção Técnica';

                                    // Para correções, mostramos o que foi checado como "ok" ou itens resolvidos
                                    // Para checklists, mostramos os "nok"
                                    const detailsItems = (event.results || []).filter(r => isCorrection ? (r.status === 'ok' || r.observacao) : r.status === 'nok');
                                    
                                    const details = detailsItems.map(r => {
                                        const imgHtml = r.fotoData ? `<br><img src="${r.fotoData}" class="mt-3 max-h-24 w-auto object-contain rounded border border-outline-variant/30 shadow-sm">` : '';
                                        return `<div class="mb-4"><strong>${r.nome}:</strong> <span class="pl-1">${r.observacao || (isCorrection ? 'Inspeção resolvida/Conferido' : 'Sem observação')}</span>${imgHtml}</div>`;
                                    }).join('');

                                    if (onlyInconformities && !isCorrection && !details) return '';

                                    return `
                                        <tr class="${isCorrection ? 'bg-emerald-400/10 text-emerald-900 border-l-4 border-l-emerald-500' : (event.hasInconformity ? 'bg-error/5 text-error border-l-4 border-l-error' : '')}">
                                            <td class="py-4 px-4 font-bold border-b border-outline-variant/10 align-top">${v?.nome || 'N/A'}<br><span class="opacity-50">${v?.placa || ''}</span></td>
                                            <td class="py-4 px-4 border-b border-outline-variant/10 align-top">
                                                <strong class="${isCorrection ? 'text-emerald-700' : ''}">${event.tipo}</strong><br>
                                                ${new Date(event.data).toLocaleString('pt-BR')}
                                            </td>
                                            <td class="py-4 px-4 font-black border-b border-outline-variant/10 uppercase align-top">
                                                ${isCorrection ? '<span class="text-emerald-600">Resolvido/Ajustado</span>' : (event.hasInconformity ? 'Inconforme' : 'Conforme')}<br>
                                                <span class="text-[9px] font-bold opacity-50 normal-case tracking-normal">${event.responsavel || 'Sistema'}</span>
                                            </td>
                                            <td class="py-4 px-4 border-b border-outline-variant/10 transition-all align-top">
                                                ${details || (isCorrection ? 'Manutenção geral e preventiva registrada.' : '-')}
                                            </td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                `;
            } else if (type === 'financeiro') {
                isLandscape = true;
                const projetoId = formData.get('projetoId');
                const dataInicio = formData.get('dataInicio');
                const dataFim = formData.get('dataFim');
                const bookings = Storage.getBookings().filter(b => {
                    const passprojeto = projetoId === 'all' || b.projetoId === projetoId;
                    const passStatus = b.status === 'concluido';
                    if (!passprojeto || !passStatus) return false;
                    if (!dataInicio && !dataFim) return true;
                    const bookingDate = (b.dataSaida || '').split('T')[0];
                    const passInicio = !dataInicio || bookingDate >= dataInicio;
                    const passFim = !dataFim || bookingDate <= dataFim;
                    return passInicio && passFim;
                });
                const projects = Storage.getProjects();
                const vehicles = Storage.getVehicles();
                const periodoLabel = dataInicio || dataFim
                    ? `Período: ${dataInicio ? new Date(dataInicio + 'T00:00:00').toLocaleDateString('pt-BR') : 'início'} até ${dataFim ? new Date(dataFim + 'T00:00:00').toLocaleDateString('pt-BR') : 'hoje'}`
                    : 'Todos os períodos';

                reportHtml = `
                    <div class="space-y-8 animate-in fade-in duration-500 landscape">
                        <div class="flex justify-between items-center no-print bg-surface-container-low p-4 rounded-xl mb-8">
                             <button onclick="App.renderView('relatorios')" class="text-xs font-bold text-on-surface-variant hover:text-primary transition-colors flex items-center gap-2 uppercase tracking-widest">
                                <span class="material-symbols-outlined text-sm">arrow_back</span> Voltar
                            </button>
                            <button onclick="window.print()" class="bg-primary text-white px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-primary/20">Imprimir / Salvar PDF</button>
                        </div>

                        ${headerHtml}
                        <h2 class="text-2xl font-black text-primary mb-1">Prestação de Contas e Custos Operacionais</h2>
                        <p class="text-xs font-bold text-on-surface-variant opacity-50 mb-6 uppercase tracking-widest">${periodoLabel}</p>

                        <table class="w-full text-[10px] border-collapse">
                            <thead>
                                <tr class="bg-primary text-white text-left">
                                    <th class="py-3 px-3 uppercase">Viagem / Projeto</th>
                                    <th class="py-3 px-3 uppercase">Veículo</th>
                                    <th class="py-3 px-3 uppercase">Período</th>
                                    <th class="py-3 px-3 uppercase">Km Totais</th>
                                    <th class="py-3 px-3 uppercase">Combustível</th>
                                    <th class="py-3 px-3 uppercase text-right">Custo Estimado</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-outline-variant/20">
                                ${bookings.map(b => {
                                    const v = vehicles.find(veh => veh.id === b.veiculoId);
                                    const p = projects.find(proj => proj.id === b.projetoId);
                                    const kmTotal = b.kmFinal - b.kmInicial;
                                    const litros = Math.ceil(kmTotal / (v?.consumption || 10));
                                    const custo = litros * Storage.getSettings().precoCombustivel;

                                    return `
                                        <tr>
                                            <td class="py-3 px-3"><strong>${b.destino}</strong><br><span class="opacity-50 uppercase tracking-widest text-[8px]">${p?.nome}</span></td>
                                            <td class="py-3 px-3">${v?.nome}<br>${v?.placa}</td>
                                            <td class="py-3 px-3">${new Date(b.dataSaida).toLocaleDateString('pt-BR')} até<br>${new Date(b.dataChegada).toLocaleDateString('pt-BR')}</td>
                                            <td class="py-3 px-3">${kmTotal.toLocaleString()} KM</td>
                                            <td class="py-3 px-3">${litros} Litros<br><span class="opacity-40 text-[8px]">${(v?.consumption || 10)} km/l</span></td>
                                            <td class="py-3 px-3 text-right font-black">R$ ${custo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                             <tfoot>
                                <tr class="bg-surface-container-high font-black">
                                    <td colspan="5" class="py-4 px-3 text-right uppercase tracking-widest text-[10px]">Total Acumulado</td>
                                    <td class="py-4 px-3 text-right text-lg">R$ ${bookings.reduce((a,b) => {
                                        const v = vehicles.find(veh => veh.id === b.veiculoId);
                                        const kmTotal = b.kmFinal - b.kmInicial;
                                        return a + (Math.ceil(kmTotal / (v?.consumption || 10)) * Storage.getSettings().precoCombustivel);
                                    }, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                `;
            }

            // Gerenciar classe de paisagem
            document.body.classList.toggle('landscape-page', isLandscape);

            contentArea.innerHTML = reportHtml;
        },

        showToast(message, type = 'success') {
            const toast = document.createElement('div');
            const bg = type === 'success' ? 'bg-emerald-600' : 'bg-error';
            toast.className = `fixed bottom-8 right-8 ${bg} text-white px-8 py-4 rounded-2xl shadow-2xl z-50 animate-in slide-in-from-right duration-500 font-black text-[10px] uppercase tracking-widest`;
            toast.innerHTML = message;
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 3000);
        }
    },

    utils: {
        applyBranding() {
            const settings = Storage.getSettings();
            
            // 1. Nome do Sistema e Título da Aba
            const systemName = settings.nomeSistema || 'Sistema';
            document.title = `${systemName}`;
            
            const titleEl = document.getElementById('app-title');
            if (titleEl) titleEl.textContent = `${systemName}`;
            
            const sidebarNameEl = document.getElementById('sidebar-system-name');
            if (sidebarNameEl) sidebarNameEl.textContent = systemName;

            const sidebarSubtitleEl = document.getElementById('sidebar-system-subtitle');
            if (sidebarSubtitleEl) sidebarSubtitleEl.textContent = settings.subtituloSistema || '';

            // 2. Logo na Sidebar
            const logoImg = document.getElementById('sidebar-logo');
            if (logoImg) {
                if (settings.logoUrl) {
                    logoImg.src = settings.logoUrl;
                    logoImg.classList.remove('hidden');
                    if (sidebarNameEl) sidebarNameEl.classList.add('hidden');
                } else {
                    logoImg.classList.add('hidden');
                    if (sidebarNameEl) sidebarNameEl.classList.remove('hidden');
                }
            }

            // 3. Favicon Dinâmico
            if (settings.faviconUrl) {
                let link = document.getElementById('app-favicon') || document.querySelector("link[rel~='icon']");
                if (link) {
                    link.href = settings.faviconUrl;
                }
            }
        },

        readFileAsDataURL(file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = (e) => reject(e);
                reader.readAsDataURL(file);
            });
        },
        updateVehicleAvailability(excludeBookingId = null, selectedVehicleId = null) {
            const list = document.getElementById('vehicle-availability-list');
            const dataSaidaInput = document.querySelector('input[name="dataSaida"]');
            const dataChegadaInput = document.querySelector('input[name="dataChegada"]');
            
            if (!dataSaidaInput || !dataChegadaInput) return;
            
            const dataSaida = dataSaidaInput.value;
            const dataChegada = dataChegadaInput.value;

            if (!dataSaida || !dataChegada) return;

            const start = new Date(dataSaida).getTime();
            const end = new Date(dataChegada).getTime();

            if (start >= end) {
                list.innerHTML = `<div class="col-span-full p-4 bg-error-container text-error rounded-xl text-xs font-bold text-center">Data de chegada deve ser após a saída.</div>`;
                return;
            }

            const bookings = Storage.getBookings();
            const activeVehicles = Storage.getVehicles().filter(v => v.status === 'ativo');

            const availableVehicles = activeVehicles.filter(v => {
                // Check for overlapping bookings for this vehicle
                const hasConflict = bookings.some(b => {
                    if (b.id === excludeBookingId) return false; // Ignorar a própria reserva na edição
                    if (b.veiculoId !== v.id || b.status === 'concluido' || b.status === 'cancelado') return false;
                    const bStart = new Date(b.dataSaida).getTime();
                    const bEnd = new Date(b.dataChegada).getTime();
                    return (start < bEnd) && (end > bStart);
                });
                return !hasConflict;
            });

            if (availableVehicles.length === 0) {
                list.innerHTML = `
                    <div class="col-span-full py-12 px-8 text-center bg-surface-container-low rounded-3xl border-2 border-dashed border-error/20 space-y-4">
                        <span class="material-symbols-outlined text-error text-4xl opacity-40">event_busy</span>
                        <p class="text-sm font-black text-error uppercase tracking-widest">Nenhum veículo disponível</p>
                        <p class="text-xs font-medium text-on-surface-variant max-w-xs mx-auto">Todos os veículos estão reservados ou em manutenção para o período selecionado.</p>
                    </div>
                `;
                return;
            }
            
            list.innerHTML = availableVehicles.map(v => `
                <label class="relative cursor-pointer group">
                    <input type="radio" name="selectedVehicle" value="${v.id}" class="peer sr-only" required ${selectedVehicleId === v.id ? 'checked' : ''}>
                    <div class="p-4 rounded-2xl border-2 border-outline-variant/10 bg-white transition-all flex items-center gap-4 hover:shadow-lg group-has-[:checked]:border-primary group-has-[:checked]:bg-primary/5">
                        <img src="${v.foto}" class="w-12 h-12 rounded-lg object-cover opacity-50 transition-all group-has-[:checked]:opacity-100">
                        <div class="flex-1">
                            <p class="text-xs font-black text-primary">${v.nome}</p>
                            <p class="text-[10px] font-bold text-on-surface-variant opacity-60">${v.placa}</p>
                        </div>
                        <div class="w-5 h-5 rounded-full border-2 border-outline-variant/30 flex items-center justify-center transition-all group-has-[:checked]:border-primary group-has-[:checked]:bg-primary">
                            <div class="w-2 h-2 rounded-full bg-white opacity-0 transition-all group-has-[:checked]:opacity-100"></div>
                        </div>
                    </div>
                </label>
            `).join('');
        },

        toggleFilterStatus(status) {
            const filters = App.state.filters.status;
            const index = filters.indexOf(status);
            if (index > -1) {
                if (filters.length > 1) filters.splice(index, 1);
            } else {
                filters.push(status);
            }
            App.renderView('agendamentos');
        },

        resetFilters() {
            App.state.filters = {
                motoristaBusca: '',
                dataInicio: '',
                dataFim: '',
                status: ['checklist_pendente', 'em_curso', 'concluido_recent'],
                showFilters: true
            };
            App.renderView('agendamentos');
        },

        toggleFilterVisibility() {
            App.state.filters.showFilters = !App.state.filters.showFilters;
            App.renderView('agendamentos');
        },

        toggleInspecoesFilterVisibility() {
            App.state.inspecoesFilters.showFilters = !App.state.inspecoesFilters.showFilters;
            App.renderView('inspecoes');
        },

        updateInspecoesOcorrencias(val) {
            App.state.inspecoesFilters.apenasOcorrencias = val;
            App.renderView('inspecoes');
        },

        resetInspecoesFilters() {
            App.state.inspecoesFilters = {
                dataInicio: '',
                dataFim: '',
                apenasOcorrencias: false,
                showFilters: true
            };
            App.renderView('inspecoes');
        },

        toggleProjetosFilterVisibility() {
            App.state.projetosFilters.showFilters = !App.state.projetosFilters.showFilters;
            App.renderView('projetos');
        },

        resetProjetosFilters() {
            App.state.projetosFilters = {
                busca: '',
                status: 'all',
                showFilters: true
            };
            App.renderView('projetos');
        },

        updatePricingEstimates() {
            const kmInput = document.getElementById('input-distancia');
            const lblKm = document.getElementById('calc-km');
            const lblLitros = document.getElementById('calc-litros');
            const lblCusto = document.getElementById('calc-custo');
            
            if (!kmInput || !lblKm || !lblLitros || !lblCusto) return;
            
            const distance = parseInt(kmInput.value) || 0;
            const settings = Storage.getSettings();
            
            // Get selected vehicle
            const vehicleId = document.querySelector('input[name="selectedVehicle"]:checked')?.value;
            
            lblKm.textContent = `~ ${distance} KM`;

            if (!vehicleId) {
                lblLitros.textContent = 'Selecione um veículo';
                lblCusto.textContent = 'R$ --,--';
                return;
            }

            const vehicle = Storage.getVehicles().find(v => v.id === vehicleId);
            const consumption = vehicle?.consumption || 10;
            
            if (distance > 0) {
                const litros = Math.ceil(distance / consumption);
                const custo = (litros * settings.precoCombustivel).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                lblLitros.textContent = `${litros} L (base: ${consumption} km/l)`;
                lblCusto.textContent = custo;
            } else {
                lblLitros.textContent = '-- L';
                lblCusto.textContent = 'R$ --,--';
            }
        },

        viewImage(url) {
            if (!url) return;
            const content = `
                <div class="flex flex-col items-center gap-6">
                    <div class="relative w-full aspect-square md:aspect-video bg-surface-container rounded-2xl overflow-hidden shadow-2xl border border-outline-variant/10">
                        <img src="${url}" class="w-full h-full object-contain animate-in zoom-in-105 duration-700">
                    </div>
                    <div class="flex items-center gap-4 bg-white/80 backdrop-blur-md px-6 py-3 rounded-2xl shadow-lg border border-outline-variant/5">
                        <button onclick="window.open('${url}', '_blank')" class="flex items-center gap-2 text-[10px] font-black text-primary uppercase tracking-widest hover:text-primary-container transition-colors">
                            <span class="material-symbols-outlined text-lg">open_in_new</span>
                            Abrir Original
                        </button>
                        <div class="w-px h-4 bg-outline-variant/20"></div>
                        <button onclick="const a = document.createElement('a'); a.href='${url}'; a.download='evidencia.jpg'; a.click();" class="flex items-center gap-2 text-[10px] font-black text-primary uppercase tracking-widest hover:text-primary-container transition-colors">
                            <span class="material-symbols-outlined text-lg">download</span>
                            Download
                        </button>
                    </div>
                </div>
            `;
            App.showModal('Visualização da Evidência', content, () => true);
        }
    }
};

// Start the App
App.init();
