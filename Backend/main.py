import os
from datetime import date, datetime

import joblib
import numpy as np
import pandas as pd
import shap
import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel


# Load environment variables from .env (if present)
load_dotenv()


# FastAPI app
app = FastAPI(title="Loan Risk API")


# CORS (defaults to '*' if not provided)
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ALLOWED_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Globals (populated once at startup) ---
risk_model = None
custom_threshold = 0.5  # Default fallback
risk_explainer = None
model_features = None  # Used to enforce the training-time column order
risk_scaler = None  # Optional: scaler for models that require normalized inputs

@app.on_event("startup")
def load_artifacts():
    # Load the model bundle and initialize SHAP explainer.
    global risk_model, custom_threshold, risk_explainer, model_features, risk_scaler
    try:
        model_path = os.getenv("MODEL_PATH")
        print(f"Loading artifact bundle from: {model_path}")
        
        bundle = joblib.load(model_path)
        
        risk_model = bundle.get("model")
        custom_threshold = bundle.get("threshold", 0.5)
        model_features = bundle.get("feature_names")
        background_data = bundle.get("background_data") 
        model_type = bundle.get("model_type", "unknown").lower()
        risk_scaler = bundle.get("scaler")  # Optional

        if risk_model is None:
            raise ValueError("Model object is missing from the bundle!")

        if risk_scaler:
            print("Scaler loaded successfully. Data will be normalized before prediction.")
        else:
            print("WARNING: No scaler found. If using Logistic Regression, ensure data is pre-scaled.")

        print(f"Model loaded: {model_type} | Custom Threshold: {custom_threshold}")

        try:
            if "logistic" in model_type or "linear" in model_type:
                # Linear models work best with an explicit background dataset.
                if background_data is None:
                    print("WARNING: No background data found for Linear Model. SHAP may fail.")
                    background_data = pd.DataFrame(0, index=np.arange(1), columns=model_features)
                
                risk_explainer = shap.LinearExplainer(risk_model, background_data)
                print("SHAP: LinearExplainer initialized.")
                
            else:
                # Tree models (XGBoost, Random Forest, LightGBM, etc.)
                risk_explainer = shap.TreeExplainer(risk_model)
                print(f"SHAP: TreeExplainer initialized for {model_type}.")
                
        except Exception as shap_e:
            print(f"SHAP Init Error ({shap_e}). Falling back to KernelExplainer (Slow).")
            if background_data is None:
                 background_data = pd.DataFrame(0, index=np.arange(1), columns=model_features)
            risk_explainer = shap.KernelExplainer(risk_model.predict_proba, background_data)

    except Exception as e:
        print(f"CRITICAL ERROR loading model bundle: {e}")

# --- Request schema (what the frontend sends) ---
class LoanApplication(BaseModel):
    loan_amnt: float
    term: int
    int_rate: float
    sub_grade: str
    emp_length: float
    annual_inc: float
    dti: float
    verification_status: str
    pub_rec: float
    pub_rec_bankruptcies: float
    revol_bal: float
    revol_util: float
    fico_range: float
    earliest_cr_line: date
    total_acc: float
    mort_acc: float
    open_acc: float
    purpose: str
    application_type: str
    home_ownership: str

# --- Human-friendly names for explanations ---
# These labels are used in: "{friendly} influenced this decision".
FRIENDLY_NAMES = {
    'loan_amnt_log': 'Requested Loan Amount',
    'term_num': 'Loan Term Length',
    'int_rate_num': 'Interest Rate',
    'sub_grade_map': 'Credit Grade',
    'emp_length_num': 'Employment History',
    'annual_inc_log': 'Annual Income',
    'dti': 'Debt-to-Income Ratio',
    'purpose_car': 'Loan Purpose: Car',
    'purpose_credit_card': 'Loan Purpose: Credit Card',
    'purpose_debt_consolidation': 'Loan Purpose: Debt Consolidation',
    'purpose_home_improvement': 'Loan Purpose: Home Improvement',
    'purpose_major_purchase': 'Loan Purpose: Major Purchase',
    'purpose_medical': 'Loan Purpose: Medical',
    'purpose_other': 'Loan Purpose: Other',
    'purpose_small_business': 'Loan Purpose: Small Business',
    'application_type_Joint App': 'Joint Application',
    'application_type_Individual': 'Individual Application',
    'fico_range': 'FICO Credit Score',
    'earliest_cr_line_months_log': 'Length of Credit History',
    'open_acc': 'Open Credit Lines',
    'total_acc': 'Total Credit Accounts',
    'revol_bal_log': 'Total Revolving Balance',
    'revol_util_num': 'Credit Line Utilization',
    'pub_rec_clip': 'Public Derogatory Records',
    'pub_rec_bankruptcies_clip': 'Bankruptcy History',
    'mort_acc': 'Number of Mortgage Accounts',
    'home_ownership_new_RENT': 'Housing Status (Renting)',
    'home_ownership_new_OWN': 'Housing Status (Owning)',
    'home_ownership_new_MORTGAGE': 'Housing Status (Mortgage)',
    'home_ownership_new_OTHER': 'Housing Status (Other)',
    'verification_status_Verified': 'Income Verified',
    'verification_status_Source Verified': 'Income Source Verification',
    'verification_status_Not Verified': 'Income Source not Verification',
    'mort_acc_utilization': 'Mortgage Account Density',
    'int_rate_per_fico': 'Interest Rate to Score Ratio',
    'flag_low_fico': 'Low Credit Score Warning',
    'flag_high_int_rate': 'High Interest Rate Warning',
    'flag_high_sub_grade': 'Risk Grade Warning'
}

# --- Feature engineering ---
def preprocess_user_input(raw_data, required_cols):

    # Start with a 1-row dataframe of zeros, using the model's expected columns
    input_df = pd.DataFrame(columns=required_cols)
    input_df.loc[0] = 0

    # 1) Log transforms
    input_df['loan_amnt_log'] = np.log(float(raw_data['loan_amnt']))
    input_df['annual_inc_log'] = np.log(float(raw_data['annual_inc']))
    input_df['revol_bal_log'] = np.log1p(float(raw_data['revol_bal']))

    # 2) Direct numeric fields
    input_df['term_num'] = int(raw_data['term'])
    int_rate_val = float(raw_data['int_rate'])
    input_df['int_rate_num'] = int_rate_val
    input_df['revol_util_num'] = float(raw_data['revol_util'])
    input_df['emp_length_num'] = raw_data['emp_length']
    
    # 3) Sub-grade mapping
    subgrade_mapping = {
        'A1': 1, 'A2': 2, 'A3': 3, 'A4': 4, 'A5': 5,
        'B1': 6, 'B2': 7, 'B3': 8, 'B4': 9, 'B5': 10,
        'C1': 11, 'C2': 12, 'C3': 13, 'C4': 14, 'C5': 15,
        'D1': 16, 'D2': 17, 'D3': 18, 'D4': 19, 'D5': 20,
        'E1': 21, 'E2': 22, 'E3': 23, 'E4': 24, 'E5': 25,
        'F1': 26, 'F2': 27, 'F3': 28, 'F4': 29, 'F5': 30,
        'G1': 31, 'G2': 32, 'G3': 33, 'G4': 34, 'G5': 35
    }
    sub_grade_val = subgrade_mapping.get(raw_data['sub_grade'], 0)
    input_df['sub_grade_map'] = sub_grade_val

    # 4) Derived features
    fico_range = float(raw_data['fico_range'])
    input_df['fico_range'] = fico_range
    
    today = datetime.now()
    earliest_date = datetime(raw_data['earliest_cr_line'].year, raw_data['earliest_cr_line'].month, 1) 
    months_diff = (today.year - earliest_date.year) * 12 + (today.month - earliest_date.month)
    input_df['earliest_cr_line_months_log'] = np.log(max(months_diff, 1))

    input_df['int_rate_per_fico'] = int_rate_val / fico_range
    total_acc = float(raw_data['total_acc'])
    mort_acc = float(raw_data['mort_acc'])
    input_df['mort_acc_utilization'] = mort_acc / (total_acc + 1)

    # 5) Simple risk flags
    input_df['flag_low_fico'] = 1 if fico_range < 660 else 0
    input_df['flag_high_int_rate'] = 1 if int_rate_val > 20 else 0
    input_df['flag_high_sub_grade'] = 1 if sub_grade_val > 25 else 0

    # 6) One-hot encoding for categorical fields
    purpose_col = f"purpose_{raw_data['purpose']}"
    if purpose_col in input_df.columns:
        input_df[purpose_col] = 1

    app_type_col = f"application_type_{raw_data['application_type']}"
    if app_type_col in input_df.columns:
        input_df[app_type_col] = 1

    home_val = raw_data['home_ownership']
    if home_val in ['ANY', 'NONE']:
        home_val = 'OTHER'
    home_col = f"home_ownership_new_{home_val}"
    if home_col in input_df.columns:
        input_df[home_col] = 1

    verification_status_col = f"verification_status_{raw_data['verification_status']}"
    if verification_status_col in input_df.columns:
        input_df[verification_status_col] = 1
    
    # 7) Pass-through numeric fields
    input_df['dti'] = raw_data['dti']
    input_df['open_acc'] = raw_data['open_acc']
    input_df['pub_rec_clip'] = raw_data['pub_rec']
    input_df['total_acc'] = raw_data['total_acc']
    input_df['mort_acc'] = raw_data['mort_acc']
    input_df['pub_rec_bankruptcies_clip'] = raw_data['pub_rec_bankruptcies']

    return input_df

# --- SHAP explanations ---
def get_reasons(processed_df, prediction_cls):
    # Return the top explanatory factors as short, user-friendly sentences.

    # Compute SHAP values
    shap_obj = risk_explainer(processed_df)
    vals = shap_obj.values
    
    # SHAP output shape differs by model/explainer; normalize to a 1D array.
    if vals.ndim == 3:
        # scikit-learn style: (samples, features, classes) -> take class 1
        shap_values_flat = vals[0, :, 1]
    else:
        # tree style: (samples, features)
        shap_values_flat = vals[0]

    contributions = []
    for col, val in zip(processed_df.columns, shap_values_flat):
        contributions.append((col, val))

    # Sort: highest positive impact first
    # (We keep the existing behavior stable and do not change sort direction.)
    is_rejected = (prediction_cls == 1)
    contributions.sort(key=lambda x: x[1], reverse=True) 
    
    top_5 = contributions[:5]
    reasons = []
    
    for feat, val in top_5:
        friendly = FRIENDLY_NAMES.get(feat, feat)
        reasons.append(f"{friendly} influenced this decision")
        
    return reasons

@app.post("/predict")
async def predict_risk(application: LoanApplication):
    if not risk_model:
        raise HTTPException(status_code=500, detail="Model not loaded. Check server logs.")
    
    raw_data = application.model_dump()
    
    try:
        # 1) Feature engineering (raw API input -> model features)
        processed_df = preprocess_user_input(raw_data, model_features)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Preprocessing Error: {str(e)}")
    
    try:
        # 2) Optional scaling (needed for many linear models)
        if risk_scaler:
            scaled_values = risk_scaler.transform(processed_df)
            processed_df = pd.DataFrame(scaled_values, columns=processed_df.columns)
        
        # 3) Predict probability of class 1 (Rejected)
        probs = risk_model.predict_proba(processed_df)
        risk_probability = float(probs[0][1])

        # 4) Apply the custom threshold (stored with the trained model)
        prediction = 1 if risk_probability >= custom_threshold else 0

        # 5) Explanations (computed on the same data given to the model)
        reasons = get_reasons(processed_df, prediction)
        
        return {
            "status": "Rejected" if prediction == 1 else "Approved",
            "risk_score": round(risk_probability * 100, 2),
            "threshold_used": custom_threshold,
            "reasons": reasons
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Prediction Error: {str(e)}")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)