import { SkeletonResultsPage } from "@/components/ui/skeleton";

export default function ResultsLoading() {
  return (
    <div className="min-h-screen bg-[#fbf5ea] p-6">
      <div className="max-w-6xl mx-auto">
        <SkeletonResultsPage />
      </div>
    </div>
  );
}
