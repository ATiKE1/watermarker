document.addEventListener("DOMContentLoaded", function () {
    const container = document.getElementById("preview-container");
    const stage = document.getElementById("watermark-stage");
    const basePreview = document.getElementById("base-preview");

    const fileImageInput = document.getElementById("image");
    const watermarkInput = document.getElementById("watermarks");
    const layerControls = document.getElementById("layer-controls");

    const subscriptionForm = document.getElementById("subscriptionForm");
    const subscriberEmail = document.getElementById("subscriber_email");
    const subscriberEmailHidden = document.getElementById("subscriber_email_hidden");
    const subscriptionStatus = document.getElementById("subscriptionStatus");

    const watermarkConfigInput = document.getElementById("watermark_config");
    const previewWInput = document.getElementById("preview_w");
    const previewHInput = document.getElementById("preview_h");

    let layers = [];
    let draggingLayerId = null;
    let offsetX = 0;
    let offsetY = 0;

    function syncHiddenState() {
        watermarkConfigInput.value = JSON.stringify(
            layers.map((layer, index) => ({
                index,
                x: layer.x,
                y: layer.y,
                opacity: layer.opacity,
                scale: layer.scale,
            }))
        );

        previewWInput.value = container.clientWidth;
        previewHInput.value = container.clientHeight;
        subscriberEmailHidden.value = subscriberEmail.value.trim().toLowerCase();
    }

    function createLayerControl(layer, index) {
        const wrapper = document.createElement("div");
        wrapper.className = "card p-2";
        wrapper.innerHTML = `
            <div class="d-flex justify-content-between align-items-center">
                <strong>Watermark #${index + 1}</strong>
            </div>
            <label class="form-label mt-2 mb-1">Размер (%)</label>
            <input type="range" class="form-range scale-input" min="10" max="200" value="${layer.scale}">
            <label class="form-label mb-1">Прозрачность</label>
            <input type="range" class="form-range opacity-input" min="0" max="255" value="${layer.opacity}">
            <small class="text-muted">Перетаскивайте watermark мышкой в области предпросмотра</small>
        `;

        const scaleInput = wrapper.querySelector(".scale-input");
        const opacityInput = wrapper.querySelector(".opacity-input");

        scaleInput.addEventListener("input", function () {
            layer.scale = Number(this.value);
            layer.el.style.width = `${layer.scale}%`;
            syncHiddenState();
        });

        opacityInput.addEventListener("input", function () {
            layer.opacity = Number(this.value);
            layer.el.style.opacity = String(layer.opacity / 255);
            syncHiddenState();
        });

        layerControls.appendChild(wrapper);
    }

    function renderLayers() {
        stage.innerHTML = "";
        layerControls.innerHTML = "";

        layers.forEach((layer, index) => {
            layer.el = document.createElement("img");
            layer.el.src = layer.src;
            layer.el.className = "watermark-preview";
            layer.el.style.left = `${layer.x}px`;
            layer.el.style.top = `${layer.y}px`;
            layer.el.style.width = `${layer.scale}%`;
            layer.el.style.opacity = String(layer.opacity / 255);

            layer.el.addEventListener("mousedown", function (e) {
                draggingLayerId = layer.id;
                offsetX = e.offsetX;
                offsetY = e.offsetY;
            });

            stage.appendChild(layer.el);
            createLayerControl(layer, index);
        });

        syncHiddenState();
    }

    document.addEventListener("mouseup", function () {
        draggingLayerId = null;
    });

    document.addEventListener("mousemove", function (e) {
        if (draggingLayerId === null) {
            return;
        }

        const layer = layers.find((item) => item.id === draggingLayerId);
        if (!layer || !layer.el) {
            return;
        }

        const rect = container.getBoundingClientRect();
        const maxX = Math.max(0, container.clientWidth - layer.el.offsetWidth);
        const maxY = Math.max(0, container.clientHeight - layer.el.offsetHeight);

        const x = Math.max(0, Math.min(e.clientX - rect.left - offsetX, maxX));
        const y = Math.max(0, Math.min(e.clientY - rect.top - offsetY, maxY));

        layer.x = x;
        layer.y = y;
        layer.el.style.left = `${x}px`;
        layer.el.style.top = `${y}px`;

        syncHiddenState();
    });

    fileImageInput.addEventListener("change", function (e) {
        const file = e.target.files[0];
        if (!file) {
            return;
        }

        const reader = new FileReader();
        reader.onload = function (event) {
            basePreview.src = event.target.result;
            basePreview.style.display = "block";
            syncHiddenState();
        };
        reader.readAsDataURL(file);
    });

    watermarkInput.addEventListener("change", function (e) {
        const files = Array.from(e.target.files || []);
        layers = files.map((file, index) => ({
            id: index,
            src: URL.createObjectURL(file),
            x: 20 + index * 15,
            y: 20 + index * 15,
            opacity: 128,
            scale: 50,
            el: null,
        }));

        renderLayers();
    });

    subscriptionForm.addEventListener("submit", async function (e) {
        e.preventDefault();
        const email = subscriberEmail.value.trim().toLowerCase();
        const plan = document.getElementById("plan").value;

        const response = await fetch("/subscribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, plan }),
        });

        const data = await response.json();
        if (!response.ok) {
            subscriptionStatus.textContent = data.error || "Не удалось сохранить подписку";
            subscriptionStatus.className = "text-danger d-block mt-2";
            return;
        }

        subscriptionStatus.textContent = `Подписка обновлена: ${data.email} → ${String(data.plan).toUpperCase()}`;
        subscriptionStatus.className = "text-success d-block mt-2";
        syncHiddenState();
    });

    document.getElementById("watermarkForm").addEventListener("submit", function () {
        syncHiddenState();
    });
});
