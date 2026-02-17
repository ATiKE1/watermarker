from __future__ import annotations

import json
import os
import sqlite3
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

from flask import Flask, render_template, request, send_file
from PIL import Image, ImageEnhance

BASE_DIR = Path(__file__).resolve().parent
UPLOAD_FOLDER = BASE_DIR / "uploads"
DB_PATH = BASE_DIR / "subscriptions.db"

UPLOAD_FOLDER.mkdir(exist_ok=True)

app = Flask(__name__)
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "dev-secret")

FREE_WATERMARK_LIMIT = 1
SUBSCRIBER_WATERMARK_LIMIT = 10


def init_db() -> None:
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS subscribers (
                email TEXT PRIMARY KEY,
                plan TEXT NOT NULL,
                created_at TEXT NOT NULL,
                expires_at TEXT NOT NULL
            )
            """
        )


def normalize_email(value: str | None) -> str | None:
    if not value:
        return None
    email = value.strip().lower()
    return email if "@" in email else None


def has_active_subscription(email: str | None) -> bool:
    if not email:
        return False

    with sqlite3.connect(DB_PATH) as conn:
        row = conn.execute(
            "SELECT expires_at FROM subscribers WHERE email = ?",
            (email,),
        ).fetchone()

    if not row:
        return False

    expires_at = datetime.fromisoformat(row[0])
    return expires_at > datetime.now(timezone.utc)


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/subscribe", methods=["GET", "POST"])
def subscribe():
    if request.method == "GET":
        return render_template("subscribe.html")

    email = normalize_email(request.form.get("email"))
    plan = request.form.get("plan", "monthly")

    if not email:
        return render_template("subscribe.html", error="Введите корректный email."), 400

    duration_days = 30 if plan == "monthly" else 365
    expires_at = datetime.now(timezone.utc) + timedelta(days=duration_days)

    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            """
            INSERT INTO subscribers(email, plan, created_at, expires_at)
            VALUES(?, ?, ?, ?)
            ON CONFLICT(email)
            DO UPDATE SET
                plan = excluded.plan,
                created_at = excluded.created_at,
                expires_at = excluded.expires_at
            """,
            (
                email,
                plan,
                datetime.now(timezone.utc).isoformat(),
                expires_at.isoformat(),
            ),
        )

    return render_template(
        "subscribe.html",
        success=f"Подписка активирована для {email} до {expires_at.date()}.",
    )


@app.route("/process", methods=["POST"])
def process():
    base_image = request.files.get("image")
    watermark_images = request.files.getlist("watermarks")

    if not base_image or not watermark_images:
        return "Image and watermarks are required", 400

    email = normalize_email(request.form.get("subscription_email"))
    is_subscriber = has_active_subscription(email)
    limit = SUBSCRIBER_WATERMARK_LIMIT if is_subscriber else FREE_WATERMARK_LIMIT

    if len(watermark_images) > limit:
        return (
            f"Лимит для вашего тарифа: {limit} watermark(ов). "
            f"Оформите подписку для увеличения лимита.",
            403,
        )

    try:
        raw_configs = request.form.get("watermark_configs", "[]")
        watermark_configs = json.loads(raw_configs)
        if len(watermark_configs) != len(watermark_images):
            return "Invalid watermark configuration length", 400

        preview_width = max(int(float(request.form.get("preview_width", "1"))), 1)
        preview_height = max(int(float(request.form.get("preview_height", "1"))), 1)
    except (ValueError, json.JSONDecodeError):
        return "Invalid input values", 400

    base_path = UPLOAD_FOLDER / f"base_{uuid.uuid4()}.png"
    watermark_paths: list[Path] = []

    base_image.save(base_path)

    try:
        base = Image.open(base_path).convert("RGBA")
        scale_x = base.width / preview_width
        scale_y = base.height / preview_height

        transparent = Image.new("RGBA", base.size, (0, 0, 0, 0))

        for index, watermark_image in enumerate(watermark_images):
            watermark_path = UPLOAD_FOLDER / f"watermark_{uuid.uuid4()}.png"
            watermark_paths.append(watermark_path)
            watermark_image.save(watermark_path)

            config = watermark_configs[index]
            wm_x = int(float(config.get("x", 20)) * scale_x)
            wm_y = int(float(config.get("y", 20)) * scale_y)
            opacity = max(0, min(255, int(float(config.get("opacity", 128)))))
            scale = max(5, min(300, int(float(config.get("scale", 50)))))

            watermark = Image.open(watermark_path).convert("RGBA")
            w_size = (
                max(1, int(watermark.width * scale / 100)),
                max(1, int(watermark.height * scale / 100)),
            )
            watermark = watermark.resize(w_size, Image.Resampling.LANCZOS)

            alpha = watermark.split()[3]
            alpha = ImageEnhance.Brightness(alpha).enhance(opacity / 255.0)
            watermark = watermark.copy()
            watermark.putalpha(alpha)

            transparent.paste(watermark, (wm_x, wm_y), watermark)

        combined = Image.alpha_composite(base, transparent)

        output_path = UPLOAD_FOLDER / f"result_{uuid.uuid4()}.jpg"
        combined.convert("RGB").save(output_path, "JPEG")

        return send_file(output_path, as_attachment=True, download_name="watermarked.jpg")

    except Exception as error:
        return f"Ошибка при обработке: {str(error)}", 500

    finally:
        if base_path.exists():
            base_path.unlink()
        for path in watermark_paths:
            if path.exists():
                path.unlink()


init_db()

if __name__ == "__main__":
    app.run(debug=True)
