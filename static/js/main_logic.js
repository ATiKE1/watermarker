document.addEventListener("DOMContentLoaded", function () {
    const form = document.getElementById("watermarkForm");
    const container = document.getElementById("preview-container");
    const basePreview = document.getElementById("base-preview");
    const fileImageInput = document.getElementById("image");
    const fileWatermarksInput = document.getElementById("watermarks");
    const opacityInput = document.getElementById("opacity");
    const scaleInput = document.getElementById("scale");
    const layerList = document.getElementById("layerList");
    const configInput = document.getElementById("watermark_configs");
    const emailInput = document.getElementById("subscription_email");
    const checkSubscriptionButton = document.getElementById("checkSubscription");
    const limitHint = document.getElementById("limitHint");
    const openSubscribeModalButton = document.getElementById("openSubscribeModal");

    const appModal = document.getElementById("appModal");
    const modalTitle = document.getElementById("modalTitle");
    const modalBody = document.getElementById("modalBody");
    const closeModalButton = document.getElementById("closeModal");

    let maxFiles = Number(limitHint.textContent.match(/\d+/)?.[0] || 1);
    let layers = [];
    let activeLayerId = null;
    let dragState = null;

    const showModal = (title, bodyHtml) => {
        modalTitle.textContent = title;
        modalBody.innerHTML = bodyHtml;
        appModal.classList.remove("hidden");
    };

    const closeModal = () => appModal.classList.add("hidden");
    closeModalButton.addEventListener("click", closeModal);
    appModal.addEventListener("click", (event) => {
        if (event.target === appModal) closeModal();
    });

    const setLimit = (limit, active) => {
        maxFiles = Number(limit);
        limitHint.textContent = `Текущий лимит watermark: ${maxFiles}${active ? " (подписка активна)" : " (free)"}`;
    };

    const fetchSubscriptionStatus = async () => {
        const email = emailInput.value.trim();
        const response = await fetch("/subscription-status", {
            method: "POST",
            body: new URLSearchParams({ email })
        });
        const data = await response.json();
        setLimit(data.limit, data.active);
    };

    const renderLayerList = () => {
        layerList.innerHTML = "";
        layers.forEach((layer, index) => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = `inline-flex px-3 py-1 mr-2 mb-2 rounded-full text-sm border ${layer.id === activeLayerId ? "bg-red-600 text-white border-red-600" : "bg-white text-red-700 border-red-300"}`;
            button.textContent = `Layer ${index + 1}`;
            button.addEventListener("click", () => setActiveLayer(layer.id));
            layerList.appendChild(button);
        });
    };

    const syncFormConfig = () => {
        document.getElementById("preview_width").value = Math.max(1, basePreview.clientWidth || 1);
        document.getElementById("preview_height").value = Math.max(1, basePreview.clientHeight || 1);

        const payload = layers.map((layer) => ({
            x: layer.x,
            y: layer.y,
            opacity: layer.opacity,
            scale: layer.scale
        }));

        configInput.value = JSON.stringify(payload);
    };

    const setActiveLayer = (layerId) => {
        activeLayerId = layerId;
        const layer = layers.find((item) => item.id === layerId);
        if (!layer) return;

        opacityInput.value = layer.opacity;
        scaleInput.value = layer.scale;
        renderLayerList();
    };

    const createLayerElement = (layer) => {
        const img = document.createElement("img");
        img.src = layer.src;
        img.className = "watermark-preview";
        img.style.left = `${layer.x}px`;
        img.style.top = `${layer.y}px`;
        img.style.width = `${layer.scale}%`;
        img.style.opacity = layer.opacity / 255;

        img.addEventListener("mousedown", function (event) {
            activeLayerId = layer.id;
            setActiveLayer(layer.id);

            const rect = img.getBoundingClientRect();
            dragState = {
                layerId: layer.id,
                offsetX: event.clientX - rect.left,
                offsetY: event.clientY - rect.top
            };
        });

        layer.element = img;
        container.appendChild(img);
    };

    const refreshLayerVisual = (layer) => {
        if (!layer.element) return;
        layer.element.style.left = `${layer.x}px`;
        layer.element.style.top = `${layer.y}px`;
        layer.element.style.width = `${layer.scale}%`;
        layer.element.style.opacity = layer.opacity / 255;
    };

    document.addEventListener("mouseup", function () {
        dragState = null;
    });

    document.addEventListener("mousemove", function (event) {
        if (!dragState) return;

        const layer = layers.find((item) => item.id === dragState.layerId);
        if (!layer || !layer.element) return;

        const rect = container.getBoundingClientRect();
        let x = event.clientX - rect.left - dragState.offsetX;
        let y = event.clientY - rect.top - dragState.offsetY;

        x = Math.max(0, Math.min(x, container.clientWidth - layer.element.offsetWidth));
        y = Math.max(0, Math.min(y, container.clientHeight - layer.element.offsetHeight));

        layer.x = x;
        layer.y = y;
        refreshLayerVisual(layer);
        syncFormConfig();
    });

    fileImageInput.addEventListener("change", function (event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function (loadEvent) {
            basePreview.src = loadEvent.target.result;
            basePreview.classList.remove("hidden");
            basePreview.onload = () => syncFormConfig();
        };
        reader.readAsDataURL(file);
    });

    fileWatermarksInput.addEventListener("change", function (event) {
        const selected = Array.from(event.target.files || []);
        if (selected.length > maxFiles) {
            this.value = "";
            showModal("Превышен лимит", `Вы выбрали <b>${selected.length}</b> файлов, но по текущему тарифу доступно максимум <b>${maxFiles}</b>.`);
            return;
        }

        container.querySelectorAll(".watermark-preview").forEach((node) => node.remove());
        layers = [];

        selected.forEach((file, index) => {
            const reader = new FileReader();
            reader.onload = function (loadEvent) {
                const layer = {
                    id: `${Date.now()}-${index}`,
                    src: loadEvent.target.result,
                    x: 20 + index * 15,
                    y: 20 + index * 15,
                    scale: 50,
                    opacity: 128,
                    element: null
                };

                layers.push(layer);
                createLayerElement(layer);

                if (layers.length === 1) setActiveLayer(layer.id);
                renderLayerList();
                syncFormConfig();
            };
            reader.readAsDataURL(file);
        });
    });

    scaleInput.addEventListener("input", function () {
        const layer = layers.find((item) => item.id === activeLayerId);
        if (!layer) return;

        layer.scale = Number(this.value);
        refreshLayerVisual(layer);
        syncFormConfig();
    });

    opacityInput.addEventListener("input", function () {
        const layer = layers.find((item) => item.id === activeLayerId);
        if (!layer) return;

        layer.opacity = Number(this.value);
        refreshLayerVisual(layer);
        syncFormConfig();
    });

    checkSubscriptionButton.addEventListener("click", async function () {
        try {
            await fetchSubscriptionStatus();
            showModal("Проверка подписки", `Лимит watermark обновлён: <b>${maxFiles}</b>.`);
        } catch (error) {
            showModal("Ошибка", "Не удалось проверить подписку. Попробуйте позже.");
        }
    });

    openSubscribeModalButton.addEventListener("click", function () {
        const template = document.getElementById("subscribeModalTemplate").innerHTML;
        showModal("Оформление подписки", template);

        const subscribeForm = document.getElementById("subscribeForm");
        const subEmail = document.getElementById("sub_email");
        subEmail.value = emailInput.value.trim();

        subscribeForm.addEventListener("submit", async function (event) {
            event.preventDefault();
            const formData = new FormData(subscribeForm);
            try {
                const response = await fetch("/subscribe", { method: "POST", body: formData });
                const data = await response.json();
                if (!response.ok) {
                    showModal("Ошибка подписки", data.error || "Не удалось активировать подписку.");
                    return;
                }

                emailInput.value = formData.get("email");
                setLimit(data.limit, true);
                showModal("Подписка активна", data.message);
            } catch (error) {
                showModal("Ошибка", "Сервис подписки временно недоступен.");
            }
        });
    });

    form.addEventListener("submit", async function (event) {
        event.preventDefault();
        if (layers.length === 0) {
            showModal("Ошибка", "Добавьте хотя бы один watermark файл.");
            return;
        }

        const selected = fileWatermarksInput.files?.length || 0;
        if (selected > maxFiles) {
            showModal("Ошибка", `Максимально допустимое количество watermark: ${maxFiles}.`);
            return;
        }

        const formData = new FormData(form);

        try {
            const response = await fetch(form.action, { method: "POST", body: formData });
            const contentType = response.headers.get("content-type") || "";

            if (!response.ok) {
                const data = contentType.includes("application/json") ? await response.json() : { error: await response.text() };
                showModal("Ошибка обработки", data.error || "Ошибка при обработке изображения.");
                return;
            }

            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "watermarked.jpg";
            a.click();
            URL.revokeObjectURL(url);
        } catch (error) {
            showModal("Ошибка", "Сервер недоступен. Попробуйте снова.");
        }
    });
});
