# JusDO 프로젝트 보고서

## 1. 프로젝트 개요
JusDO는 회원가입과 로그인 기능을 기반으로 사용자별 할 일 목록을 관리할 수 있도록 제작한 ToDo List이다. CRUD기능을 포함해 할 일 목록을 다루는 것이 이번 프로젝트의 핵심기능이였다.

배포 주소: [Cloudflare 연결 URL](https://segments-syndrome-investigators-notices.trycloudflare.com)

사용 기술은 다음과 같다.
- Frontend: HTML, JavaScript, Tailwind CSS
- Backend: Node.js, Express
- Database: MariaDB
- Authentication: JWT, bcrypt
- Infra: GCP VM, Cloudflare Tunnel

## 2. 백엔드 구성 및 라우팅
백엔드는 `server.js`를 중심으로 구성하였으며, 정적 페이지 라우팅과 API 라우팅을 분리하여 작성하였다. 페이지 라우팅은 로그인, 회원가입, 대시보드, 할 일 목록, 할 일 작성 화면으로 연결되며, API는 인증 처리와 할 일 관리 기능을 담당한다.

### 2.1 라우팅 및 API 구성 표

| 메서드 | API 이름 | 하는 일 |
|---|---|---|
| GET | `/` | 로그인 페이지를 반환한다. |
| GET | `/signup` | 회원가입 페이지를 반환한다. |
| GET | `/dashboard` | 대시보드 페이지를 반환한다. |
| GET | `/TodoList` | 할 일 목록 페이지를 반환한다. |
| GET | `/TodoWrite` | 할 일 작성 및 수정 페이지를 반환한다. |
| POST | `/auth/signup` | 회원가입 정보를 받아 새 사용자를 생성한다. |
| POST | `/auth/login` | 로그인 정보를 검증하고 JWT 토큰을 발급한다. |
| GET | `/auth/verify` | 전달된 JWT 토큰이 유효한지 검증한다. |
| GET | `/api/dashboard/summary` | 로그인한 사용자의 할 일 요약 정보를 조회한다. |
| POST | `/api/todos` | 새 할 일을 생성한다. |
| GET | `/api/todos` | 로그인한 사용자의 할 일 목록을 조회한다. |
| POST | `/api/todos/:id/edit` | 수정 화면에 진입하기 위한 기존 할 일 데이터를 조회한다. |
| POST | `/api/todos/:id` | 기존 할 일을 수정하여 저장한다. |
| PATCH | `/api/todos/:id/status` | 할 일의 완료 상태만 별도로 변경한다. |
| DELETE | `/api/todos/:id` | 특정 할 일을 삭제한다. |

회원가입 시에는 사용자가 입력한 비밀번호를 `bcrypt`로 해시 처리한 뒤 데이터베이스에 저장하였다. 로그인 시에는 `login_id`를 기준으로 사용자를 조회한 뒤, 저장된 해시값과 입력 비밀번호를 비교하여 인증하였다. 인증에 성공하면 JWT 토큰을 발급하며, 이후 보호된 API 요청 시 `Authorization: Bearer <token>` 형식으로 전달하도록 구성하였다.

이와 같이 라우팅을 구분함으로써, 페이지 이동 흐름과 실제 데이터 처리 흐름을 명확하게 분리할 수 있었다. 특히 완료 상태 변경 API를 별도로 둔 이유는, 단순한 체크박스 변경에 전체 수정 API를 재사용할 경우 불필요하게 제목과 내용까지 다시 전달해야 하는 문제가 있었기 때문이다.

## 3. 데이터베이스 설계 및 SQL 사용
본 프로젝트에서는 MariaDB를 사용하였으며, 사용자 정보와 할 일 목록을 각각 별도의 테이블로 관리하였다. 관계 구조는 한 명의 사용자가 여러 개의 할 일을 가질 수 있는 `1:N` 구조이다.

### 3.1 사용자 테이블
```sql
CREATE TABLE users (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    login_id VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    user_name VARCHAR(50) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP
);
```

### 3.2 할 일 테이블
```sql
CREATE TABLE todos (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    title VARCHAR(100) NOT NULL,
    content TEXT NULL,
    is_completed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_todos_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
);
```

### 3.3 주요 SQL 문
회원가입 시 사용한 SQL
```sql
INSERT INTO users (login_id, password_hash, user_name)
VALUES (?, ?, ?);
```

할 일 생성 시 사용한 SQL
```sql
INSERT INTO todos (user_id, title, content)
VALUES (?, ?, ?);
```

로그인한 사용자의 할 일 목록 조회 SQL
```sql
SELECT id, title, content, is_completed, created_at, updated_at
FROM todos
WHERE user_id = ?
ORDER BY is_completed ASC, created_at DESC, id DESC;
```

할 일 수정 SQL
```sql
UPDATE todos
SET title = ?, content = ?, is_completed = ?
WHERE id = ? AND user_id = ?;
```

완료 상태만 변경하는 SQL
```sql
UPDATE todos
SET is_completed = ?
WHERE id = ? AND user_id = ?;
```

할 일 삭제 SQL
```sql
DELETE FROM todos
WHERE id = ? AND user_id = ?;
```

이와 같은 SQL 구성을 통해, 각 사용자의 데이터가 서로 섞이지 않도록 `user_id` 조건을 반드시 포함하여 처리하였다.

## 4. 인프라 및 배포 기록
클라우드 서버: GCP VM 인스턴스에서 서버를 가동한 과정

도메인 연결: Cloudflare를 통한 HTTPS 보안 접속 설정 과정

## 5. 트러블슈팅 및 문제 해결
프로젝트를 진행하면서 생긴 문제와 해결방법은 다음과 같다.

### 5.1 로그인 상태가 유지되어 재접속 시 자동으로 대시보드로 이동하는 문제
초기에는 JWT 토큰을 `localStorage`에 저장하였기 때문에, 사용자가 로그아웃하지 않고 브라우저를 닫았다가 다시 접속해도 이전 로그인 상태가 유지되었다. 이로 인해 로그인 페이지를 거치지 않고 바로 대시보드로 진입하는 현상이 발생하였다.

이를 해결하기 위해 토큰 저장 방식을 `sessionStorage`로 변경하였다. 그 결과 같은 탭에서 새로고침할 때는 로그인 상태가 유지되지만, 브라우저 탭을 닫고 다시 접속하면 다시 로그인하도록 개선할 수 있었다.

- localStorage와 sessionStorage의 차이
`localStorage`는 브라우저를 종료한 뒤 다시 접속해도 데이터가 남아 있기 때문에 자동 로그인 상태가 쉽게 유지된다. 

`sessionStorage`는 현재 브라우저 탭이 열려 있는 동안만 데이터를 유지하며, 탭이나 브라우저를 닫으면 저장된 정보가 함께 사라진다. 

이번에 서비스할 웹사이트는 사용자가 브라우저를 완전히 종료한 뒤 다시 접속할 경우 다시 로그인하도록 만드는 것이 목적이었기 때문에 `sessionStorage`가 더 적합하다고 판단하였다.

### 5.2 체크박스 완료 처리 시 전체 수정 API를 재사용하던 문제
초기 구현에서는 할 일 완료 체크박스를 변경할 때도 기존 수정 API를 그대로 재사용하였다. 이 방식은 단순히 완료 여부만 바꾸고 싶어도 제목과 내용까지 함께 다시 전달해야 했기 때문에 구조가 비효율적이었고, 데이터가 꼬일 위험도 있었다.

이를 해결하기 위해 `PATCH /api/todos/:id/status` API를 별도로 추가하였다. 이 API는 완료 여부만 변경하도록 역할을 분리하였으며, 프론트엔드에서도 체크박스 토글 시 상태값만 전달하도록 수정하였다.

이때 HTTP 메서드로 `PATCH`를 사용한 이유는, 전체 데이터를 새로 저장하는 것이 아니라 기존 할 일 데이터의 일부 속성인 `is_completed` 값만 변경하는 작업이었기 때문이다.

### 6. 최종 회고
이번 프로젝트는 1차 해커톤에 비하면 조금 더 수월하게 진행되었다. 물론 상대적으로 덜 헤맸다는 뜻이지, 빠르게 끝났다는 의미는 아니다.

1차 해커톤을 하면서 느낀 점은 처음에 해야 할 일을 명확히 정하지 않으면 프로젝트를 진행하는 도중에 자꾸 헷갈리게 되고, 빠진 부분을 확인하는 데에도 시간이 많이 든다는 점이었다. 무엇을 빼먹었는지조차 구분하기 어려워지기 때문이다. 그래서 이번에는 시작 전에 워크플로우를 먼저 정하고 진행했다.

이번 해커톤은 필수 기능이 분명한 프로젝트였기 때문에, 먼저 DB 테이블 설계를 하고 API 라우트를 정리한 뒤 관련 SQL문까지 함께 작성했다. 이렇게 순서를 잡고 나니 해야 할 일이 훨씬 명확해졌고, 1차 해커톤에 비해 진행이 더 수월했던 것 같다. 기능 정리를 먼저 하고 워크플로우를 세운 뒤 프로젝트를 시작해야 한다는 점을 이번에 더 확실히 체감했다.

또한 DB를 사용할 경우 서버와 데이터베이스의 연관 관계가 매우 깊다는 점도 알 수 있었다. DB 테이블을 처음 직접 구성할 때는 고민이 많았지만, 실습 레퍼런스를 참고하면서 방향을 잡아갈 수 있었다. 이 과정에서 데이터 무결성을 지키는 설계가 중요하다는 점도 알게 되었고, 이 부분은 앞으로 더 공부해야겠다는 생각이 들었다.

이번에는 Google Cloud를 이용해 서버를 실제로 배포해본 점도 인상 깊었다. 내가 만든 웹사이트가 계속 살아 있는 상태로 동작한다는 것이 새롭게 느껴졌고, 작업하는 과정 자체도 재미있었다. 앞으로도 웹사이트를 만들고 직접 서버 배포까지 해보는 경험을 더 쌓아보고 싶다.

시간이 부족해 완성하지 못한 기능에 대한 개선 계획은 다음과 같다.
1. 할 일 생성 시 태그를 추가할 수 있게 하여, 태그별로 할 일을 분류해서 볼 수 있도록 개선하고 싶다.
2. 검색 기능을 추가하여 원하는 할 일을 빠르게 찾을 수 있게 만들고 싶다.
