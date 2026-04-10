const signupForm = document.getElementById('signup-form');
const signupMessage = document.getElementById('signup-message');

function showSignupMessage(message, isError) {
    signupMessage.textContent = message;
    signupMessage.className = isError
        ? 'mt-4 min-h-6 text-sm text-orange-300'
        : 'mt-4 min-h-6 text-sm text-white/70';
}

async function signup(event) {
    event.preventDefault();

    const userName = document.getElementById('userName').value;
    const loginId = document.getElementById('loginId').value;
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (password !== confirmPassword) {
        showSignupMessage('비밀번호 확인이 일치하지 않습니다.', true);
        return;
    }

    const response = await fetch('/auth/signup', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            userName: userName,
            loginId: loginId,
            password: password
        })
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
        showSignupMessage(data.message || '회원가입에 실패했습니다.', true);
        return;
    }

    showSignupMessage('계정이 생성되었습니다. 로그인 페이지로 이동합니다.', false);

    setTimeout(function () {
        location.href = '/';
    }, 700);
}

signupForm.addEventListener('submit', signup);
