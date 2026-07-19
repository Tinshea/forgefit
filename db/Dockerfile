# Image PostgreSQL portant le schéma.
#
# ┌─ POURQUOI UNE IMAGE PLUTÔT QU'UN MONTAGE ─────────────────────────┐
# │ Le compose de développement monte ./db/init depuis le disque. Ça  │
# │ suppose que les sources soient présentes sur l'hôte.               │
# │                                                                     │
# │ Dans l'éditeur web de Portainer, il n'y a AUCUN dépôt sur le       │
# │ serveur : le montage pointerait vers un dossier inexistant, et la  │
# │ base démarrerait sans schéma — silencieusement, puisque Postgres   │
# │ n'échoue pas sur un répertoire d'init vide. L'application ne       │
# │ planterait qu'à la première requête.                                │
# │                                                                     │
# │ Les scripts embarqués dans l'image, la stack devient autonome.      │
# └─────────────────────────────────────────────────────────────────────┘
#
# Rappel : ces scripts ne s'exécutent qu'au TOUT PREMIER démarrage, sur
# un volume vide. Mettre à jour l'image ne rejoue pas le schéma sur une
# base existante — une migration reste une opération à part.

FROM postgres:16-alpine

# Exécutés dans l'ordre lexical : 001_schema, 002_seed, 003_programs,
# 004_nutrition, 005_food_catalogue.
COPY init/ /docker-entrypoint-initdb.d/

# Le français est la langue de l'interface, et la recherche plein texte
# s'appuie sur la configuration « french » de PostgreSQL.
ENV LANG=fr_FR.utf8
