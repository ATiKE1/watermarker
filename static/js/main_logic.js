document.addEventListener("DOMContentLoaded", function () {
    const container = document.getElementById("preview-container");
    const basePreview = document.getElementById("base-preview");
    const fileImageInput = document.getElementById("image");
    const fileWatermarksInput = document.getElementById("watermarks");
    const opacityInput = document.getElementById("opacity");
    const scaleInput = document.getElementById("scale");
    const layerList = document.getElementById("layerList");
    const configInput = document.getElementById("watermark_configs");

    let layers = [];
    let activeLayerId = null;
    let dragState = null;

    const renderLayerList = () => {
        layerList.innerHTML = "";
        layers.forEach((layer, index) => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = `btn btn-sm me-2 mb-2 ${layer.id === activeLayerId ? "btn-primary" : "btn-outline-primary"}`;
            button.textContent = `Layer ${index + 1}`;
            button.addEventListener("click", () => setActiveLayer(layer.id));
            layerList.appendChild(button);
        });
    };

    const syncFormConfig = () => {
        document.getElementById("preview_width").value = Math.max(1, basePreview.clientWidth || 1);
        document.getElementById("preview_height").value = Math.max(1, basePreview.clientHeight || 1);

        const payload = layers.map(layer => ({
            x: layer.x,
            y: layer.y,
            opacity: layer.opacity,
            scale: layer.scale
        }));

        configInput.value = JSON.stringify(payload);
    };

    const setActiveLayer = (layerId) => {
        activeLayerId = layerId;
        const layer = layers.find(item => item.id === layerId);
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

        const layer = layers.find(item => item.id === dragState.layerId);
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
            basePreview.style.display = "block";
            basePreview.onload = () => syncFormConfig();
        };
        reader.readAsDataURL(file);
    });

    fileWatermarksInput.addEventListener("change", function (event) {
        container.querySelectorAll(".watermark-preview").forEach(node => node.remove());
        layers = [];

        const files = Array.from(event.target.files || []);
        files.forEach((file, index) => {
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

                if (layers.length === 1) {
                    setActiveLayer(layer.id);
                }

                renderLayerList();
                syncFormConfig();
            };
            reader.readAsDataURL(file);
        });
    });

    scaleInput.addEventListener("input", function () {
        const layer = layers.find(item => item.id === activeLayerId);
        if (!layer) return;

        layer.scale = Number(this.value);
        refreshLayerVisual(layer);
        syncFormConfig();
    });

    opacityInput.addEventListener("input", function () {
        const layer = layers.find(item => item.id === activeLayerId);
        if (!layer) return;

        layer.opacity = Number(this.value);
        refreshLayerVisual(layer);
        syncFormConfig();
    });
});
