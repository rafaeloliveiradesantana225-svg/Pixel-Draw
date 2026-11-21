
const imageUrlInput = document.getElementById("imageUrl");
const widthInput = document.getElementById("width");
const heightInput = document.getElementById("height");
const drawButton = document.getElementById("drawButton");
const copyButton = document.getElementById("copyButton");
const statusEl = document.getElementById("status");
const canvas = document.getElementById("preview");
const ctx = canvas.getContext("2d");
const output = document.getElementById("output");
const form = document.getElementById("drawform");

let lastPixels = null;

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const imageUrl = imageUrlInput.value.trim();
  const width = Number(widthInput.value);
  const height = Number(heightInput.value);

  if (!imageUrl ||
      !Number.isInteger(width) ||
      !Number.isInteger(height) ||
      width < 1 || height < 1 ||
      width > 512 || height > 512 ||
      width * height > 512 * 512) {
    statusEl.textContent =
      "Informe uma URL e dimensões válidas (1 a 512).";
    return;
  }

  drawButton.disabled = true;
  copyButton.disabled = true;
  drawButton.textContent = "Processando...";
  statusEl.textContent = "Processando imagem em alta qualidade...";
  output.textContent = "";

  try {
    const response = await fetch("/api/draw", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageUrl, width, height })
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(result.error || `Erro HTTP ${response.status}`);
    }

    if (!result.ok || !Array.isArray(result.pixels)) {
      throw new Error("Resultado inválido da API.");
    }

    lastPixels = result.pixels;

    canvas.width = result.width;
    canvas.height = result.height;

    const imageData = ctx.createImageData(
      result.width,
      result.height
    );

    for (let y = 0; y < result.height; y++) {
      for (let x = 0; x < result.width; x++) {
        const rgb = result.pixels[y][x];
        const index = (y * result.width + x) * 4;

        imageData.data[index] = rgb[0];
        imageData.data[index + 1] = rgb[1];
        imageData.data[index + 2] = rgb[2];
        imageData.data[index + 3] = 255;
      }
    }

    ctx.putImageData(imageData, 0, 0);

    output.textContent = JSON.stringify(result.pixels);
    copyButton.disabled = false;

    statusEl.textContent =
      `Concluído! ${result.width} × ${result.height} pixels RGB em alta qualidade.`;

  } catch (error) {
    lastPixels = null;
    statusEl.textContent = `Erro: ${error.message}`;

  } finally {
    drawButton.disabled = false;
    drawButton.textContent = "Draw";
  }
});

copyButton.addEventListener("click", async () => {
  if (!lastPixels) return;

  try {
    await navigator.clipboard.writeText(
      JSON.stringify(lastPixels)
    );

    statusEl.textContent = "Matriz RGB copiada!";
  } catch {
    statusEl.textContent =
      "Não foi possível copiar. Selecione o resultado manualmente.";
  }
});

fetch("/api/health")
  .then(response => response.json())
  .then(data => {
    if (data.ok) {
      statusEl.textContent = "API online e pronta para uso.";
    }
  })
  .catch(() => {
    statusEl.textContent = "Não foi possível verificar a API.";
  });
