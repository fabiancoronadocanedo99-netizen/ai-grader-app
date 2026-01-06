interface UsageAnalyticsProps {
  organizationId: string;
}

export default function UsageAnalytics({ organizationId }: UsageAnalyticsProps) {
  return (
    <div className="p-8 bg-[#f0f2f5] rounded-[30px] shadow-[20px_20px_60px_#bebebe,-20px_-20px_60px_#ffffff]">
      <h2 className="text-xl font-bold text-slate-700 mb-6 flex items-center gap-2">
        📊 Analíticas de Uso
      </h2>
      <div className="h-48 w-full rounded-[20px] bg-[#f0f2f5] shadow-[inset_10px_10px_20px_#ced1d6,inset_-10px_-10px_20px_#ffffff] flex items-center justify-center">
        <p className="text-slate-500 font-medium">Gráficos de consumo en tiempo real</p>
      </div>
    </div>
  );
}