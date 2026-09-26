// Fabrique le raccourci iOS « Santé vers Atlas », signé, prêt à importer.
//
// ┌─ POURQUOI GENERER PLUTOT QU'ECRIRE UN MODE D'EMPLOI ──────────────┐
// │ La marche a suivre manuelle faisait vingt actions a monter au     │
// │ doigt sur un telephone. Personne ne va au bout, et c'est normal.  │
// └────────────────────────────────────────────────────────────────────┘
//
// ┌─ CE QUI RENDAIT CE FICHIER IMPOSSIBLE A ECRIRE, ET CE QUI A CHANGE ┐
// │ Les identifiants internes des actions Sante ne sont documentes    │
// │ NULLE PART de verifiable : absents des ressources de WorkflowKit  │
// │ (le binaire vit dans le cache partage de dyld), absents des       │
// │ references communautaires, absents de Cherri — qui ne connait de  │
// │ Sante que « ouvrir l'application ».                               │
// │                                                                    │
// │ Ils ont ete releves sur un raccourci PUBLIC et libre : celui du   │
// │ projet Heartbridge (MIT, github.com/mm/heartbridge), telecharge   │
// │ depuis son lien iCloud puis relu. D'ou :                          │
// │                                                                    │
// │   is.workflow.actions.filter.health.quantity      chercher        │
// │   is.workflow.actions.properties.health.quantity  lire un champ   │
// │   is.workflow.actions.downloadurl                 envoyer         │
// │   WFWorkflowImportQuestions                       demander l'URL  │
// │                                                                    │
// │ Ce dernier est la piece maitresse : il fait poser la question a   │
// │ l'IMPORT. L'adresse de l'instance n'a donc pas a etre figee ici.  │
// └────────────────────────────────────────────────────────────────────┘
//
// ┌─ CE QUE JE NE PEUX PAS VERIFIER D'ICI ────────────────────────────┐
// │ Apple Sante N'EXISTE PAS sur macOS. Ce raccourci ne peut donc     │
// │ etre execute nulle part sur cette machine, pas meme une fois.     │
// │ Le fichier est verifie IMPORTABLE (signature, relecture du plist  │
// │ apres signature) ; son execution ne l'est que sur l'iPhone.       │
// │                                                                    │
// │ Consequence pratique : si un libelle de type Sante est errone, le │
// │ filtre correspondant ne ramene rien et cette mesure-la manque —   │
// │ les autres passent. Le libelle se corrige dans l'application, il  │
// │ n'y a pas a regenerer le fichier.                                 │
// └────────────────────────────────────────────────────────────────────┘
//
//   node scripts/generate-shortcut.mjs

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(ICI, '../public');
const NOM = 'sante-vers-atlas';

/**
 * Les mesures rapatriees.
 *
 * `sante` est le libelle EXACT du type dans Raccourcis ; `cle` est le
 * type canonique attendu par l'API. Les deux vocabulaires sont
 * distincts et il ne faut pas les confondre.
 *
 * Le SOMMEIL manque, et ce n'est pas un oubli : c'est un echantillon de
 * CATEGORIE, pas de quantite. `filter.health.quantity` ne sait pas le
 * lire — il faudrait une autre action, avec une autre forme de sortie.
 * Il reste couvert par l'import manuel.
 */
const MESURES = [
  { cle: 'hrv', sante: 'Heart Rate Variability', unite: 'ms', variable: 'vfc' },
  { cle: 'resting_hr', sante: 'Resting Heart Rate', unite: 'count/min', variable: 'fc_repos' },
  { cle: 'weight', sante: 'Weight', unite: 'kg', variable: 'poids' },
  { cle: 'lean_mass', sante: 'Lean Body Mass', unite: 'kg', variable: 'masse_maigre' },
  { cle: 'steps', sante: 'Steps', unite: 'count', variable: 'pas' },
];

/** Identifiants stables : le meme fichier doit sortir a chaque appel. */
let compteur = 0;
const uuid = () => {
  compteur += 1;
  const h = compteur.toString(16).padStart(12, '0');
  return `A71A5000-0000-4000-8000-${h.toUpperCase()}`;
};

/** Une reference a la sortie d'une action precedente. */
const sortieDe = (id, nom) => ({
  Value: { OutputUUID: id, OutputName: nom, Type: 'ActionOutput' },
  WFSerializationType: 'WFTextTokenAttachment',
});

/**
 * Du texte contenant une variable.
 *
 * Raccourcis ne stocke pas « {vfc} » : il pose un caractere de
 * substitution U+FFFC dans la chaine, et decrit a part quel objet
 * occupe cette position. D'ou `attachmentsByRange`, dont la cle est
 * litteralement « {position, longueur} ».
 */
const texteVariable = (nom) => ({
  Value: {
    string: '￼',
    attachmentsByRange: { '{0, 1}': { VariableName: nom, Type: 'Variable' } },
  },
  WFSerializationType: 'WFTextTokenString',
});

const texteSimple = (s) => ({
  Value: { string: s, attachmentsByRange: {} },
  WFSerializationType: 'WFTextTokenString',
});

const actions = [];

actions.push({
  WFWorkflowActionIdentifier: 'is.workflow.actions.comment',
  WFWorkflowActionParameters: {
    WFCommentActionText:
      'Relève la dernière valeur de chaque mesure dans l’app Santé et '
      + 'l’envoie à Atlas.\n\n'
      + 'Pour ajouter une mesure : dupliquer un bloc de trois actions '
      + '(Rechercher / Obtenir / Définir la variable), changer le type de '
      + 'santé, puis ajouter la clé correspondante au Dictionnaire.',
  },
});

// Trois actions par mesure : chercher, lire la valeur, ranger.
for (const m of MESURES) {
  const idFiltre = uuid();
  const idValeur = uuid();

  actions.push({
    WFWorkflowActionIdentifier: 'is.workflow.actions.filter.health.quantity',
    WFWorkflowActionParameters: {
      UUID: idFiltre,
      WFContentItemFilter: {
        Value: {
          WFActionParameterFilterPrefix: 1,
          WFActionParameterFilterTemplates: [{
            Bounded: true,
            Operator: 4,
            Property: 'Type',
            Removable: false,
            Values: {
              Enumeration: {
                Value: m.sante,
                WFSerializationType: 'WFStringSubstitutableState',
              },
            },
          }],
          WFContentPredicateBoundedDate: false,
        },
        WFSerializationType: 'WFContentPredicateTableTemplate',
      },
      // La plus recente, et elle seule : on envoie un etat, pas un
      // historique — l'historique est deja passe par l'import manuel.
      WFContentItemSortProperty: 'Start Date',
      WFContentItemSortOrder: 'Latest First',
      WFContentItemLimitEnabled: true,
      WFContentItemLimitNumber: 1,

      // ┌─ L'UNITE N'EST PAS FACULTATIVE ──────────────────────────────┐
      // │ Premiere version livree SANS ces deux parametres : le        │
      // │ raccourci s'importait, s'executait, envoyait sa requete — et │
      // │ les CINQ variables revenaient vides. Pas une, les cinq, ce   │
      // │ qui excluait un libelle de type errone et designait un       │
      // │ defaut commun a toutes les actions.                          │
      // │                                                               │
      // │ C'etait celui-ci : une quantite HealthKit n'a pas de valeur  │
      // │ dans l'absolu, seulement dans une unite. Sans ce champ,      │
      // │ l'action ne sait pas quoi rendre et ne rend rien.            │
      // │                                                               │
      // │ Releve par comparaison champ a champ avec le raccourci       │
      // │ Heartbridge, qui fonctionne et les porte tous les deux.      │
      // └───────────────────────────────────────────────────────────────┘
      WFHKSampleFilteringUnit: m.unite,
      // `false` : une journee sans mesure reste absente, elle ne vaut
      // pas zero. Un zero fabrique fausserait les moyennes.
      WFHKSampleFilteringFillMissing: false,
    },
  });

  actions.push({
    WFWorkflowActionIdentifier: 'is.workflow.actions.properties.health.quantity',
    WFWorkflowActionParameters: {
      UUID: idValeur,
      WFInput: sortieDe(idFiltre, 'Health Samples'),
      WFContentItemPropertyName: 'Value',
    },
  });

  actions.push({
    WFWorkflowActionIdentifier: 'is.workflow.actions.setvariable',
    WFWorkflowActionParameters: {
      WFInput: sortieDe(idValeur, 'Value'),
      WFVariableName: m.variable,
    },
  });
}

// Un dictionnaire PLAT : une cle, une valeur. C'est tout ce que
// Raccourcis fabrique sans peine, et l'API l'accepte (adaptateur
// `plat`, services/adapters.js).
const idDico = uuid();
actions.push({
  WFWorkflowActionIdentifier: 'is.workflow.actions.dictionary',
  WFWorkflowActionParameters: {
    UUID: idDico,
    WFItems: {
      Value: {
        WFDictionaryFieldValueItems: MESURES.map((m) => ({
          WFKey: texteSimple(m.cle),
          WFItemType: 0,
          WFValue: texteVariable(m.variable),
        })),
      },
      WFSerializationType: 'WFDictionaryFieldValue',
    },
  },
});

actions.push({
  WFWorkflowActionIdentifier: 'is.workflow.actions.downloadurl',
  WFWorkflowActionParameters: {
    UUID: uuid(),
    WFURL: 'http://192.168.1.10:3000/api/health-sync?token=',
    WFHTTPMethod: 'POST',
    WFHTTPBodyType: 'File',
    WFRequestVariable: sortieDe(idDico, 'Dictionary'),
    ShowHeaders: true,
    WFHTTPHeaders: {
      Value: {
        WFDictionaryFieldValueItems: [{
          WFKey: texteSimple('X-ForgeFit-Source'),
          WFItemType: 0,
          WFValue: texteSimple('apple_health'),
        }],
      },
      WFSerializationType: 'WFDictionaryFieldValue',
    },
  },
});

const raccourci = {
  WFWorkflowClientVersion: '1050.19',
  WFWorkflowMinimumClientVersion: 900,
  WFWorkflowMinimumClientVersionString: '900',
  WFWorkflowIcon: {
    WFWorkflowIconStartColor: 4282601983,
    WFWorkflowIconGlyphNumber: 59764,
  },
  // La question posee A L'IMPORT. Sans elle il faudrait figer ici une
  // adresse qui n'est valable que sur un seul reseau.
  // ┌─ POURQUOI LE JETON VOYAGE DANS L'URL ───────────────────────────┐
  // │ Une question d'import ne peut viser qu'un parametre SIMPLE de   │
  // │ l'action. `WFURL` en est un ; `WFHTTPHeaders` est un            │
  // │ dictionnaire et n'en est pas un — on ne peut pas y faire poser  │
  // │ une question. Mettre le jeton dans un en-tete obligerait donc a │
  // │ l'ecrire a la main dans l'application apres import, ce qui      │
  // │ ramene le bricolage qu'on cherchait a supprimer.                │
  // │                                                                  │
  // │ Contrepartie assumee, et l'API accepte les deux formes : une    │
  // │ URL finit dans les journaux du serveur, pas un en-tete. Sur une │
  // │ instance de reseau local c'est acceptable ; sur une instance    │
  // │ exposee, il faudrait repasser a l'en-tete.                       │
  // └──────────────────────────────────────────────────────────────────┘
  WFWorkflowImportQuestions: [{
    ParameterKey: 'WFURL',
    Category: 'Parameter',
    ActionIndex: actions.length - 1,
    Text: 'Colle l’adresse affichée sur l’écran Santé d’Atlas (elle contient ton jeton).',
    DefaultValue: 'http://192.168.1.10:3000/api/health-sync?token=',
  }],
  WFWorkflowTypes: ['Watch', 'NCWidget'],
  WFWorkflowInputContentItemClasses: [],
  WFWorkflowActions: actions,
};

const brut = path.join(PUBLIC, `${NOM}.brut.shortcut`);
const signe = path.join(PUBLIC, `${NOM}.shortcut`);
fs.mkdirSync(PUBLIC, { recursive: true });

// `plutil` convertit le JSON en plist binaire : Node ne sait pas ecrire
// de plist, et c'est le seul format que Raccourcis accepte.
fs.writeFileSync(`${brut}.json`, JSON.stringify(raccourci));
execFileSync('plutil', ['-convert', 'binary1', `${brut}.json`, '-o', brut]);
fs.unlinkSync(`${brut}.json`);

// ┌─ LA SIGNATURE N'EST PAS FACULTATIVE ──────────────────────────────┐
// │ Depuis iOS 15, un `.shortcut` non signe ne s'importe plus, quel   │
// │ que soit le reglage « raccourcis non fiables ». Sans cette etape, │
// │ le fichier produit est inutilisable.                             │
// │                                                                    │
// │ `shortcuts sign` n'existe que sur macOS. Le fichier signe est     │
// │ donc VERSIONNE : il n'a pas a etre regenere a chaque construction,│
// │ et la chaine de construction tourne sous Linux.                   │
// └────────────────────────────────────────────────────────────────────┘
try {
  execFileSync('shortcuts', ['sign', '--mode', 'anyone', '--input', brut, '--output', signe], {
    stdio: ['ignore', 'ignore', 'ignore'],
  });
} catch {
  console.error(`Signature impossible. Sans elle iOS refusera le fichier.\n`
    + `  — sur macOS : verifier que l'app Raccourcis a ete ouverte une fois ;\n`
    + `  — ailleurs : garder le fichier signe deja versionne.`);
  process.exit(1);
}

// ┌─ `shortcuts sign` ECRIT EN 600 ───────────────────────────────────┐
// │ Lisible par le seul proprietaire. Copie tel quel dans l'image, le │
// │ fichier devenait illisible pour nginx, qui ne tourne pas en root :│
// │ un 403 sur le bouton de telechargement, alors que le fichier      │
// │ etait bien la. Rien dans le message d'erreur ne l'indiquait.      │
// └────────────────────────────────────────────────────────────────────┘
fs.chmodSync(signe, 0o644);

const taille = fs.statSync(signe).size;
fs.unlinkSync(brut);
console.log(`${actions.length} actions · ${MESURES.length} mesures`);
console.log(`Ecrit et signe : public/${NOM}.shortcut (${taille} octets)`);
