/**
 * Palier de fiabilité d'un exercice.
 *
 * Le badge seul ne veut rien dire : « Fondamental » n'informe que si on
 * peut lire la règle qui l'attribue. Le critère du palier est donc
 * toujours accessible — en infobulle, et en texte déplié pour les
 * lecteurs d'écran, qui n'ont pas accès au survol.
 */

export const TIER_STYLE = {
  fondamental: { label: 'Fondamental', color: 'var(--good)' },
  complement: { label: 'Complément', color: 'var(--series-1)' },
  accessoire: { label: 'Accessoire', color: 'var(--text-muted)' },
};

export default function EvidenceBadge({ tier, criteria, compact = false }) {
  if (!tier) return null;
  const style = TIER_STYLE[tier];
  if (!style) return null;

  return (
    <span
      className={`pill${compact ? ' pill-compact' : ''}`}
      title={criteria ?? undefined}
      style={{
        color: style.color,
        borderColor: style.color,
        // La taille passe par une classe plutôt que par le style en
        // ligne : c'est ce qui permet à la feuille de style de la
        // relever sur téléphone, où 10 px se lit mal à bout de bras.
        // Un style en ligne l'aurait emporté sur toute règle.
        
        whiteSpace: 'nowrap',
      }}
    >
      {style.label}
      {criteria && <span className="visually-hidden"> — {criteria}</span>}
    </span>
  );
}
