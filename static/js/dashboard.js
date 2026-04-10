const welcomeMessage = document.getElementById('welcome-message');
const totalCount = document.getElementById('total-count');
const waitingCount = document.getElementById('waiting-count');
const doneCount = document.getElementById('done-count');
const recentTodos = document.getElementById('recent-todos');
const logoutButton = document.getElementById('logout-button');
const chartTotal = document.getElementById('chart-total');
const chartWaiting = document.getElementById('chart-waiting');
const chartDone = document.getElementById('chart-done');

let todoRatioChart = null;

const centerTextPlugin = {
    id: 'centerTextPlugin',
    afterDraw(chart) {
        const meta = chart.config.options.plugins.centerText;

        if (!meta) {
            return;
        }

        const { ctx, chartArea } = chart;
        const centerX = (chartArea.left + chartArea.right) / 2;
        const centerY = (chartArea.top + chartArea.bottom) / 2;

        ctx.save();
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(255,255,255,0.42)';
        ctx.font = '11px Space Grotesk';
        ctx.fillText(meta.label, centerX, centerY - 12);
        ctx.fillStyle = '#f5f5f5';
        ctx.font = '700 42px Barlow Condensed';
        ctx.fillText(meta.value, centerX, centerY + 28);
        ctx.restore();
    }
};

function getToken() {
    return sessionStorage.getItem('jusdo_token');
}

function logout() {
    sessionStorage.removeItem('jusdo_token');
    sessionStorage.removeItem('jusdo_user');
    sessionStorage.removeItem('jusdo_edit_todo');
    location.href = '/';
}

async function verifyUser() {
    const token = getToken();

    if (!token) {
        logout();
        return null;
    }

    const response = await fetch('/auth/verify', {
        headers: {
            Authorization: 'Bearer ' + token
        }
    });

    const data = await response.json();

    if (!data.success) {
        logout();
        return null;
    }

    return data.user;
}

async function getSummary() {
    const response = await fetch('/api/dashboard/summary', {
        headers: {
            Authorization: 'Bearer ' + getToken()
        }
    });

    return response.json();
}

async function getTodos() {
    const response = await fetch('/api/todos', {
        headers: {
            Authorization: 'Bearer ' + getToken()
        }
    });

    return response.json();
}

function drawRecentTodos(todos) {
    recentTodos.innerHTML = '';

    if (todos.length === 0) {
        recentTodos.innerHTML = '<div class="surface-soft rounded-3xl p-5 text-sm text-white/55">아직 등록된 할 일이 없습니다.</div>';
        return;
    }

    for (let i = 0; i < todos.length; i++) {
        const todo = todos[i];
        const card = document.createElement('article');

        card.className = 'surface-soft rounded-3xl p-5';
        card.innerHTML = `
            <div class="flex items-start justify-between gap-3">
                <div>
                    <p class="font-display text-2xl uppercase">${todo.title}</p>
                    <p class="mt-2 text-sm text-white/55">${todo.content || '설명이 없는 할 일입니다.'}</p>
                </div>
                <span class="${todo.is_completed ? 'done-badge' : 'waiting-badge'} rounded-full px-3 py-1 text-xs uppercase tracking-[0.2em]">
                    ${todo.is_completed ? '완료' : '진행 중'}
                </span>
            </div>
        `;

        recentTodos.appendChild(card);
    }
}

function drawRatioChart(summary) {
    const total = Number(summary.totalCount || 0);
    const waiting = Number(summary.waitingCount || 0);
    const done = Number(summary.doneCount || 0);
    const donePercent = total === 0 ? 0 : Math.round((done / total) * 100);
    const empty = total === 0 ? 1 : 0;

    chartTotal.textContent = total;
    chartWaiting.textContent = waiting;
    chartDone.textContent = done;

    const ctx = document.getElementById('todo-ratio-chart').getContext('2d');
    const waitingGradient = ctx.createLinearGradient(0, 0, 0, 260);
    waitingGradient.addColorStop(0, '#ffb45e');
    waitingGradient.addColorStop(1, '#ff7b1f');

    const doneGradient = ctx.createLinearGradient(0, 0, 0, 260);
    doneGradient.addColorStop(0, '#ffe0bb');
    doneGradient.addColorStop(1, '#ffb15d');

    if (todoRatioChart) {
        todoRatioChart.destroy();
    }

    todoRatioChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: total === 0 ? ['데이터 없음'] : ['진행 중', '완료'],
            datasets: [{
                data: total === 0 ? [empty] : [waiting, done],
                backgroundColor: total === 0
                    ? ['rgba(255,255,255,0.14)']
                    : [waitingGradient, doneGradient],
                borderColor: 'rgba(255,255,255,0.02)',
                borderWidth: 1,
                borderRadius: 14,
                spacing: 6,
                hoverOffset: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '80%',
            plugins: {
                centerText: {
                    label: total === 0 ? '할 일 없음' : '완료 비율',
                    value: donePercent + '%'
                },
                legend: {
                    display: false
                }
            }
        },
        plugins: [centerTextPlugin]
    });
}

async function loadDashboard() {
    const user = await verifyUser();

    if (!user) {
        return;
    }

    const savedUser = JSON.parse(sessionStorage.getItem('jusdo_user') || 'null');

    if (savedUser && savedUser.userName) {
        welcomeMessage.textContent = savedUser.userName + '님의 흐름을 기준으로 오늘의 todo 리듬을 보여줍니다.';
    }

    const summaryData = await getSummary();
    const todoData = await getTodos();

    totalCount.textContent = summaryData.summary.totalCount || 0;
    waitingCount.textContent = summaryData.summary.waitingCount || 0;
    doneCount.textContent = summaryData.summary.doneCount || 0;

    drawRecentTodos((todoData.todos || []).slice(0, 3));
    drawRatioChart(summaryData.summary || {});
}

logoutButton.addEventListener('click', logout);
loadDashboard();
