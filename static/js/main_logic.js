
document.addEventListener("DOMContentLoaded", function () {
    const watermarkPreview = document.getElementById("watermark-preview");
    const container = document.getElementById("preview-container");
    const basePreview = document.getElementById("base-preview");
    const fileImageInput = document.getElementById("image");
    const fileWatermarkInput = document.getElementById("watermark");

    let offsetX = 0, offsetY = 0;
    let isDragging = false;

    watermarkPreview.addEventListener("mousedown", function (e) {
        isDragging = true;
        offsetX = e.offsetX;
        offsetY = e.offsetY;
    });

    document.addEventListener("mouseup", function () {
        isDragging = false;
    });

    document.addEventListener("mousemove", function (e) {
        if (!isDragging) return;

        const rect = container.getBoundingClientRect();
        let x = e.clientX - rect.left - offsetX;
        let y = e.clientY - rect.top - offsetY;

        x = Math.max(0, Math.min(x, container.clientWidth - watermarkPreview.offsetWidth));
        y = Math.max(0, Math.min(y, container.clientHeight - watermarkPreview.offsetHeight));

        watermarkPreview.style.left = `${x}px`;
        watermarkPreview.style.top = `${y}px`;

        document.getElementById("wm_x").value = x;
        document.getElementById("wm_y").value = y;
    });

    fileImageInput.addEventListener("change", function (e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function (event) {
                basePreview.src = event.target.result;
                basePreview.style.display = "block";
            };
            reader.readAsDataURL(file);
        }
    });

    fileWatermarkInput.addEventListener("change", function (e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function (event) {
                watermarkPreview.src = event.target.result;
                watermarkPreview.style.display = "block";

                watermarkPreview.style.left = "20px";
                watermarkPreview.style.top = "20px";
                document.getElementById("wm_x").value = 20;
                document.getElementById("wm_y").value = 20;
            };
            reader.readAsDataURL(file);
        }
    });

    document.getElementById("scale").addEventListener("input", function () {
        const scaleValue = this.value;
        watermarkPreview.style.width = scaleValue + "%";
        watermarkPreview.style.height = "auto";
    });

    document.getElementById("opacity").addEventListener("input", function () {
        const opacityValue = this.value / 255;
        watermarkPreview.style.opacity = opacityValue;
    });
});