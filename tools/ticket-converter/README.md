# Ticket converter

Одноразовый конвертер для подключения PDF-билетов к MVP.

## Что делает

- читает файлы вида `1_1-5.pdf.pdf`;
- понимает номер билета и диапазон вопросов из имени файла;
- рендерит PDF-страницу в PNG;
- создает `tickets.json` в формате, который читает экран `/student/theory/training/tickets`;
- подтягивает текст комментариев из файлов вида `1-komment-abm-2023.pdf.pdf`.

Прямое извлечение кириллицы из текущих PDF может давать битый текст, поэтому результат нужно проверить и при необходимости почистить в JSON. Интерфейс MVP уже работает с финальным чистым JSON и не зависит от PDF.

## Команда

```powershell
& "$env:USERPROFILE\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe" `
  tools\ticket-converter\convert_tickets.py `
  --input "C:\111\driving-school-pwa\билеты" `
  --output "public\tickets"
```

## Формат вопроса

```json
{
  "number": 1,
  "text": "Текст вопроса",
  "image": "/tickets/images/1_1-5-pdf.png",
  "answers": [
    { "number": 1, "text": "Вариант 1" },
    { "number": 2, "text": "Вариант 2" },
    { "number": 3, "text": "Вариант 3" }
  ],
  "correctAnswer": 2,
  "hint": "Подсказка или комментарий"
}
```
