"use client"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useEffect, useState } from "react"

interface PredictionResult {
  status: "Approved" | "Rejected"
  risk_score: number
  reasons: string[]
}

interface LoanApplicationFormData {
  // Loan Details
  loanAmnt: string
  term: string
  purpose: string

  // Financial Information
  annualInc: string
  dti: string
  intRate: string
  revolUtil: string
  revolBal: string

  // Credit Profile
  subGrade: string
  verificationStatus: string
  earliestCrLine: string
  empLength: string
  ficoRange: string

  // Account Information
  totalAcc: string
  openAcc: string
  mortAcc: string
  pubRec: string
  pubRecBankruptcies: string

  // Personal & Home Information
  applicationType: string
  homeOwnership: string
}

const initialFormData: LoanApplicationFormData = {
  loanAmnt: "",
  term: "",
  purpose: "",
  annualInc: "",
  dti: "",
  intRate: "",
  revolUtil: "",
  revolBal: "",
  subGrade: "",
  verificationStatus: "",
  earliestCrLine: "",
  empLength: "",
  ficoRange: "",
  totalAcc: "", 
  openAcc: "",
  mortAcc: "",
  pubRec: "",
  pubRecBankruptcies: "",
  applicationType: "",
  homeOwnership: "",
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  "http://localhost:8000"

export default function PredictPage() {
  const [formData, setFormData] = useState<LoanApplicationFormData>(
    initialFormData
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [prediction, setPrediction] = useState<PredictionResult | null>(null)

  useEffect(() => {
    if (!prediction) return

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPrediction(null)
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [prediction])

  const isApproved = prediction?.status === "Approved"
  const isHighRisk = (prediction?.risk_score ?? 0) >= 50

  const handleInputChange = (
    field: keyof LoanApplicationFormData,
    value: string
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const simulateCreditFetch = () => {
    const randomScore = Math.floor(Math.random() * (750 - 660 + 1)) + 660
    const randomAnnualInc = Math.floor(Math.random() * 100000 + 30000)
    const randomDti = (Math.random() * 25 + 5).toFixed(2)
    const randomRevolBal = Math.floor(Math.random() * 20000 + 1000)
    const randomRevolUtil = (Math.random() * 60 + 10).toFixed(1)
    const randomTotalAcc = Math.floor(Math.random() * 20 + 10)
    const randomOpenAcc = Math.floor(Math.random() * 10 + 5)
    const randomMortAcc = Math.floor(Math.random() * 2)

    // Generate random date between 5-15 years ago
    const daysAgo = Math.floor(Math.random() * (365 * 15 - 365 * 5) + 365 * 5)
    const randomDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000)
    const formattedDate = randomDate.toISOString().split("T")[0]

    const isGoodScore = randomScore > 700
    const randomIntRate = isGoodScore ? "8.5" : "15.2"
    const randomSubGrade = isGoodScore ? "A4" : "C3"
    const randomVerificationStatus = isGoodScore ? "Source Verified" : "Verified"

    setFormData((prev) => ({
      ...prev,
      ficoRange: String(Math.min(850, randomScore + 10)),
      annualInc: randomAnnualInc.toString(),
      dti: randomDti,
      revolBal: randomRevolBal.toString(),
      revolUtil: randomRevolUtil,
      totalAcc: randomTotalAcc.toString(),
      openAcc: randomOpenAcc.toString(),
      mortAcc: randomMortAcc.toString(),
      pubRec: "0",
      pubRecBankruptcies: "0",
      earliestCrLine: formattedDate,
      intRate: randomIntRate,
      subGrade: randomSubGrade,
      verificationStatus: randomVerificationStatus
    }))
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const toNumber = (value: string, label: string) => {
      const num = Number(value)
      if (!Number.isFinite(num)) {
        throw new Error(`Invalid ${label}`)
      }
      return num
    }

    try {
      const submitData = {
        loan_amnt: toNumber(formData.loanAmnt, "loan amount"),
        term: Math.trunc(toNumber(formData.term, "term")),
        int_rate: toNumber(formData.intRate, "interest rate"),
        sub_grade: formData.subGrade,
        emp_length: toNumber(formData.empLength, "employment length"),
        annual_inc: toNumber(formData.annualInc, "annual income"),
        dti: toNumber(formData.dti, "DTI"),
        verification_status: formData.verificationStatus,
        pub_rec: toNumber(formData.pubRec, "public records"),
        pub_rec_bankruptcies: toNumber(
          formData.pubRecBankruptcies,
          "bankruptcies"
        ),
        revol_bal: toNumber(formData.revolBal, "revolving balance"),
        revol_util: toNumber(formData.revolUtil, "revolving utilization"),
        fico_range: toNumber(formData.ficoRange, "FICO range"),
        earliest_cr_line: formData.earliestCrLine,
        total_acc: toNumber(formData.totalAcc, "total accounts"),
        mort_acc: toNumber(formData.mortAcc, "mortgage accounts"),
        open_acc: toNumber(formData.openAcc, "open accounts"),
        purpose: formData.purpose,
        application_type: formData.applicationType,
        home_ownership: formData.homeOwnership,
      }

      console.log("Submitting form data:", JSON.stringify(submitData))

      const response = await fetch(`${API_BASE_URL}/predict`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(submitData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || "Failed to get prediction")
      }

      const data = await response.json()
      console.log("Prediction result:", data)
      setPrediction(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => {
    setFormData(initialFormData)
    setError(null)
    setPrediction(null)
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6 md:p-10">
        <header className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            Loan risk assessment
          </h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Fill the applicant’s details to get a risk score and key drivers.
            Use “Simulate Credit Data” to quickly populate the credit fields the
            way banking APIs typically would.
          </p>
        </header>

        {/* Prediction Modal */}
        {prediction && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
            <div
              className="relative w-full max-w-md rounded-lg border bg-card p-6 shadow-lg"
              role="dialog"
              aria-modal="true"
              aria-label="Prediction result"
            >
              <button
                onClick={() => setPrediction(null)}
                className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
                aria-label="Close prediction"
              >
                ×
              </button>

              <div className="text-center">
                <div className="mb-6">
                  <div
                    className={
                      "mb-3 text-6xl font-semibold " +
                      (isApproved ? "text-primary" : "text-destructive")
                    }
                  >
                    {isApproved ? "✓" : "✗"}
                  </div>
                  <h2 className="text-3xl font-semibold tracking-tight">
                    {isApproved ? "Approved" : "Denied"}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Risk score estimates likelihood of rejection.
                  </p>
                </div>

                <div className="mb-8 flex justify-center">
                  <div
                    className={
                      "flex h-32 w-32 flex-col items-center justify-center rounded-full border-4 " +
                      (isHighRisk ? "border-destructive" : "border-primary")
                    }
                  >
                    <p className="text-sm font-medium text-muted-foreground">
                      Risk score
                    </p>
                    <p
                      className={
                        "text-3xl font-semibold " +
                        (isHighRisk ? "text-destructive" : "text-primary")
                      }
                    >
                      {prediction.risk_score.toFixed(1)}%
                    </p>
                  </div>
                </div>

                <div className="mb-6 max-h-60 overflow-y-auto rounded-lg border bg-background/50 p-4 text-left">
                  <h3 className="mb-3 text-sm font-medium text-muted-foreground">
                    Key factors
                  </h3>
                  <ul className="space-y-2">
                    {prediction.reasons.map((reason, index) => (
                      <li
                        key={index}
                        className="flex items-start gap-2 text-sm text-foreground"
                      >
                        <span
                          className={
                            "mt-0.5 font-semibold " +
                            (isApproved ? "text-primary" : "text-destructive")
                          }
                        >
                          →
                        </span>
                        <span>{reason}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex gap-3">
                  <Button
                    onClick={() => setPrediction(null)}
                    variant="secondary"
                    className="flex-1"
                  >
                    Close
                  </Button>
                  <Button onClick={handleReset} className="flex-1">
                    New Application
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="rounded-lg border bg-card">
          <div className="border-b p-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="flex flex-col gap-1">
                <h2 className="text-base font-semibold">Application details</h2>
                <p className="text-sm text-muted-foreground">
                  All fields are required for scoring.
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={simulateCreditFetch}
                  disabled={loading}
                >
                  Simulate Credit Data
                </Button>
                <Button
                  variant="outline"
                  type="button"
                  onClick={handleReset}
                  disabled={loading}
                >
                  Reset
                </Button>
              </div>
            </div>
          </div>

          <div className="p-6">
            {error && (
              <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <FieldGroup className="gap-6">
                {/* Loan Details */}
                <FieldSet className="rounded-lg border bg-background/40 p-5">
                  <FieldLegend>Loan Details</FieldLegend>
                  <FieldDescription>Basic loan information</FieldDescription>
                  <div className="grid gap-6 md:grid-cols-2">
                    <Field>
                      <FieldLabel htmlFor="loan_amnt">Loan Amount ($)</FieldLabel>
                      <Input
                        id="loan_amnt"
                        type="number"
                        inputMode="numeric"
                        min={0}
                        placeholder="25000"
                        value={formData.loanAmnt}
                        onChange={(e) =>
                          handleInputChange("loanAmnt", e.target.value)
                        }
                        required
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="term">Term (Months)</FieldLabel>
                      <Select
                        value={formData.term}
                        onValueChange={(value) =>
                          handleInputChange("term", value)
                        }
                      >
                        <SelectTrigger id="term">
                          <SelectValue placeholder="Select term" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="36">36 months</SelectItem>
                          <SelectItem value="60">60 months</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="purpose">Purpose</FieldLabel>
                      <Select
                        value={formData.purpose}
                        onValueChange={(value) =>
                          handleInputChange("purpose", value)
                        }
                      >
                        <SelectTrigger id="purpose">
                          <SelectValue placeholder="Select purpose" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="car">Car</SelectItem>
                          <SelectItem value="credit_card">Credit Card</SelectItem>
                          <SelectItem value="debt_consolidation">
                            Debt Consolidation
                          </SelectItem>
                          <SelectItem value="home_improvement">
                            Home Improvement
                          </SelectItem>
                          <SelectItem value="major_purchase">
                            Major Purchase
                          </SelectItem>
                          <SelectItem value="medical">Medical</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                          <SelectItem value="small_business">
                            Small Business
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>
                </FieldSet>

            
                {/* Personal & Home Information */}
                <FieldSet className="rounded-lg border bg-background/40 p-5">
                  <FieldLegend>Personal & Home</FieldLegend>
                  <FieldDescription>Your application and home details</FieldDescription>
                  <div className="grid gap-6 md:grid-cols-2">
                    <Field>
                      <FieldLabel htmlFor="application_type">
                        Application Type
                      </FieldLabel>
                      <Select
                        value={formData.applicationType}
                        onValueChange={(value) =>
                          handleInputChange("applicationType", value)
                        }
                      >
                        <SelectTrigger id="application_type">
                          <SelectValue placeholder="Select application type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Individual">Individual</SelectItem>
                          <SelectItem value="Joint App">
                            Joint Application
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="home_ownership">
                        Home Ownership
                      </FieldLabel>
                      <Select
                        value={formData.homeOwnership}
                        onValueChange={(value) =>
                          handleInputChange("homeOwnership", value)
                        }
                      >
                        <SelectTrigger id="home_ownership">
                          <SelectValue placeholder="Select home ownership" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="MORTGAGE">Mortgage</SelectItem>
                          <SelectItem value="OWN">Own</SelectItem>
                          <SelectItem value="RENT">Rent</SelectItem>
                          <SelectItem value="OTHER">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>

                    <Field>
                      <FieldLabel htmlFor="emp_length">
                        Employment Length
                      </FieldLabel>
                      <Select
                        value={formData.empLength}
                        onValueChange={(value) =>
                          handleInputChange("empLength", value)
                        }
                      >
                        <SelectTrigger id="emp_length">
                          <SelectValue placeholder="Select employment length" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0.5">Less than 1 year</SelectItem>
                          <SelectItem value="1">1 year</SelectItem>
                          <SelectItem value="2">2 years</SelectItem>
                          <SelectItem value="3">3 years</SelectItem>
                          <SelectItem value="4">4 years</SelectItem>
                          <SelectItem value="5">5 years</SelectItem>
                          <SelectItem value="6">6 years</SelectItem>
                          <SelectItem value="7">7 years</SelectItem>
                          <SelectItem value="8">8 years</SelectItem>
                          <SelectItem value="9">9 years</SelectItem>
                          <SelectItem value="10">10+ years</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>
                </FieldSet>

            {/* Financial Information */}
            <FieldSet className="rounded-lg border bg-background/40 p-5">
              <FieldLegend>Financial Information</FieldLegend>
              <FieldDescription>Your income and debt details</FieldDescription>
              <div className="grid gap-6 md:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="annual_inc">Annual Income ($)</FieldLabel>
                  <Input
                    id="annual_inc"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    placeholder="75000"
                    value={formData.annualInc}
                    onChange={(e) => handleInputChange("annualInc", e.target.value)}
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="dti">Debt-to-Income Ratio (%)</FieldLabel>
                  <Input
                    id="dti"
                    type="number"
                    step="0.01"
                    min={0}
                    placeholder="25.5"
                    value={formData.dti}
                    onChange={(e) => handleInputChange("dti", e.target.value)}
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="int_rate">Interest Rate (%)</FieldLabel>
                  <Input
                    id="int_rate"
                    type="number"
                    step="0.01"
                    min={0}
                    placeholder="12.5"
                    value={formData.intRate}
                    onChange={(e) => handleInputChange("intRate", e.target.value)}
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="revol_util">Revolving Credit Utilization (%)</FieldLabel>
                  <Input
                    id="revol_util"
                    type="number"
                    step="0.01"
                    min={0}
                    placeholder="45.2"
                    value={formData.revolUtil}
                    onChange={(e) => handleInputChange("revolUtil", e.target.value)}
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="revol_bal">Revolving Balance ($)</FieldLabel>
                  <Input
                    id="revol_bal"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    placeholder="15000"
                    value={formData.revolBal}
                    onChange={(e) => handleInputChange("revolBal", e.target.value)}
                    required
                  />
                </Field>
              </div>
            </FieldSet>

            {/* Credit Profile */}
            <FieldSet className="rounded-lg border bg-background/40 p-5">
              <FieldLegend>Credit Profile</FieldLegend>
              <FieldDescription>Your credit history and status</FieldDescription>
              <div className="grid gap-6 md:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="sub_grade">Sub Grade</FieldLabel>
                  <Select value={formData.subGrade} onValueChange={(value) => handleInputChange("subGrade", value)}>
                    <SelectTrigger id="sub_grade">
                      <SelectValue placeholder="Select sub grade" />
                    </SelectTrigger>
                    <SelectContent>
                      {['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((grade) =>
                        [1, 2, 3, 4, 5].map((num) => (
                          <SelectItem key={`${grade}${num}`} value={`${grade}${num}`}>
                            {grade}{num}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="verification_status">Verification Status</FieldLabel>
                  <Select value={formData.verificationStatus} onValueChange={(value) => handleInputChange("verificationStatus", value)}>
                    <SelectTrigger id="verification_status">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Not Verified">Not Verified</SelectItem>
                      <SelectItem value="Source Verified">Source Verified</SelectItem>
                      <SelectItem value="Verified">Verified</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="earliest_cr_line">Earliest Credit Line Date</FieldLabel>
                  <Input
                    id="earliest_cr_line"
                    type="date"
                    className="dark:scheme-dark"
                    value={formData.earliestCrLine}
                    onChange={(e) => handleInputChange("earliestCrLine", e.target.value)}
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="fico_range">FICO Range</FieldLabel>
                  <Input
                    id="fico_range"
                    type="number"
                    inputMode="numeric"
                    min={300}
                    max={850}
                    placeholder="680"
                    value={formData.ficoRange}
                    onChange={(e) => handleInputChange("ficoRange", e.target.value)}
                    required
                  />
                </Field>
              </div>
            </FieldSet>

            {/* Account Information */}
            <FieldSet className="rounded-lg border bg-background/40 p-5">
              <FieldLegend>Account Information</FieldLegend>
              <FieldDescription>Your credit account details</FieldDescription>
              <div className="grid gap-6 md:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="total_acc">Total Accounts</FieldLabel>
                  <Input
                    id="total_acc"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    placeholder="15"
                    value={formData.totalAcc}
                    onChange={(e) => handleInputChange("totalAcc", e.target.value)}
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="open_acc">Open Accounts</FieldLabel>
                  <Input
                    id="open_acc"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    placeholder="8"
                    value={formData.openAcc}
                    onChange={(e) => handleInputChange("openAcc", e.target.value)}
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="mort_acc">Mortgage Accounts</FieldLabel>
                  <Input
                    id="mort_acc"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    placeholder="2"
                    value={formData.mortAcc}
                    onChange={(e) => handleInputChange("mortAcc", e.target.value)}
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="pub_rec">Public Records</FieldLabel>
                  <Input
                    id="pub_rec"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    placeholder="0"
                    value={formData.pubRec}
                    onChange={(e) => handleInputChange("pubRec", e.target.value)}
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="pub_rec_bankruptcies">Bankruptcies</FieldLabel>
                  <Input
                    id="pub_rec_bankruptcies"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    placeholder="0"
                    value={formData.pubRecBankruptcies}
                    onChange={(e) => handleInputChange("pubRecBankruptcies", e.target.value)}
                    required
                  />
                </Field>
              </div>
            </FieldSet>

              <div className="sticky bottom-4 z-10">
                <div className="rounded-lg border bg-card/95 p-4 shadow-sm backdrop-blur">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-muted-foreground">
                      Ready? Submit to generate risk score.
                    </p>
                    <Button type="submit" disabled={loading} className="sm:w-auto">
                      {loading ? "Submitting..." : "Predict Loan Approval"}
                    </Button>
                  </div>
                </div>
              </div>
            </FieldGroup>
          </form>
        </div>
      </div>
      </div>
    </div>
  )
}