<#
.SYNOPSIS
    One-shot bootstrap for the AdNexus / Vaart-E CMS on Windows.

.DESCRIPTION
    Installs and verifies every prerequisite (Node.js, pnpm, PostgreSQL),
    installs workspace dependencies, writes the .env files with a freshly
    generated AUTH_SECRET, creates the database, applies Prisma migrations and
    seeds the default users.

    Every step is idempotent: existing env files and databases are left alone,
    so it is safe to re-run after pulling new code.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File .\setup-windows.ps1
#>

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$RootDir    = Split-Path -Parent $MyInvocation.MyCommand.Path
$WebDir     = Join-Path $RootDir "apps\web"
$DbDir      = Join-Path $RootDir "packages\database"
$WebEnvFile = Join-Path $WebDir ".env.local"
$DbEnvFile  = Join-Path $DbDir ".env"

$DbHost = "localhost"
$DbPort = 5432
$DbUser = "postgres"
$DbPass = "vaarte_dev"
$DbName = "vaarte"
$DbUrl  = "postgresql://${DbUser}:${DbPass}@${DbHost}:${DbPort}/${DbName}?schema=public"

# --------------------------------------------------------------------------
# Output helpers
# --------------------------------------------------------------------------
function Write-Step { param([string]$m) Write-Host "`n==> $m" -ForegroundColor Cyan }
function Write-Ok   { param([string]$m) Write-Host "    [ok] $m" -ForegroundColor Green }
function Write-Info { param([string]$m) Write-Host "    $m" -ForegroundColor Gray }
function Write-Warn { param([string]$m) Write-Host "    [warn] $m" -ForegroundColor Yellow }
function Fail       { param([string]$m) Write-Host "`n[FAILED] $m" -ForegroundColor Red; exit 1 }

# --------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------
function Test-Command {
    param([string]$Name)
    return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

function Get-NodeMajorVersion {
    try {
        $v = (& node --version 2>$null) -replace '^v', ''
        return [int]($v -split '\.')[0]
    } catch { return 0 }
}

function New-RandomSecret {
    # Works on both Windows PowerShell 5.1 and PowerShell 7+.
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $bytes = New-Object byte[] 32
    $rng.GetBytes($bytes)
    $rng.Dispose()
    return [Convert]::ToBase64String($bytes)
}

function Write-Utf8NoBom {
    # Set-Content -Encoding UTF8 emits a BOM under Windows PowerShell 5.1,
    # which corrupts the first variable in a .env file (the key becomes
    # "\ufeffDATABASE_URL"). WriteAllText is BOM-free on every PS version.
    param([string]$Path, [string]$Content)
    [System.IO.File]::WriteAllText($Path, $Content, (New-Object System.Text.UTF8Encoding($false)))
}

function Test-TcpPort {
    # Much faster than Test-NetConnection, which can take seconds per attempt.
    param([string]$HostName, [int]$Port, [int]$TimeoutMs = 1000)
    try {
        $client = New-Object System.Net.Sockets.TcpClient
        $iar = $client.BeginConnect($HostName, $Port, $null, $null)
        if (-not $iar.AsyncWaitHandle.WaitOne($TimeoutMs, $false)) { $client.Close(); return $false }
        $client.EndConnect($iar)
        $client.Close()
        return $true
    } catch { return $false }
}

function Find-PsqlPath {
    if (Test-Command "psql") { return (Get-Command psql).Source }
    $candidates = @(
        "$env:ProgramFiles\PostgreSQL\*\bin\psql.exe",
        "${env:ProgramFiles(x86)}\PostgreSQL\*\bin\psql.exe"
    )
    foreach ($c in $candidates) {
        $hit = Get-ChildItem -Path $c -ErrorAction SilentlyContinue |
               Sort-Object FullName -Descending | Select-Object -First 1
        if ($hit) { return $hit.FullName }
    }
    return $null
}

function Invoke-Checked {
    param([string]$Exe, [string[]]$Args, [string]$What, [string]$Cwd = $RootDir)
    Push-Location $Cwd
    try {
        & $Exe @Args
        if ($LASTEXITCODE -ne 0) { Fail "$What failed (exit code $LASTEXITCODE)." }
    } finally { Pop-Location }
}

# --------------------------------------------------------------------------
Write-Host "===============================================" -ForegroundColor DarkCyan
Write-Host " AdNexus / Vaart-E CMS - Windows setup" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor DarkCyan

# --------------------------------------------------------------------------
# 1. Node.js
# --------------------------------------------------------------------------
Write-Step "Checking Node.js (need >= 20.9.0)"

if (-not (Test-Command "node")) {
    Write-Warn "Node.js not found. Installing via winget..."
    if (Test-Command "winget") {
        Start-Process winget -ArgumentList "install","OpenJS.NodeJS.LTS","--accept-source-agreements","--accept-package-agreements" -Wait -NoNewWindow
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" +
                    [System.Environment]::GetEnvironmentVariable("Path","User")
    } else {
        Fail "Node.js is required and winget is unavailable. Install Node.js 20+ from https://nodejs.org and re-run."
    }
}

$nodeMajor = Get-NodeMajorVersion
if ($nodeMajor -lt 20) { Fail "Node.js 20+ required, found major version $nodeMajor. Please upgrade and re-run." }
Write-Ok "Node.js $(& node --version)"

# --------------------------------------------------------------------------
# 2. pnpm
# --------------------------------------------------------------------------
Write-Step "Checking pnpm"

if (Test-Command "corepack") {
    Write-Info "Enabling pnpm via corepack..."
    & corepack enable 2>$null | Out-Null
}

if (-not (Test-Command "pnpm")) {
    Write-Warn "pnpm not found. Installing via npm..."
    & npm install -g pnpm@9 --silent
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" +
                [System.Environment]::GetEnvironmentVariable("Path","User")
}

if (-not (Test-Command "pnpm")) { Fail "pnpm could not be installed. Install it with: npm install -g pnpm" }
Write-Ok "pnpm $(& pnpm --version)"

# --------------------------------------------------------------------------
# 3. PostgreSQL
# --------------------------------------------------------------------------
Write-Step "Checking PostgreSQL"

$psql = Find-PsqlPath
$pgService = Get-Service -Name "postgresql-x64","postgresql*" -ErrorAction SilentlyContinue |
            Where-Object { $_.Name -like "postgresql*" } | Select-Object -First 1

if (-not $psql) {
    Write-Warn "PostgreSQL not found. Installing via winget..."
    if (Test-Command "winget") {
        Start-Process winget -ArgumentList "install","PostgreSQL.PostgreSQL","--accept-source-agreements","--accept-package-agreements" -Wait -NoNewWindow
        $psql = Find-PsqlPath
    }
    if (-not $psql) {
        Fail ("PostgreSQL is required. Install PostgreSQL 14+ from https://www.postgresql.org/download/windows/ " +
              "and make sure psql is on your PATH, then re-run this script.")
    }
    Write-Ok "PostgreSQL installed"
}

if ($psql) { Write-Info "psql: $psql" }

if ($pgService -and $pgService.Status -ne "Running") {
    Write-Warn "Starting service '$($pgService.Name)' (may require Administrator)..."
    try {
        Start-Service -Name $pgService.Name -ErrorAction Stop
    } catch {
        Write-Warn "Could not start the service automatically: $($_.Exception.Message)"
    }
}

# Wait for the server to accept connections.
$ready = $false
foreach ($port in $DbPort, 5433, 5434) {
    foreach ($attempt in 1..15) {
        if (Test-TcpPort -HostName $DbHost -Port $port) { $DbPort = $port; $ready = $true; break }
        Start-Sleep -Seconds 1
    }
    if ($ready) { break }
}
if ($ready) { Write-Ok "PostgreSQL accepting connections on ${DbHost}:${DbPort}" }
else { Fail "Could not connect to PostgreSQL on port ${DbPort}. Is the service running?" }

# --------------------------------------------------------------------------
# 4. Workspace dependencies
# --------------------------------------------------------------------------
Write-Step "Installing workspace dependencies"
Write-Info "(first run downloads a lot - this can take a few minutes)"
Invoke-Checked -Exe "pnpm" -Args @("install") -What "pnpm install"
Write-Ok "Dependencies installed"

# --------------------------------------------------------------------------
# 5. Env files
# --------------------------------------------------------------------------
Write-Step "Writing environment files"

$needSecret = $false
if (Test-Path $WebEnvFile) { Write-Info "$WebEnvFile already exists - keeping it" } else { $needSecret = $true }
if (Test-Path $DbEnvFile)  { Write-Info "$DbEnvFile already exists - keeping it" }
if ($needSecret) {
    $secret = New-RandomSecret
} else {
    $secret = "<keep-existing>"
}

$DbUrl = "postgresql://${DbUser}:${DbPass}@${DbHost}:${DbPort}/${DbName}?schema=public"
$Origin = "http://localhost:3000"

if (-not (Test-Path $DbEnvFile)) {
    $dbEnv = @"
# Used by the Prisma CLI (migrate / generate / seed) from packages/database.
# Must stay in sync with DATABASE_URL in apps/web/.env.local
DATABASE_URL="$DbUrl"
"@
    Write-Utf8NoBom -Path $DbEnvFile -Content $dbEnv
    Write-Ok "Created $DbEnvFile"
}

if (-not (Test-Path $WebEnvFile)) {
    $webEnv = @"
# AdNexus CMS - local development environment
# Generated by setup-windows.ps1

# --- Database -------------------------------------------------------------
DATABASE_URL="$DbUrl"

# --- Auth (NextAuth v5 / Auth.js) ----------------------------------------
AUTH_SECRET="$secret"
NEXTAUTH_URL="$Origin"
AUTH_URL="$Origin"

# --- Player URLs ----------------------------------------------------------
NEXT_PUBLIC_PLAYER_BASE_URL="$Origin"

# --- Cloudflare R2 (optional) --------------------------------------------
# "dummy" keeps local disk uploads enabled. Fill these in to use R2.
R2_ACCOUNT_ID="dummy"
R2_ACCESS_KEY_ID="dummy"
R2_SECRET_ACCESS_KEY="dummy"
R2_BUCKET_NAME="dummy"
R2_PUBLIC_URL="dummy"

# --- Pusher (optional) ---------------------------------------------------
# "dummy" makes TVs poll instead of receiving realtime pushes.
PUSHER_APP_ID="dummy"
PUSHER_KEY="dummy"
PUSHER_SECRET="dummy"
PUSHER_CLUSTER="mt1"
NEXT_PUBLIC_PUSHER_KEY="dummy"
NEXT_PUBLIC_PUSHER_CLUSTER="mt1"
"@
    Write-Utf8NoBom -Path $WebEnvFile -Content $webEnv
    Write-Ok "Created $WebEnvFile (generated a new AUTH_SECRET)"
}

# --------------------------------------------------------------------------
# 6. Database
# --------------------------------------------------------------------------
Write-Step "Creating database '$DbName'"

$canConnect = $false
try {
    $env:PGPASSWORD = $DbPass
    & $psql -h $DbHost -p $DbPort -U $DbUser -d $DbName -c "SELECT 1" 2>$null | Out-Null
    $canConnect = ($LASTEXITCODE -eq 0)
} catch { $canConnect = $false }

if ($canConnect) {
    Write-Ok "Database '$DbName' already reachable - skipping creation"
} else {
    Write-Info "Need to create the role and database. You may be prompted for the"
    Write-Info "PostgreSQL superuser password (the one you chose during installation)."
    Write-Info "If you do not know it, reset it with:"
    Write-Info "  ALTER ROLE postgres WITH PASSWORD 'your-new-password';"

    $superPass = Read-Host "PostgreSQL superuser password for role '$DbUser'" -AsSecureString
    $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($superPass)
    try {
        $superPlain = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    } finally {
        [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    }

    $env:PGPASSWORD = $superPlain
    # NOTE: \gexec is a psql meta-command, so the SQL must arrive on stdin.
    # Passing it with -c sends it to the server verbatim and fails to parse.
    $provision = @"
DO `$`$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '$DbUser') THEN
    EXECUTE format('CREATE ROLE %I LOGIN PASSWORD %L', '$DbUser', '$DbPass');
  ELSE
    EXECUTE format('ALTER ROLE %I WITH LOGIN PASSWORD %L', '$DbUser', '$DbPass');
  END IF;
END
`$`$;
"@
    $provision | & $psql -h $DbHost -p $DbPort -U $DbUser -d postgres -v ON_ERROR_STOP=1
    if ($LASTEXITCODE -ne 0) { Fail "Could not create the role '$DbUser'. Check the password and try again." }

    $createdb = @"
SELECT 'CREATE DATABASE "$DbName" OWNER "$DbUser" ENCODING ''UTF8'''
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$DbName')\gexec
"@
    $createdb | & $psql -h $DbHost -p $DbPort -U $DbUser -d postgres -v ON_ERROR_STOP=1
    if ($LASTEXITCODE -ne 0) { Fail "Could not create the database '$DbName'." }

    Write-Ok "Created role and database '$DbName'"
}

# --------------------------------------------------------------------------
# 7. Migrations + seed
# --------------------------------------------------------------------------
Write-Step "Applying Prisma migrations"
Invoke-Checked -Exe "pnpm" -Args @("--filter","@vaart/database","exec","prisma","migrate","deploy") `
    -What "prisma migrate deploy" -Cwd $RootDir

Write-Step "Seeding default users and sample data"
Invoke-Checked -Exe "pnpm" -Args @("--filter","@vaart/database","exec","prisma","db","seed") `
    -What "prisma db seed" -Cwd $RootDir

# --------------------------------------------------------------------------
Write-Host ""
Write-Host "===============================================" -ForegroundColor DarkCyan
Write-Host " Setup complete" -ForegroundColor Green
Write-Host "===============================================" -ForegroundColor DarkCyan
Write-Host ""
Write-Host "  Start the app:   pnpm --filter web dev" -ForegroundColor White
Write-Host "  Then open:       http://localhost:3000" -ForegroundColor White
Write-Host ""
Write-Host "  Admin login:     admin@vaart.com / Admin@123" -ForegroundColor Yellow
Write-Host "  Campaigner:      client@example.com / Client@123" -ForegroundColor Yellow
Write-Host ""
Write-Host "  First compile takes 1-3 minutes. That is normal." -ForegroundColor DarkGray
Write-Host ""
exit 0