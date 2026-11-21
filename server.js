const express = require("express");
const sharp = require("sharp");
const dns = require("node:dns/promises");
const net = require("node:net");
const ipaddr = require("ipaddr.js");
const path = require("node:path");

const app = express();
const PORT = Number(process.env.PORT) || 10000;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_SIDE = 160;
const MAX_PIXELS = 160 * 160;

app.disable("x-powered-by");
app.use(express.json({ limit: "16kb" }));
app.use(express.static(path.join(__dirname, "public")));

function isPublicIp(address) {
  try {
    const parsed = ipaddr.parse(address);
    return parsed.range() === "unicast";
  } catch {
    return false;
  }
}

async function validatePublicHost(hostname) {
  if (hostname === "localhost" || hostname.endsWith(".localhost") ||
      hostname.endsWith(".local")) {
    throw new Error("Endereço de imagem não permitido.");
  }

  if (net.isIP(hostname)) {
    if (!isPublicIp(hostname)) throw new Error("Endereço de imagem não permitido.");
    return;
  }

  const records = await dns.lookup(hostname, { all: true, verbatim: true });
  if (!records.length || records.some(record => !isPublicIp(record.address))) {
    throw new Error("O domínio da imagem não aponta apenas para endereços públicos.");
  }
}

async function fetchImageBuffer(inputUrl) {
  let currentUrl;
  try {
    currentUrl = new URL(inputUrl);
  } catch {
    throw new Error("URL da imagem inválida.");
  }

  for (let redirectCount = 0; redirectCount <= 4; redirectCount++) {
    if (!["http:", "https:"].includes(currentUrl.protocol)) {
      throw new Error("Use uma URL HTTP ou HTTPS.");
    }
    if (currentUrl.username || currentUrl.password) {
      throw new Error("URLs com usuário ou senha não são permitidas.");
    }

    await validatePublicHost(currentUrl.hostname);

    const response = await fetch(currentUrl, {
      method: "GET",
      redirect: "manual",
      headers: { "User-Agent": "PixelDraw/1.0", "Accept": "image/*" },
      signal: AbortSignal.timeout(15000)
    });

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location || redirectCount === 4) {
        throw new Error("Redirecionamento da imagem inválido ou excessivo.");
      }
      currentUrl = new URL(location, currentUrl);
      continue;
    }

    if (!response.ok) {
      throw new Error(`O servidor da imagem respondeu HTTP ${response.status}.`);
    }

    const contentType = (response.headers.get("content-type") || "").toLowerCase();
    if (!contentType.startsWith("image/")) {
      throw new Error("O endereço informado não retornou um arquivo de imagem.");
    }

    const declaredLength = Number(response.headers.get("content-length") || 0);
    if (declaredLength > MAX_IMAGE_BYTES) {
      throw new Error("A imagem é muito grande. O limite é 10 MB.");
    }

    const chunks = [];
    let total = 0;
    for await (const chunk of response.body) {
      total += chunk.length;
      if (total > MAX_IMAGE_BYTES) {
        response.body.cancel().catch(() => {});
        throw new Error("A imagem é muito grande. O limite é 10 MB.");
      }
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }

  throw new Error("Não foi possível baixar a imagem.");
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "pixel-draw-api", status: "online" });
});

app.post("/api/draw", async (req, res) => {
  try {
    const { imageUrl } = req.body || {};
    const width = Number(req.body?.width ?? 120);
    const height = Number(req.body?.height ?? 120);

    if (typeof imageUrl !== "string" || imageUrl.length > 2048) {
      return res.status(400).json({ error: "Informe uma URL de imagem válida." });
    }
    if (!Number.isInteger(width) || !Number.isInteger(height) ||
        width < 1 || height < 1 || width > MAX_SIDE || height > MAX_SIDE ||
        width * height > MAX_PIXELS) {
      return res.status(400).json({
        error: `Largura e altura devem ser números inteiros entre 1 e ${MAX_SIDE}.`
      });
    }

    const input = await fetchImageBuffer(imageUrl);
    const { data, info } = await sharp(input, {
      failOn: "error",
      limitInputPixels: 40_000_000
    })
      .rotate()
      .resize(width, height, { fit: "fill", kernel: "nearest" })
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const pixels = [];
    for (let y = 0; y < info.height; y++) {
      const row = [];
      for (let x = 0; x < info.width; x++) {
        const offset = (y * info.width + x) * info.channels;
        row.push([data[offset], data[offset + 1], data[offset + 2]]);
      }
      pixels.push(row);
    }

    res.json({
      ok: true,
      width: info.width,
      height: info.height,
      channels: 3,
      format: "RGB",
      pixels
    });
  } catch (error) {
    console.error("Draw API error:", error.message);
    res.status(400).json({ error: error.message || "Não foi possível processar a imagem." });
  }
});

app.use((err, _req, res, _next) => {
  console.error("Request error:", err.message);
  res.status(400).json({ error: "Requisição inválida." });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Pixel Draw API listening on port ${PORT}`);
});
