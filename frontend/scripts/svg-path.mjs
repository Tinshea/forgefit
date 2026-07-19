// Analyseur de chemins SVG.
//
// Écrit à la main parce qu'un découpage par expression régulière échoue
// sur la NOTATION COMPACTE DES DRAPEAUX D'ARC : dans
// `a1.5 1.5 0 0114.6 3.5`, la séquence `0114.6` vaut drapeau
// large-arc=0, drapeau sweep=1, puis abscisse 14.6. Un tokeniseur
// générique y voit le nombre 114.6, se retrouve avec 5 arguments au lieu
// de 7, et perd la fin du tracé.
//
// Les drapeaux se lisent donc caractère par caractère, comme l'exige la
// grammaire SVG.

const ARG_COUNT = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };

/** Découpe un chemin en commandes { cmd, args }. */
export function parsePath(d) {
  const s = String(d);
  const out = [];
  let i = 0;

  const skip = () => { while (i < s.length && /[\s,]/.test(s[i])) i += 1; };

  const readNumber = () => {
    skip();
    const start = i;
    if (s[i] === '+' || s[i] === '-') i += 1;
    while (i < s.length && s[i] >= '0' && s[i] <= '9') i += 1;
    if (s[i] === '.') {
      i += 1;
      while (i < s.length && s[i] >= '0' && s[i] <= '9') i += 1;
    }
    if (s[i] === 'e' || s[i] === 'E') {
      i += 1;
      if (s[i] === '+' || s[i] === '-') i += 1;
      while (i < s.length && s[i] >= '0' && s[i] <= '9') i += 1;
    }
    return i === start ? NaN : Number(s.slice(start, i));
  };

  // Un drapeau est UN caractère, jamais un nombre : c'est toute la
  // difficulté de la notation compacte.
  const readFlag = () => {
    skip();
    const c = s[i];
    i += 1;
    return c === '1' ? 1 : 0;
  };

  let cmd = null;
  while (i < s.length) {
    skip();
    if (i >= s.length) break;

    if (/[MmLlHhVvCcSsQqTtAaZz]/.test(s[i])) {
      cmd = s[i];
      i += 1;
    } else if (!cmd) {
      break;
    } else if (cmd === 'M') {
      cmd = 'L'; // répétition implicite après un moveto
    } else if (cmd === 'm') {
      cmd = 'l';
    }

    const up = cmd.toUpperCase();
    if (up === 'Z') { out.push({ cmd, args: [] }); continue; }

    const n = ARG_COUNT[up];
    const args = [];
    if (up === 'A') {
      args.push(readNumber(), readNumber(), readNumber());
      args.push(readFlag(), readFlag());
      args.push(readNumber(), readNumber());
    } else {
      for (let k = 0; k < n; k += 1) args.push(readNumber());
    }

    if (args.some(Number.isNaN)) break; // chemin malformé : on s'arrête
    out.push({ cmd, args });
  }

  return out;
}

/**
 * Boîte englobante d'un chemin.
 *
 * Approximation volontaire : on retient les points de contrôle des
 * courbes plutôt que leur enveloppe exacte. La boîte obtenue est donc
 * au plus légèrement PLUS GRANDE que la forme réelle — ce qui est le
 * bon sens de l'erreur pour dimensionner un cadre.
 */
export function pathBBox(d) {
  let minX = Infinity; let maxX = -Infinity;
  let minY = Infinity; let maxY = -Infinity;
  let cx = 0; let cy = 0; let sx = 0; let sy = 0;

  const visit = (x, y) => {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  };

  for (const { cmd, args } of parsePath(d)) {
    const up = cmd.toUpperCase();
    const rel = cmd !== up;

    if (up === 'Z') { cx = sx; cy = sy; continue; }
    if (up === 'H') { cx = rel ? cx + args[0] : args[0]; }
    else if (up === 'V') { cy = rel ? cy + args[0] : args[0]; }
    else if (up === 'A') {
      // Seul le point d'arrivée est pris en compte ; le bombé de l'arc
      // est négligeable à l'échelle d'un muscle.
      cx = rel ? cx + args[5] : args[5];
      cy = rel ? cy + args[6] : args[6];
    } else {
      for (let k = 0; k + 1 < args.length; k += 2) {
        visit(rel ? cx + args[k] : args[k], rel ? cy + args[k + 1] : args[k + 1]);
      }
      cx = rel ? cx + args[args.length - 2] : args[args.length - 2];
      cy = rel ? cy + args[args.length - 1] : args[args.length - 1];
    }

    visit(cx, cy);
    if (up === 'M') { sx = cx; sy = cy; }
  }

  return {
    minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY,
    centerX: (minX + maxX) / 2, centerY: (minY + maxY) / 2,
  };
}

/** Boîte englobante d'un ensemble de chemins. */
export function unionBBox(paths) {
  let minX = Infinity; let maxX = -Infinity;
  let minY = Infinity; let maxY = -Infinity;
  for (const d of paths) {
    const b = pathBBox(d);
    if (b.minX < minX) minX = b.minX;
    if (b.maxX > maxX) maxX = b.maxX;
    if (b.minY < minY) minY = b.minY;
    if (b.maxY > maxY) maxY = b.maxY;
  }
  return {
    minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY,
    centerX: (minX + maxX) / 2, centerY: (minY + maxY) / 2,
  };
}
