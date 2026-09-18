from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, validator
import numpy as np
import pandas as pd
import joblib
import json
from pathlib import Path
from typing import Literal

# ── paths ─────────────────────────────────────────────────────────────────────
BASE = Path(__file__).parent.parent / "model"
model      = joblib.load(BASE / "best_model.pkl")
scaler     = joblib.load(BASE / "scaler.pkl")
with open(BASE / "model_info.json") as f:
    model_info = json.load(f)

# ── constants ─────────────────────────────────────────────────────────────────
MONTH_MAP = {
    'Jan': 1, 'Feb': 2, 'Mar': 3, 'Apr': 4,
    'May': 5, 'June': 6, 'Jul': 7, 'Aug': 8,
    'Sep': 9, 'Oct': 10, 'Nov': 11, 'Dec': 12,
}

# Columns the scaler was fitted on (19 features, in exact order)
SCALE_COLS = [
    'Administrative', 'Administrative_Duration',
    'Informational', 'Informational_Duration',
    'ProductRelated', 'ProductRelated_Duration',
    'BounceRates', 'ExitRates', 'PageValues', 'SpecialDay',
    'OperatingSystems', 'Browser', 'Region',
    'TrafficType',   # scaled then dropped — not in final model
    'Month_Num',
    'Total_Duration', 'Total_Pages', 'Engagement_Score', 'Avg_Time_Per_Page',
]

# Final 21 features the model was trained on (order must match X_processed.csv)
FINAL_FEATURES: list[str] = model_info['features']

# ── app ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Online Shoppers Purchase Prediction API",
    description="Predicts whether an online shopping session will result in a purchase.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── schema ────────────────────────────────────────────────────────────────────
class SessionInput(BaseModel):
    Administrative:             int   = Field(default=0,    ge=0,  description="Number of administrative pages visited")
    Administrative_Duration:    float = Field(default=0.0,  ge=0,  description="Time on administrative pages (seconds)")
    Informational:              int   = Field(default=0,    ge=0,  description="Number of informational pages visited")
    Informational_Duration:     float = Field(default=0.0,  ge=0,  description="Time on informational pages (seconds)")
    ProductRelated:             int   = Field(default=1,    ge=0,  description="Number of product-related pages visited")
    ProductRelated_Duration:    float = Field(default=0.0,  ge=0,  description="Time on product pages (seconds)")
    BounceRates:                float = Field(default=0.0,  ge=0, le=1, description="Average bounce rate (0–1)")
    ExitRates:                  float = Field(default=0.05, ge=0, le=1, description="Average exit rate (0–1)")
    PageValues:                 float = Field(default=0.0,  ge=0,  description="Average page value of pages visited")
    SpecialDay:                 float = Field(default=0.0,  ge=0, le=1, description="Closeness to a special day (0–1)")
    Month:                      Literal['Jan','Feb','Mar','Apr','May','June','Jul','Aug','Sep','Oct','Nov','Dec'] = Field(default='Nov')
    OperatingSystems:           int   = Field(default=2,    ge=1, le=8)
    Browser:                    int   = Field(default=2,    ge=1, le=13)
    Region:                     int   = Field(default=1,    ge=1, le=9)
    VisitorType:                Literal['New_Visitor','Returning_Visitor','Other'] = Field(default='Returning_Visitor')
    Weekend:                    bool  = Field(default=False)

# ── preprocessing ─────────────────────────────────────────────────────────────
def preprocess(data: dict) -> np.ndarray:
    d = data

    # Derived / encoded values
    month_num        = MONTH_MAP.get(d['Month'], 6)
    visitor_new      = int(d['VisitorType'] == 'New_Visitor')
    visitor_other    = int(d['VisitorType'] == 'Other')
    visitor_return   = int(d['VisitorType'] == 'Returning_Visitor')
    weekend          = int(d['Weekend'])

    total_dur        = d['Administrative_Duration'] + d['Informational_Duration'] + d['ProductRelated_Duration']
    total_pages      = d['Administrative'] + d['Informational'] + d['ProductRelated']
    engagement       = d['ProductRelated'] * d['PageValues']
    avg_time         = total_dur / total_pages if total_pages > 0 else 0.0

    # Build full row (scale_cols + binary cols)
    row = {
        'Administrative':            d['Administrative'],
        'Administrative_Duration':   d['Administrative_Duration'],
        'Informational':             d['Informational'],
        'Informational_Duration':    d['Informational_Duration'],
        'ProductRelated':            d['ProductRelated'],
        'ProductRelated_Duration':   d['ProductRelated_Duration'],
        'BounceRates':               d['BounceRates'],
        'ExitRates':                 d['ExitRates'],
        'PageValues':                d['PageValues'],
        'SpecialDay':                d['SpecialDay'],
        'OperatingSystems':          d['OperatingSystems'],
        'Browser':                   d['Browser'],
        'Region':                    d['Region'],
        'TrafficType':               2,     # not used by model, placeholder for scaler
        'Month_Num':                 month_num,
        'Total_Duration':            total_dur,
        'Total_Pages':               total_pages,
        'Engagement_Score':          engagement,
        'Avg_Time_Per_Page':         avg_time,
        'Weekend':                   weekend,
        'Visitor_New_Visitor':       visitor_new,
        'Visitor_Other':             visitor_other,
        'Visitor_Returning_Visitor': visitor_return,
    }

    df = pd.DataFrame([row])

    # Apply scaler to the exact 19 columns it was fitted on
    df[SCALE_COLS] = scaler.transform(df[SCALE_COLS])

    # Select final 21 features in training order (drops TrafficType & Visitor_Other)
    return df[FINAL_FEATURES]

# ── routes ────────────────────────────────────────────────────────────────────
@app.get("/")
def root():
    return {
        "message": "Online Shoppers Purchase Prediction API",
        "docs":    "/docs",
        "status":  "running",
    }


@app.get("/health")
def health():
    return {
        "status":   "healthy",
        "model":    model_info["model_name"],
        "features": model_info["n_features"],
        "metrics": {
            "accuracy":  model_info["accuracy"],
            "f1_score":  model_info["f1_score"],
            "auc_roc":   model_info["auc_roc"],
        },
    }


@app.post("/predict")
def predict(session: SessionInput):
    try:
        X = preprocess(session.dict())
        prediction  = int(model.predict(X)[0])
        proba       = float(model.predict_proba(X)[0][1])
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return {
        "prediction":              prediction,
        "result":                  "Purchase" if prediction == 1 else "No Purchase",
        "purchase_probability":    round(proba * 100, 2),
        "no_purchase_probability": round((1 - proba) * 100, 2),
        "model":                   model_info["model_name"],
    }


@app.get("/model-info")
def get_model_info():
    return model_info
