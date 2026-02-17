# Watermarker

Веб‑приложение на Flask для наложения нескольких watermark на изображение с ограничениями по подписке.

## Что нового

- Поддержка **нескольких watermark** за один рендер.
- Поддержка **индивидуального позиционирования, прозрачности и масштаба** для каждого слоя.
- **Подписочная система** (SQLite):
  - Бесплатно: до 1 watermark.
  - Активная подписка: до 10 watermark.
- Обновлённый UI с панелью слоёв.

## Основные возможности

## Стек

- Python 3.10+
- Flask
- Pillow
- SQLite (встроено)
- HTML/CSS/JS + Bootstrap 5

- Python 3.10+
- Flask
- Pillow
- SQLite
- Tailwind CSS + Vanilla JS

## Запуск

```bash
pip install flask pillow
python app.py
```

Открыть: `http://localhost:5000`.

## Маршруты

- `GET /` — главная страница.
- `POST /subscription-status` — возвращает статус подписки и лимит watermark для email.
- `POST /subscribe` — активирует подписку (monthly/yearly), возвращает JSON.
- `POST /process` — обрабатывает изображение и возвращает JPG-файл.

## Примечания

- Подписка демонстрационная (без платежного шлюза).
- База подписок хранится в `subscriptions.db`.
