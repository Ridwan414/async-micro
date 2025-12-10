# Monitor Autoscaling in Staging Environment
# This script monitors HPA, pods, and resource usage during load testing

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Staging Autoscaling Monitor" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Starting monitoring... Press Ctrl+C to stop" -ForegroundColor Yellow
Write-Host ""

$iteration = 0

while ($true) {
    $iteration++
    Clear-Host
    
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "  Iteration: $iteration" -ForegroundColor Cyan
    Write-Host "  Time: $(Get-Date -Format 'HH:mm:ss')" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    
    # Load Test Job Status
    Write-Host "📊 LOAD TEST STATUS:" -ForegroundColor Green
    kubectl get jobs -n staging -l app=load-test 2>$null
    Write-Host ""
    
    # HPA Status
    Write-Host "🔄 HORIZONTAL POD AUTOSCALER:" -ForegroundColor Green
    kubectl get hpa -n staging 2>$null
    Write-Host ""
    
    # Pod Count
    Write-Host "🚀 POD STATUS:" -ForegroundColor Green
    kubectl get pods -n staging --no-headers 2>$null | ForEach-Object {
        $fields = $_ -split '\s+'
        $name = $fields[0]
        $ready = $fields[1]
        $status = $fields[2]
        
        $color = "White"
        if ($status -eq "Running") { $color = "Green" }
        elseif ($status -eq "Pending" -or $status -eq "ContainerCreating") { $color = "Yellow" }
        elseif ($status -like "*Error*" -or $status -like "*CrashLoop*") { $color = "Red" }
        
        Write-Host "  $name" -NoNewline
        Write-Host " [$ready] " -NoNewline -ForegroundColor $color
        Write-Host "$status" -ForegroundColor $color
    }
    Write-Host ""
    
    # Resource Usage
    Write-Host "💻 RESOURCE USAGE:" -ForegroundColor Green
    kubectl top pods -n staging 2>$null | Select-Object -First 15
    Write-Host ""
    
    # Deployment Replicas
    Write-Host "📈 DEPLOYMENT REPLICAS:" -ForegroundColor Green
    $deployments = kubectl get deployments -n staging -o json 2>$null | ConvertFrom-Json
    foreach ($dep in $deployments.items) {
        $name = $dep.metadata.name
        $desired = $dep.spec.replicas
        $ready = $dep.status.readyReplicas
        $available = $dep.status.availableReplicas
        
        Write-Host "  $name" -NoNewline
        Write-Host " - Desired: $desired, Ready: $ready, Available: $available" -ForegroundColor Cyan
    }
    Write-Host ""
    
    # Load Test Logs (last 5 lines)
    Write-Host "📝 LOAD TEST LOGS (Last 5 lines):" -ForegroundColor Green
    $pods = kubectl get pods -n staging -l app=load-test -o name 2>$null
    if ($pods) {
        $firstPod = $pods | Select-Object -First 1
        kubectl logs $firstPod -n staging --tail=5 2>$null
    } else {
        Write-Host "  No load test pods found" -ForegroundColor Yellow
    }
    Write-Host ""
    
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "Next update in 5 seconds..." -ForegroundColor Gray
    Write-Host "Press Ctrl+C to stop monitoring" -ForegroundColor Gray
    Write-Host "========================================" -ForegroundColor Cyan
    
    Start-Sleep -Seconds 5
}

