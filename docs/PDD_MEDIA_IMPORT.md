# Медиа для нового курса ПДД

В `tools/pdd-source-images-manifest.json` перечислены 383 PNG, использованные в 30 разделах нового курса. Исходный коммит закреплён в manifest.

`tools/import_pdd_images.py` скачивает файлы из **зафиксированного коммита** репозитория `motostrelok1/edu.dvizh-teory` в `public/course-import/img`. Повторный запуск пропускает уже существующие валидные PNG, `--verify-only` проверяет все 383 файла. Скрипт ничего не пишет в Supabase и не меняет текущие страницы.

## Рекомендуемый запуск через GitHub Actions

После слияния PR открой **Actions → Prepare PDD course media → Run workflow**. Workflow на GitHub Runner скачает и проверит PNG и создаст артефакт `pdd-course-images.tar.gz` со всеми изображениями. Файлы пока **не попадают** в рабочую папку сайта или Git — архив используется для следующего PR импорта и тестирования рендера.

Локально (там, где есть Python 3 и доступ к github.com): `python3 tools/import_pdd_images.py && python3 tools/import_pdd_images.py --verify-only`.

**Не переключайте** `/student/theory/course` до того, как все картинки станут доступны на новом сайте и будут проверены ссылки на знаки/разметку. Никаких команд очистки Supabase здесь нет.
