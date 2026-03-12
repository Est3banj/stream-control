# Generar Iconos PWA

Los iconos son necesarios para que la PWA funcione correctamente.

## Opción 1: Usar el generador HTML (Recomendado)

1. Abre el archivo `generate-icons.html` en tu navegador
2. Haz clic en "Generar Iconos"
3. Los archivos `icon-192.png` e `icon-512.png` se descargarán automáticamente
4. Mueve estos archivos a la carpeta `/public` del proyecto

## Opción 2: Usar ImageMagick (si está instalado)

```bash
cd public
./create-simple-icons.sh
```

## Opción 3: Crear manualmente

Crea dos archivos PNG:
- `icon-192.png` (192x192 píxeles)
- `icon-512.png` (512x512 píxeles)

Con el diseño de tu preferencia usando los colores del tema:
- Violeta: #6B21A8
- Azul: #3B82F6
- Cian: #06B6D4

## Nota

Los archivos SVG creados (`icon-192.svg` e `icon-512.svg`) son solo placeholders.
Debes generar los PNGs usando una de las opciones anteriores.





