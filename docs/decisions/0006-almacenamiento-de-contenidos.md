# ADR-0006: Almacenamiento de los contenidos de clase

## Status
Propuesta

## Date
2026-09-21

## Context
La clienta confirmó (2026-09-21) que el contenido de las clases son **archivos que sube el capacitador o la empresa**; la plataforma aporta la estructura (Diagnóstico → Clase → Monitoreo) y los ordena. Hasta ahora el sistema no guarda archivos.

Restricciones del proyecto: sin herramientas de pago, desarrollo 100% local por ahora, y material que puede ser interno y sensible de cada empresa (Ley 21.719: los archivos de una empresa no pueden quedar accesibles a otra).

## Decision
- **Interfaz `AlmacenamientoArchivos`** con dos implementaciones: **disco** (por defecto) y, cuando el volumen lo justifique, **S3 compatible**. El resto del código no sabe cuál está activa.
- **En desarrollo:** carpeta local del repositorio, ignorada por git. **En el piloto:** volumen persistente del proveedor (Railway y Render ofrecen discos).
- **Los archivos NO se sirven directo desde una URL pública.** Se descargan por un endpoint de la API que verifica sesión, permisos y empresa, igual que cualquier otro dato.
- **Validación de lo que se sube:**
  - Tipos permitidos: PDF, Word, PowerPoint, Excel, imágenes (PNG/JPG) y video MP4 **[P]**.
  - Tamaño máximo por archivo: 50 MB **[P]**.
  - Se valida el contenido real del archivo (bytes de cabecera), no el tipo que declara el navegador.
  - En disco se guarda con un nombre aleatorio; el nombre original queda en la base de datos. Así un nombre malicioso no puede escaparse de la carpeta.
  - La descarga fuerza `Content-Disposition: attachment`, para que un archivo HTML subido no se ejecute en el navegador de quien lo abre.
- **Metadatos en Postgres** (`MaterialClase`): curso, etapa, nombre original, tipo, tamaño, quién lo subió y cuándo. Subir y descargar quedan en la auditoría.

## Alternatives Considered
- **MinIO local:** era la opción natural para simular S3, pero dejó de publicar su imagen en Docker Hub y cambió su licencia y su consola en 2025. Rechazado por riesgo de mantenimiento.
- **Guardar los archivos en Postgres:** evita infraestructura, pero infla la base y sus respaldos, y complica servir videos. Rechazado.
- **Almacenamiento en la nube desde ya (Cloudflare R2, Backblaze B2, Supabase):** es lo correcto a escala, pero exige contratar y configurar un proveedor antes de tener el flujo funcionando. Se pospone: la interfaz deja el cambio en una sola clase.
- **Servir los archivos con URL pública firmada:** más rápido, pero saca el control de acceso de la API. Rechazado mientras el material sea interno de cada empresa.

## Consequences
- El piloto necesita un disco persistente en el proveedor; si el plan gratuito no lo incluye, se activa el adaptador S3.
- **Antivirus fuera de alcance del semestre:** nadie analiza los archivos subidos. Antes de un uso real con varias empresas hay que sumar un análisis (por ejemplo ClamAV) o restringir aún más los tipos. Queda registrado como riesgo conocido.
- Falta definir con la clienta si hay un límite de espacio por empresa.
