
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";

export default function QuestionBankPage() {
  return (
    <div>
      <PageHeader
        title="Question Bank"
        description="Create and manage a bank of practice questions for your subjects."
      />
      <div className="flex flex-col items-center justify-center h-96 border-2 border-dashed rounded-lg bg-card">
        <div className="text-center">
            <h3 className="text-lg font-semibold">Coming Soon!</h3>
            <p className="text-muted-foreground mt-2">The Question Bank is under construction.</p>
            <Button variant="outline" className="mt-4" disabled>Create Question</Button>
        </div>
      </div>
    </div>
  );
}
