import { TransactionCategoryKind } from "@prisma/client";
import {
  createTransactionCategoryAction,
  updateTransactionCategoryAction,
} from "@/actions/transactions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { titleCaseEnum } from "@/lib/dashboard/formatters";

type Category = {
  id: string;
  name: string;
  kind: TransactionCategoryKind;
  displayOrder: number;
  isActive: boolean;
};

export function TransactionCategoryManager({
  categories = [],
}: {
  categories?: Category[];
}) {
  return (
    <Card className="mt-6 p-5 sm:p-6">
      <details>
        <summary className="min-h-11 cursor-pointer font-semibold">
          Manage transaction-purpose categories
        </summary>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          Rename, order, or deactivate stable categories without changing their
          identity. Saving, reserves, goals, and extra principal belong to later
          planning destinations, not this taxonomy.
        </p>
        <div className="mt-5 grid gap-6">
          {Object.values(TransactionCategoryKind).map((kind) => (
            <section key={kind} aria-labelledby={`category-kind-${kind}`}>
              <h3 id={`category-kind-${kind}`} className="font-bold">
                {titleCaseEnum(kind)} categories
              </h3>
              <div className="mt-3 grid gap-3">
                {categories
                  .filter((category) => category.kind === kind)
                  .map((category) => (
                    <form
                      key={category.id}
                      action={updateTransactionCategoryAction}
                      className="grid gap-3 rounded-lg border border-[var(--border-default)] p-3 sm:grid-cols-[1fr_7rem_auto_auto] sm:items-end"
                    >
                      <input
                        type="hidden"
                        name="categoryId"
                        value={category.id}
                      />
                      <label>
                        <span className="text-xs font-semibold">Name</span>
                        <input
                          name="name"
                          defaultValue={category.name}
                          maxLength={80}
                          className="mt-1 min-h-11 w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-panel)] px-3"
                        />
                      </label>
                      <label>
                        <span className="text-xs font-semibold">Order</span>
                        <input
                          name="displayOrder"
                          type="number"
                          min="0"
                          max="10000"
                          defaultValue={category.displayOrder}
                          className="mt-1 min-h-11 w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-panel)] px-3"
                        />
                      </label>
                      <label className="flex min-h-11 items-center gap-2">
                        <input
                          type="checkbox"
                          name="isActive"
                          value="true"
                          defaultChecked={category.isActive}
                          className="size-5"
                        />
                        Active
                      </label>
                      <Button type="submit">Save</Button>
                    </form>
                  ))}
              </div>
              <form
                action={createTransactionCategoryAction}
                className="mt-3 flex flex-wrap items-end gap-3"
              >
                <input type="hidden" name="kind" value={kind} />
                <label className="min-w-0 flex-1">
                  <span className="text-xs font-semibold">Add category</span>
                  <input
                    name="name"
                    maxLength={80}
                    required
                    className="mt-1 min-h-11 w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-panel)] px-3"
                  />
                </label>
                <Button type="submit">
                  Add {titleCaseEnum(kind).toLowerCase()} category
                </Button>
              </form>
            </section>
          ))}
        </div>
      </details>
    </Card>
  );
}
