export default function BalanceSheetPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-stone-800">Balance Sheet</h1>
      <div className="bg-white rounded-xl border border-stone-200 p-8 text-center text-stone-500">
        <p className="font-medium text-stone-600">Coming in Sprint 4</p>
        <p className="text-sm mt-2">
          Accrual Balance Sheet with Cash, AR, Supplier Prepayments, Customer Deposits, and Members&apos; Equity,
          generated from period-close snapshots.
        </p>
        <p className="text-sm mt-2 text-stone-400">
          Requires Sprint 3 (period close + snapshots) first.
        </p>
      </div>
    </div>
  );
}
