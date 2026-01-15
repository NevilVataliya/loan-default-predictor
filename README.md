# Loan Default Predictor (Loan Risk Assessment)

End-to-end ML project that predicts **loan approval risk** from Lending Club-style application data.
It includes:

- A **FastAPI** backend that loads a trained model bundle and returns a **risk score + decision + reasons**
- A **Next.js** frontend UI to enter applicant details and display results
- A full **notebook pipeline** for sampling, cleaning, encoding, feature engineering, and model training
- **SHAP explanations** (“key factors”) returned alongside predictions

---

## What the API returns

For each application, the backend predicts the probability of **class 1 = Rejected**, and then applies a **custom threshold** stored in the model bundle.

Example response:

```json
{
  "status": "Rejected",
  "risk_score": 63.42,
  "threshold_used": 0.476016,
  "reasons": [
    "Interest Rate influenced this decision",
    "Credit Grade influenced this decision"
  ]
}
```

---

## Tech stack

- **ML / Data**: pandas, numpy, scikit-learn, XGBoost / LightGBM
- **Backend**: FastAPI, pydantic v2, joblib, SHAP, uvicorn
- **Frontend**: Next.js 16, React 19, TypeScript, TailwindCSS

---

## Repository structure

- `Backend/` – FastAPI server (`/predict`) + model bundle loading
- `Backend/models/` – trained model bundles (`.pkl`) used by the API
- `Frontend/` – Next.js UI (`/predict` form)
- `Notebooks/` – step-by-step pipeline from raw dataset → trained model
- `data/` – intermediate CSVs and saved model bundles

---

## Quickstart (run the app locally)

### 1) Backend (FastAPI)

Prereqs:
- Python 3.10+ recommended

From the repo root:

```bash
cd Backend
python -m venv .venv
```

Activate venv:

- Windows (PowerShell):
  ```powershell
  .\.venv\Scripts\Activate.ps1
  ```
- Windows (cmd):
  ```bat
  .\.venv\Scripts\activate.bat
  ```

Install dependencies:

```bash
pip install -r requirements.txt
```

Create environment file (recommended):

- Windows (PowerShell):
   ```powershell
   Copy-Item .env.sample .env
   ```
- Windows (cmd):
   ```bat
   copy .env.sample .env
   ```
- macOS/Linux:
   ```bash
   cp .env.sample .env
   ```

Set the model bundle path (choose one in env):

- Windows (PowerShell):
   ```powershell
   $env:MODEL_PATH = "./models/xgboost_loan_default_model.pkl"
   ```
- Windows (cmd):
   ```bat
   set MODEL_PATH=./models/xgboost_loan_default_model.pkl
   ```
- macOS/Linux:
   ```bash
   export MODEL_PATH=./models/xgboost_loan_default_model.pkl
   ```

Run the server:

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Open Swagger docs:

- http://localhost:8000/docs

Notes:
- CORS is controlled via `CORS_ALLOWED_ORIGINS` (comma-separated). Example: `http://localhost:3000`
- You can also run `python main.py` (the repo supports this entrypoint).

### 1b) Backend with Docker

From the repo root:

```bash
cd Backend
docker build -t loan-risk-api .
docker run --rm -p 7860:7860 --env-file .env loan-risk-api
```

Swagger docs (Docker):

- http://localhost:7860/docs

### 2) Frontend (Next.js)

Prereqs:
- Node.js 18+ (or newer)
- pnpm (recommended because the repo includes a `pnpm-lock.yaml`)

From the repo root:

```bash
cd Frontend
pnpm install
pnpm dev
```

Frontend will run at:

- http://localhost:3000

Backend URL configuration:
- Default backend URL is `http://localhost:8000`
- If you run the backend via Docker, use `http://localhost:7860`
- Optionally set `NEXT_PUBLIC_BACKEND_URL` in `Frontend/.env.local`, e.g.

```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
```

---

## API contract

### POST `/predict`

Request body fields:

- `loan_amnt` (number)
- `term` (integer): `36` or `60`
- `int_rate` (number) — in percent (e.g. `12.5`)
- `sub_grade` (string): `A1`..`G5`
- `emp_length` (number): examples used by the UI are `0.5, 1, 2, …, 10`
- `annual_inc` (number)
- `dti` (number)
- `verification_status` (string): `Not Verified`, `Source Verified`, `Verified`
- `pub_rec` (number)
- `pub_rec_bankruptcies` (number)
- `revol_bal` (number)
- `revol_util` (number)
- `fico_range` (number)
- `earliest_cr_line` (date string, `YYYY-MM-DD`)
- `total_acc` (number)
- `mort_acc` (number)
- `open_acc` (number)
- `purpose` (string): `car`, `credit_card`, `debt_consolidation`, `home_improvement`, `major_purchase`, `medical`, `other`, `small_business`
- `application_type` (string): `Individual` or `Joint App`
- `home_ownership` (string): `MORTGAGE`, `OWN`, `RENT`, `OTHER`

Example request:

```json
{
  "loan_amnt": 25000,
  "term": 36,
  "int_rate": 12.5,
  "sub_grade": "B3",
  "emp_length": 5,
  "annual_inc": 75000,
  "dti": 18.3,
  "verification_status": "Verified",
  "pub_rec": 0,
  "pub_rec_bankruptcies": 0,
  "revol_bal": 12000,
  "revol_util": 42.1,
  "fico_range": 690,
  "earliest_cr_line": "2012-01-01",
  "total_acc": 15,
  "mort_acc": 1,
  "open_acc": 7,
  "purpose": "debt_consolidation",
  "application_type": "Individual",
  "home_ownership": "RENT"
}
```

---

## ML pipeline (notebooks)

The project is structured as a step-by-step pipeline:

1. **Sampling** ([Notebooks/1_sampling.ipynb](Notebooks/1_sampling.ipynb))
   - Downloads Lending Club dataset from Kaggle (via `kagglehub`)
   - Filters loan statuses to: `Fully Paid`, `Charged Off`, `Default`
   - Performs class-wise sampling and saves `data/sampled_data.csv`

2. **Feature selection + missing values** ([Notebooks/2_removed_non_useful_features_and_handle_missing_values.ipynb](Notebooks/2_removed_non_useful_features_and_handle_missing_values.ipynb))
   - Keeps a curated feature set
   - Creates `fico_range` from low/high
   - Drops rows where `dti` or `revol_util` are missing
   - Fills `pub_rec_bankruptcies` with 0
   - Predicts missing `mort_acc` (RandomForestRegressor) and writes `data/2_removed_missing_values.csv`

3. **Outlier handling + numeric conversions** ([Notebooks/3_removing_outliers.ipynb](Notebooks/3_removing_outliers.ipynb))
   - Converts string fields: term/int_rate/revol_util
   - Maps `sub_grade` → numeric ordinal
   - Normalizes home ownership (`ANY`/`NONE` → `OTHER`)
   - Creates date features like `issue_d_date` and credit-history months
   - Removes obvious outliers (e.g. `dti > 100`, extreme revolving utilization)
   - Writes `data/3_removed_outliers.csv`

4. **Encoding** ([Notebooks/4_encoding.ipynb](Notebooks/4_encoding.ipynb))
   - One-hot encodes categorical columns using `pd.get_dummies`
   - Writes `data/4_encoded_data.csv`

5. **Additional features** ([Notebooks/5_add_additional_features.ipynb](Notebooks/5_add_additional_features.ipynb))
   - Adds engineered features
   - Example engineered columns: `mort_acc_utilization`, `int_rate_per_fico`, `flag_high_int_rate`, `flag_high_sub_grade`, `flag_low_fico`.
   - Writes `data/5_additional_features_data.csv`.

6. **Logistic Regression model** ([Notebooks/6_model_build_with_logistic_regression.ipynb](Notebooks/6_model_build_with_logistic_regression.ipynb))
   - Time-based split using `issue_d_date` around `2017-07-01`
   - Standard scaling + L1-regularized Logistic Regression
   - Threshold search using precision/recall curves
   - Saves a model bundle to `data/logistic_regression_model.pkl`

7. **XGBoost model** ([Notebooks/7_model_build_with_xgboost.ipynb](Notebooks/7_model_build_with_xgboost.ipynb))
   - Trains XGBoost with class imbalance handling (`scale_pos_weight`)
   - Tests time-series generalization using `TimeSeriesSplit`
   - Saves `data/xgboost_loan_default_model.pkl`

8. **LightGBM model** ([Notebooks/8_model_build_with_LightGBM.ipynb](Notebooks/8_model_build_with_LightGBM.ipynb))
   - GridSearchCV + threshold tuning
   - TimeSeriesSplit evaluation
   - Saves `data/lightGBM_loan_default_model.pkl`

---

## Model bundle format

The backend expects a Joblib-saved dictionary with (at minimum):

- `model`: trained classifier (must support `predict_proba`)
- `threshold`: float decision threshold for class 1
- `model_type`: string label (used to pick SHAP explainer)
- `feature_names`: list of training feature columns (used to enforce input order)

Optional keys:

- `scaler`: fitted scaler (used for Logistic Regression)
- `background_data`: background dataset for SHAP LinearExplainer

---

## Common issues

- **"Model not loaded"**: ensure `MODEL_PATH` points to an existing `.pkl` model bundle.
- **CORS errors**: set `CORS_ALLOWED_ORIGINS=http://localhost:3000` in `Backend/.env` (or environment).
- **Data files missing on GitHub**: this repo’s `.gitignore` ignores intermediate `*.csv`, so you may need to re-generate data using the notebooks.

---

## Contact

If you’re a recruiter or reviewer and want a quick walkthrough (data pipeline → model → API → UI), feel free to open an issue in this repo or contact via LinkedIn / Email.
