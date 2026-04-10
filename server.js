const express = require('express');
const path = require('path');
const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const app = express();
const PORT = 3000;
const JWT_SECRET = 'secret_key_1234';

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/static', express.static(path.join(__dirname, 'static')));

const pool = mysql.createPool({
    host: 'localhost',
    user: 'testuser',
    password: '1234',
    database: 'testdb'
});

function authenticateToken(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
        return res.status(401).json({ success: false, message: 'Token is required.' });
    }

    try {
        req.user = jwt.verify(token, JWT_SECRET);
        next();
    } catch (error) {
        return res.status(401).json({ success: false, message: 'Invalid token.' });
    }
}

// 페이지 라우팅
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'templates', 'login.html')));
app.get('/signup', (req, res) => res.sendFile(path.join(__dirname, 'templates', 'signup.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'templates', 'dashboard.html')));
app.get('/TodoList', (req, res) => res.sendFile(path.join(__dirname, 'templates', 'TodoList.html')));
app.get('/TodoWrite', (req, res) => res.sendFile(path.join(__dirname, 'templates', 'TodoWrite.html')));

// [API] 회원가입
app.post('/auth/signup', async (req, res) => {
    try {
        const { loginId, password, userName } = req.body;

        if (!loginId || !password || !userName) {
            return res.status(400).json({ success: false, message: 'Missing required fields.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        await pool.execute(
            'INSERT INTO users (login_id, password_hash, user_name) VALUES (?, ?, ?)',
            [loginId, hashedPassword, userName]
        );

        res.status(201).json({ success: true });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ success: false, message: 'Login ID already exists.' });
        }

        res.status(500).json({ success: false, message: 'Failed to sign up.' });
    }
});

// [API] 로그인
app.post('/auth/login', async (req, res) => {
    try {
        const { loginId, password } = req.body;
        const [rows] = await pool.execute(
            'SELECT id, login_id, password_hash, user_name FROM users WHERE login_id = ?',
            [loginId]
        );

        const user = rows[0];

        if (!user || !(await bcrypt.compare(password, user.password_hash))) {
            return res.status(401).json({ success: false, message: 'Invalid credentials.' });
        }

        const token = jwt.sign(
            { id: user.id, loginId: user.login_id, userName: user.user_name },
            JWT_SECRET,
            { expiresIn: '1h' }
        );

        res.json({
            success: true,
            accessToken: token,
            user: {
                id: user.id,
                loginId: user.login_id,
                userName: user.user_name
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to log in.' });
    }
});

// [API] 토큰 검증
app.get('/auth/verify', authenticateToken, (req, res) => {
    res.json({ success: true, user: req.user });
});

// [API] 대시보드 요약
app.get('/api/dashboard/summary', authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT
                COUNT(*) AS totalCount,
                SUM(CASE WHEN is_completed = FALSE THEN 1 ELSE 0 END) AS waitingCount,
                SUM(CASE WHEN is_completed = TRUE THEN 1 ELSE 0 END) AS doneCount
             FROM todos
             WHERE user_id = ?`,
            [req.user.id]
        );

        res.json({ success: true, summary: rows[0] });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to load dashboard summary.' });
    }
});

// [API] 할 일 생성
app.post('/api/todos', authenticateToken, async (req, res) => {
    try {
        const { title, content } = req.body;

        if (!title || !title.trim()) {
            return res.status(400).json({ success: false, message: 'Title is required.' });
        }

        const [result] = await pool.execute(
            'INSERT INTO todos (user_id, title, content) VALUES (?, ?, ?)',
            [req.user.id, title.trim(), content ?? null]
        );

        res.status(201).json({ success: true, todoId: result.insertId, redirectTo: '/TodoList' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to create todo.' });
    }
});

// [API] 할 일 조회
app.get('/api/todos', authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.execute(
            `SELECT id, title, content, is_completed, created_at, updated_at
             FROM todos
             WHERE user_id = ?
             ORDER BY is_completed ASC, created_at DESC, id DESC`,
            [req.user.id]
        );

        res.json({ success: true, todos: rows });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to load todos.' });
    }
});

// [API] 할 일 수정용 조회
app.post('/api/todos/:id/edit', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await pool.execute(
            `SELECT id, title, content, is_completed, created_at, updated_at
             FROM todos
             WHERE id = ? AND user_id = ?`,
            [id, req.user.id]
        );

        const todo = rows[0];

        if (!todo) {
            return res.status(404).json({ success: false, message: 'Todo not found.' });
        }

        res.json({
            success: true,
            todo,
            redirectTo: '/TodoWrite'
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to load todo for editing.' });
    }
});

// [API] 할 일 수정 저장
app.post('/api/todos/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { title, content, is_completed } = req.body;

        if (!title || !title.trim()) {
            return res.status(400).json({ success: false, message: 'Title is required.' });
        }

        const [result] = await pool.execute(
            `UPDATE todos
             SET title = ?, content = ?, is_completed = ?
             WHERE id = ? AND user_id = ?`,
            [title.trim(), content ?? null, Boolean(is_completed), id, req.user.id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Todo not found.' });
        }

        res.json({ success: true, redirectTo: '/TodoList' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to update todo.' });
    }
});

// [API] 완료 상태 변경
app.patch('/api/todos/:id/status', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { is_completed } = req.body;

        const [result] = await pool.execute(
            `UPDATE todos
             SET is_completed = ?
             WHERE id = ? AND user_id = ?`,
            [Boolean(is_completed), id, req.user.id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Todo not found.' });
        }

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to update todo status.' });
    }
});

// [API] 할 일 삭제
app.delete('/api/todos/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await pool.execute(
            'DELETE FROM todos WHERE id = ? AND user_id = ?',
            [id, req.user.id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Todo not found.' });
        }

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to delete todo.' });
    }
});

app.listen(PORT, () => console.log(`서버 실행: http://localhost:${PORT}`));
