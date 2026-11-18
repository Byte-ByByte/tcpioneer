
param(
    [string]$BaseUrl = "http://127.0.0.1:8208",
    [string]$Token = $env:TCPIONEER_TOKEN
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($Token)) {
    throw "Set TCPIONEER_TOKEN or provide -Token."
}

$Headers = @{
    Authorization = "Bearer $Token"
}

function Invoke-Api {
    param(
        [string]$Path,
        [hashtable]$Body,
        [string]$Method = "GET"
    )

    $Request = @{
        Uri = "$BaseUrl$Path"
        Method = $Method
        Headers = $Headers
    }

    if ($null -ne $Body) {
        $Request.ContentType = "application/json"
        $Request.Body = $Body | ConvertTo-Json -Depth 10
    }

    if ($Method -eq "GET" -and $null -ne $Body) {
        $Curl = Get-Command curl.exe -ErrorAction SilentlyContinue
        if ($null -eq $Curl) {
            throw "curl.exe is required to send a GET request with a body."
        }

        $RequestFile = $null
        $ResponseFile = $null
        try {
            $RequestFile = [System.IO.Path]::GetTempFileName()
            $ResponseFile = [System.IO.Path]::GetTempFileName()
            [System.IO.File]::WriteAllBytes(
                $RequestFile,
                [System.Text.Encoding]::UTF8.GetBytes($Request.Body)
            )

            $StatusCode = & $Curl.Source `
                --silent `
                --show-error `
                --request $Method `
                --data-binary "@$RequestFile" `
                --header "Authorization: $($Headers.Authorization)" `
                --header "Content-Type: application/json" `
                --output $ResponseFile `
                --write-out "%{http_code}" `
                --url $Request.Uri

            if ($LASTEXITCODE -ne 0) {
                throw "curl.exe failed with exit code $LASTEXITCODE."
            }

            return @{
                StatusCode = [int]$StatusCode
                Content = [System.IO.File]::ReadAllText($ResponseFile)
            }
        } finally {
            if ($null -ne $ResponseFile) {
                Remove-Item -LiteralPath $ResponseFile -Force
            }
            if ($null -ne $RequestFile) {
                Remove-Item -LiteralPath $RequestFile -Force
            }
        }
    }

    try {
        $Response = Invoke-WebRequest @Request
    } catch {
        $Response = $_.Exception.Response
        if ($null -eq $Response) {
            throw
        }

        $StatusCode = [int]$Response.StatusCode
        if ($Response -is [System.Net.HttpWebResponse]) {
            $Reader = New-Object System.IO.StreamReader($Response.GetResponseStream())
            try {
                $Content = $Reader.ReadToEnd()
            } finally {
                $Reader.Dispose()
                $Response.Dispose()
            }
        } else {
            $Content = $Response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
        }

        return @{
            StatusCode = $StatusCode
            Content = $Content
        }
    }

    return @{
        StatusCode = [int]$Response.StatusCode
        Content = $Response.Content
    }
}

function Assert-Status {
    param(
        [string]$Name,
        [int]$Actual,
        [int]$Expected
    )

    if ($Actual -ne $Expected) {
        Write-Host "[FAIL] $Name`: expected $Expected, got $Actual" -ForegroundColor Red
        throw "Lifecycle test failed."
    }

    Write-Host "[PASS] $Name ($Actual)" -ForegroundColor Green
}

Write-Host "`n=== TCPIOneer Session Lifecycle Test ===`n"

# 1. Create a session
Write-Host "[TEST] Creating session..."

$Create = Invoke-Api `
    -Path "/api/v1/request-session" `
    -Body $null

Assert-Status "Session creation" $Create.StatusCode 201

$SessionData = $Create.Content | ConvertFrom-Json
$SessionId = $SessionData.session

if ([string]::IsNullOrWhiteSpace($SessionId)) {
    throw "Session response did not contain a session ID."
}

Write-Host "Session ID: $SessionId"

# 2. Verify the session is usable
if (-not $SessionData.usable) {
    throw "Session is not usable. Check session configuration and capabilities."
}

$KeyboardCapability = $SessionData.capabilities | Where-Object { $_.capability -eq "keyboard" }
if ($null -eq $KeyboardCapability) {
    throw "Session does not have the keyboard capability."
}

# 3. Test capability before deletion
Write-Host "`n[TEST] Testing capability before deletion..."

$CapabilityBody = @{
    "capability-name" = "keyboard"
    params = @{
        key = "shift"
        hold = 10
    }
    task = 0
    session = $SessionId
}

$BeforeDelete = Invoke-Api `
    -Path "/api/v1/capability" `
    -Body $CapabilityBody `
    -Method "POST"

Assert-Status "Capability before deletion" $BeforeDelete.StatusCode 200

# 4. Delete the session
Write-Host "`n[TEST] Deleting session..."

$DeleteBody = @{
    session = $SessionId
}

$Delete = Invoke-Api `
    -Path "/api/v1/delete-session" `
    -Body $DeleteBody

if ($Delete.StatusCode -notin @(200, 204)) {
    throw "Session deletion failed: HTTP $($Delete.StatusCode). Response: $($Delete.Content)"
}

Write-Host "[PASS] Session deletion ($($Delete.StatusCode))" -ForegroundColor Green

# 5. First request after deletion: expect 410
Write-Host "`n[TEST] Checking tombstone response..."

$AfterDelete = Invoke-Api `
    -Path "/api/v1/capability" `
    -Body $CapabilityBody `
    -Method "POST"

Assert-Status "First request after deletion" $AfterDelete.StatusCode 410

# 6. Second request after deletion: expect 404
Write-Host "`n[TEST] Checking subsequent lookup..."

$AfterTombstone = Invoke-Api `
    -Path "/api/v1/capability" `
    -Body $CapabilityBody `
    -Method "POST"

Assert-Status "Second request after deletion" $AfterTombstone.StatusCode 404

Write-Host "`n=== ALL LIFECYCLE TESTS PASSED ===" -ForegroundColor Green
