
const form = document.getElementById("drawForm");
const imageUrlInput = document.getElementById("imageUrl");
const widthInput = document.getElementById("width");
const heightInput = document.getElementById("height");
const drawButton = document.getElementById("drawButton");
const copyButton = document.getElementById("copyButton");
const statusEl = document.getElementById("status");
const canvas = document.getElementById("preview");
const output = document.getElementById("output");

let lastPixels = null;

if (!form) {
  document.body.insertAdjacentHTML(
    "beforeend",
    "<p>ERRO: formulário drawForm não encontrado.</p>"
  );
} else {
  statusEl.textContent = "JavaScript conectado! API pronta.";

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const imageUrl = imageUrlInput.value.trim();
    const width = Number(widthInput.value);
    const height = Number(heightInput.value);

    if (!imageUrl || !Number.isInteger(width) ||
        !Number.isInteger(height) ||
        width < 1 || height < 1 || width > 512 || height > 512) {
      statusEl.textContent = "Informe uma URL e dimensões entre 1 e 512.";
      return;
    }

    drawButton.disabled = true;
    drawButton.textContent = "Processando...";
    statusEl.textContent = "Convertendo imagem...";
    output.textContent = "";
    copyButton.disabled = true;

    try {
      const response = await fetch("/api/draw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl, width, height })
      });

      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.error || "Erro na API.");
      }

      lastPixels = result.pixels;
      canvas.width = result.width;
      canvas.height = result.height;

      const ctx = canvas.getContext("2d");
      const imageData = ctx.createImageData(result.width, result.height);

      for (let y = 0; y < result.height; y++) {
        for (let x = 0; x < result.width; x++) {
          const rgb = result.pixels[y][x];
          const i = (y * result.width + x) * 4;

          imageData.data[i] = rgb[0];
          imageData.data[i + 1] = rgb[1];
          imageData.data[i + 2] = rgb[2];
          imageData.data[i + 3] = 255;
        }
      }

      ctx.putImageData(imageData, 0, 0);
      output.textContent = JSON.stringify(lastPixels);
      copyButton.disabled = false;
      statusEl.textContent = "Conversão concluída!";
    } catch (error) {
      statusEl.textContent = "Erro: " + error.message;
    } finally {
      drawButton.disabled = false;
      drawButton.textContent = "Draw";
    }
  });

  copyButton.addEventListener("click", async () => {
    if (!lastPixels) return;

    try {
      await navigator.clipboard.writeText(JSON.stringify(lastPixels));
      statusEl.textContent = "Matriz RGB copiada!";
    } catch {
      statusEl.textContent = "Não foi possível copiar a matriz.";
    }
  });
}
