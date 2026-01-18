import { SkeletonSurveyList } from "@/components/ui/skeleton";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";

export default function SurveysLoading() {
  return (
    <div className="min-h-screen bg-[#fbf5ea]">
      {/* Header */}
      <header className="border-b border-[#dcd6f6]">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-[#6b6b7b] hover:text-[#1a1a2e] transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="font-['Syne'] font-semibold text-lg">All Surveys</h1>
          </div>
          <Skeleton className="h-9 w-32" />
        </div>
      </header>

      <div className="container mx-auto px-6 py-8 max-w-4xl">
        <SkeletonSurveyList />
      </div>
    </div>
  );
}
