export default function IncomeStatementPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-stone-800">Income Statement</h1>
      <div className="bg-white rounded-xl border border-stone-200 p-8 text-center text-stone-500">
        <p className="font-medium text-stone-600">Coming in Sprint 4</p>
        <p className="text-sm mt-2">
          Accrual Income Statement generated from invoices (revenue/COGS) + operating expenses,
          with monthly/YTD/comparative views and Allianz-format export.
        </p>
        <p className="text-sm mt-2 text-stone-400">
          Sprint 1 (bank import + categorization) is live. Sprints 2-3 (OpEx, capital, period close) next.
        </p>
      </div>
    </div>
  );
}
