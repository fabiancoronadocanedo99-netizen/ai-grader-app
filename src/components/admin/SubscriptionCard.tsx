'use client'
import { assignPlanToOrganization } from '@/actions/organization-actions'

export default function SubscriptionCard({ initialData }: { initialData: any }) {
  const handlePlanChange = async (plan: any) => {
    await assignPlanToOrganization(initialData.id, plan);
  };

  return (
    <div className="p-8 bg-[#f0f2f5] rounded-[30px] shadow-[20px_20px_60px_#bebebe,-20px_-20px_60px_#ffffff] space-y-6">
      <h2 className="text-lg font-bold text-slate-700 font-bold uppercase">Suscripción</h2>

      <div className="py-6 px-4 rounded-[20px] bg-[#f0f2f5] shadow-[inset_8px_8px_16px_#d1d1d1,inset_-8px_-8px_16px_#ffffff] text-center">
        <p className="text-xs font-bold text-blue-500 uppercase">Plan Activo</p>
        <p className="text-2xl font-black text-slate-700">{initialData.subscription_plan || 'Free'}</p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {['Basic', 'Pro', 'Enterprise'].map((plan) => (
          <button
            key={plan}
            onClick={() => handlePlanChange(plan as any)}
            className="py-3 rounded-[15px] bg-[#f0f2f5] shadow-[6px_6px_12px_#d1d1d1,-6px_-6px_12px_#ffffff] text-sm font-bold text-slate-600 hover:text-blue-500 active:shadow-[inset_4px_4px_8px_#d1d1d1,inset_-4px_-4px_8px_#ffffff] transition-all"
          >
            Activar {plan}
          </button>
        ))}
      </div>
    </div>
  );
}