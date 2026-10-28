# Трекер задач: GitHub

Задачи и спецификации этого репозитория хранятся в GitHub Issues. Все операции выполняются через CLI `gh`.

## Соглашения

- **Создать задачу**: `gh issue create --title "..." --body "..."`. Для многострочного описания используйте heredoc.
- **Прочитать задачу**: `gh issue view <number> --json number,title,body,labels,comments`.
- **Список задач**: `gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'` с нужными фильтрами `--label` и `--state`.
- **Сделать задачу подзадачей родителя**: `gh issue create --parent <parent> ...` или потом `gh issue edit <parent> --add-sub-issue <child>` (`gh` 2.94+). В старом `gh`: `gh api --method POST repos/<owner>/<repo>/issues/<parent>/sub_issues -F sub_issue_id=<child-db-id>` (database id, как в пункте **Блокировки**). Если sub-issues недоступны, начните описание дочерней задачи строкой `Part of #<parent>`.
- **Блокировки**: **нативные зависимости задач** GitHub — каноническое представление, видимое в интерфейсе. Связь добавляется через `gh issue create --blocked-by <n>,<n> ...` или `gh issue edit <child> --add-blocked-by <blocker>` (`gh` 2.94+). В старом `gh`: `gh api --method POST repos/<owner>/<repo>/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-db-id>`, где `<blocker-db-id>` — числовой **database id** блокирующей задачи (`gh api repos/<owner>/<repo>/issues/<n> --jq .id`, _не_ `#number` и не `node_id`). Если зависимости недоступны, начните описание дочерней задачи строкой `Blocked by: #<n>, #<n>`. Задача разблокирована, когда закрыты все блокирующие.
- **Посчитать открытые блокировки**: `gh api repos/<owner>/<repo>/issues/<n> --jq .issue_dependencies_summary.blocked_by` (только открытые; 0 — можно начинать). `gh issue view <n> --json blockedBy` показывает и закрытые, поэтому фильтруйте: `--jq '[.blockedBy.nodes[] | select(.state == "OPEN")] | length'`.
- **Прокомментировать задачу**: `gh issue comment <number> --body "..."`
- **Добавить / снять метки**: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **Закрыть**: опубликуйте пояснение через `gh issue comment <number> --body "..."`, затем `gh issue close <number>`. Для уже закрытой задачи `gh issue close --comment` теряет комментарий и всё равно завершается с кодом 0.

Репозиторий определяется по `git remote -v`; внутри клона `gh` делает это сам.

Создавайте задачи только в репозитории пользователя (`iusik/ai-for-developers-project-386`). Никогда не создавайте их в `mattpocock/skills` (репозиторий, откуда взяты скиллы), если он не принадлежит пользователю. В форке `gh` может по умолчанию выбрать upstream, поэтому перед первым `gh issue create` в сессии проверьте цель через `gh repo view --json nameWithOwner` и, если это не репозиторий пользователя, уточните у него.

## Pull request'ы как источник запросов

**PRs as a request surface: no.** _(Поставьте `yes`, если внешние PR в этом репозитории считаются запросами на функциональность; флаг читает `/triage`.)_

При значении `yes` PR проходят через те же метки и состояния, что и задачи, с эквивалентами `gh pr`:

- **Прочитать PR**: `gh pr view <number>`, затем `gh pr view <number> --comments` (без TTY `--comments` выводит только комментарии, без описания) и `gh pr diff <number>` для diff.
- **Список внешних PR для triage**: `gh api --paginate 'repos/{owner}/{repo}/pulls?state=open' --jq '.[] | select(.author_association | IN("OWNER","MEMBER","COLLABORATOR") | not) | {number, title, author: .user.login, author_association, labels: [.labels[].name]}'`.
- **Комментарий / метки / закрытие**: `gh pr comment`, `gh pr edit --add-label`/`--remove-label`, `gh pr close`.

У задач и PR в GitHub общая нумерация, поэтому `#42` может быть и тем, и другим: проверьте `gh pr view 42`, при неудаче — `gh issue view 42`.

## Когда скилл говорит «опубликовать в трекере задач»

Создайте задачу в GitHub.

## Когда скилл говорит «получить нужный тикет»

Прочитайте его, как в пункте **Прочитать задачу** выше.

## Операции wayfinding

Используются `/wayfinder`. **Карта** — одна задача, **дочерние** задачи — тикеты.

- **Карта**: одна задача с меткой `wayfinder:map`, в описании которой разделы Notes / Decisions-so-far / Fog. `gh issue create --label wayfinder:map`.
- **Дочерний тикет**: задача, привязанная к карте как sub-issue GitHub (см. **Сделать задачу подзадачей родителя**). Если sub-issues не включены, добавьте тикет в task list в описании карты и начните описание тикета строкой `Part of #<map>`. Метки: `wayfinder:<type>` (`research`/`prototype`/`grilling`/`task`). Взятый в работу тикет назначается на разработчика, который его ведёт.
- **Блокировки**: см. **Блокировки** в разделе «Соглашения».
- **Запрос фронтира**: возьмите открытые дочерние задачи карты (`gh issue list --state open` в пределах sub-issues / task list карты), отбросьте те, у которых есть открытая блокировка (см. **Посчитать открытые блокировки** или открытую задачу в строке `Blocked by`) или исполнитель; побеждает первая по порядку на карте.
- **Взять в работу**: `gh issue edit <n> --add-assignee @me` — первая запись в сессии.
- **Закрыть тикет**: `gh issue comment <n> --body "<ответ>"`, затем `gh issue close <n>`, затем допишите в Decisions-so-far карты ссылку на контекст (суть + ссылка).
