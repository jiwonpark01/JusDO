const todoForm = document.getElementById('todo-form');
const todoMessage = document.getElementById('todo-message');
const writeTitle = document.getElementById('write-title');
const writeDescription = document.getElementById('write-description');
const submitButton = document.getElementById('submit-button');
const resetButton = document.getElementById('reset-button');
const completedWrapper = document.getElementById('completed-wrapper');
const titleInput = document.getElementById('title');
const contentInput = document.getElementById('content');
const completedInput = document.getElementById('isCompleted');

let editTodoData = null;

function getToken() {
    return sessionStorage.getItem('jusdo_token');
}

function logout() {
    sessionStorage.removeItem('jusdo_token');
    sessionStorage.removeItem('jusdo_user');
    sessionStorage.removeItem('jusdo_edit_todo');
    location.href = '/';
}

function showTodoMessage(message, isError) {
    todoMessage.textContent = message;
    todoMessage.className = isError
        ? 'mt-4 min-h-6 text-sm text-orange-300'
        : 'mt-4 min-h-6 text-sm text-white/70';
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

function loadEditTodo() {
    const savedTodo = sessionStorage.getItem('jusdo_edit_todo');

    if (!savedTodo) {
        return;
    }

    editTodoData = JSON.parse(savedTodo);
    writeTitle.innerHTML = 'Edit<br>Todo';
    writeDescription.textContent = '기존 todo를 불러와서 같은 작성 화면에서 수정합니다.';
    submitButton.textContent = '수정하기';
    completedWrapper.classList.remove('hidden');
    completedWrapper.classList.add('flex');
    titleInput.value = editTodoData.title || '';
    contentInput.value = editTodoData.content || '';
    completedInput.checked = Boolean(editTodoData.is_completed);
}

function resetTodoForm() {
    if (!editTodoData) {
        todoForm.reset();
        return;
    }

    titleInput.value = editTodoData.title || '';
    contentInput.value = editTodoData.content || '';
    completedInput.checked = Boolean(editTodoData.is_completed);
}

async function saveTodo(event) {
    event.preventDefault();

    const title = titleInput.value.trim();
    const content = contentInput.value.trim();
    const is_completed = completedInput.checked;

    if (!title) {
        showTodoMessage('제목은 비워둘 수 없습니다.', true);
        return;
    }

    const url = editTodoData ? '/api/todos/' + editTodoData.id : '/api/todos';

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + getToken()
        },
        body: JSON.stringify({
            title: title,
            content: content,
            is_completed: is_completed
        })
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
        showTodoMessage(data.message || '저장에 실패했습니다.', true);
        return;
    }

    sessionStorage.removeItem('jusdo_edit_todo');
    location.href = data.redirectTo || '/TodoList';
}

async function startPage() {
    const ok = await verifyUser();

    if (!ok) {
        return;
    }

    loadEditTodo();
}

todoForm.addEventListener('submit', saveTodo);
resetButton.addEventListener('click', resetTodoForm);
startPage();
