# Stress-Management-ML-Engine

An AI/ML-powered stress and welfare risk decision-support backend built with **Python, Flask, XGBoost, SHAP, MongoDB, and an optional LLM layer**.

The system processes longitudinal operational and voluntary wellness data, generates engineered features, predicts stress/welfare risk, explains predictions using SHAP, and provides grounded welfare recommendations.

---

## AI / ML Pipeline

```text
Operational Data
       +
Voluntary Wellness Data
       |
       v
Feature Engineering
       |
       v
31-Feature Canonical Vector
       |
       v
XGBoost Multiclass Model
       |
       +------------------+
       |                  |
       v                  v
Risk Prediction        SHAP
LOW / ELEVATED / HIGH  Explanation
       |
       v
Welfare Decision Support
       |
       v
Grounded Recommendations
       |
       +----------------------+
       |                      |
       v                      v
Knowledge Base           Optional LLM
Retrieval                Recommendation
```

### 1. Feature Engineering

The system converts longitudinal operational and, when consent is available, voluntary wellness information into a canonical **31-feature vector**.

Features are generated from areas such as:

* Duty records
* Leave records
* Deployment records
* Transfer records
* Training records
* Workload records
* Voluntary wellness assessments

Wellness information is incorporated only when the required consent is currently available.

The canonical feature contract is:

```text
surakshai-phase4-feature-v1
```

The model does not directly use identifiers such as `personnel_id`, dates, or target labels as model features.

---

## 2. Machine Learning Model

The active classifier is an **XGBoost multiclass classification model**.

### Output classes

```text
LOW
ELEVATED
HIGH
```

The model produces a risk decision-support prediction from the engineered feature vector.

The current development dataset is the bundled synthetic Phase 4 dataset:

```text
data/surakshai_phase4_synthetic_risk_dataset.csv
```

This dataset is intended for development and experimentation and is **not evidence of production model validity**.

---

## 3. Explainable AI with SHAP

The system uses **SHAP (SHapley Additive exPlanations)** to explain individual model predictions.

```text
Input Features
      |
      v
XGBoost Prediction
      |
      v
SHAP
      |
      v
Feature Contributions
```

SHAP is used to identify which features contributed to a prediction.

For example, the system can expose an explanation showing which engineered factors pushed a prediction toward a particular risk class.

> SHAP explanations describe model behavior. They do not establish causation or clinical meaning.

---

## 4. AI Recommendation Layer

After the ML prediction, the system can provide welfare guidance through two layers.

### Grounded Knowledge Base

The application uses a welfare knowledge collection for retrieval-based guidance.

```text
Risk / Welfare Context
        |
        v
Knowledge Retrieval
        |
        v
Grounded Welfare Guidance
```

The knowledge base is represented by the:

```text
surakshai_welfare_knowledge
```

Chroma collection.

### Optional LLM Layer

An optional OpenAI-compatible provider can generate recommendation text using the retrieved context.

```text
Prediction
    |
    v
Relevant Knowledge
    |
    v
LLM
    |
    v
Recommendation
```

The LLM is therefore an **additional recommendation/generation layer**, not the primary risk prediction model.

If the provider is not configured, provider-generated recommendations fail closed while grounded retrieval remains separate.

---

# Technology Stack

## Backend

* **Python**
* **Flask**
* REST API
* JWT authentication
* Pydantic/schema validation

## Machine Learning

* **XGBoost**
* **SHAP**
* Feature engineering
* Multiclass classification
* Model versioning and candidate model lifecycle

## AI / Generative AI

* Optional **OpenAI-compatible LLM provider**
* Grounded recommendation generation
* Chroma-based welfare knowledge retrieval
* Embeddings using:

```text
sentence-transformers/all-MiniLM-L6-v2
```

## Database

* **MongoDB**

Used for:

* Users
* Personnel records
* Operational records
* Wellness assessments
* Risk predictions
* Alerts
* Interventions
* Support requests
* Model-training jobs

## Infrastructure

* Docker-compatible development environment
* Gunicorn for production WSGI deployment
* MongoDB
* Separate ML model-training worker

---

# System Architecture

```text
                   
                  +--------------------+
                  |    Flask API       |
                  |                    |
                  | Authentication     |
                  | Authorization      |
                  | Validation         |
                  | API Routes         |
                  +---------+----------+
                            |
             +--------------+---------------+
             |              |               |
             v              v               v
         MongoDB        ML Pipeline      AI Layer
             |              |               |
             |              v               v
             |        Feature Engine     Knowledge Base
             |              |               |
             |              v               v
             |           XGBoost           LLM
             |              |
             |              v
             |            SHAP
             |              |
             +--------------+---------------+
                            |
                            v
                  Welfare Decision Support
```

---

# ML Training Architecture

Model training is separated from the Flask API.

```text
                 Admin
                   |
                   v
          Training Plan Request
                   |
                   v
             Flask API
                   |
                   v
             MongoDB Queue
                   |
                   v
        Model Training Worker
                   |
                   v
       Feature Schema + Dataset
                   |
                   v
              XGBoost
                   |
                   v
          Candidate Model
                   |
                   v
       Validation + Evaluation
                   |
                   v
          Explicit Promotion
                   |
                   v
           Active Model
```

Training does not happen directly inside the web request.

The worker processes queued training jobs separately.

Start the worker with:

```bash
python scripts/run_model_training_worker.py
```

---

# Repository Structure

```text
stress-management-engine-backend/
│
├── api_server.py
├── config.py
├── requirements.txt
├── .env.example
│
├── src/
│   ├── features/
│   │   └── Feature engineering
│   │
│   ├── ml/
│   │   ├── XGBoost risk model
│   │   ├── SHAP explanations
│   │   ├── feature schema
│   │   ├── recommendations
│   │   └── model lifecycle
│   │
│   ├── services/
│   ├── schemas/
│   ├── db/
│   ├── security/
│   ├── welfare/
│   └── reports/
│
├── data/
│   └── surakshai_phase4_synthetic_risk_dataset.csv
│
├── models/
│   └── risk/
│       ├── surakshai_risk_model.json
│       ├── metadata.json
│       ├── active.json
│       └── rollback.json
│
├── knowledge_base/
│
├── scripts/
│   ├── train_phase4_risk_model.py
│   ├── run_model_training_worker.py
│   └── ...
│
└── tests/
```

---

# Complete Local Architecture

After everything is running:

```text

   Flask API
        |
        +----------------------+
        |                      |
        v                      v
    MongoDB              ML Pipeline
                               |
                     +---------+---------+
                     |                   |
                     v                   v
              Feature Engineering     XGBoost
                     |                   |
                     |                   v
                     |                 SHAP
                     |                   |
                     +---------+---------+
                               |
                               v
                       Risk Decision Support
                               |
                               v
                     Knowledge Retrieval
                               |
                               v
                       Optional LLM
```

---

# ML Workflow Summary

```text
Raw Operational Data
        +
Wellness Data
        |
        v
Data Validation
        |
        v
Feature Engineering
        |
        v
31-Dimensional Feature Vector
        |
        v
XGBoost Multiclass Classifier
        |
        +----------------+
        |                |
        v                v
 Risk Prediction       SHAP
        |             Explanation
        |
        v
Welfare Decision Support
        |
        v
Knowledge Retrieval
        |
        v
Optional LLM Generation
        |
        v
Human-Reviewed Recommendation
```

---

# Important Design Principle

The project separates the responsibilities of each AI/ML component:

| Component           | Responsibility                                 |
| ------------------- | ---------------------------------------------- |
| Feature Engineering | Convert raw longitudinal data into ML features |
| XGBoost             | Predict welfare/stress risk category           |
| SHAP                | Explain model predictions                      |
| Knowledge Base      | Provide grounded welfare information           |
| LLM                 | Generate contextual recommendation text        |
| Human Review        | Make the final welfare decision                |

The system does **not** allow the ML model or LLM to automatically make personnel, disciplinary, medical, or employment decisions.

---

# Testing

Run the complete backend test suite:

```bash
python -m unittest discover -s tests -p "test_*.py" -v
```

The tests cover API behavior, authentication, consent, wellness, risk prediction/history, welfare workflows, model training, and related services.

---

# Development Notes

The current model uses a **synthetic development dataset**. Model performance on this dataset should not be interpreted as evidence that the system is validated for real-world deployment.

The ML architecture is intentionally separated into:

```text
Data
  ↓
Feature Engineering
  ↓
ML Prediction
  ↓
Explainability
  ↓
Grounded AI
  ↓
Human Review
```

This separation makes it possible to independently improve the feature-engineering pipeline, ML model, explainability layer, and LLM recommendation layer.
