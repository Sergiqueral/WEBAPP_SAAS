# 📖 Historial de Decisiones Arquitectónicas (ADRs) - Gorila SaaS

Este documento recopila las decisiones de arquitectura, diseño y tecnología adoptadas en **Gorila SaaS**, junto con el contexto, las alternativas evaluadas y las consecuencias de cada decisión.

---

## Índice de Decisiones (ADR)

*   [ADR-001: Motor de Autenticación Soberano (Better Auth)](#adr-001-motor-de-autenticación-soberano-better-auth)
*   [ADR-002: Biología del Dato - Modelo Átomos y Sinapsis (Codex)](#adr-002-biología-del-dato---modelo-átomos-y-sinapsis-codex)
*   [ADR-003: Servidor de Correo Transaccional (Google Workspace SMTP)](#adr-003-servidor-de-correo-transaccional-google-workspace-smtp)
*   [ADR-004: Unificación de Temas y Diseño Semántico con Shadcn/UI](#adr-004-unificación-de-temas-y-diseño-semántico-con-shadcnui)
*   [ADR-005: Consola de Administración Dedicada para Superadmin](#adr-005-consola-de-administración-dedicada-para-superadmin)
*   [ADR-006: Principios de Arquitectura Offline-First y Hoja de Ruta Móvil](#adr-006-principios-de-arquitectura-offline-first-y-hoja-de-ruta-móvil)
*   [ADR-007: Infraestructura de Producción, Despliegue Continuo y Lefthook](#adr-007-infraestructura-de-producción-despliegue-continuo-y-lefthook)

---

### ADR-001: Motor de Autenticación Soberano (Better Auth)
*   **Fecha:** Octubre 2026
*   **Estado:** Aceptado e Implementado
*   **Contexto:** El proyecto requería autenticación multi-inquilino (organizaciones, miembros, roles), inicio de sesión con contraseña tradicional y proveedores sociales (Google OAuth), sin incurrir en costes recurrentes de terceros (como Clerk, Auth0 o Supabase Auth).
*   **Decisión:** Adoptar **Better Auth** con almacenamiento directo en la base de datos PostgreSQL mediante Drizzle ORM.
*   **Consecuencias Positivas:**
    *   Coste 0€ en capas de autenticación de terceros.
    *   Control total sobre los esquemas de tablas (`user`, `session`, `account`, `organization`, `member`).
    *   Soporte nativo tanto para cookies en el navegador como para cabeceras `Authorization: Bearer <token>` consumibles por futuras apps móviles.
    *   Gestión de organizaciones y miembros nativa integrada en el core.

---

### ADR-002: Biología del Dato - Modelo Átomos y Sinapsis (Codex)
*   **Fecha:** Octubre 2026
*   **Estado:** Aceptado e Implementado
*   **Contexto:** Un SaaS modular como Gorila necesita gestionar clientes, tareas, eventos, notas, contactos y futuras entidades de negocio sin tener que realizar migraciones complejas de esquemas SQL en cada nueva funcionalidad.
*   **Decisión:** Diseñar el módulo **Codex** con un esquema de base de datos polimórfico basado en dos tablas principales:
    *   `atoms`: Identificador UUIDv4, tipo (`type`), datos flexibles (`payload: jsonb`) y metadatos (`metadata: jsonb`).
    *   `links`: Grafo de relaciones dirigidas (`sourceAtomId` -> `targetAtomId`) con tipo de relación (`relationType`).
*   **Consecuencias Positivas:**
    *   Flexibilidad total: Nuevos tipos de datos no requieren migraciones DDL de PostgreSQL.
    *   Consultas ultrarrápidas mediante índices GIN sobre el payload JSONB e índices B-Tree en relaciones.
    *   Desacoplamiento mediante el patrón Repositorio (`AtomRepository`, `SynapseRepository`, `MoleculeRepository`).

---

### ADR-003: Servidor de Correo Transaccional (Google Workspace SMTP)
*   **Fecha:** Octubre 2026
*   **Estado:** Aceptado e Implementado
*   **Contexto:** Para la verificación de correos de nuevos usuarios y avisos del sistema, se evaluaron dos alternativas: Hostinger Email vs Google Workspace (`serveix.me`). Hostinger presentaba limitaciones de coste por buzón tras el periodo de prueba y trampas de renovación. Google Workspace ya estaba contratado para el dominio corporativo y permite alias y grupos ilimitados sin coste adicional.
*   **Decisión:** Configurar **Nodemailer** apuntando a `smtp.gmail.com` (puerto 465 SSL) utilizando una contraseña de aplicación generada en la cuenta administradora de Google Workspace, utilizando la dirección oficial `soporte@serveix.me` / `info@serveix.me`.
*   **Consecuencias Positivas:**
    *   0€ de coste adicional en infraestructura de email.
    *   Máxima entregabilidad (reputación de IPs de Google, DKIM/SPF corporativo configurado en Workspace).
    *   Recepción centralizada de respuestas en el buzón de soporte.

---

### ADR-004: Unificación de Temas y Diseño Semántico con Shadcn/UI
*   **Fecha:** Octubre 2026
*   **Estado:** Aceptado e Implementado
*   **Contexto:** Existían incoherencias visuales provocadas por clases de fondo oscuro forzadas (`bg-zinc-950`, `border-zinc-800`, textos blancos fijos) mezcladas con la paleta original del SaaS, lo que causaba que en Modo Claro se vieran bloques oscuros o contrastes deficientes.
*   **Decisión:**
    *   Eliminar todos los estilos oscuros fijos de formularios de autenticación, tarjetas y perfiles.
    *   Adoptar de forma rigurosa los tokens semánticos de Shadcn (`bg-card`, `border-border`, `text-card-foreground`, `text-muted-foreground`).
    *   Implementar el componente global `ThemeToggle.tsx` en el encabezado del panel de control para permitir alternar libremente entre **Modo Claro**, **Modo Oscuro** y **Preferencia del Sistema**.
*   **Consecuencias Positivas:**
    *   Coherencia visual del 100% en todas las vistas de la aplicación.
    *   Cumplimiento de estándares de accesibilidad y contraste WCAG.

---

### ADR-005: Consola de Administración Dedicada para Superadmin
*   **Fecha:** Octubre 2026
*   **Estado:** Aceptado e Implementado
*   **Contexto:** La cuenta fundadora `squeral@serveix.me` requería una consola operativa para gestionar la plataforma (verificar o desverificar usuarios, cambiar planes de suscripción, proteger organizaciones contra purgas, gestionar membresías y auditar la infraestructura).
*   **Decisión:**
    *   Crear la ruta `/dashboard/admin` (Server Component protegido).
    *   Implementar endpoints API REST dedicados bajo `/api/v1/admin/*` (`overview`, `users`, `organizations`, `memberships`).
    *   Implementar blindaje de seguridad: nadie puede auto-eliminarse ni degradar a las cuentas `@serveix.me`, ni eliminar la organización maestra `org_serveix_master`.
*   **Consecuencias Positivas:**
    *   Herramienta operativa completa sin necesidad de acceder a la consola de base de datos ni a SSH para tareas rutinarias.
    *   Supervisión en tiempo real de la salud del motor (DB, SMTP, OAuth).

---

### ADR-006: Principios de Arquitectura Offline-First y Hoja de Ruta Móvil
*   **Fecha:** Octubre 2026
*   **Estado:** Aceptado y Establecido como Directriz
*   **Contexto:** A futuro se desarrollará una app móvil para Android (inicialmente) y luego iOS. Dicha app debe permitir el trabajo en campo sin conexión a internet (offline-first), acceso a sensores del terminal (geolocalización GPS, llamadas telefónicas directas, cámara) y sincronización diferida automática al recuperar cobertura.
*   **Decisiones Arquitectónicas Adoptadas:**
    1.  **Generación de IDs en Cliente (UUIDv4):** Ninguna tabla de negocio utilizará `serial()` autoincremental. Toda entidad generará su identificador en el cliente con UUIDv4 para permitir la creación local offline sin colisiones.
    2.  **Soporte de Soft Deletes:** Prohibido el borrado destructivo (`DELETE`) en entidades sincronizables. Se reservará `deletedAt` / `isDeleted` para que el protocolo de sincronización incremental (*Delta Sync*) pueda propagar eliminaciones a las bases de datos locales SQLite.
    3.  **Trazabilidad Temporal:** Uso estricto de `createdAt` y `updatedAt` para consultas de delta (`/api/v1/sync?since=TIMESTAMP`).
    4.  **Stack Móvil Designado:** **React Native con Expo (TypeScript)** + motor de base de datos embebido **WatermelonDB / SQLite**. Permite compartir tipos TypeScript, esquemas Zod y lógica de dominio con el SaaS web.
*   **Consecuencias Positivas:**
    *   Cero deuda técnica en la base de datos actual de cara al desarrollo móvil.
    *   Transición fluida a la app móvil sin necesidad de rehacer el backend.

---

### ADR-007: Infraestructura de Producción, Despliegue Continuo y Lefthook
*   **Fecha:** Octubre 2026
*   **Estado:** Aceptado e Implementado
*   **Contexto:** Para garantizar la estabilidad del software y evitar desplegar código roto o dependencias huérfanas en el entorno productivo de Google Cloud.
*   **Decisión:**
    *   Configurar Lefthook para validar en cada commit local: `npm run lint`, `npm run check-types`, `npm run check:deps` (Knip), `npm run test` (Vitest) y `commitlint`.
    *   Entorno de producción en Google Cloud Compute Engine bajo el proceso PM2 `webapp-saas`, conectado a la rama `tester`.
    *   Protocolo de despliegue directo en servidor:
        `git pull origin tester && npm run build:next && pm2 restart webapp-saas --update-env`
*   **Consecuencias Positivas:**
    *   Imposibilidad de subir código con errores de TypeScript o sintaxis rota.
    *   Despliegue predecible y reproducible en segundos con cero tiempo de inactividad visible.
