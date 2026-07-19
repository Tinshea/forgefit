# Composants tiers

## Tracés anatomiques SVG

`frontend/src/lib/anatomy.js` contient des tracés SVG adaptés de
**react-muscle-highlighter**.

- Source : https://github.com/soroojshehryar/react-muscle-highlighter
- Licence : MIT

Adaptations : les vues face et dos ont été extraites du canevas commun et
ramenées à une origine unique, et le vocabulaire de muscles a été aligné sur
celui du catalogue d'exercices (`chest` → `pectorals`, `quadriceps` → `quads`…).
Aucun tracé n'a été modifié géométriquement.

```
MIT License

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Dataset d'exercices

`hasaneyldrm/exercises-dataset` — 1324 exercices, instructions en 10 langues.

- Source : https://github.com/hasaneyldrm/exercises-dataset
- Médias : © Gym visual — https://gymvisual.com/

Les médias ne sont **pas redistribués** : seules les URL sont stockées, et les
images sont chargées depuis le dépôt d'origine.
