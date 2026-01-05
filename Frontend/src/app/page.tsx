import Link from "next/link"

import { Button } from "@/components/ui/button"

const API_BASE_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  "http://localhost:8000"

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-foreground p-6">
      <main className="w-full max-w-2xl rounded-lg border bg-card p-8">
        <div className="flex flex-col gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            Loan approval prediction
          </h1>
          <p className="text-sm text-muted-foreground">
            Enter applicant details to get a model-backed risk score and key
            factors.
          </p>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button asChild className="sm:w-auto">
            <Link href="/predict">Start prediction</Link>
          </Button>
          <Button asChild variant="secondary" className="sm:w-auto">
            <a href={`${API_BASE_URL}/docs`} target="_blank" rel="noreferrer">
              Backend docs
            </a>
          </Button>
        </div>
      </main>
    </div>
  )
}
