[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string] $OutputPath
)
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$output = [IO.Path]::GetFullPath($OutputPath)
if (Test-Path -LiteralPath $output) { throw "Output already exists: $output. Choose a new path." }
if ([IO.Path]::GetExtension($output) -ne '.zip') { throw 'OutputPath must end in .zip' }
Push-Location $root
try {
  foreach ($step in @('test', 'build', 'check-config')) {
    & npm run $step
    if ($LASTEXITCODE -ne 0) { throw "npm run $step failed" }
  }
  $files = @()
  foreach ($directory in @('src', 'public', 'config')) {
    $files += Get-ChildItem -LiteralPath (Join-Path $root $directory) -File -Recurse
  }
  $files += Get-Item -LiteralPath (Join-Path $root 'package.json'), (Join-Path $root 'package-lock.json')
  Add-Type -AssemblyName System.IO.Compression
  $archive = [IO.Compression.ZipFile]::Open($output, [IO.Compression.ZipArchiveMode]::Create)
  try {
    foreach ($file in $files) {
      $relative = [IO.Path]::GetRelativePath($root, $file.FullName).Replace('\', '/')
      if ($relative -notmatch '^(src/[^/]+\.js|public/[^/]+\.(html|css|js)|config/solutions\.json|package(-lock)?\.json)$') {
        throw "Unexpected file in release allowlist: $relative"
      }
      [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $file.FullName, $relative) | Out-Null
    }
  } finally { $archive.Dispose() }
  Write-Host "Deployment ZIP created: $output. No enclosing directory, local env, dependencies or documentation included."
} finally { Pop-Location }
