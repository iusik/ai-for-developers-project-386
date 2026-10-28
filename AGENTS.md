# AGENTS.md

Сервис бронирования звонков (аналог cal.com). Монорепозиторий pnpm: `apps/api` — Fastify, `apps/web` — React + Vite. Описание продукта — в `README.md`, дизайн окружения — в `docs/superpowers/specs/`.

## Требования к хосту

Только Docker и [mise](https://mise.jdx.dev). Node и pnpm запускаются внутри контейнера `dev`; не вызывайте `pnpm`/`node` на хосте напрямую — `node_modules` содержит Linux-сборки нативных пакетов (esbuild, rolldown), сделанные внутри контейнера.

Первый запуск: `mise trust && mise run setup`.

## Команды

| Команда                 | Что делает                                                                    |
| ----------------------- | ----------------------------------------------------------------------------- |
| `mise run setup`        | собрать образ, установить зависимости, установить git-хуки                    |
| `mise run dev`          | запустить db (5432), api (http://localhost:3000), web (http://localhost:5173) |
| `mise run down`         | остановить окружение                                                          |
| `mise run check`        | **все проверки**: формат, линтер, типы, тесты с покрытием, формат коммита     |
| `mise run lint:commits` | проверить сообщение последнего коммита (Conventional Commits)                 |
| `mise run lint`         | ESLint                                                                        |
| `mise run format`       | Prettier (исправляет файлы)                                                   |
| `mise run typecheck`    | TypeScript                                                                    |
| `mise run test`         | Vitest с покрытием                                                            |
| `mise run shell`        | shell в контейнере `dev`                                                      |

Разовая команда в контейнере: `docker compose run --rm -T dev <команда>`, например `docker compose run --rm -T dev pnpm --filter @callbook/api add <пакет>@<версия>`.

## Правила

- Перед завершением задачи `mise run check` должен быть зелёным. Тот же `check` запускается хуком `pre-push` и в GitHub Actions.
- Покрытие тестами — не ниже 80% (lines, branches, functions, statements); падение ниже порога роняет `check`.
- Предупреждения ESLint считаются ошибками. Не отключайте правила, чтобы пройти проверку, — исправляйте код.
- Зависимости — только точные версии (`saveExact` в `pnpm-workspace.yaml`), lockfile коммитится.
- Версии инструментов зафиксированы: Node — `docker/dev.Dockerfile` и `engines` в `package.json`; pnpm — `packageManager` и `docker/dev.Dockerfile` (менять вместе); PostgreSQL — `compose.yaml`; lefthook и mise — `mise.toml`, `.github/workflows/ci.yml`.
- Не изменяйте `.github/workflows/hexlet-check.yml`.
- Git-хуки ставит `mise run setup` (`lefthook install`). После смены версии lefthook в `mise.toml` повторите `mise run setup`.
- `pre-push` проверяет рабочее дерево, а не только отправляемые коммиты, — перед push закоммитьте или уберите незакоммиченные изменения.

## Формат коммитов

[Conventional Commits](https://www.conventionalcommits.org/ru/v1.0.0/): `<тип>(<область>)?: <описание>`. Сообщение проверяется commitlint — в хуке `commit-msg` и в `mise run check`.

Типы: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.

Примеры:

```
feat(api): add endpoint for available slots
fix(web): show slots in guest timezone
docs: describe booking rules
refactor(api): extract slot generator
test(api): cover double booking
chore: bump vitest to 5.0.6
ci: cache docker layers
```

## Agent skills

### Issue tracker

Задачи ведутся в GitHub Issues репозитория `iusik/ai-for-developers-project-386` через `gh`. См. `docs/agents/issue-tracker.md`.

### Triage labels

Стандартные метки: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. См. `docs/agents/triage-labels.md`.

### Domain docs

Single-context: один `GLOSSARY.md` и `docs/adr/` в корне репозитория. См. `docs/agents/domain.md`.
