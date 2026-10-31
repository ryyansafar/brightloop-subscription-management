import { Suspense } from "react";
// Staff users: admin-only list with an Add staff member dialog.
import type { Metadata } from "next";
import { Badge, DataTable, PageHeader, formatDate, type Column } from "@/components";
import { AddStaffDialog } from "./AddStaffDialog";
import { requireAdminPage } from "./guard";
import { listStaffUsers, type StaffRow } from "./queries";

export const metadata: Metadata = { title: "Staff users" };

const columns: Column<StaffRow>[] = [
  { key: "name", header: "Name", render: (r) => <span className="break-words font-medium">{r.name}</span> },
  { key: "email", header: "Email", render: (r) => <span className="break-all">{r.email}</span> },
  {
    key: "role",
    header: "Role",
    render: (r) => <Badge tone={r.role === "ADMIN" ? "primary" : "neutral"}>{r.role === "ADMIN" ? "Admin" : "Staff"}</Badge>,
  },
  { key: "created", header: "Created", hideOnMobile: true, render: (r) => formatDate(r.createdAt) },
];

async function StaffUsersPageContent() {
  const session = await requireAdminPage();
  const users = await listStaffUsers(session.role);

  return (
    <>
      <PageHeader
        title="Staff users"
        description={`${users.length} ${users.length === 1 ? "member" : "members"} · Admin only`}
        actions={<AddStaffDialog />}
      />
      <div className="p-4 md:p-6">
        <DataTable
          columns={columns}
          rows={users}
          rowKey={(r) => r.id}
          basePath="/admin/staff"
          emptyMessage="No staff users yet."
        />
      </div>
    </>
  );
}

export default function StaffUsersPage() {
  return <Suspense fallback={<div role="status" className="p-6 text-muted">Loading…</div>}><StaffUsersPageContent /></Suspense>;
}
