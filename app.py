from flask import Flask, after_this_request, jsonify, render_template, request, send_file
from PIL import Image, ImageEnhance
import json
import os
import sqlite3
import uuid

app = Flask(__name__)

UPLOAD_FOLDER = "uploads"
DB_PATH = "subscriptions.db"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

PLANS = {
    "free": {
        "max_layers": 1,
        "description": "Базовый план: один watermark на изображение",
    },
    "pro": {
        "max_layers": 5,
        "description": "Профессиональный план: до 5 watermark на изображение",
    },
    "business": {
        "max_layers": 20,
        "description": "Бизнес-план: до 20 watermark на изображение",
    },
}


class SubscriptionService:
    def __init__(self, db_path: str):
        self.db_path = db_path
        self._init_db()

    def _connect(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self):
        with self._connect() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS subscribers (
                    email TEXT PRIMARY KEY,
                    plan TEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
                """
            )

    def upsert_subscription(self, email: str, plan: str):
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO subscribers(email, plan)
                VALUES(?, ?)
                ON CONFLICT(email) DO UPDATE SET
                    plan=excluded.plan
                """,
                (email, plan),
            )

    def get_plan(self, email: str) -> str:
        if not email:
            return "free"
        with self._connect() as conn:
            row = conn.execute(
                "SELECT plan FROM subscribers WHERE email = ?", (email,)
            ).fetchone()
        if row is None:
            return "free"
        return row["plan"] if row["plan"] in PLANS else "free"


subscriptions = SubscriptionService(DB_PATH)


@app.route("/")
def index():
    return render_template("index.html", plans=PLANS)


@app.route("/plans", methods=["GET"])
def plans():
    return jsonify(PLANS)


@app.route("/subscribe", methods=["POST"])
def subscribe():
    data = request.get_json(silent=True) or request.form
    email = (data.get("email") or "").strip().lower()
    plan = (data.get("plan") or "free").strip().lower()

    if not email:
        return jsonify({"error": "Email обязателен"}), 400
    if plan not in PLANS:
        return jsonify({"error": f"Неизвестный план: {plan}"}), 400

    subscriptions.upsert_subscription(email, plan)
    return jsonify({"message": "Подписка сохранена", "email": email, "plan": plan})


@app.route("/process", methods=["POST"])
def process():
    base_image = request.files.get("image")
    watermark_files = request.files.getlist("watermarks")
    subscriber_email = (request.form.get("subscriber_email") or "").strip().lower()

    if base_image is None:
        return "Базовое изображение не загружено", 400
    if not watermark_files:
        return "Нужно загрузить хотя бы один watermark", 400

    try:
        config_raw = request.form.get("watermark_config", "[]")
        watermark_config = json.loads(config_raw)
        preview_w = float(request.form.get("preview_w", "0"))
        preview_h = float(request.form.get("preview_h", "0"))
    except (ValueError, TypeError, json.JSONDecodeError):
        return "Некорректные параметры watermark", 400

    plan = subscriptions.get_plan(subscriber_email)
    max_layers = PLANS[plan]["max_layers"]

    if len(watermark_config) > max_layers:
        return (
            f"Ваш план ({plan}) поддерживает максимум {max_layers} watermark на изображение",
            403,
        )

    base_path = os.path.join(UPLOAD_FOLDER, f"base_{uuid.uuid4()}.png")
    base_image.save(base_path)

    watermark_paths = []
    output_path = ""

    try:
        for wm_file in watermark_files:
            wm_path = os.path.join(UPLOAD_FOLDER, f"watermark_{uuid.uuid4()}.png")
            wm_file.save(wm_path)
            watermark_paths.append(wm_path)

        base = Image.open(base_path).convert("RGBA")
        if preview_w <= 0 or preview_h <= 0:
            return "Не удалось получить размеры области предпросмотра", 400

        scale_x = base.width / preview_w
        scale_y = base.height / preview_h

        transparent = Image.new("RGBA", base.size, (0, 0, 0, 0))

        for layer in watermark_config:
            idx = int(layer["index"])
            wm_x = int(round(float(layer["x"]) * scale_x))
            wm_y = int(round(float(layer["y"]) * scale_y))
            opacity = int(layer["opacity"])
            scale = int(layer["scale"])

            if idx < 0 or idx >= len(watermark_paths):
                continue

            watermark = Image.open(watermark_paths[idx]).convert("RGBA")

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
        output_path = os.path.join(UPLOAD_FOLDER, f"result_{uuid.uuid4()}.jpg")
        combined.convert("RGB").save(output_path, "JPEG")

        @after_this_request
        def remove_generated_files(response):
            if os.path.exists(output_path):
                os.remove(output_path)
            return response

        return send_file(output_path, as_attachment=True)

    except Exception as e:
        return f"Ошибка при обработке: {str(e)}", 500

    finally:
        if os.path.exists(base_path):
            os.remove(base_path)
        for wm_path in watermark_paths:
            if os.path.exists(wm_path):
                os.remove(wm_path)


if __name__ == "__main__":
    app.run(debug=True)
