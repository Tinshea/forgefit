# Importe un export de l'app Santé dans la stack Docker.
#
#   .\scripts\import-health.ps1 -Fichier "$env:USERPROFILE\Downloads\export.zip"
#   .\scripts\import-health.ps1 -Fichier ...\export.zip -Simulation
#   .\scripts\import-health.ps1 -Fichier ...\export.zip -Depuis 2026-01-01
#
# Accepte le .zip tel qu'il sort de l'iPhone, ou le export.xml déjà
# extrait. Le fichier est copié dans le conteneur puis importé : rien
# n'est monté, donc aucun redémarrage de la stack.

param(
  [Parameter(Mandatory = $true)][string]$Fichier,
  [string]$Conteneur = 'forgefit-api',
  [string]$Depuis,
  [switch]$Simulation
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

if (-not (Test-Path $Fichier)) { throw "Fichier introuvable : $Fichier" }

# Le conteneur doit tourner, sinon docker cp échoue avec un message
# nettement moins clair.
$etat = docker inspect -f '{{.State.Running}}' $Conteneur 2>$null
if ($etat -ne 'true') {
  throw "Le conteneur « $Conteneur » ne tourne pas. Lancer : docker compose up -d"
}

$xml = $Fichier

# L'iPhone produit un .zip contenant apple_health_export/export.xml.
if ($Fichier -like '*.zip') {
  $temp = Join-Path $env:TEMP "forgefit-health-$(Get-Random)"
  Write-Host "Extraction de l'archive..." -ForegroundColor Cyan
  Expand-Archive -Path $Fichier -DestinationPath $temp -Force

  $trouve = Get-ChildItem $temp -Recurse -Filter 'export.xml' | Select-Object -First 1
  if (-not $trouve) {
    throw "Aucun export.xml dans l'archive. Contenu : " +
          ((Get-ChildItem $temp -Recurse | Select-Object -First 10 -ExpandProperty Name) -join ', ')
  }
  $xml = $trouve.FullName
  Write-Host "  trouvé : $($trouve.Name) ($([math]::Round($trouve.Length/1MB,1)) Mo)" -ForegroundColor Green
}

$taille = [math]::Round((Get-Item $xml).Length / 1MB, 1)
Write-Host "`nCopie dans le conteneur ($taille Mo)..." -ForegroundColor Cyan
docker cp $xml "${Conteneur}:/tmp/export.xml"
if ($LASTEXITCODE -ne 0) { throw 'La copie vers le conteneur a échoué.' }

# Surtout pas $args : c'est une variable automatique de PowerShell.
$options = @('--file', '/tmp/export.xml')
if ($Simulation) { $options += '--dry-run' }
if ($Depuis) { $options += @('--since', $Depuis) }

Write-Host "`nImport..." -ForegroundColor Cyan

# npm écrit ses avis (« npm notice : nouvelle version disponible ») sur
# la sortie d'erreur. PowerShell les remonte en NativeCommandError et
# ferait échouer un import parfaitement réussi : on fusionne les deux
# flux et on ne juge que le code de retour.
$ErrorActionPreference = 'Continue'
docker exec $Conteneur npm run import:health -- @options 2>&1 | ForEach-Object { "$_" }
$code = $LASTEXITCODE
$ErrorActionPreference = 'Stop'

# Le fichier peut peser plusieurs centaines de Mo : on ne le laisse pas
# occuper la couche du conteneur.
#
# En root : `docker cp` dépose le fichier avec ce propriétaire, alors
# que le conteneur tourne sous l'utilisateur `node`, qui ne peut donc
# pas le supprimer. Et un échec de ménage ne doit jamais faire échouer
# un import réussi.
try {
  docker exec -u root $Conteneur rm -f /tmp/export.xml 2>&1 | Out-Null
} catch {
  Write-Host '  (fichier temporaire non supprimé du conteneur)' -ForegroundColor DarkGray
}
if ($temp -and (Test-Path $temp)) { Remove-Item $temp -Recurse -Force }

if ($code -ne 0) { throw "L'import a échoué (code $code)." }

Write-Host "`nTerminé." -ForegroundColor Green
if ($Simulation) {
  Write-Host 'Simulation : relancer sans -Simulation pour écrire en base.' -ForegroundColor Yellow
} else {
  Write-Host 'Vérifier dans Progression → Tendances.' -ForegroundColor Gray
}
