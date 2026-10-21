import { PlanilhaDiaria } from "../components/dashboard/PlanilhaDiaria";
import { PageHeader } from "../components/layout/PageHeader";

export default function Dashboard() {
  return (
    <div>
      <PageHeader
        title="Visão geral"
        description="Acompanhe e gerencie as entregas do dia."
      />
      <PlanilhaDiaria />
    </div>
  );
}
