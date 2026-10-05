import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ColumnDef } from "@tanstack/react-table";
import { describe, expect, it, vi } from "vitest";
import { ConfirmDialog } from "../confirm-dialog";
import { DataTable } from "../data-table";
import { StatusBadge } from "../status-badge";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

describe("StatusBadge", () => {
  it("shows a readable label, not just a colour", () => {
    render(<StatusBadge status="PENDING_APPROVAL" />);
    expect(screen.getByText("Pending approval")).toBeInTheDocument();
  });
});

type Row = { id: string; name: string };
const columns: ColumnDef<Row>[] = [{ accessorKey: "name", header: "Name" }];

describe("DataTable", () => {
  it("renders rows and paginates", async () => {
    const onPageChange = vi.fn();
    render(
      <DataTable
        columns={columns}
        data={[{ id: "1", name: "Aarav Sharma" }]}
        meta={{ page: 1, limit: 1, total: 3, totalPages: 3 }}
        onPageChange={onPageChange}
      />,
    );
    expect(screen.getByText("Aarav Sharma")).toBeInTheDocument();
    expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /next/i }));
    expect(onPageChange).toHaveBeenCalledWith(2);
    expect(screen.getByRole("button", { name: /previous/i })).toBeDisabled();
  });

  it("shows the empty state when there is no data", () => {
    render(<DataTable columns={columns} data={[]} emptyState={<p>No patients yet</p>} />);
    expect(screen.getByText("No patients yet")).toBeInTheDocument();
  });
});

describe("ConfirmDialog", () => {
  it("requires a reason before confirming when asked", async () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        open
        title="Cancel appointment?"
        confirmLabel="Cancel appointment"
        reason={{ label: "Reason", required: true }}
        onConfirm={onConfirm}
      />,
    );
    const confirm = screen.getByRole("button", { name: "Cancel appointment" });
    expect(confirm).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/reason/i), "Patient unwell");
    expect(confirm).toBeEnabled();
    await userEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledWith("Patient unwell");
  });
});
