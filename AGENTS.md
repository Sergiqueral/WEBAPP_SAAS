# 🦍 GORILA SAAS - AGENTS.MD (Project Constitution & Engineering Guidelines)

> **Documento de lectura obligatoria para cualquier Agente de IA o Desarrollador.**  
> Este documento define la arquitectura, las verdades inmutables, las reglas de codificación y los procedimientos operativos estándar para el repositorio **WEBAPP_SAAS** (Gorila SaaS / Serveix).

---

## 1. 🏛️ Identidad del Proyecto y Verdades Inmutables

1. **Superadministrador del Sistema:**
   - La cuenta soberana y fundadora es `squeral@serveix.me` (y cualquier cuenta bajo el dominio `@serveix.me`).
   - Posee privilegios de superadministrador globales (`isSuperadmin: true`), bypass de validaciones, inmunidad total contra borrado/purga y acceso exclusivo a `/dashboard/admin`.
   - **Regla:** Ningún endpoint o script puede permitir auto-eliminar, degradar o bloquear cuentas `@serveix.me`.

2. **Infraestructura de Producción:**
   - **Servidor:** Google Cloud Compute Engine (Debian VM en IP `104.197.236.170`).
   - **Dominio Público:** `https://gorila.serveix.work` (Proxy Nginx con SSL Let's Encrypt).
   - **Gestor de Procesos:** PM2 (proceso `webapp-saas`, PID monitorizado).
   - **Rama de Producción/Despliegue:** `tester`.
   - **Comando Estándar de Despliegue en VM:**  
     `git pull origin tester && npm run build:next && pm2 restart webapp-saas --update-env`

3. **Comunicaciones Transaccionales (Google Workspace SMTP 0€ extra):**
   - El sistema de correos de verificación y notificaciones opera vía SMTP de Google Workspace (`smtp.gmail.com:465`, SSL).
   - Utiliza contraseñas de aplicación generadas desde la cuenta administradora de Google Workspace.
   - Remitente oficial: `Gorila SaaS <soporte@serveix.me>` (o `info@serveix.me`).

4. **Multi-inquilino Estricto (Tenant Isolation):**
   - Toda entidad de datos y operación de negocio pertenece a una Organización (`organizationId`).
   - **Regla:** Ninguna consulta o mutación puede realizarse sin resolver y validar previamente el contexto del inquilino (`tenantContext`) mediante `resolveTenantContext(userId, orgId, orgRole)`.

---

## 2. 🧬 Estructura de Datos y Preparación Offline-First (Módulo Codex)

El sistema utiliza el paradigma **Biología del Dato (Gorila Codex)**: en lugar de crear docenas de tablas monolíticas rígidas, los datos se estructuran como un grafo reactivo de **Átomos y Sinapsis**.

### Reglas Críticas para la Base de Datos:
1. **IDs Siempre Generados por el Cliente (UUIDv4):**
   - **Queda estrictamente prohibido usar IDs autoincrementales (`serial()`) para entidades sincronizables.**
   - Todas las entidades usan `text('id').primaryKey().$defaultFn(() => crypto.randomUUID())`.
   - *Razón:* Permite que la futura aplicación móvil cree tareas, clientes o notas en modo **offline** sin esperar al servidor y sin peligro de colisión de identificadores.

2. **Trazabilidad y Delta Sync:**
   - Todo registro mutable debe incluir `createdAt` y `updatedAt`.
   - `updatedAt` debe actualizarse automáticamente en cada modificación (`$onUpdate(() => new Date())`).
   - La sincronización móvil se realiza de forma incremental (`since=TIMESTAMP`).

3. **Prohibido el Borrado Destructivo en Datos Maestros (Soft Deletes):**
   - En entidades sincronizables (`atoms`, `links`, etc.), no se debe ejecutar `DELETE FROM` directo.
   - Se debe utilizar borrado lógico (`deletedAt: timestamp` o `isDeleted: boolean`) para que los clientes offline que sincronicen horas o días después puedan recibir la instrucción de eliminar el registro en su base de datos local SQLite.

4. **Payload Dinámico (`jsonb`):**
   - Los átomos almacenan sus campos en columnas `jsonb` (`payload` y `metadata`).
   - Las modificaciones deben realizarse mediante fusiones de parches (*JSON patch / shallow merge*) para evitar sobreescrituras destructivas entre diferentes usuarios o dispositivos.

---

## 3. 🎨 Frontend, UX y Modo Oscuro (Tokens Semánticos)

1. **Uso Obligatorio de Tokens Semánticos de Shadcn / Tailwind:**
   - **Prohibido:** Hardcodear fondos oscuros (`bg-zinc-900`, `bg-zinc-950`, `bg-black`) o textos claros fijos (`text-white`) en componentes compartidos.
   - **Obligatorio:** Utilizar variables semánticas:
     - Fondos: `bg-background`, `bg-card`, `bg-popover`, `bg-muted`.
     - Textos: `text-foreground`, `text-card-foreground`, `text-muted-foreground`.
     - Bordes: `border-border`, `border-input`.
   - Esto garantiza que la aplicación se adapte de forma nativa e impecable tanto en **Modo Claro** como en **Modo Oscuro**.

2. **Aislamiento Estricto Cliente / Servidor (Zero Leaks):**
   - Los componentes cliente (`"use client"`) **NUNCA** deben importar módulos o barriles raíz (`index.ts`) que exporten código con dependencias de Node.js (`fs`, `net`, `tls`, `@/libs/DB.ts`, `pg`).
   - Importar siempre directamente desde el submódulo específico de dominio:
     - Bien: `import { useCodexPreferences } from '@/modules/codex/domain/preferences/useCodexPreferences'`
     - Mal: `import { useCodexPreferences } from '@/modules/codex'` (rompe el empaquetador del navegador).

---

## 4. 📱 Hoja de Ruta de la App Móvil (Android & iOS)

Cuando se inicie el desarrollo de la aplicación móvil:
1. **Stack Oficial:** **React Native con Expo (TypeScript)**.
   - Permite compartir el 100% de los esquemas Zod, tipos TypeScript y utilidades del SaaS web.
   - Compila de forma unificada para Android (`.apk` / `.aab`) e iOS (`.ipa`).
2. **Base de Datos Local Offline:** **WatermelonDB** o **SQLite nativo**.
   - Los datos se consultan y guardan instantáneamente en local.
   - Una cola de mutaciones en segundo plano (*Sync Queue*) envía los cambios a `/api/v1/sync` en cuanto se recupera la cobertura de red.
3. **Integración con Hardware del Dispositivo:**
   - **Llamadas telefónicas:** Protocolo `tel:${numero}` mediante el marcador nativo del sistema.
   - **Coordenadas GPS:** `expo-location` almacenando `{ lat, lng, accuracy, timestamp }` directamente en el `payload` del átomo.
   - **Cámara y Almacenamiento:** Captura de fotos/recibos y subida en diferido.

---

## 5. 🛡️ Calidad de Código y Validación Pre-Commit

Antes de considerar cualquier tarea o cambio como terminado, el código debe superar obligatoriamente:
1. **Verificación de Tipos TypeScript:** `npm run check:types` (`tsc --noEmit`) -> **0 errores**.
2. **Linter:** `npm run lint` (`eslint`) -> **0 errores**.
3. **Dependencias Huérfanas:** `npm run check:deps` (`knip`) -> **0 dependencias no resueltas**.
4. **Pruebas Unitarias:** `npm run test` (`vitest`) -> **100% de tests aprobados**.
5. **Compilación de Next.js:** `npm run build:next` -> Compilación limpia sin errores de cliente/servidor.
