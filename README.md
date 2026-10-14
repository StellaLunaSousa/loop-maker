# Loop Maker

Monte músicas com blocos de loop no estilo dos consoles clássicos e compartilhe nas redes.

- **Dois consoles:** _8-bit Cartucho_ (ondas de pulso, triângulo em degraus e ruído LFSR, tudo sintetizado) e _32-bit Disco_ (timbres FM, pad de cordas, baixo slap e bateria breakbeat, passando por filtro e reverb de hardware).
- **Músicas que fazem sentido:** cada música tem um tom e um clima (maior, dórico ou menor), e cada seção (Intro, Verso, Refrão, Ponte, Final) tem sua progressão de acordes. Os blocos são escritos em relação ao acorde, então as notas dos tempos fortes sempre pertencem a ele. Seções do mesmo tipo compartilham os blocos, viradas de bateria aparecem nas transições e a música termina no acorde da tônica.
- **Compartilhar:** vídeo MP4 (9:16, 1:1, 16:9) gerado no navegador, WAV, e um link que carrega a música inteira (quem abre pode fazer remix).

## Rodando

Precisa do [Node.js](https://nodejs.org) 20 ou mais novo.

```bash
npm install
npm run dev      # abre em http://localhost:5173
npm test         # testes de harmonia e do link
npm run build    # gera a versão de produção em dist/
```

## Onde mexer

| O quê | Arquivo |
|---|---|
| Progressões de acordes por clima e seção | `src/music/theory.ts` |
| Blocos (batidas, baixos, acordes, melodias) | `src/music/blocks.ts` |
| Como blocos viram notas (viradas, final, registro) | `src/music/compose.ts` |
| "Surpreenda-me" e música inicial | `src/music/presets.ts` |
| Som do 8-bit / 32-bit | `src/audio/nes.ts`, `src/audio/psx.ts` |
| Tocar ao vivo e exportar áudio | `src/audio/engine.ts` |
| Animação da TV e do vídeo | `src/viz/visualizer.ts` |
| Vídeo MP4 | `src/export/video.ts` |
| Links de doação (Ko-fi, Pix) | `src/config.ts` |
| Visual dos dois temas | `src/index.css` |

## Publicar

O workflow em `.github/workflows/deploy.yml` publica no GitHub Pages a cada push na `main`. Ative em **Settings → Pages → Source: GitHub Actions**.

## Atalhos

Espaço toca/para · setas mudam o quadrado selecionado · Delete apaga o bloco · Ctrl+Z / Ctrl+Y desfaz e refaz.

---

Sons e melodias originais, inspirados em consoles clássicos. Sem afiliação com nenhuma fabricante de videogame.
