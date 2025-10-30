# Script to generate PNG icons from SVG
# This uses PowerShell and .NET libraries

Write-Host "Generating app icons..." -ForegroundColor Green

$svgPath = ".\public\icon.svg"
$outputDir = ".\public"

# Check if SVG exists
if (-not (Test-Path $svgPath)) {
    Write-Host "Error: icon.svg not found in public folder!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "=== ICON GENERATION ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "I'll help you generate the icons. Here are your options:" -ForegroundColor Yellow
Write-Host ""
Write-Host "OPTION 1: Online Converter (Easiest)" -ForegroundColor Green
Write-Host "  1. Open this URL in your browser:"
Write-Host "     https://svgtopng.com/" -ForegroundColor Cyan
Write-Host ""
Write-Host "  2. Upload this file:"
Write-Host "     $((Resolve-Path $svgPath).Path)" -ForegroundColor Cyan
Write-Host ""
Write-Host "  3. Generate these sizes and save them:" -ForegroundColor Yellow
Write-Host "     - 192x192 -> Save as: $outputDir\icon-192.png"
Write-Host "     - 512x512 -> Save as: $outputDir\icon-512.png"
Write-Host "     - 32x32   -> Save as: $outputDir\favicon.ico"
Write-Host ""
Write-Host "OPTION 2: Install ImageMagick" -ForegroundColor Green
Write-Host "  1. Install via Chocolatey:"
Write-Host "     choco install imagemagick" -ForegroundColor Cyan
Write-Host ""
Write-Host "  2. Then run these commands:"
Write-Host "     magick convert .\public\icon.svg -resize 192x192 .\public\icon-192.png" -ForegroundColor Cyan
Write-Host "     magick convert .\public\icon.svg -resize 512x512 .\public\icon-512.png" -ForegroundColor Cyan
Write-Host "     magick convert .\public\icon.svg -resize 32x32 .\public\favicon.ico" -ForegroundColor Cyan
Write-Host ""
Write-Host "OPTION 3: Use Node.js (if you have sharp installed)" -ForegroundColor Green
Write-Host "  Run: npm install sharp" -ForegroundColor Cyan
Write-Host "  Then: node generate-icons-sharp.js" -ForegroundColor Cyan
Write-Host ""

# Try to open the online converter
$openBrowser = Read-Host "Would you like me to open the online converter in your browser? (Y/N)"
if ($openBrowser -eq "Y" -or $openBrowser -eq "y") {
    Start-Process "https://svgtopng.com/"
    Write-Host ""
    Write-Host "Browser opened! Follow the instructions above." -ForegroundColor Green
    Write-Host ""
    Write-Host "After saving the files, press any key to verify..." -ForegroundColor Yellow
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    
    # Check if files were created
    $icon192 = Test-Path ".\public\icon-192.png"
    $icon512 = Test-Path ".\public\icon-512.png"
    $favicon = Test-Path ".\public\favicon.ico"
    
    Write-Host ""
    Write-Host "=== VERIFICATION ===" -ForegroundColor Cyan
    Write-Host "icon-192.png: $(if($icon192){'✓ Found'}else{'✗ Missing'})" -ForegroundColor $(if($icon192){'Green'}else{'Red'})
    Write-Host "icon-512.png: $(if($icon512){'✓ Found'}else{'✗ Missing'})" -ForegroundColor $(if($icon512){'Green'}else{'Red'})
    Write-Host "favicon.ico:  $(if($favicon){'✓ Found'}else{'✗ Missing'})" -ForegroundColor $(if($favicon){'Green'}else{'Red'})
    Write-Host ""
    
    if ($icon192 -and $icon512 -and $favicon) {
        Write-Host "✓ All icons generated successfully!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Next steps:" -ForegroundColor Yellow
        Write-Host "1. Commit the files: git add public/ && git commit -m 'Add icons'" -ForegroundColor Cyan
        Write-Host "2. Push to deploy: git push" -ForegroundColor Cyan
        Write-Host "   OR deploy with Vercel CLI: vercel --prod" -ForegroundColor Cyan
    } else {
        Write-Host "Some icons are missing. Please generate them manually." -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Script complete!" -ForegroundColor Green
