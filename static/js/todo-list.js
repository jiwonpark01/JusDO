const todoList = document.getElementById('todo-list');
const todoEmpty = document.getElementById('todo-empty');
const todoCount = document.getElementById('todo-count');
const completedList = document.getElementById('completed-list');
const completedEmpty = document.getElementById('completed-empty');
const completedCount = document.getElementById('completed-count');
const listLogoutButton = document.getElementById('logout-button');

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
        return false;
    }

    const response = await fetch('/auth/verify', {
        headers: {
            Authorization: 'Bearer ' + token
        }
    });

    const data = await response.json();

    if (!data.success) {
        logout();
        return false;
    }

    return true;
}

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function createTodoRow(todo, isCompletedSection) {
    const card = document.createElement('article');
    const titleClass = isCompletedSection ? 'text-white/90' : '';
    const bodyClass = isCompletedSection ? 'text-white/50' : 'text-white/60';
    const badgeClass = isCompletedSection ? 'done-badge' : 'waiting-badge';
    const badgeText = isCompletedSection ? '완료' : '진행 중';
    const toggleClass = isCompletedSection ? 'todo-toggle is-checked' : 'todo-toggle';

    card.className = isCompletedSection
        ? 'todo-card surface-soft completed-glow rounded-[1.75rem] p-5 opacity-95'
        : 'todo-card surface-soft rounded-[1.75rem] p-5';

    card.innerHTML = `
        <div class="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div class="min-w-0 flex-1 space-y-3">
                <div class="flex flex-wrap items-center gap-3">
                    <p class="font-display text-3xl uppercase ${titleClass}">${escapeHtml(todo.title)}</p>
                    <span class="${badgeClass} rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.2em]">${badgeText}</span>
                </div>
                <p class="text-sm leading-7 ${bodyClass}">${escapeHtml(todo.content || '메모가 없는 할 일입니다.')}</p>
            </div>
            <div class="flex flex-wrap items-center gap-3 lg:justify-end">
                ${isCompletedSection ? '' : '<button data-action="edit" class="accent-button rounded-full px-4 py-2 text-xs font-bold uppercase tracking-[0.18em]">수정</button>'}
                <label class="${toggleClass} inline-flex items-center gap-3 rounded-full px-4 py-2 text-xs uppercase tracking-[0.18em] ${isCompletedSection ? 'text-white/85' : 'text-white/80'}">
                    <input type="checkbox" class="todo-check" data-action="toggle" ${todo.is_completed ? 'checked' : ''}>
                    <span>완료</span>
                </label>
                <button data-action="delete" class="ghost-button rounded-full px-4 py-2 text-xs uppercase tracking-[0.18em] text-white/80">삭제</button>
            </div>
        </div>
    `;

    card.dataset.id = String(todo.id);
    card.dataset.title = todo.title || '';
    card.dataset.content = todo.content || '';
    card.dataset.completed = String(Boolean(todo.is_completed));

    return card;
}

function drawTodos(todos) {
    const pendingTodos = todos.filter(function (todo) {
        return !todo.is_completed;
    });
    const doneTodos = todos.filter(function (todo) {
        return !!todo.is_completed;
    });

    todoList.innerHTML = '';
    completedList.innerHTML = '';
    todoCount.textContent = pendingTodos.length + '개';
    completedCount.textContent = doneTodos.length + '개';

    todoEmpty.classList.toggle('hidden', pendingTodos.length > 0);
    completedEmpty.classList.toggle('hidden', doneTodos.length > 0);

    pendingTodos.forEach(function (todo) {
        todoList.appendChild(createTodoRow(todo, false));
    });

    doneTodos.forEach(function (todo) {
        completedList.appendChild(createTodoRow(todo, true));
    });
}

async function loadTodos() {
    const ok = await verifyUser();

    if (!ok) {
        return;
    }

    const response = await fetch('/api/todos', {
        headers: {
            Authorization: 'Bearer ' + getToken()
        }
    });

    const data = await response.json();
    drawTodos(data.todos || []);
}

async function openEditTodo(todoId) {
    const response = await fetch('/api/todos/' + todoId + '/edit', {
        method: 'POST',
        headers: {
            Authorization: 'Bearer ' + getToken()
        }
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
        alert(data.message || '수정할 todo를 불러오지 못했습니다.');
        return;
    }

    sessionStorage.setItem('jusdo_edit_todo', JSON.stringify(data.todo));
    location.href = data.redirectTo || '/TodoWrite';
}

async function deleteTodo(todoId) {
    const confirmed = confirm('이 할 일을 삭제할까요?');

    if (!confirmed) {
        return;
    }

    const response = await fetch('/api/todos/' + todoId, {
        method: 'DELETE',
        headers: {
            Authorization: 'Bearer ' + getToken()
        }
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
        alert(data.message || '할 일 삭제에 실패했습니다.');
        return;
    }

    loadTodos();
}

async function toggleTodoStatus(todoId, checked) {
    const response = await fetch('/api/todos/' + todoId + '/status', {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + getToken()
        },
        body: JSON.stringify({
            is_completed: checked
        })
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
        alert(data.message || '완료 상태 변경에 실패했습니다.');
        loadTodos();
        return;
    }

    loadTodos();
}

function findTodoCard(element) {
    return element.closest('article[data-id]');
}

todoList.addEventListener('click', async function (event) {
    const actionTarget = event.target.closest('[data-action]');
    if (!actionTarget) {
        return;
    }

    const card = findTodoCard(actionTarget);
    if (!card) {
        return;
    }

    const todoId = card.dataset.id;
    const action = actionTarget.dataset.action;

    if (action === 'edit') {
        await openEditTodo(todoId);
    }

    if (action === 'delete') {
        await deleteTodo(todoId);
    }
});

completedList.addEventListener('click', async function (event) {
    const actionTarget = event.target.closest('[data-action="delete"]');
    if (!actionTarget) {
        return;
    }

    const card = findTodoCard(actionTarget);
    if (!card) {
        return;
    }

    await deleteTodo(card.dataset.id);
});

todoList.addEventListener('change', async function (event) {
    const actionTarget = event.target.closest('[data-action="toggle"]');
    if (!actionTarget) {
        return;
    }

    const card = findTodoCard(actionTarget);
    if (!card) {
        return;
    }

    await toggleTodoStatus(card.dataset.id, actionTarget.checked);
});

completedList.addEventListener('change', async function (event) {
    const actionTarget = event.target.closest('[data-action="toggle"]');
    if (!actionTarget) {
        return;
    }

    const card = findTodoCard(actionTarget);
    if (!card) {
        return;
    }

    await toggleTodoStatus(card.dataset.id, actionTarget.checked);
});

listLogoutButton.addEventListener('click', logout);
loadTodos();
