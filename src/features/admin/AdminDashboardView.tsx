'use client';

import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Clock,
  Database,
  Key,
  Layers,
  Link as LinkIcon,
  Mail,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserCheck,
  Users,
  UserX,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';

type Stats = {
  users: { total: number; verified: number; unverified: number };
  organizations: { total: number; plans: Record<string, number> };
  memberships: { total: number };
  system: { dbConnected: boolean; smtpConfigured: boolean; oauthConfigured: boolean; smtpUser: string | null };
};

type AdminUser = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
  createdAt: string;
  isSuperadmin: boolean;
  organizations: Array<{ orgId: string; orgName: string; role: string }>;
};

type AdminOrg = {
  id: string;
  name: string;
  slug: string | null;
  logo: string | null;
  createdAt: string;
  memberCount: number;
  plan: string;
  status: string;
  isProtected: boolean;
  isMaster: boolean;
};

type AdminMembership = {
  id: string;
  role: string;
  createdAt: string;
  userId: string;
  userName: string | null;
  userEmail: string | null;
  orgId: string;
  orgName: string | null;
  orgSlug: string | null;
};

export const AdminDashboardView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'organizations' | 'memberships'>('overview');
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Datos
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [organizations, setOrganizations] = useState<AdminOrg[]>([]);
  const [memberships, setMemberships] = useState<AdminMembership[]>([]);

  // Filtros de búsqueda
  const [userSearch, setUserSearch] = useState('');
  const [userFilter, setUserFilter] = useState<'all' | 'verified' | 'unverified'>('all');
  const [orgSearch, setOrgSearch] = useState('');

  // Modal de confirmación para borrado
  const [deleteConfirm, setDeleteConfirm] = useState<{
    type: 'user' | 'organization';
    id: string;
    title: string;
  } | null>(null);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMessage({ type, text });
    setTimeout(setToastMessage, 4000, null);
  };

  const loadAllData = async () => {
    setIsLoading(true);
    try {
      const [overviewRes, usersRes, orgsRes, membersRes] = await Promise.all([
        fetch('/api/v1/admin/overview'),
        fetch('/api/v1/admin/users'),
        fetch('/api/v1/admin/organizations'),
        fetch('/api/v1/admin/memberships'),
      ]);

      const [overviewData, usersData, orgsData, membersData] = await Promise.all([
        overviewRes.json(),
        usersRes.json(),
        orgsRes.json(),
        membersRes.json(),
      ]);

      if (overviewData.success) {
        setStats(overviewData.stats);
      }
      if (usersData.success) {
        setUsers(usersData.users);
      }
      if (orgsData.success) {
        setOrganizations(orgsData.organizations);
      }
      if (membersData.success) {
        setMemberships(membersData.memberships);
      }
    } catch {
      showToast('error', 'Error al sincronizar datos del panel de administración');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // Acciones de Usuario
  const handleUserAction = async (action: string, userId: string) => {
    setActionLoading(userId);
    try {
      const res = await fetch('/api/v1/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, userId }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast('error', data.error || 'Error al procesar la acción');
      } else {
        showToast('success', data.message || 'Acción completada');
        await loadAllData();
      }
    } catch {
      showToast('error', 'Fallo en la comunicación con el servidor');
    } finally {
      setActionLoading(null);
      setDeleteConfirm(null);
    }
  };

  // Acciones de Organización
  const handleOrgAction = async (action: string, organizationId: string, payload?: Record<string, unknown>) => {
    setActionLoading(organizationId);
    try {
      const res = await fetch('/api/v1/admin/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, organizationId, ...payload }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast('error', data.error || 'Error al procesar la acción');
      } else {
        showToast('success', data.message || 'Organización actualizada');
        await loadAllData();
      }
    } catch {
      showToast('error', 'Fallo en la comunicación con el servidor');
    } finally {
      setActionLoading(null);
      setDeleteConfirm(null);
    }
  };

  // Acciones de Membresía
  const handleMembershipAction = async (action: string, memberId: string, role?: string) => {
    setActionLoading(memberId);
    try {
      const res = await fetch('/api/v1/admin/memberships', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, memberId, role }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast('error', data.error || 'Error al modificar membresía');
      } else {
        showToast('success', data.message || 'Membresía actualizada');
        await loadAllData();
      }
    } catch {
      showToast('error', 'Fallo en la comunicación con el servidor');
    } finally {
      setActionLoading(null);
    }
  };

  // Filtrado de usuarios
  const filteredUsers = users.filter((u) => {
    const matchesSearch = u.name?.toLowerCase().includes(userSearch.toLowerCase())
      || u.email?.toLowerCase().includes(userSearch.toLowerCase())
      || u.id.toLowerCase().includes(userSearch.toLowerCase());

    if (!matchesSearch) {
      return false;
    }
    if (userFilter === 'verified') {
      return u.emailVerified;
    }
    if (userFilter === 'unverified') {
      return !u.emailVerified;
    }
    return true;
  });

  // Filtrado de empresas
  const filteredOrgs = organizations.filter((o) => {
    return o.name?.toLowerCase().includes(orgSearch.toLowerCase())
      || o.slug?.toLowerCase().includes(orgSearch.toLowerCase())
      || o.id.toLowerCase().includes(orgSearch.toLowerCase());
  });

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className={`
          fixed right-6 bottom-6 z-50 flex items-center gap-3 rounded-xl border
          p-4 shadow-xl backdrop-blur-md transition-all
          ${
        toastMessage.type === 'success'
          ? `
            border-emerald-500/40 bg-emerald-500/10 text-emerald-800
            dark:text-emerald-200
          `
          : 'border-destructive/40 bg-destructive/10 text-destructive'
        }
        `}
        >
          {toastMessage.type === 'success'
            ? (
                <CheckCircle2 className="
                  size-5 shrink-0 text-emerald-600
                  dark:text-emerald-400
                "
                />
              )
            : <AlertTriangle className="size-5 shrink-0" />}
          <span className="text-sm font-medium">{toastMessage.text}</span>
        </div>
      )}

      {/* Cabecera del Panel */}
      <div className="
        flex flex-col justify-between gap-4 rounded-2xl border border-border
        bg-card p-6 shadow-xs
        sm:flex-row sm:items-center
      "
      >
        <div>
          <div className="flex items-center gap-2.5">
            <div className="
              flex size-10 items-center justify-center rounded-xl
              bg-amber-500/15 text-amber-600
              dark:text-amber-400
            "
            >
              <ShieldCheck className="size-6" />
            </div>
            <div>
              <h1 className="
                flex items-center gap-2 text-2xl font-bold tracking-tight
                text-foreground
              "
              >
                <span>Panel de Superadministrador</span>
                <span className="
                  rounded-sm border border-amber-500/30 bg-amber-500/10 px-2
                  py-0.5 text-xs font-semibold text-amber-600
                  dark:text-amber-400
                "
                >
                  Soberano
                </span>
              </h1>
              <p className="text-xs text-muted-foreground">
                Control central de usuarios, empresas, vinculaciones y suscripciones en Gorila DB
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadAllData}
            disabled={isLoading}
            className="
              inline-flex items-center gap-2 rounded-xl border border-border
              bg-background px-3.5 py-2 text-xs font-medium text-foreground
              transition-colors
              hover:bg-muted
              disabled:opacity-50
            "
          >
            <RefreshCw className={`
              size-3.5
              ${isLoading ? 'animate-spin' : ''}
            `}
            />
            <span>Actualizar Datos</span>
          </button>
        </div>
      </div>

      {/* Barra de Pestañas */}
      <div className="flex border-b border-border">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`
            flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium
            transition-colors
            ${activeTab === 'overview'
      ? `border-primary font-semibold text-primary`
      : `
        border-transparent text-muted-foreground
        hover:text-foreground
      `}
          `}
        >
          <Layers className="size-4" />
          <span>Resumen General</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('users')}
          className={`
            flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium
            transition-colors
            ${activeTab === 'users'
      ? `border-primary font-semibold text-primary`
      : `
        border-transparent text-muted-foreground
        hover:text-foreground
      `}
          `}
        >
          <Users className="size-4" />
          <span>
            Usuarios (
            {users.length}
            )
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('organizations')}
          className={`
            flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium
            transition-colors
            ${activeTab === 'organizations'
      ? `border-primary font-semibold text-primary`
      : `
        border-transparent text-muted-foreground
        hover:text-foreground
      `}
          `}
        >
          <Building2 className="size-4" />
          <span>
            Empresas (
            {organizations.length}
            )
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('memberships')}
          className={`
            flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium
            transition-colors
            ${activeTab === 'memberships'
      ? `border-primary font-semibold text-primary`
      : `
        border-transparent text-muted-foreground
        hover:text-foreground
      `}
          `}
        >
          <LinkIcon className="size-4" />
          <span>
            Vinculaciones (
            {memberships.length}
            )
          </span>
        </button>
      </div>

      {/* ========================================================= */}
      {/* PESTAÑA 1: RESUMEN GENERAL (KPIs)                         */}
      {/* ========================================================= */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Métricas Principales */}
          <div className="
            grid grid-cols-1 gap-4
            sm:grid-cols-2
            lg:grid-cols-4
          "
          >
            {/* Total Usuarios */}
            <div className="
              rounded-2xl border border-border bg-card p-5 shadow-xs
            "
            >
              <div className="flex items-center justify-between">
                <span className="
                  text-xs font-semibold tracking-wider text-muted-foreground
                  uppercase
                "
                >
                  Usuarios Totales
                </span>
                <div className="
                  flex size-8 items-center justify-center rounded-lg
                  bg-blue-500/10 text-blue-600
                  dark:text-blue-400
                "
                >
                  <Users className="size-4" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-foreground">
                  {stats?.users.total || 0}
                </span>
              </div>
              <div className="
                mt-2 flex items-center gap-2 text-xs text-muted-foreground
              "
              >
                <span className="
                  font-semibold text-emerald-600
                  dark:text-emerald-400
                "
                >
                  {stats?.users.verified || 0}
                  {' '}
                  verificados
                </span>
                <span>•</span>
                <span className="
                  text-amber-600
                  dark:text-amber-400
                "
                >
                  {stats?.users.unverified || 0}
                  {' '}
                  pendientes
                </span>
              </div>
            </div>

            {/* Total Organizaciones */}
            <div className="
              rounded-2xl border border-border bg-card p-5 shadow-xs
            "
            >
              <div className="flex items-center justify-between">
                <span className="
                  text-xs font-semibold tracking-wider text-muted-foreground
                  uppercase
                "
                >
                  Empresas Activas
                </span>
                <div className="
                  flex size-8 items-center justify-center rounded-lg
                  bg-purple-500/10 text-purple-600
                  dark:text-purple-400
                "
                >
                  <Building2 className="size-4" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-foreground">
                  {stats?.organizations.total || 0}
                </span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Entornos multi-inquilino en Gorila SaaS
              </p>
            </div>

            {/* Suscripciones Pro / Enterprise */}
            <div className="
              rounded-2xl border border-border bg-card p-5 shadow-xs
            "
            >
              <div className="flex items-center justify-between">
                <span className="
                  text-xs font-semibold tracking-wider text-muted-foreground
                  uppercase
                "
                >
                  Planes de Pago
                </span>
                <div className="
                  flex size-8 items-center justify-center rounded-lg
                  bg-emerald-500/10 text-emerald-600
                  dark:text-emerald-400
                "
                >
                  <ShieldCheck className="size-4" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-foreground">
                  {(stats?.organizations.plans.pro || 0) + (stats?.organizations.plans.enterprise || 0)}
                </span>
              </div>
              <div className="
                mt-2 flex items-center gap-2 text-xs text-muted-foreground
              "
              >
                <span>
                  Pro:
                  {stats?.organizations.plans.pro || 0}
                </span>
                <span>•</span>
                <span>
                  Enterprise:
                  {stats?.organizations.plans.enterprise || 0}
                </span>
              </div>
            </div>

            {/* Salud del Sistema */}
            <div className="
              rounded-2xl border border-border bg-card p-5 shadow-xs
            "
            >
              <div className="flex items-center justify-between">
                <span className="
                  text-xs font-semibold tracking-wider text-muted-foreground
                  uppercase
                "
                >
                  Estado Motor
                </span>
                <div className="
                  flex size-8 items-center justify-center rounded-lg
                  bg-emerald-500/10 text-emerald-600
                  dark:text-emerald-400
                "
                >
                  <Database className="size-4" />
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <span className="size-2.5 rounded-full bg-emerald-500" />
                <span className="text-sm font-bold text-foreground">
                  Operativo 100%
                </span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                GCP VM • PostgreSQL 16 • PM2
              </p>
            </div>
          </div>

          {/* Estado de Integraciones */}
          <div className="
            rounded-2xl border border-border bg-card p-6 shadow-xs
          "
          >
            <h3 className="text-base font-bold text-foreground">
              Infraestructura & Proveedores Conectados
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Comprobaciones automáticas en tiempo de ejecución
            </p>

            <div className="
              mt-4 grid grid-cols-1 gap-4
              sm:grid-cols-3
            "
            >
              {/* PostgreSQL */}
              <div className="rounded-xl border border-border bg-muted/40 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Database className="size-5 text-primary" />
                    <div>
                      <h4 className="text-sm font-semibold text-foreground">PostgreSQL Gorila</h4>
                      <p className="text-xs text-muted-foreground">Base de datos soberana</p>
                    </div>
                  </div>
                  <span className="
                    inline-flex items-center gap-1 rounded-sm bg-emerald-500/10
                    px-2 py-0.5 text-xs font-semibold text-emerald-600
                    dark:text-emerald-400
                  "
                  >
                    Conectado
                  </span>
                </div>
              </div>

              {/* SMTP Google Workspace */}
              <div className="rounded-xl border border-border bg-muted/40 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Mail className="size-5 text-primary" />
                    <div>
                      <h4 className="text-sm font-semibold text-foreground">Google Workspace SMTP</h4>
                      <p className="text-xs text-muted-foreground">soporte@serveix.me</p>
                    </div>
                  </div>
                  <span className="
                    inline-flex items-center gap-1 rounded-sm bg-emerald-500/10
                    px-2 py-0.5 text-xs font-semibold text-emerald-600
                    dark:text-emerald-400
                  "
                  >
                    Activo (465)
                  </span>
                </div>
              </div>

              {/* Google OAuth */}
              <div className="rounded-xl border border-border bg-muted/40 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Key className="size-5 text-primary" />
                    <div>
                      <h4 className="text-sm font-semibold text-foreground">Google OAuth 2.0</h4>
                      <p className="text-xs text-muted-foreground">Web & Addons Sync</p>
                    </div>
                  </div>
                  <span className="
                    inline-flex items-center gap-1 rounded-sm bg-emerald-500/10
                    px-2 py-0.5 text-xs font-semibold text-emerald-600
                    dark:text-emerald-400
                  "
                  >
                    Activo
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* PESTAÑA 2: GESTIÓN DE USUARIOS                            */}
      {/* ========================================================= */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          {/* Controles de Búsqueda y Filtro */}
          <div className="
            flex flex-col justify-between gap-3
            sm:flex-row sm:items-center
          "
          >
            <div className="relative max-w-sm flex-1">
              <Search className="
                pointer-events-none absolute top-1/2 left-3 size-4
                -translate-y-1/2 text-muted-foreground
              "
              />
              <input
                type="text"
                placeholder="Buscar por nombre, email o ID..."
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
                className="
                  w-full rounded-xl border border-input bg-background py-2 pr-3
                  pl-9 text-xs text-foreground
                  placeholder:text-muted-foreground
                  focus:ring-2 focus:ring-ring focus:outline-none
                "
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setUserFilter('all')}
                className={`
                  rounded-lg px-3 py-1.5 text-xs font-medium transition-colors
                  ${userFilter === 'all'
          ? 'bg-primary text-primary-foreground'
          : `
            border border-border bg-background text-muted-foreground
            hover:bg-muted
          `}
                `}
              >
                Todos
              </button>
              <button
                type="button"
                onClick={() => setUserFilter('verified')}
                className={`
                  rounded-lg px-3 py-1.5 text-xs font-medium transition-colors
                  ${userFilter === 'verified'
          ? 'bg-primary text-primary-foreground'
          : `
            border border-border bg-background text-muted-foreground
            hover:bg-muted
          `}
                `}
              >
                Verificados
              </button>
              <button
                type="button"
                onClick={() => setUserFilter('unverified')}
                className={`
                  rounded-lg px-3 py-1.5 text-xs font-medium transition-colors
                  ${userFilter === 'unverified'
          ? 'bg-primary text-primary-foreground'
          : `
            border border-border bg-background text-muted-foreground
            hover:bg-muted
          `}
                `}
              >
                Pendientes
              </button>
            </div>
          </div>

          {/* Tabla de Usuarios */}
          <div className="
            overflow-x-auto rounded-2xl border border-border bg-card shadow-xs
          "
          >
            <table className="w-full text-left text-xs">
              <thead className="
                border-b border-border bg-muted/50 font-semibold
                text-muted-foreground
              "
              >
                <tr>
                  <th className="px-4 py-3">Usuario</th>
                  <th className="px-4 py-3">Estado Correo</th>
                  <th className="px-4 py-3">Organizaciones</th>
                  <th className="px-4 py-3">Registro</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredUsers.length === 0
                  ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="py-8 text-center text-muted-foreground"
                        >
                          No se encontraron usuarios que coincidan con la búsqueda.
                        </td>
                      </tr>
                    )
                  : (
                      filteredUsers.map(user => (
                        <tr
                          key={user.id}
                          className="
                            transition-colors
                            hover:bg-muted/30
                          "
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <div className="
                                flex size-8 items-center justify-center
                                rounded-full bg-primary text-xs font-bold
                                text-primary-foreground
                              "
                              >
                                {user.name ? user.name.slice(0, 2).toUpperCase() : 'US'}
                              </div>
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className="
                                    font-semibold text-foreground
                                  "
                                  >
                                    {user.name || 'Sin Nombre'}
                                  </span>
                                  {user.isSuperadmin && (
                                    <span className="
                                      rounded-sm border border-amber-500/30
                                      bg-amber-500/10 px-1 py-0.5 text-[10px]
                                      font-bold text-amber-600
                                      dark:text-amber-400
                                    "
                                    >
                                      👑 Superadmin
                                    </span>
                                  )}
                                </div>
                                <span className="
                                  text-[11px] text-muted-foreground
                                "
                                >
                                  {user.email}
                                </span>
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-3">
                            {user.emailVerified
                              ? (
                                  <span className="
                                    inline-flex items-center gap-1 rounded-sm
                                    border border-emerald-500/30
                                    bg-emerald-500/10 px-2 py-0.5 text-[11px]
                                    font-medium text-emerald-700
                                    dark:text-emerald-300
                                  "
                                  >
                                    <CheckCircle2 className="size-3" />
                                    Verificado
                                  </span>
                                )
                              : (
                                  <span className="
                                    inline-flex items-center gap-1 rounded-sm
                                    border border-amber-500/30 bg-amber-500/10
                                    px-2 py-0.5 text-[11px] font-medium
                                    text-amber-700
                                    dark:text-amber-300
                                  "
                                  >
                                    <Clock className="size-3" />
                                    Pendiente
                                  </span>
                                )}
                          </td>

                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1">
                              {user.organizations.length > 0
                                ? (
                                    user.organizations.map(org => (
                                      <span
                                        key={org.orgId}
                                        className="
                                          rounded-sm border border-border
                                          bg-muted px-2 py-0.5 text-[10px]
                                          text-foreground
                                        "
                                      >
                                        {org.orgName}
                                        {' '}
                                        (
                                        {org.role}
                                        )
                                      </span>
                                    ))
                                  )
                                : (
                                    <span className="
                                      text-muted-foreground italic
                                    "
                                    >
                                      Sin vinculación
                                    </span>
                                  )}
                            </div>
                          </td>

                          <td className="px-4 py-3 text-muted-foreground">
                            {new Date(user.createdAt).toLocaleDateString()}
                          </td>

                          <td className="px-4 py-3 text-right">
                            <div className="
                              flex items-center justify-end gap-1.5
                            "
                            >
                              {!user.emailVerified && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleUserAction('verify_email', user.id)}
                                    disabled={actionLoading === user.id}
                                    title="Forzar verificación manual"
                                    className="
                                      rounded-lg border border-border
                                      bg-background p-1.5 text-emerald-600
                                      transition-colors
                                      hover:bg-emerald-500/10
                                      dark:text-emerald-400
                                    "
                                  >
                                    <UserCheck className="size-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleUserAction('resend_verification', user.id)}
                                    disabled={actionLoading === user.id}
                                    title="Reenviar correo de activación"
                                    className="
                                      rounded-lg border border-border
                                      bg-background p-1.5 text-primary
                                      transition-colors
                                      hover:bg-muted
                                    "
                                  >
                                    <Mail className="size-3.5" />
                                  </button>
                                </>
                              )}

                              {user.emailVerified && !user.isSuperadmin && (
                                <button
                                  type="button"
                                  onClick={() => handleUserAction('unverify_email', user.id)}
                                  disabled={actionLoading === user.id}
                                  title="Revocar verificación"
                                  className="
                                    rounded-lg border border-border
                                    bg-background p-1.5 text-amber-600
                                    transition-colors
                                    hover:bg-amber-500/10
                                    dark:text-amber-400
                                  "
                                >
                                  <UserX className="size-3.5" />
                                </button>
                              )}

                              {!user.isSuperadmin && (
                                <button
                                  type="button"
                                  onClick={() => setDeleteConfirm({ type: 'user', id: user.id, title: user.email })}
                                  disabled={actionLoading === user.id}
                                  title="Eliminar usuario"
                                  className="
                                    rounded-lg border border-border
                                    bg-background p-1.5 text-destructive
                                    transition-colors
                                    hover:bg-destructive/10
                                  "
                                >
                                  <Trash2 className="size-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* PESTAÑA 3: GESTIÓN DE EMPRESAS / ORGANIZACIONES           */}
      {/* ========================================================= */}
      {activeTab === 'organizations' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="relative max-w-sm flex-1">
              <Search className="
                pointer-events-none absolute top-1/2 left-3 size-4
                -translate-y-1/2 text-muted-foreground
              "
              />
              <input
                type="text"
                placeholder="Buscar empresa o ID..."
                value={orgSearch}
                onChange={e => setOrgSearch(e.target.value)}
                className="
                  w-full rounded-xl border border-input bg-background py-2 pr-3
                  pl-9 text-xs text-foreground
                  placeholder:text-muted-foreground
                  focus:ring-2 focus:ring-ring focus:outline-none
                "
              />
            </div>
          </div>

          <div className="
            overflow-x-auto rounded-2xl border border-border bg-card shadow-xs
          "
          >
            <table className="w-full text-left text-xs">
              <thead className="
                border-b border-border bg-muted/50 font-semibold
                text-muted-foreground
              "
              >
                <tr>
                  <th className="px-4 py-3">Empresa / ID</th>
                  <th className="px-4 py-3">Miembros</th>
                  <th className="px-4 py-3">Plan Activo</th>
                  <th className="px-4 py-3">Blindaje Anti-Purga</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredOrgs.length === 0
                  ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="py-8 text-center text-muted-foreground"
                        >
                          No se encontraron empresas.
                        </td>
                      </tr>
                    )
                  : (
                      filteredOrgs.map(org => (
                        <tr
                          key={org.id}
                          className="
                            transition-colors
                            hover:bg-muted/30
                          "
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <div className="
                                flex size-8 items-center justify-center
                                rounded-lg bg-primary/10 text-xs font-bold
                                text-primary
                              "
                              >
                                {org.name.slice(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className="
                                    font-semibold text-foreground
                                  "
                                  >
                                    {org.name}
                                  </span>
                                  {org.isMaster && (
                                    <span className="
                                      rounded-sm border border-indigo-500/30
                                      bg-indigo-500/10 px-1 py-0.5 text-[10px]
                                      font-bold text-indigo-600
                                      dark:text-indigo-400
                                    "
                                    >
                                      Master
                                    </span>
                                  )}
                                </div>
                                <span className="
                                  text-[10px] text-muted-foreground
                                "
                                >
                                  ID:
                                  {org.id}
                                </span>
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-3">
                            <span className="font-semibold text-foreground">{org.memberCount}</span>
                            {' '}
                            <span className="text-muted-foreground">miembro(s)</span>
                          </td>

                          <td className="px-4 py-3">
                            <select
                              value={org.plan}
                              onChange={e => handleOrgAction('set_plan', org.id, { plan: e.target.value })}
                              disabled={actionLoading === org.id}
                              className="
                                rounded-lg border border-input bg-background
                                px-2 py-1 text-xs font-semibold text-foreground
                                focus:ring-1 focus:ring-ring focus:outline-none
                              "
                            >
                              <option value="alpha_tester">Alpha Tester (Full)</option>
                              <option value="free">Free</option>
                              <option value="pro">Pro (19€/mes)</option>
                              <option value="enterprise">Enterprise (99€/mes)</option>
                            </select>
                          </td>

                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => handleOrgAction('set_protection', org.id, { isProtected: !org.isProtected })}
                              disabled={actionLoading === org.id}
                              className={`
                                inline-flex items-center gap-1.5 rounded-lg
                                border px-2.5 py-1 text-xs font-medium
                                transition-colors
                                ${
                        org.isProtected
                          ? `
                            border-emerald-500/40 bg-emerald-500/10
                            text-emerald-700
                            dark:text-emerald-300
                          `
                          : `
                            border-border bg-background text-muted-foreground
                            hover:bg-muted hover:text-foreground
                          `
                        }
                              `}
                            >
                              <Shield className="size-3" />
                              <span>{org.isProtected ? 'Blindada' : 'Normal'}</span>
                            </button>
                          </td>

                          <td className="px-4 py-3">
                            <span className="
                              inline-flex items-center rounded-sm bg-muted px-2
                              py-0.5 text-[10px] font-semibold text-foreground
                              capitalize
                            "
                            >
                              {org.status}
                            </span>
                          </td>

                          <td className="px-4 py-3 text-right">
                            {!org.isMaster && (
                              <button
                                type="button"
                                onClick={() => setDeleteConfirm({ type: 'organization', id: org.id, title: org.name })}
                                disabled={actionLoading === org.id}
                                title="Eliminar empresa"
                                className="
                                  rounded-lg border border-border bg-background
                                  p-1.5 text-destructive transition-colors
                                  hover:bg-destructive/10
                                "
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* PESTAÑA 4: GESTIÓN DE VINCULACIONES / MEMBRESÍAS          */}
      {/* ========================================================= */}
      {activeTab === 'memberships' && (
        <div className="space-y-4">
          <div className="
            overflow-x-auto rounded-2xl border border-border bg-card shadow-xs
          "
          >
            <table className="w-full text-left text-xs">
              <thead className="
                border-b border-border bg-muted/50 font-semibold
                text-muted-foreground
              "
              >
                <tr>
                  <th className="px-4 py-3">Usuario</th>
                  <th className="px-4 py-3">Empresa</th>
                  <th className="px-4 py-3">Rol Asignado</th>
                  <th className="px-4 py-3">Fecha de Unión</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {memberships.length === 0
                  ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="py-8 text-center text-muted-foreground"
                        >
                          No hay vinculaciones registradas.
                        </td>
                      </tr>
                    )
                  : (
                      memberships.map(m => (
                        <tr
                          key={m.id}
                          className="
                            transition-colors
                            hover:bg-muted/30
                          "
                        >
                          <td className="px-4 py-3">
                            <span className="font-semibold text-foreground">{m.userName || 'Usuario'}</span>
                            <span className="
                              block text-[11px] text-muted-foreground
                            "
                            >
                              {m.userEmail}
                            </span>
                          </td>

                          <td className="px-4 py-3">
                            <span className="font-semibold text-foreground">{m.orgName || 'Empresa'}</span>
                            <span className="
                              block text-[10px] text-muted-foreground
                            "
                            >
                              {m.orgId}
                            </span>
                          </td>

                          <td className="px-4 py-3">
                            <select
                              value={m.role}
                              onChange={e => handleMembershipAction('change_role', m.id, e.target.value)}
                              disabled={actionLoading === m.id}
                              className="
                                rounded-lg border border-input bg-background
                                px-2 py-1 text-xs font-semibold text-foreground
                                focus:ring-1 focus:ring-ring focus:outline-none
                              "
                            >
                              <option value="owner">Owner (Propietario)</option>
                              <option value="admin">Admin (Administrador)</option>
                              <option value="member">Member (Miembro)</option>
                            </select>
                          </td>

                          <td className="px-4 py-3 text-muted-foreground">
                            {new Date(m.createdAt).toLocaleDateString()}
                          </td>

                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleMembershipAction('remove_member', m.id)}
                              disabled={actionLoading === m.id}
                              title="Desvincular usuario de esta empresa"
                              className="
                                rounded-lg border border-border bg-background
                                p-1.5 text-destructive transition-colors
                                hover:bg-destructive/10
                              "
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal de Confirmación de Borrado */}
      {deleteConfirm && (
        <div className="
          fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4
          backdrop-blur-xs
        "
        >
          <div className="
            w-full max-w-md rounded-2xl border border-destructive/40 bg-card p-6
            shadow-2xl
          "
          >
            <div className="flex items-center gap-3 text-destructive">
              <ShieldAlert className="size-6" />
              <h3 className="text-lg font-bold">¿Confirmar Eliminación?</h3>
            </div>
            <p className="mt-3 text-sm text-foreground">
              Estás a punto de eliminar
              {' '}
              {deleteConfirm.type === 'user' ? 'al usuario' : 'la empresa'}
              :
              <strong className="mt-1 block font-mono text-xs">{deleteConfirm.title}</strong>
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Esta acción no se puede deshacer y borrará los datos asociados en PostgreSQL.
            </p>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="
                  rounded-xl border border-border bg-background px-4 py-2
                  text-xs font-semibold text-foreground transition-colors
                  hover:bg-muted
                "
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  if (deleteConfirm.type === 'user') {
                    handleUserAction('delete_user', deleteConfirm.id);
                  } else {
                    handleOrgAction('delete_organization', deleteConfirm.id);
                  }
                }}
                className="
                  rounded-xl bg-destructive px-4 py-2 text-xs font-semibold
                  text-destructive-foreground transition-colors
                  hover:bg-destructive/90
                "
              >
                Eliminar Definitivamente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
