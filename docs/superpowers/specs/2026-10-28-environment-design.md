# Окружение разработки и guardrails — дизайн

Дата: 2026-10-28
Статус: на согласовании

## Цель

Подготовить репозиторий сервиса бронирования звонков (см. `README.md`) к разработке: стек, локальный запуск через Docker и mise, линтеры, тесты с порогом покрытия 80%, проверка формата коммитов, CI на каждый push. Бизнес-логику на этом этапе не пишем.

## Критерии готовности

1. `mise run setup` на чистой машине (нужны только Docker и mise) готовит окружение.
2. `mise run check` запускает все проверки и проходит зелёным локально.
3. Тот же `mise run check` выполняется в GitHub Actions на каждый push в любую ветку и проходит зелёным.
4. Покрытие ниже 80% (lines, branches, functions, statements) роняет `check`.
5. Коммит с сообщением не по Conventional Commits отклоняется локально хуком `commit-msg`.
6. `git push` запускает `mise run check` и не выполняется, если проверки упали.
7. Версии всех инструментов зафиксированы в репозитории.
8. В корне есть `AGENTS.md` с командами запуска, тестов, линтера и правилом формата коммитов.

## Стек

| Область | Выбор | Версия |
|---|---|---|
| Runtime | Node.js LTS (Krypton) | 24.22.1 |
| Пакетный менеджер | pnpm (workspaces), через corepack | 12.15.0 |
| Язык | TypeScript | 6.0.3 |
| Бэкенд | Fastify + TypeBox | 5.x (последняя на момент установки) |
| БД | PostgreSQL | 18.6 (образ `postgres:18.6-alpine`) |
| ORM / миграции | Drizzle ORM + drizzle-kit | 0.45.x / 0.31.x |
| Фронтенд | React + Vite | 19.x / 8.x |
| Тесты | Vitest + `@vitest/coverage-v8`; Testing Library + jsdom для web | 5.x |
| Линтер | ESLint (flat config) + typescript-eslint | 10.x / 8.x |
| Форматтер | Prettier | 3.x |
| Коммиты | commitlint + `@commitlint/config-conventional` | 21.x |
| Git-хуки | lefthook (через mise) | 2.2.2 |
| Оркестрация задач | mise | min_version 2026.10.0 |

TypeScript закреплён на 6.0.x: typescript-eslint 8.x поддерживает `typescript <6.1`, а правила с проверкой типов — ключевая часть линтинга. Переход на TypeScript 7 — отдельная задача, когда появится поддержка в typescript-eslint.

Точные версии npm-пакетов фиксируются при установке (`save-exact=true`) и в `pnpm-lock.yaml`.

## Структура репозитория

```
apps/
  api/                 — Fastify, Drizzle; каркас: GET /health + тест
  web/                 — React + Vite; каркас: страница-заглушка + тест
docker/
  dev.Dockerfile       — образ с Node, pnpm, git
docs/superpowers/specs/
.github/workflows/
  ci.yml               — наш CI
  hexlet-check.yml     — не трогаем
compose.yaml
mise.toml
lefthook.yml
package.json           — корневые скрипты, packageManager, engines
pnpm-workspace.yaml
.npmrc                 — save-exact=true, engine-strict=true
tsconfig.base.json
eslint.config.js
.prettierrc.json, .prettierignore
vitest.config.ts       — projects: apps/api, apps/web; пороги покрытия
commitlint.config.js
AGENTS.md
README.md
```

`packages/shared` не создаём, пока не появится общий код.

## Docker

Всё выполняется в контейнерах; на хосте нужны только Docker и mise.

**`docker/dev.Dockerfile`** — на базе `node:24.22.1-bookworm-slim` (glibc, чтобы нативные бинарники esbuild/rollup работали без сюрпризов). Ставит `git` (нужен commitlint), включает corepack, помечает `/app` как `safe.directory` для git.

**`compose.yaml`:**

- `dev` — образ из `dev.Dockerfile`, исходники смонтированы в `/app`, pnpm store в именованном томе. Служит для разовых команд: `docker compose run --rm dev <команда>`. `node_modules` лежит в смонтированной папке, поэтому IDE на хосте видит типы.
- `db` — `postgres:18.6-alpine`, healthcheck через `pg_isready`, данные в именованном томе.
- `api` — тот же образ, `pnpm --filter api dev`, порт 3000, зависит от здорового `db`, получает `DATABASE_URL`.
- `web` — тот же образ, `pnpm --filter web dev --host`, порт 5173.

Production-образы не делаем — появятся вместе с задачей деплоя.

## mise

`mise.toml` фиксирует `min_version` и версию lefthook, а также описывает задачи — единую точку входа:

| Задача | Что делает |
|---|---|
| `mise run setup` | собирает образ, `pnpm install --frozen-lockfile` в контейнере, `lefthook install` |
| `mise run dev` | `docker compose up` — db, api, web |
| `mise run down` | `docker compose down` |
| `mise run check` | `pnpm install --frozen-lockfile && pnpm check` в контейнере `dev` |
| `mise run lint` / `format` / `typecheck` / `test` | соответствующий pnpm-скрипт в контейнере `dev` |
| `mise run shell` | shell внутри контейнера `dev` |

## Guardrails

**`pnpm check`** выполняет шаги последовательно, первый упавший останавливает прогон:

1. `format:check` — `prettier --check .`
2. `lint` — `eslint . --max-warnings=0`
3. `typecheck` — `tsc --noEmit` в каждом пакете
4. `test:coverage` — `vitest run --coverage`
5. `lint:commits` — `commitlint --last`

**ESLint:** `typescript-eslint` `strictTypeChecked` + `stylisticTypeChecked` с `projectService`; для `apps/web` — `eslint-plugin-react-hooks` и `eslint-plugin-react-refresh`; в конце `eslint-config-prettier`.

**TypeScript:** `tsconfig.base.json` — `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `verbatimModuleSyntax`; пакеты наследуют его.

**Покрытие:** корневой `vitest.config.ts` объединяет `apps/api` (окружение node) и `apps/web` (jsdom) через `projects`, единый отчёт v8, пороги 80% по lines, branches, functions, statements. Из покрытия исключены только файлы без логики: конфиги, точки входа (`apps/web/src/main.tsx`, `apps/api/src/server.ts`), миграции, `*.d.ts`.

**Каркас для проверок:** `apps/api` — фабрика приложения `buildApp()` с маршрутом `GET /health` → `{ "status": "ok" }` и тест через `app.inject()`; `apps/web` — компонент `App` с заголовком и тест на Testing Library. Это минимум, без которого Vitest падает с «нет тестов» и порог покрытия не проверить.

**Коммиты:** Conventional Commits, проверка через commitlint (`@commitlint/config-conventional`).

**Git-хуки (`lefthook.yml`):**

- `commit-msg` — `docker compose run --rm -T dev pnpm exec commitlint --edit {1}`
- `pre-push` — `mise run check`

**Фиксация версий:**

- Node — тег образа в `dev.Dockerfile` и `engines.node` в `package.json`;
- pnpm — `packageManager` в `package.json`;
- npm-зависимости — точные версии и `pnpm-lock.yaml`, в CI `--frozen-lockfile`;
- PostgreSQL — тег образа в `compose.yaml`;
- lefthook и минимальная версия mise — `mise.toml`;
- GitHub Actions — `actions/checkout@v7.0.1`, `jdx/mise-action@v5.2.4`.

## CI

`.github/workflows/ci.yml`, триггер — push в любую ветку:

1. `actions/checkout`
2. `jdx/mise-action` — ставит mise и инструменты из `mise.toml`
3. `mise run check`

`hexlet-check.yml` остаётся без изменений.

## AGENTS.md

Содержит: требования к хосту (Docker, mise), команды `setup`, `dev`, `check`, `lint`, `test`, `typecheck`, `format`, правило «перед завершением задачи `mise run check` должен быть зелёным», требование покрытия ≥ 80% и формат коммитов Conventional Commits с примерами (`feat:`, `fix:`, `docs:`, `chore:`, `test:`, `refactor:`, `ci:`).

## README.md

Раздел «Стек» заполняется выбранным стеком, разделы «Установка» и «Использование» — командами mise.

## Известные ограничения

- `lint:commits` в CI проверяет только последний коммит пуша; остальные защищает локальный хук `commit-msg`.
- Хук `commit-msg` поднимает контейнер — коммит занимает на 1–2 секунды дольше.
- На Linux-хосте файлы, созданные в контейнере, могут принадлежать root; на macOS с Docker Desktop проблемы нет. Решаем, если понадобится.
- Тестам пока не нужна БД; подключение `db` к прогону тестов добавим вместе с первыми интеграционными тестами.
