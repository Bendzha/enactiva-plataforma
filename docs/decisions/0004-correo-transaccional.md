# ADR-0004: Correo transaccional

## Status
Propuesta — proveedor por elegir

## Date
2026-09-15

## Context
La clienta confirmó que agregar una empresa debe enviar un **correo real de invitación** al contacto RRHH. ENACTIVA tiene dominio propio. Sin SPF, DKIM y DMARC configurados en ese dominio, los correos caen en spam.

## Decision
- Un `MailerService` con interfaz propia (`enviarInvitacion(...)`) y un adaptador **SMTP** (nodemailer), para que el proveedor sea intercambiable sin tocar la lógica de negocio.
- **Desarrollo local y CI:** Mailpit en Docker. Captura todos los correos y nunca envía reales.
- **Producción:** proveedor transaccional con SMTP y DKIM, enviando desde un **subdominio** (ej. `notificaciones.<dominio>`) para no afectar la reputación del correo corporativo de ENACTIVA. Se elige al llegar al despliegue del Slice 1, verificando límites y precios vigentes en la documentación oficial.
- El envío ocurre **después** de confirmar la transacción que crea empresa + usuario + token. Si falla, la invitación queda creada y el Admin puede **reenviarla** (nuevo token; el anterior se revoca).

## Alternatives Considered
- **Link manual copiado por el Admin:** descartado por la clienta.
- **Enviar desde la cuenta de correo corporativa de ENACTIVA vía SMTP:** límites diarios y riesgo para la cuenta. Rechazado.
- **Cola de mensajes (outbox + worker):** robusto, pero excesivo para decenas de invitaciones en un piloto. Se reevalúa si aparecen más tipos de correo.

## Consequences
- Mientras el proyecto se trabaje solo en local (decisión 2026-09-15), todos los correos van a Mailpit; no se contrata proveedor.
- Antes de publicar, alguien de ENACTIVA debe agregar registros DNS (SPF, DKIM, DMARC) en su dominio (SPEC Q1).
