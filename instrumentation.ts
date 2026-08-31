export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { startImportRetentionCleanup } = await import(
    "@/lib/imports/retention"
  );
  await startImportRetentionCleanup();
}
