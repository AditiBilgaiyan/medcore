"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal, ShieldCheck, UserCheck, UserPlus, UserX, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DataTable } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { EmptyState } from "@/components/shared/states";
import { StatusBadge } from "@/components/shared/status-badge";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { InviteStaffDialog } from "@/components/modules/admin/invite-staff-dialog";
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/constants/roles";
import { useAuth } from "@/hooks/use-auth";
import { formatDate, formatRelative } from "@/lib/format";
import { useStaff, useUpdateStaff } from "@/services/admin";
import { STAFF_ROLES, type Role, type User, type UserStatus } from "@/types";

type PendingChange = { user: User; kind: "role"; role: Role } | { user: User; kind: "disable" } | null;

const STATUS_OPTIONS: { value: "ALL" | UserStatus; label: string }[] = [
  { value: "ALL", label: "All statuses" },
  { value: "ACTIVE", label: "Active" },
  { value: "INVITED", label: "Invited" },
  { value: "DISABLED", label: "Disabled" },
];

export default function StaffPage() {
  const { user: me, can } = useAuth();
  const manage = can("staff:manage");
  const [role, setRole] = useState<"ALL" | Role>("ALL");
  const [status, setStatus] = useState<"ALL" | UserStatus>("ALL");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pending, setPending] = useState<PendingChange>(null);
  const update = useUpdateStaff();

  const { data, isLoading, isFetching, error, refetch } = useStaff({
    role: role === "ALL" ? undefined : [role],
    status: status === "ALL" ? undefined : [status],
    search: search || undefined,
    page,
    limit: 20,
  });

  const enable = async (u: User) => {
    try {
      await update.mutateAsync({ id: u.id, status: "ACTIVE" });
      toast.success(`${u.firstName} ${u.lastName} can sign in again`);
    } catch {
      /* toast from the mutation cache */
    }
  };

  const columns = useMemo<ColumnDef<User>[]>(
    () => [
      {
        id: "name",
        header: "Name",
        cell: ({ row }) => {
          const u = row.original;
          return (
            <div className="flex min-w-0 items-center gap-2.5">
              <UserAvatar name={`${u.firstName} ${u.lastName}`} src={u.avatarUrl} />
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {u.firstName} {u.lastName}
                  {u.id === me?.id && <span className="text-muted-foreground ml-1.5 text-xs font-normal">(you)</span>}
                </p>
                <p className="text-muted-foreground truncate text-xs">{u.email}</p>
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "role",
        header: "Role",
        cell: ({ row }) => <span className="whitespace-nowrap">{ROLE_LABELS[row.original.role]}</span>,
      },
      {
        accessorKey: "phone",
        header: "Phone",
        cell: ({ row }) => <span className="whitespace-nowrap tabular-nums">{row.original.phone}</span>,
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        accessorKey: "lastLoginAt",
        header: "Last sign-in",
        cell: ({ row }) =>
          row.original.lastLoginAt ? (
            <span className="whitespace-nowrap" title={formatDate(row.original.lastLoginAt, "dd MMM yyyy, HH:mm")}>
              {formatRelative(row.original.lastLoginAt)}
            </span>
          ) : (
            <span className="text-muted-foreground">Never</span>
          ),
      },
      ...(manage
        ? [
            {
              id: "actions",
              header: () => <span className="sr-only">Actions</span>,
              cell: ({ row }: { row: { original: User } }) => {
                const u = row.original;
                const self = u.id === me?.id;
                return (
                  <div className="flex justify-end">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${u.firstName} ${u.lastName}`}>
                          <MoreHorizontal />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-52">
                        <DropdownMenuLabel className="text-muted-foreground truncate text-xs">
                          {u.firstName} {u.lastName}
                        </DropdownMenuLabel>
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger disabled={self}>
                            <ShieldCheck /> Change role
                          </DropdownMenuSubTrigger>
                          <DropdownMenuSubContent>
                            <DropdownMenuRadioGroup
                              value={u.role}
                              onValueChange={(r) => r !== u.role && setPending({ user: u, kind: "role", role: r as Role })}
                            >
                              {STAFF_ROLES.map((r) => (
                                <DropdownMenuRadioItem key={r} value={r}>
                                  {ROLE_LABELS[r]}
                                </DropdownMenuRadioItem>
                              ))}
                            </DropdownMenuRadioGroup>
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>
                        <DropdownMenuSeparator />
                        {u.status === "DISABLED" ? (
                          <DropdownMenuItem onSelect={() => void enable(u)}>
                            <UserCheck /> Enable account
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem variant="destructive" disabled={self} onSelect={() => setPending({ user: u, kind: "disable" })}>
                            <UserX /> Disable account
                          </DropdownMenuItem>
                        )}
                        {self && (
                          <p className="text-muted-foreground px-1.5 py-1 text-xs">
                            You can&apos;t change your own role or disable yourself.
                          </p>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                );
              },
            } satisfies ColumnDef<User>,
          ]
        : []),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [manage, me?.id],
  );

  const filtered = role !== "ALL" || status !== "ALL" || !!search;
  const p = pending;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Staff"
        description="Everyone with access to your hospital, their roles and account status."
        actions={
          manage ? (
            <InviteStaffDialog
              trigger={
                <Button>
                  <UserPlus /> Invite staff
                </Button>
              }
            />
          ) : undefined
        }
      />

      <DataTable
        columns={columns}
        data={data?.data}
        isLoading={isLoading}
        isFetching={isFetching}
        error={error}
        onRetry={() => void refetch()}
        meta={data?.meta}
        onPageChange={setPage}
        getRowId={(u) => u.id}
        caption="Staff members"
        rowClassName={(u) => (u.status === "DISABLED" ? "text-muted-foreground" : undefined)}
        toolbar={
          <>
            <SearchInput
              value={search}
              onChange={(v) => {
                setSearch(v);
                setPage(1);
              }}
              placeholder="Search name or email"
            />
            <div className="flex flex-wrap gap-2 sm:ml-auto">
              <Select
                value={role}
                onValueChange={(v) => {
                  setRole(v as typeof role);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-full sm:w-44" aria-label="Filter by role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All roles</SelectItem>
                  {STAFF_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={status}
                onValueChange={(v) => {
                  setStatus(v as typeof status);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-full sm:w-36" aria-label="Filter by status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        }
        emptyState={
          <EmptyState
            icon={Users}
            title={filtered ? "No staff match these filters" : "No staff yet"}
            description={filtered ? "Try another role, status or search." : "Invite doctors, nurses and front-office staff to get started."}
          />
        }
      />

      <ConfirmDialog
        open={p?.kind === "role"}
        onOpenChange={(v) => !v && setPending(null)}
        title={p ? `Change ${p.user.firstName}'s role?` : "Change role?"}
        description={
          p?.kind === "role" ? (
            <>
              {p.user.firstName} {p.user.lastName} moves from <strong>{ROLE_LABELS[p.user.role]}</strong> to{" "}
              <strong>{ROLE_LABELS[p.role]}</strong>: {ROLE_DESCRIPTIONS[p.role].toLowerCase()}.
            </>
          ) : undefined
        }
        confirmLabel="Change role"
        onConfirm={async () => {
          if (p?.kind !== "role") return;
          await update.mutateAsync({ id: p.user.id, role: p.role });
          toast.success(`${p.user.firstName} ${p.user.lastName} is now ${ROLE_LABELS[p.role]}`);
        }}
      />
      <ConfirmDialog
        open={p?.kind === "disable"}
        onOpenChange={(v) => !v && setPending(null)}
        title={p ? `Disable ${p.user.firstName} ${p.user.lastName}?` : "Disable account?"}
        description="They're signed out of every device and can't sign in until you enable the account again. Their records stay intact."
        confirmLabel="Disable account"
        destructive
        onConfirm={async () => {
          if (p?.kind !== "disable") return;
          await update.mutateAsync({ id: p.user.id, status: "DISABLED" });
          toast.success(`${p.user.firstName} ${p.user.lastName} disabled`);
        }}
      />
    </div>
  );
}
