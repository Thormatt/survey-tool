import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-[#fbf5ea] flex items-center justify-center">
      <SignUp
        appearance={{
          elements: {
            rootBox: "mx-auto",
            card: "bg-white shadow-lg",
            headerTitle: "font-['Syne']",
            headerSubtitle: "text-[#6b6b7b]",
            formButtonPrimary: "bg-[#1a1a2e] hover:bg-[#2a2a3e]",
          },
        }}
      />
    </div>
  );
}
