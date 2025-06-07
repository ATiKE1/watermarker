from flask import Flask, render_template, request, send_file
from PIL import Image, ImageEnhance
import os
import uuid

app = Flask(__name__)

UPLOAD_FOLDER = 'uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/process', methods=['POST'])
def process():
    base_image = request.files['image']
    watermark_image = request.files['watermark']

    try:
        wm_x = int(round(float(request.form['wm_x'])))
        wm_y = int(round(float(request.form['wm_y'])))
        opacity = int(request.form['opacity'])
        scale = int(request.form['scale'])
    except ValueError:
        return "Invalid input values", 400

    base_path = os.path.join(UPLOAD_FOLDER, f"base_{uuid.uuid4()}.png")
    watermark_path = os.path.join(UPLOAD_FOLDER, f"watermark_{uuid.uuid4()}.png")

    base_image.save(base_path)
    watermark_image.save(watermark_path)

    try:
        base = Image.open(base_path).convert("RGBA")
        watermark = Image.open(watermark_path).convert("RGBA")

        w_size = int(watermark.width * scale / 100), int(watermark.height * scale / 100)
        watermark = watermark.resize(w_size, Image.Resampling.LANCZOS)

        alpha = watermark.split()[3]
        alpha = ImageEnhance.Brightness(alpha).enhance(opacity / 255.0)
        watermark = watermark.copy()
        watermark.putalpha(alpha)

        transparent = Image.new("RGBA", base.size, (0, 0, 0, 0))
        transparent.paste(watermark, (wm_x, wm_y), watermark)
        combined = Image.alpha_composite(base, transparent)

        output_path = os.path.join(UPLOAD_FOLDER, f"result_{uuid.uuid4()}.jpg")
        combined.convert("RGB").save(output_path, "JPEG")

        return send_file(output_path, as_attachment=True)

    except Exception as e:
        return f"Ошибка при обработке: {str(e)}", 500

    finally:
        if os.path.exists(base_path): os.remove(base_path)
        if os.path.exists(watermark_path): os.remove(watermark_path)

if __name__ == '__main__':
    app.run(debug=True)