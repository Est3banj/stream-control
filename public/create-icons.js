const fs = require('fs');
const { createCanvas } = require('canvas');

const sizes = [192, 512];

sizes.forEach(size => {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');
    
    // Fondo con gradiente
    const gradient = ctx.createLinearGradient(0, 0, size, size);
    gradient.addColorStop(0, '#6B21A8');
    gradient.addColorStop(0.5, '#3B82F6');
    gradient.addColorStop(1, '#06B6D4');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    
    // Círculo central
    const center = size / 2;
    const radius = size * 0.35;
    ctx.beginPath();
    ctx.arc(center, center, radius, 0, 2 * Math.PI);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = size * 0.02;
    ctx.stroke();
    
    // Texto "SC"
    ctx.fillStyle = 'white';
    ctx.font = `bold ${size * 0.3}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SC', center, center);
    
    // Guardar
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(`icon-${size}.png`, buffer);
    console.log(`✓ Creado icon-${size}.png`);
});

console.log('Iconos generados exitosamente!');
