const loginForm = document.getElementById('login-form');
const loginMessage = document.getElementById('login-message');

function showLoginMessage(message, isError) {
    loginMessage.textContent = message;
    loginMessage.className = isError
        ? 'mt-4 min-h-6 text-sm text-orange-300'
        : 'mt-4 min-h-6 text-sm text-white/70';
}

function saveLogin(data) {
    sessionStorage.setItem('jusdo_token', data.accessToken);
    sessionStorage.setItem('jusdo_user', JSON.stringify(data.user));
}

function clearLogin() {
    sessionStorage.removeItem('jusdo_token');
    sessionStorage.removeItem('jusdo_user');
}

async function checkLogin() {
    const token = sessionStorage.getItem('jusdo_token');

    if (!token) {
        return;
    }

    const response = await fetch('/auth/verify', {
        headers: {
            Authorization: 'Bearer ' + token
        }
    });

    const data = await response.json();

    if (data.success) {
        location.href = '/dashboard';
    } else {
        clearLogin();
    }
}

async function login(event) {
    event.preventDefault();

    const loginId = document.getElementById('loginId').value;
    const password = document.getElementById('password').value;

    showLoginMessage('로그인 중입니다...', false);

    const response = await fetch('/auth/login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            loginId: loginId,
            password: password
        })
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
        showLoginMessage(data.message || '로그인에 실패했습니다.', true);
        return;
    }

    saveLogin(data);
    location.href = '/dashboard';
}

loginForm.addEventListener('submit', login);
checkLogin();
