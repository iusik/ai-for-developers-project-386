# Окружение разработки и guardrails — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Подготовить монорепозиторий (Fastify API + React web) к разработке: Docker + mise, линтеры, тесты с порогом покрытия 80%, Conventional Commits, единая команда `mise run check` локально, в pre-push и в GitHub Actions.

**Architecture:** Все Node-инструменты работают внутри контейнера `dev` (образ `docker/dev.Dockerfile`), исходники смонтированы в `/app`. mise — точка входа: задачи `setup`, `dev`, `check` и т. д. оборачивают `docker compose`. lefthook (версия в `mise.toml`) вешает `commit-msg` и `pre-push`. CI ставит mise и выполняет тот же `mise run check`.

**Tech Stack:** Node 24.22.1, pnpm 12.15.0, TypeScript 6.0.3, Fastify 5, React 19 + Vite 8, Vitest 5 + coverage-v8, ESLint 10 + typescript-eslint 8, Prettier 3, commitlint 21, lefthook 2.2.2, PostgreSQL 18.6, mise ≥ 2026.10.0.

**Spec:** `docs/superpowers/specs/2026-10-28-environment-design.md`

## Global Constraints

- На хосте требуются только Docker и mise; Node-команды выполняются через `docker compose run --rm -T dev …`.
- Версии: Node `24.22.1` (образ `node:24.22.1-bookworm-slim`), pnpm `12.15.0`, TypeScript `6.0.3`, PostgreSQL `postgres:18.6-alpine`, lefthook `2.2.2`, mise `min_version = "2026.10.0"`, в CI mise `2026.10.21`, `actions/checkout@v7.0.1`, `jdx/mise-action@v5.2.4`.
- npm-зависимости — только точные версии (`saveExact: true`), установка в CI — `--frozen-lockfile`.
- Настройки pnpm — в `pnpm-workspace.yaml`, не в `.npmrc`.
- Порог покрытия: 80% lines, branches, functions, statements.
- Коммиты — Conventional Commits, каждый коммит заканчивается строкой `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.
- `.github/workflows/hexlet-check.yml` не изменять.
- Бизнес-логику (расписание, бронирования) не писать.
- Drizzle и TypeBox не устанавливать.

## Карта файлов

| Файл | Ответственность |
|---|---|
| `docker/dev.Dockerfile` | образ с Node, pnpm, git |
| `.dockerignore` | пустой контекст сборки |
| `compose.yaml` | сервисы `dev`, `db`, `api`, `web` |
| `mise.toml` | версия lefthook, min_version, задачи |
| `package.json` | корневые скрипты, devDependencies, `packageManager`, `engines` |
| `pnpm-workspace.yaml` | пакеты `apps/*`, настройки pnpm |
| `.gitignore` | `node_modules`, `coverage`, `dist`, `.env` |
| `.prettierrc.json`, `.prettierignore` | форматирование |
| `tsconfig.base.json` | общие строгие опции TS |
| `tsconfig.json` | typecheck корневых `*.ts`-конфигов |
| `eslint.config.js` | правила линтера для всего репозитория |
| `vitest.config.ts` | projects + покрытие с порогами |
| `apps/api/*` | Fastify-каркас: `buildApp()`, `server.ts`, тест `/health` |
| `apps/web/*` | React-каркас: `App`, `main.tsx`, тест |
| `commitlint.config.js` | пресет conventional |
| `lefthook.yml` | хуки `commit-msg`, `pre-push` |
| `.github/workflows/ci.yml` | CI |
| `AGENTS.md`, `README.md` | документация команд и правил |

---

### Task 1: Docker-образ, compose, mise и корневой pnpm-проект с Prettier

**Files:**
- Create: `docker/dev.Dockerfile`, `.dockerignore`, `compose.yaml`, `mise.toml`, `package.json`, `pnpm-workspace.yaml`, `.gitignore`, `.prettierrc.json`, `.prettierignore`
- Modify: `README.md`, `docs/**` (только форматирование Prettier)

**Interfaces:**
- Produces: образ `callbook-dev:local`; сервис `dev` (команды: `docker compose run --rm -T dev <cmd>`); задачи mise `setup`, `dev`, `down`, `shell`, `check`, `lint`, `format`, `typecheck`, `test`; pnpm-скрипты `format`, `format:check`.

- [ ] **Step 1: Проверить, что mise установлен**

Run: `mise --version`
Expected: версия ≥ 2026.10.0. Если команды нет — попросить пользователя выполнить `! brew install mise` и активировать mise в shell (`eval "$(mise activate zsh)"` в `~/.zshrc`).

- [ ] **Step 2: Создать `docker/dev.Dockerfile`**

```dockerfile
FROM node:24.22.1-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends git ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Версия должна совпадать с packageManager в package.json
RUN npm install -g pnpm@12.15.0 \
  && git config --system --add safe.directory /app

WORKDIR /app
```

- [ ] **Step 3: Создать `.dockerignore`** (образу не нужны файлы проекта — исходники монтируются томом)

```
*
```

- [ ] **Step 4: Создать `compose.yaml`**

```yaml
name: callbook

x-node: &node
  build:
    context: .
    dockerfile: docker/dev.Dockerfile
  image: callbook-dev:local
  working_dir: /app
  volumes:
    - .:/app
    - pnpm-store:/root/.local/share/pnpm
  environment:
    CI: ${CI:-}

services:
  dev:
    <<: *node
    profiles: [tools]

  db:
    image: postgres:18.6-alpine
    environment:
      POSTGRES_USER: callbook
      POSTGRES_PASSWORD: callbook
      POSTGRES_DB: callbook
    ports:
      - '5432:5432'
    volumes:
      - db-data:/var/lib/postgresql
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U callbook -d callbook']
      interval: 2s
      timeout: 3s
      retries: 15

  api:
    <<: *node
    command: pnpm --filter @callbook/api dev
    ports:
      - '3000:3000'
    environment:
      CI: ${CI:-}
      PORT: '3000'
      HOST: 0.0.0.0
      DATABASE_URL: postgres://callbook:callbook@db:5432/callbook
    depends_on:
      db:
        condition: service_healthy

  web:
    <<: *node
    command: pnpm --filter @callbook/web dev --host 0.0.0.0 --port 5173
    ports:
      - '5173:5173'
    depends_on:
      - api

volumes:
  pnpm-store:
  db-data:
```

- [ ] **Step 5: Создать `mise.toml`**

```toml
min_version = "2026.10.0"

[tools]
lefthook = "2.2.2"

[tasks.setup]
description = "Собрать образ, установить зависимости и git-хуки"
run = [
  "docker compose build dev",
  "docker compose run --rm -T dev pnpm install --frozen-lockfile",
  "lefthook install",
]

[tasks.dev]
description = "Запустить db, api и web"
run = "docker compose up --build db api web"

[tasks.down]
description = "Остановить окружение"
run = "docker compose down"

[tasks.shell]
description = "Shell внутри контейнера dev"
run = "docker compose run --rm dev bash"

[tasks.check]
description = "Все проверки: формат, линтер, типы, тесты с покрытием, коммит"
run = "docker compose run --rm -T dev sh -c 'pnpm install --frozen-lockfile && pnpm check'"

[tasks.lint]
description = "ESLint"
run = "docker compose run --rm -T dev pnpm lint"

[tasks.format]
description = "Отформатировать код Prettier"
run = "docker compose run --rm -T dev pnpm format"

[tasks.typecheck]
description = "Проверка типов TypeScript"
run = "docker compose run --rm -T dev pnpm typecheck"

[tasks.test]
description = "Тесты с покрытием"
run = "docker compose run --rm -T dev pnpm test:coverage"
```

- [ ] **Step 6: Создать `pnpm-workspace.yaml`**

```yaml
packages:
  - apps/*

saveExact: true
engineStrict: true
```

- [ ] **Step 7: Создать `package.json`**

```json
{
  "name": "callbook",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@12.15.0",
  "engines": {
    "node": "24.22.1"
  },
  "scripts": {
    "format": "prettier --write .",
    "format:check": "prettier --check ."
  }
}
```

- [ ] **Step 8: Создать `.gitignore`**

```
node_modules/
coverage/
dist/
.env
*.log
.DS_Store
```

- [ ] **Step 9: Создать `.prettierrc.json` и `.prettierignore`**

`.prettierrc.json`:

```json
{
  "singleQuote": true
}
```

`.prettierignore`:

```
pnpm-lock.yaml
coverage/
dist/
.github/workflows/hexlet-check.yml
```

- [ ] **Step 10: Собрать образ и установить Prettier**

Run:
```bash
docker compose build dev
docker compose run --rm -T dev pnpm add -D -w prettier@3.9.10
```
Expected: появились `node_modules/`, `pnpm-lock.yaml`, в `package.json` — `"prettier": "3.9.10"` (без `^`). Если pnpm падает с `ERR_PNPM_IGNORED_BUILDS` — добавить в `pnpm-workspace.yaml` блок `allowBuilds:` с перечисленными в ошибке пакетами (`<имя>: true`) и повторить.

- [ ] **Step 11: Отформатировать репозиторий и проверить формат**

Run: `docker compose run --rm -T dev pnpm format && docker compose run --rm -T dev pnpm format:check`
Expected: PASS, `All matched files use Prettier code style!`. Проверить `git diff .github/workflows/hexlet-check.yml` — пусто.

- [ ] **Step 12: Проверить задачи mise и db**

Run: `docker compose run --rm -T dev pnpm install --frozen-lockfile` — Expected: без ошибок, lockfile актуален. (`mise run setup` целиком не запускать до Task 4: `lefthook install` без `lefthook.yml` создаст шаблонный конфиг.)
Run: `docker compose up -d db && docker compose ps db` — Expected: статус `healthy`. Затем `docker compose down`.

- [ ] **Step 13: Commit**

```bash
git add docker .dockerignore compose.yaml mise.toml package.json pnpm-workspace.yaml pnpm-lock.yaml .gitignore .prettierrc.json .prettierignore README.md docs
git commit -m "chore: add docker, mise and prettier setup" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: TypeScript, ESLint, Vitest и каркас API

**Files:**
- Create: `tsconfig.base.json`, `tsconfig.json`, `eslint.config.js`, `vitest.config.ts`, `apps/api/package.json`, `apps/api/tsconfig.json`, `apps/api/vitest.config.ts`, `apps/api/src/app.ts`, `apps/api/src/server.ts`
- Test: `apps/api/src/app.test.ts`
- Modify: `package.json` (scripts + devDependencies)

**Interfaces:**
- Consumes: сервис `dev`, pnpm-скрипты `format`, `format:check` (Task 1).
- Produces: `buildApp(options?: FastifyServerOptions): FastifyInstance` в `apps/api/src/app.ts`; pnpm-скрипты `lint`, `typecheck`, `test`, `test:coverage`; корневой `vitest.config.ts` с `projects: ['apps/*']`; пакет `@callbook/api` со скриптами `dev`, `typecheck`.

- [ ] **Step 1: Создать `tsconfig.base.json`**

TypeScript 6 по умолчанию ставит `types: []`, поэтому каждый пакет перечисляет нужные типы явно.

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "noEmit": true
  }
}
```

- [ ] **Step 2: Создать `tsconfig.json`** (корневые TS-конфиги)

```json
{
  "extends": "./tsconfig.base.json",
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "types": ["node"]
  },
  "include": ["vitest.config.ts"]
}
```

- [ ] **Step 3: Создать пакет `apps/api`**

`apps/api/package.json`:

```json
{
  "name": "@callbook/api",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "typecheck": "tsc -p tsconfig.json"
  }
}
```

`apps/api/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "types": ["node"]
  },
  "include": ["src", "vitest.config.ts"]
}
```

`apps/api/vitest.config.ts`:

```ts
import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'api',
    environment: 'node',
  },
});
```

- [ ] **Step 4: Установить зависимости**

Run:
```bash
docker compose run --rm -T dev pnpm add -D -w typescript@6.0.3 @types/node@24.19.2 eslint@10.13.0 @eslint/js@10.0.1 typescript-eslint@8.72.1 eslint-config-prettier@10.1.8 globals@17.13.0 vitest@5.0.5 @vitest/coverage-v8@5.0.5
docker compose run --rm -T dev pnpm --filter @callbook/api add fastify@5.12.7
docker compose run --rm -T dev pnpm --filter @callbook/api add -D tsx@4.23.15
```
Expected: все версии в `package.json` без `^`. При `ERR_PNPM_IGNORED_BUILDS` — дополнить `allowBuilds` в `pnpm-workspace.yaml` (например, `esbuild: true`).

- [ ] **Step 5: Создать корневой `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: ['apps/*'],
    coverage: {
      provider: 'v8',
      include: ['apps/*/src/**/*.{ts,tsx}'],
      exclude: [
        '**/*.test.{ts,tsx}',
        '**/*.d.ts',
        'apps/api/src/server.ts',
        'apps/web/src/main.tsx',
        'apps/web/src/test/**',
      ],
      reporter: ['text', 'html'],
      thresholds: {
        lines: 80,
        branches: 80,
        functions: 80,
        statements: 80,
      },
    },
  },
});
```

- [ ] **Step 6: Добавить скрипты в корневой `package.json`**

Блок `scripts` целиком:

```json
"scripts": {
  "format": "prettier --write .",
  "format:check": "prettier --check .",
  "lint": "eslint . --max-warnings=0",
  "typecheck": "tsc -p tsconfig.json && pnpm -r run typecheck",
  "test": "vitest run",
  "test:coverage": "vitest run --coverage"
}
```

- [ ] **Step 7: Написать падающий тест `apps/api/src/app.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { buildApp } from './app.js';

describe('GET /health', () => {
  it('отвечает статусом ok', async () => {
    const app = buildApp();

    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json<{ status: string }>()).toEqual({ status: 'ok' });
    await app.close();
  });
});
```

- [ ] **Step 8: Запустить тест — должен упасть**

Run: `docker compose run --rm -T dev pnpm test`
Expected: FAIL — `Failed to resolve import "./app.js"` / модуль не найден.

- [ ] **Step 9: Реализовать `apps/api/src/app.ts`**

```ts
import Fastify, {
  type FastifyInstance,
  type FastifyServerOptions,
} from 'fastify';

export function buildApp(options: FastifyServerOptions = {}): FastifyInstance {
  const app = Fastify(options);

  app.get('/health', () => ({ status: 'ok' }));

  return app;
}
```

- [ ] **Step 10: Создать точку входа `apps/api/src/server.ts`**

```ts
import { buildApp } from './app.js';

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '0.0.0.0';

const app = buildApp({ logger: true });

await app.listen({ port, host });
```

- [ ] **Step 11: Запустить тесты с покрытием — должны пройти**

Run: `docker compose run --rm -T dev pnpm test:coverage`
Expected: PASS, 1 тест; `app.ts` 100%; пороги выполнены.

- [ ] **Step 12: Создать `eslint.config.js`**

```js
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig(
  globalIgnores(['**/node_modules/', '**/coverage/', '**/dist/']),
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ['**/*.js'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['apps/api/**/*.ts'],
    languageOptions: { globals: globals.node },
  },
  prettier,
);
```

- [ ] **Step 13: Прогнать линтер и типы**

Run: `docker compose run --rm -T dev pnpm lint && docker compose run --rm -T dev pnpm typecheck`
Expected: оба PASS без предупреждений. Если линтер ругается на конкретное правило в каркасе — исправить код, а не отключать правило.

- [ ] **Step 14: Проверить dev-сервер API**

Run: `docker compose up -d api && sleep 5 && curl -s localhost:3000/health; docker compose down`
Expected: `{"status":"ok"}`.

- [ ] **Step 15: Отформатировать и закоммитить**

```bash
docker compose run --rm -T dev pnpm format
git add tsconfig.base.json tsconfig.json eslint.config.js vitest.config.ts package.json pnpm-lock.yaml pnpm-workspace.yaml apps/api
git commit -m "chore: add typescript, eslint, vitest and api skeleton" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Каркас web (React + Vite) с тестом

**Files:**
- Create: `apps/web/package.json`, `apps/web/tsconfig.json`, `apps/web/vite.config.ts`, `apps/web/index.html`, `apps/web/src/App.tsx`, `apps/web/src/main.tsx`, `apps/web/src/test/setup.ts`
- Test: `apps/web/src/App.test.tsx`
- Modify: `eslint.config.js`

**Interfaces:**
- Consumes: корневые `vitest.config.ts` (`projects: ['apps/*']`, исключения `apps/web/src/main.tsx`, `apps/web/src/test/**`), `tsconfig.base.json`, `eslint.config.js` (Task 2).
- Produces: компонент `App(): JSX.Element` в `apps/web/src/App.tsx`; пакет `@callbook/web` со скриптами `dev`, `typecheck`.

- [ ] **Step 1: Создать `apps/web/package.json`**

```json
{
  "name": "@callbook/web",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "typecheck": "tsc -p tsconfig.json"
  }
}
```

- [ ] **Step 2: Установить зависимости**

Run:
```bash
docker compose run --rm -T dev pnpm --filter @callbook/web add react@19.3.1 react-dom@19.3.1
docker compose run --rm -T dev pnpm --filter @callbook/web add -D vite@8.3.5 @vitejs/plugin-react@6.1.2 @types/react@19.3.0 @types/react-dom@19.3.0 jsdom@30.1.3 @testing-library/react@16.3.3 @testing-library/dom@10.4.2 @testing-library/jest-dom@7.0.1
docker compose run --rm -T dev pnpm add -D -w eslint-plugin-react-hooks@7.1.1 eslint-plugin-react-refresh@0.5.7
```
Expected: точные версии. Проверить, что у `@testing-library/jest-dom@7` есть точка входа `@testing-library/jest-dom/vitest` (`ls node_modules/@testing-library/jest-dom/vitest*` внутри контейнера или поле `exports` в его `package.json`).

- [ ] **Step 3: Создать `apps/web/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "types": ["vite/client", "node"]
  },
  "include": ["src", "vite.config.ts"]
}
```

- [ ] **Step 4: Создать `apps/web/vite.config.ts`**

```ts
import react from '@vitejs/plugin-react';
import { defineProject } from 'vitest/config';

export default defineProject({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://api:3000',
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  test: {
    name: 'web',
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
});
```

- [ ] **Step 5: Создать `apps/web/src/test/setup.ts`**

```ts
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});
```

- [ ] **Step 6: Написать падающий тест `apps/web/src/App.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('App', () => {
  it('показывает заголовок сервиса', () => {
    render(<App />);

    expect(
      screen.getByRole('heading', { name: 'Календарь звонков' }),
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 7: Запустить — должен упасть**

Run: `docker compose run --rm -T dev pnpm test`
Expected: FAIL в проекте `web` — не найден `./App`; тест `api` проходит.

- [ ] **Step 8: Реализовать `apps/web/src/App.tsx`**

```tsx
export function App() {
  return (
    <main>
      <h1>Календарь звонков</h1>
      <p>Скоро здесь можно будет забронировать звонок.</p>
    </main>
  );
}
```

- [ ] **Step 9: Создать `apps/web/src/main.tsx` и `apps/web/index.html`**

`apps/web/src/main.tsx`:

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

const root = document.getElementById('root');

if (!root) {
  throw new Error('Не найден элемент #root');
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

`apps/web/index.html`:

```html
<!doctype html>
<html lang="ru">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Календарь звонков</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 10: Тесты с покрытием**

Run: `docker compose run --rm -T dev pnpm test:coverage`
Expected: PASS, 2 теста (api + web), покрытие ≥ 80% по всем метрикам.

- [ ] **Step 11: Добавить React-правила в `eslint.config.js`**

Добавить импорты:

```js
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
```

И блок перед `prettier,`:

```js
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat.recommended, reactRefresh.configs.vite],
    languageOptions: { globals: globals.browser },
  },
```

Если в установленных версиях плагинов имена конфигов отличаются (`reactHooks.configs.flat['recommended-latest']`, `reactRefresh.configs.vite()`), свериться с README плагина в `node_modules` и использовать актуальное имя.

- [ ] **Step 12: Линтер и типы**

Run: `docker compose run --rm -T dev pnpm lint && docker compose run --rm -T dev pnpm typecheck`
Expected: PASS без предупреждений.

- [ ] **Step 13: Проверить dev-сервер**

Run: `docker compose up -d web && sleep 8 && curl -s localhost:5173 | grep -o '<title>.*</title>'; docker compose down`
Expected: `<title>Календарь звонков</title>`.

- [ ] **Step 14: Отформатировать и закоммитить**

```bash
docker compose run --rm -T dev pnpm format
git add apps/web eslint.config.js package.json pnpm-lock.yaml pnpm-workspace.yaml
git commit -m "chore: add react web skeleton" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: commitlint, единая команда `check` и git-хуки

**Files:**
- Create: `commitlint.config.js`, `lefthook.yml`
- Modify: `package.json` (scripts `lint:commits`, `check`)

**Interfaces:**
- Consumes: pnpm-скрипты `format:check`, `lint`, `typecheck`, `test:coverage` (Tasks 1–3); задача mise `check` (Task 1).
- Produces: pnpm-скрипты `lint:commits`, `check`; хуки `commit-msg`, `pre-push`.

- [ ] **Step 1: Установить commitlint**

Run: `docker compose run --rm -T dev pnpm add -D -w @commitlint/cli@21.2.4 @commitlint/config-conventional@21.2.4`

- [ ] **Step 2: Создать `commitlint.config.js`**

```js
export default {
  extends: ['@commitlint/config-conventional'],
};
```

- [ ] **Step 3: Проверить, что неправильное сообщение отклоняется**

Run: `echo "Update stuff" | docker compose run --rm -T dev pnpm exec commitlint`
Expected: FAIL — `subject may not be empty`, `type may not be empty`.
Run: `echo "chore: update stuff" | docker compose run --rm -T dev pnpm exec commitlint`
Expected: PASS (код 0).

- [ ] **Step 4: Добавить скрипты в `package.json`**

Дописать в `scripts`:

```json
"lint:commits": "commitlint --last --verbose",
"check": "pnpm format:check && pnpm lint && pnpm typecheck && pnpm test:coverage && pnpm lint:commits"
```

- [ ] **Step 5: Создать `lefthook.yml`**

```yaml
commit-msg:
  commands:
    commitlint:
      run: docker compose run --rm -T dev pnpm exec commitlint --edit {1}

pre-push:
  commands:
    check:
      run: mise run check
```

- [ ] **Step 6: Установить хуки**

Run: `lefthook install` (через mise: `mise exec -- lefthook install`)
Expected: созданы `.git/hooks/commit-msg` и `.git/hooks/pre-push`.

- [ ] **Step 7: Проверить, что падение покрытия роняет check**

Временно создать `apps/api/src/uncovered.ts`:

```ts
export function uncovered(a: number): number {
  if (a > 0) {
    return a * 2;
  }
  return -a;
}

export function alsoUncovered(): string {
  return 'never called';
}
```

Run: `docker compose run --rm -T dev pnpm test:coverage`
Expected: FAIL — `ERROR: Coverage for lines (…%) does not meet global threshold (80%)`.
Удалить файл: `rm apps/api/src/uncovered.ts`.

- [ ] **Step 8: Отформатировать и закоммитить — хук `commit-msg` должен отработать**

Сначала проверить отказ:
```bash
docker compose run --rm -T dev pnpm format
git add commitlint.config.js lefthook.yml package.json pnpm-lock.yaml
git commit -m "Add commitlint"
```
Expected: коммит отклонён хуком commitlint.

Затем:
```bash
git commit -m "chore: add commitlint, check script and git hooks" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```
Expected: коммит создан.

- [ ] **Step 9: Полный прогон**

Run: `mise run check`
Expected: все пять шагов PASS, последний — `commitlint` без ошибок.

---

### Task 5: CI, AGENTS.md и README

**Files:**
- Create: `.github/workflows/ci.yml`, `AGENTS.md`
- Modify: `README.md` (разделы «Стек», «Установка», «Использование»)

**Interfaces:**
- Consumes: задачи mise `setup`, `dev`, `down`, `check`, `lint`, `format`, `typecheck`, `test`, `shell` (Task 1); хуки (Task 4).
- Produces: workflow `ci` на каждый push.

- [ ] **Step 1: Создать `.github/workflows/ci.yml`**

```yaml
name: ci

on:
  push:
    branches:
      - '**'

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7.0.1

      - uses: jdx/mise-action@v5.2.4
        with:
          version: 2026.10.21

      - name: Run all checks
        run: mise run check
```

- [ ] **Step 2: Создать `AGENTS.md`**

````markdown
# AGENTS.md

Сервис бронирования звонков (аналог cal.com). Монорепозиторий pnpm: `apps/api` — Fastify, `apps/web` — React + Vite. Описание продукта — в `README.md`, дизайн окружения — в `docs/superpowers/specs/`.

## Требования к хосту

Только Docker и [mise](https://mise.jdx.dev). Node и pnpm запускаются внутри контейнера `dev`; не вызывайте `pnpm`/`node` на хосте напрямую.

## Команды

| Команда | Что делает |
|---|---|
| `mise run setup` | собрать образ, установить зависимости, установить git-хуки |
| `mise run dev` | запустить db (5432), api (http://localhost:3000), web (http://localhost:5173) |
| `mise run down` | остановить окружение |
| `mise run check` | **все проверки**: формат, линтер, типы, тесты с покрытием, формат коммита |
| `mise run lint` | ESLint |
| `mise run format` | Prettier (исправляет файлы) |
| `mise run typecheck` | TypeScript |
| `mise run test` | Vitest с покрытием |
| `mise run shell` | shell в контейнере `dev` |

Разовая команда в контейнере: `docker compose run --rm -T dev <команда>`, например `docker compose run --rm -T dev pnpm --filter @callbook/api add <пакет>@<версия>`.

## Правила

- Перед завершением задачи `mise run check` должен быть зелёным. Тот же `check` запускается хуком `pre-push` и в GitHub Actions.
- Покрытие тестами — не ниже 80% (lines, branches, functions, statements); падение ниже порога роняет `check`.
- Предупреждения ESLint считаются ошибками. Не отключайте правила, чтобы пройти проверку, — исправляйте код.
- Зависимости — только точные версии (`saveExact` в `pnpm-workspace.yaml`), lockfile коммитится.
- Версии инструментов зафиксированы: Node — `docker/dev.Dockerfile` и `engines` в `package.json`; pnpm — `packageManager` и `docker/dev.Dockerfile` (менять вместе); PostgreSQL — `compose.yaml`; lefthook и mise — `mise.toml`, `.github/workflows/ci.yml`.
- Не изменяйте `.github/workflows/hexlet-check.yml`.

## Формат коммитов

[Conventional Commits](https://www.conventionalcommits.org/ru/v1.0.0/): `<тип>(<область>)?: <описание>`. Проверяется commitlint в хуке `commit-msg` и в `check`.

Типы: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.

Примеры:

```
feat(api): add endpoint for available slots
fix(web): show slots in guest timezone
test(api): cover double booking
chore: bump vitest to 5.0.6
```
````

- [ ] **Step 3: Обновить README.md**

Заменить разделы «Стек», «Установка» и «Использование» на:

````markdown
## Стек

- **Бэкенд:** Node.js 24, Fastify 5, TypeScript, PostgreSQL 18 (Drizzle ORM — с первой фичей, которой нужна БД)
- **Фронтенд:** React 19, Vite 8
- **Тесты:** Vitest, Testing Library; порог покрытия 80%
- **Качество:** ESLint (typescript-eslint strict), Prettier, commitlint (Conventional Commits), lefthook
- **Окружение:** Docker Compose, mise; pnpm workspaces

## Установка

Нужны только [Docker](https://www.docker.com/) и [mise](https://mise.jdx.dev).

```bash
git clone https://github.com/iusik/ai-for-developers-project-386.git
cd ai-for-developers-project-386
mise trust
mise run setup
```

## Использование

```bash
mise run dev     # db, api на http://localhost:3000, web на http://localhost:5173
mise run check   # все проверки: формат, линтер, типы, тесты с покрытием
```

Остальные команды и правила разработки — в [AGENTS.md](AGENTS.md).
````

- [ ] **Step 4: Отформатировать и прогнать check**

Run: `mise run format && mise run check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/ci.yml AGENTS.md README.md
git commit -m "ci: run checks on every push" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 6: Push и проверка CI (только с согласия пользователя)**

Спросить пользователя разрешения на `git push origin master`. После push:
Run: `gh run watch $(gh run list --workflow ci.yml --limit 1 --json databaseId -q '.[0].databaseId') --exit-status`
Expected: workflow `ci` зелёный. Хук `pre-push` перед этим должен выполнить `mise run check` и пройти.
