# Ревизия PR и порядок безопасного слияния — 2026-10-17

Это снимок по GitHub на момент проверки. Mergeability/CI могут измениться; **перед слиянием перепроверять на последнем head SHA**. Документационные PR не создают работающие функции.

## driving-school

| PR | Состояние | Решение |
|---|---|---|
| #198 pre-confirmation push spec | mergeable, CI green | **Готов к документальному merge**; реализация push ещё не начиналась |
| #199 deployment/configuration guide | mergeable, CI green | **Готов к документальному merge**; руководство не делает установщик готовым |
| #200 director/admin ownership spec | mergeable, CI green | **Готов к документальному merge**; роль директора и RLS не реализованы |
| #201 administrator user guide | mergeable, CI green | **Готов к документальному merge**; при изменении UI обновлять примеры |
| #202 Lite migration checklist | mergeable, CI green до добавления этого файла | **Кандидат к merge после повторной проверки CI** |
| #171 performance audit plan | **conflict с main**, CI green на head | Разрешить конфликт README и project-map, сохранить новую спецификацию PERF и ссылки; повторный CI |
| #180 theory-video progress UI + migration 0063 | mergeable, CI green | **БЛОКИРОВАНИЕ DEPLOY:** тестовое применение миграции 0063 + RLS + фронтенд E2E и production runbook; CI не доказывает безопасный выкат |
| #185 Auth audit log restore lab | draft, mergeable, CI green | Не для production; проверить актуальность после внедрения backup/restore 5.19 и безопасность скрипта; принять/закрыть отдельно |
| #169 selfhosted SQL/Edge CI/CD | draft, mergeable, CI green | **Оставить draft** до baseline миграций, secure environment, secret rotation, теста dry run/rollback и явного разрешения включить deploy |

## supabase-lite

| PR | Состояние | Решение |
|---|---|---|
| #3 Core + Driving School Kit plan | mergeable, без CI | Готов к документальному review/merge; провести ручную проверку согласованности PLAN/PROGRESS |
| #4 Lite installation guide | mergeable, без CI | Готов к документальному review/merge; инструменты `install` описаны как будущие |
| #1 bootstrap spec | draft, **конфликт** и частично дублирует поздний PLAN | Перенести полезные уникальные `.gitignore`, `docs/CONFIG-CAPTURE.md`, `scripts/inspect-local-stack.sh` в новую ветку на актуальном main только после проверки безопасности; не force merge |

## Очерёдность
1. Ревью/слияние чисто документационных #198–202 и Lite #3/#4 (CI GitHub в driving-school, reviewer в Lite).
2. Сверить и восстановить единственную актуальную версию `docs/PLAN.md`, `docs/PROGRESS.md`; перенести полезный остаток Lite #1 и закрыть устаревший draft после review.
3. Разрешить конфликт performance spec #171 без отката более новых карт проекта.
4. Проверить на изолированном стеке 0063 из #180, согласовать миграцию production до выката UI.
5. Auth restore #185 и автоматический production deploy #169 — по отдельным высоким воротам безопасности. CI green недостаточно.
6. Supabase Lite Core/Kit, media packaging 383 PNG и clean-room install — **не созданы этими документационными PR**. До production cutover остаются release blockers.

Никакого production SQL, CI/CD активации, merge или выпуска здесь не выполняется.
