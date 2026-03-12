#!/bin/bash
# Script para crear iconos simples usando ImageMagick o crear placeholders

if command -v convert &> /dev/null; then
    # Usar ImageMagick si está disponible
    convert -size 192x192 xc:"#6B21A8" -fill "#3B82F6" -draw "circle 96,96 96,20" -fill white -pointsize 60 -gravity center -annotate +0+0 "SC" icon-192.png
    convert -size 512x512 xc:"#6B21A8" -fill "#3B82F6" -draw "circle 256,256 256,50" -fill white -pointsize 160 -gravity center -annotate +0+0 "SC" icon-512.png
    echo "Iconos creados con ImageMagick"
else
    # Crear archivos SVG como placeholder
    cat > icon-192.svg << SVGEOF
<svg width="192" height="192" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#6B21A8;stop-opacity:1" />
      <stop offset="50%" style="stop-color:#3B82F6;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#06B6D4;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="192" height="192" fill="url(#grad)"/>
  <circle cx="96" cy="96" r="60" fill="rgba(255,255,255,0.2)" stroke="rgba(255,255,255,0.5)" stroke-width="4"/>
  <text x="96" y="110" font-family="Arial" font-size="60" font-weight="bold" fill="white" text-anchor="middle">SC</text>
</svg>
SVGEOF
    cat > icon-512.svg << SVGEOF
<svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#6B21A8;stop-opacity:1" />
      <stop offset="50%" style="stop-color:#3B82F6;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#06B6D4;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="url(#grad)"/>
  <circle cx="256" cy="256" r="160" fill="rgba(255,255,255,0.2)" stroke="rgba(255,255,255,0.5)" stroke-width="10"/>
  <text x="256" y="290" font-family="Arial" font-size="160" font-weight="bold" fill="white" text-anchor="middle">SC</text>
</svg>
SVGEOF
    echo "Iconos SVG creados. Abre generate-icons.html en tu navegador para generar PNGs."
fi
