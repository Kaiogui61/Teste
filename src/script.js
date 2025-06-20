let MostrarSenha = document.getElementById("togglePassword");
let Senha = document.getElementById("password");
const userAgent = navigator.userAgent;
let trava = false;

// Mostrar/ocultar senha
if (MostrarSenha && Senha) {
    MostrarSenha.addEventListener("click", () => {
        Senha.type = Senha.type === "password" ? "text" : "password";
    });
}

// Notificação estilo Taskitos
function Atividade(titulo, mensagem) {
    const container = document.getElementById('notificationContainer');
    if (!container) return;

    const notification = document.createElement('div');
    notification.className = 'notification';

    notification.innerHTML = `
        <div class="notification-content">
            <strong>${titulo}</strong>
            <p>${mensagem}</p>
        </div>
        <div class="notification-progress">
            <div class="notification-progress-bar"></div>
        </div>
    `;

    container.appendChild(notification);

    // Força o reflow para ativar a transição
    void notification.offsetWidth;
    notification.classList.add('show');

    // Remove após 5s
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 400);
    }, 5000);
}

// Login
document.getElementById('loginForm').addEventListener('submit', (e) => {
    e.preventDefault();

    if (trava) return;
    trava = true;

    const options = {
        TEMPO: 90, //Tempo atividade em SEGUNDOS
        ENABLE_SUBMISSION: true,
        LOGIN_URL: 'https://sedintegracoes.educacao.sp.gov.br/credenciais/api/LoginCompletoToken',
        LOGIN_DATA: {
            user: document.getElementById('ra').value,
            senha: document.getElementById('senha').value,
        },
    };

    loginRequest(options);
});

async function loginRequest(options) {
    const headers = {
        Accept: 'application/json, text/plain, */*',
        'User-Agent': navigator.userAgent,
        'Ocp-Apim-Subscription-Key': '2b03c1db3884488795f79c37c069381a',
        'Content-Type': 'application/json'
    };

    try {
        const res = await fetch(options.LOGIN_URL, {
            method: 'POST',
            headers,
            body: JSON.stringify(options.LOGIN_DATA)
        });
        if (!res.ok) throw new Error('Login inválido');
        const data = await res.json();

        // Salva o token globalmente
        window._token = data.token || data.auth_token;
        Atividade('SALA-DO-FUTURO', 'Logado com sucesso!');
        Atividade('Cebolitos', 'Atenção: o script não faz redações e atividades em rascunho!');
        Atividade('Cebolitos', 'O script vem como padrão o tempo de 90 Segundos para fazer as atividades!');
        fetchUserRooms(window._token);
    } catch (error) {
        Atividade('SALA-DO-FUTURO', 'Não foi possível logar!');
        setTimeout(() => {
            trava = false;
        }, 2000);
    }
}

function makeRequest(url, method = 'GET', headers = {}, body = null) {
    const options = {
        method,
        headers: {
            'User-Agent': navigator.userAgent,
            'Content-Type': 'application/json',
            ...headers,
        },
    };
    if (body) {
        options.body = JSON.stringify(body);
    }

    return fetch(url, options)
        .then(res => {
            if (!res.ok) throw new Error(`❌ HTTP ${method} ${url} => ${res.status}`);
            return res.json();
        });
}

function fetchUserRooms(token) {
    window._token = token; // Salva o token globalmente
    const url = 'https://edusp-api.ip.tv/room/user?list_all=true&with_cards=true';
    const headers = { 'User-Agent': navigator.userAgent, 'x-api-key': token };

    makeRequest(url, 'GET', headers)
        .then(data => {
            if (data.rooms && data.rooms.length > 0) {
                const roomCode = data.rooms[0].code || data.rooms[0].room_code;
                window._room = roomCode;
                console.log('roomCode usado:', roomCode);
                fetchTasks(token, roomCode);
            } else {
                Atividade('SALA-DO-FUTURO', 'Nenhuma sala encontrada.');
            }
        })
        .catch(error => {
            Atividade('SALA-DO-FUTURO', 'Erro ao buscar salas.');
            trava = false;
        });
}

function fetchTasks(token, room) {
    const urls = [
        {
            label: 'Normal',
            url: `https://edusp-api.ip.tv/tms/task/todo?room_code=${room}&answer_statuses=pending`,
        },
        {
            label: 'Expirada',
            url: `https://edusp-api.ip.tv/tms/task/todo?room_code=${room}&answer_statuses=pending&expired_only=true`,
        },
        {
            label: 'Rascunho',
            url: `https://edusp-api.ip.tv/tms/task/todo?room_code=${room}&answer_statuses=draft`,
        },
    ];

    const options = {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'User-Agent': navigator.userAgent,
            'x-api-key': token,
            'x-api-platform': 'webclient',
            'x-api-realm': 'edusp'
        },
    };

    const requests = urls.map(({ label, url }) => {
        console.log(`Tentando buscar tarefas: ${label} - ${url}`);
        return fetch(url, options)
            .then(response => {
                if (!response.ok) throw new Error(`❌ Erro na ${label}: ${response.statusText}`);
                return response.json();
            })
            .then(data => {
                console.log(`URL usada para ${label}:`, url);
                console.log(`Resposta da API para ${label}:`, data);
                return { label, data };
            })
            .catch(error => {
                Atividade('TAREFA-SP', `Erro ao buscar ${label}: ${error.message}`);
                console.error('Erro ao buscar tarefas:', error);
                return null;
            });
    });

    Promise.all(requests).then(results => {
        results.forEach(result => {
            if (result) {
                console.log(`DEBUG ${result.label}:`, result.data);
            }
            if (result && result.label === 'Normal') window._tarefasPendentes = result.data;
            if (result && result.label === 'Expirada') window._tarefasExpiradas = result.data;
        });

        // Habilita os botões se houver tarefas
        document.getElementById('loginNormal').disabled = !window._tarefasPendentes || window._tarefasPendentes.length === 0;
        document.getElementById('loginOverdue').disabled = !window._tarefasExpiradas || window._tarefasExpiradas.length === 0;
    });
}

// Função para abrir o modal e mudar o título conforme o botão
function openActivityModal(tipo) {
    document.getElementById('activityModal').classList.add('show');
    document.getElementById('modalTitle').textContent = tipo === 'pendentes'
        ? 'Selecionar Atividades Pendentes'
        : 'Selecionar Atividades Expiradas';
}

// Botões para abrir o modal
document.getElementById('loginNormal').onclick = function() {
    openActivityModal('pendentes');
    console.log('Abrindo modal com:', window._tarefasPendentes);
    preencherAtividadesModal(window._tarefasPendentes);
};
document.getElementById('loginOverdue').onclick = function() {
    openActivityModal('expiradas');
    preencherAtividadesModal(window._tarefasExpiradas);
};

// Fechar modal ao clicar no X
document.getElementById('closeActivityModal').onclick = function() {
    document.getElementById('activityModal').classList.remove('show');
};
// Fechar ao clicar fora do conteúdo
document.getElementById('activityModal').onclick = function(e) {
    if (e.target === this) this.classList.remove('show');
};

// Utilitário para pegar atividades selecionadas
function getSelecionadas() {
    return Array.from(document.querySelectorAll('#activityItems input[type="checkbox"]:checked'))
        .map(cb => cb.value);
}
// Utilitário para pegar todas as atividades listadas
function getTodas() {
    return Array.from(document.querySelectorAll('#activityItems input[type="checkbox"]'))
        .map(cb => cb.value);
}

// Função para processar atividades (normal ou rascunho)
async function processarAtividades(taskIds, token, room, status = "submitted") {
    if (!taskIds.length) {
        Atividade('TAREFA-SP', 'Selecione ao menos uma atividade!');
        return;
    }
    document.getElementById('activityModal').classList.remove('show');
    for (const taskId of taskIds) {
        try {
            await fazerAtividade(taskId, token, room, status);
            Atividade('TAREFA-SP', `Atividade ${taskId} enviada como ${status === "draft" ? "rascunho" : "normal"}!`);
        } catch (e) {
            Atividade('TAREFA-SP', `Erro ao enviar ${taskId}: ${e.message}`);
        }
    }
}

// Função para enviar atividade (normal ou rascunho)
async function fazerAtividade(taskId, token, room, status = "submitted") {
    // Busca detalhes da tarefa
    const urlDetalhes = `https://edusp-api.ip.tv/tms/task/${taskId}/apply?preview_mode=false&room_code=${room}`;
    const headers = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'x-api-realm': 'edusp',
        'x-api-platform': 'webclient',
        'User-Agent': navigator.userAgent,
        'x-api-key': token,
    };
    const detalhes = await fetch(urlDetalhes, { method: 'GET', headers }).then(r => r.json());

    // Verificação de segurança
    if (!detalhes.questions || !Array.isArray(detalhes.questions)) {
        throw new Error(`Tarefa ${taskId} inválida ou sem perguntas (questions).`);
    }

    const answersData = {};
    detalhes.questions.forEach(question => {
        const questionId = question.id;
        let answer = {};
        if (question.type === 'info') return;
        if (question.type === 'media') {
            answer = { status: 'error', message: 'Type=media system require url' };
        } else if (question.options && typeof question.options === 'object') {
            const options = Object.values(question.options);
            const correctIndex = Math.floor(Math.random() * options.length);
            options.forEach((_, i) => {
                answer[i] = i === correctIndex;
            });
        }
        answersData[questionId] = {
            question_id: questionId,
            question_type: question.type,
            answer,
        };
    });

    // Monta o request
    const request = {
        status: status,
        accessed_on: "room",
        executed_on: room,
        answers: answersData
    };

    // Aguarda tempo se for envio normal
    if (status === "submitted") {
        let min = parseInt(document.getElementById('minTime')?.value) || 1;
        let max = parseInt(document.getElementById('maxTime')?.value) || 3;
        if (min > max) [min, max] = [max, min];
        const tempo = Math.floor(Math.random() * (max - min + 1)) + min;
        await delay(tempo * 60 * 1000); // tempo em minutos
    }

    // Envia resposta
    const urlResposta = `https://edusp-api.ip.tv/tms/task/${taskId}/answer`;
    await fetch(urlResposta, {
        method: "POST",
        headers: {
            "X-Api-Key": token,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(request)
    });
}

// BOTÃO: Fazer Lições Selecionadas (normal)
document.getElementById('startSelected').onclick = async function() {
    const selecionadas = getSelecionadas();
    await processarAtividades(selecionadas, window._token, window._room, "submitted");
};

// BOTÃO: Fazer Lições Todas (normal)
document.getElementById('startAllActivities').onclick = async function() {
    const todas = getTodas();
    await processarAtividades(todas, window._token, window._room, "submitted");
};

// BOTÃO: Fazer Lições Selecionadas como Rascunho
document.getElementById('saveDraft').onclick = async function() {
    const selecionadas = getSelecionadas();
    await processarAtividades(selecionadas, window._token, window._room, "draft");
};

window._tarefasPendentes = [];
window._tarefasExpiradas = [];

// Preenche o modal com as tarefas
function preencherAtividadesModal(listaTarefas) {
    const container = document.getElementById('activityItems');
    container.innerHTML = '';
    if (!listaTarefas || listaTarefas.length === 0) {
        container.innerHTML = '<div style="padding:1rem;color:#b0b8c1;">Nenhuma atividade encontrada.</div>';
        return;
    }
    listaTarefas.forEach(tarefa => {
        const div = document.createElement('div');
        div.className = 'activity-item';
        div.innerHTML = `
            <label>
                <input type="checkbox" value="${tarefa.id}">
                ${tarefa.title}
            </label>
        `;
        container.appendChild(div);
    });
}