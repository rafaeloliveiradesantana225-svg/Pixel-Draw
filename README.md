# Pixel Draw — Render

Projeto completo com frontend e API própria em Node.js, Express e Sharp.

## Rodar localmente

Requer Node.js 20 ou superior.

```bash
npm install
npm start
```

Abra `http://localhost:10000`.

## Publicar no Render

1. Envie estes arquivos para um repositório GitHub.
2. No Render, escolha **New + → Web Service** e conecte o repositório.
3. Configure:
   - Runtime: **Node**
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Instance Type: conforme sua necessidade
4. Não defina uma porta manual: o Render fornece `PORT` automaticamente.
5. Faça o deploy e abra a URL `https://SEU-SERVICO.onrender.com`.

## Testar a API

Abra `https://SEU-SERVICO.onrender.com/api/health`.
A resposta esperada é:

```json
{"ok":true,"service":"pixel-draw-api","status":"online"}
```

Teste de conversão:

```bash
curl -X POST https://SEU-SERVICO.onrender.com/api/draw \
  -H "Content-Type: application/json" \
  -d '{"imageUrl":"https://SEU-SITE/imagem.png","width":120,"height":120}'
```

A API retorna `pixels` como uma matriz de linhas e colunas; cada pixel é `[R,G,B]`.

## Observações importantes

- A imagem precisa estar em uma URL pública HTTP/HTTPS acessível pelo Render.
- O endpoint bloqueia endereços locais/privados para reduzir risco de SSRF.
- Limite de download: 10 MB.
- Dimensões máximas: 160 × 160.
- O código fornece a API e uma página web de demonstração. Para integrar com um jogo ou script externo, esse cliente deve fazer um POST para `/api/draw` e consumir `pixels`.
- Nenhum código pode garantir ausência absoluta de erros em todos os ambientes. Faça o deploy e valide `/api/health` e `/api/draw` com uma imagem pública.
