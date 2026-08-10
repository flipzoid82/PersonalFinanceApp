import { notFound } from "next/navigation";
import { TransactionDetail } from "@/components/transactions/transaction-detail";
import { requireUser } from "@/lib/auth";
import {
  getTransactionCategoryOptions,
  getTransactionDetail,
} from "@/lib/transactions/queries";

export default async function TransactionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ transactionId: string }>;
  searchParams?: Promise<{ message?: string; error?: string }>;
}) {
  const owner = await requireUser();
  const { transactionId } = await params;
  const [transaction, categories] = await Promise.all([
    getTransactionDetail(owner.id, transactionId),
    getTransactionCategoryOptions(owner.id),
  ]);
  if (!transaction) notFound();
  const feedback = (await searchParams) ?? {};
  return (
    <TransactionDetail
      transaction={transaction}
      categories={categories}
      message={feedback.message}
      error={feedback.error}
    />
  );
}
