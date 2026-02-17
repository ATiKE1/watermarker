# Watermarker

Flask-приложение для наложения нескольких watermark на изображение с ограничениями по подписке.

## Основные возможности

- Наложение нескольких PNG watermark за один рендер.
- Drag & drop позиционирование каждого слоя.
- Индивидуальные настройки opacity/scale для активного слоя.
- Подписки на SQLite:
  - Free: до 1 watermark.
  - Active subscription: до 10 watermark.
- Проверка лимита **до отправки формы**: ограничение количества выбираемых watermark файлов на клиенте.
- Ошибки и подписка — через модальные окна на главной странице (без отдельного UI-роута подписки).
- UI переведён на Tailwind CSS, тёмная красная тема.

## Стек

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
