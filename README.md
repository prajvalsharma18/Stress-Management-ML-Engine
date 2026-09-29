# Stress-Management-Engine — AI/ML Personnel Welfare Decision Support

stress-management-engine is a project that combines operational records, optional consented self-reported wellness data, and an interpretable risk model to support human welfare review. The repository contains a React/TypeScript web frontend and a Flask API with model scoring, explanation, grounded recommendation, alert workflow, and administrator-managed model training capabilities.

> **Intended use:** The model produces a prototype decision-support signal. It is not a clinical assessment or diagnosis, and it must not be used to make fitness-for-duty, disciplinary, employment, or other automated personnel decisions. The bundled training data is synthetic and does not establish real-world validity.

## AI/ML workflow

The online prediction path is consent-aware and runs through the backend:

```text
Authorized operational records ─┐
                                ├─> longitudinal feature service
Current wellness consent +      │      └─> canonical 31-feature vector
eligible voluntary assessment ──┘                 │
                                                  v
                                      active XGBoost classifier
                                       ├─> risk class + probabilities
                                       ├─> SHAP explanation (on request)
                                       └─> grounded welfare guidance (on request)
```

1. The API checks identity, role, resource access, and (for wellness input) current consent.
2. The feature service computes operational history features for the requested reference date.
3. `risk_features.py` maps service output into the ordered feature contract. When consent is absent, revoked, or no eligible assessment exists, wellness measurements are missing and `wellness_available` is `0`.
4. The active model returns `LOW`, `ELEVATED`, or `HIGH` probabilities and the selected class.
5. On explanation requests, SHAP TreeExplainer ranks the largest signed contributions for the predicted class.
6. On recommendation requests, the backend retrieves relevant local welfare knowledge and asks the configured provider to return recommendations with citations to retrieved source IDs. The response is validated before it is returned.
7. Alerts are evaluated under persistence/cooldown policy and then handled through explicit human review workflows. Prediction does not itself contact a person or trigger an intervention.

The API is the authority for access control and data authorization. Frontend route guards improve navigation but do not replace backend checks.

## Model and feature contract

The current baseline is an **XGBoost multiclass classifier**. Its artifacts are in `stress-management-engine-backend/models/risk/`; the baseline metadata identifies model version `surakshai-risk-v0.1`. The model consumes exactly 31 numeric features in the order declared in `src/ml/feature_schema.py`. The contract version is `surakshai-phase4-feature-v1`.

| Feature group | Signals |
| --- | --- |
| Duty and schedule | 7/30-day average duty hours, night duty counts and rates, recent trends, current and maximum consecutive duty days |
| Workload | 7/30-day averages and trend, task average, high-workload days, workload/duty-hours mean |
| Leave and personnel movement | Days since most recent leave, recent leave days and episodes, recent transfers |
| Deployment and training | Current/recent deployment duration and count, current deployment intensity, recent training hours and sessions |
| Voluntary wellness | Latest eligible sleep quality, fatigue, perceived stress, mood/wellbeing, plus the `wellness_available` indicator |

Personnel identifiers, reference dates, dataset split labels, and the target label are metadata or labels; they are not model inputs. The model adapter maps source field aliases, converts deployment intensity categories to numeric values, and preserves the canonical feature order. Missing operational values are represented as `NaN`; model behavior with missing values follows the serialized XGBoost estimator. Training fills missing values using medians computed from the training partition.

### Classes and output

Class codes map to `LOW`, `ELEVATED`, and `HIGH`. Prediction responses include the selected category, per-class probabilities, reference date, model version, and whether the run used `OPERATIONAL_ONLY` or `OPERATIONAL_AND_WELLNESS` data. That data mode is useful context; it does not imply that wellness data was medically evaluated.

### Baseline evaluation snapshot

The checked-in metadata reports training-script metrics on the dataset's designated `TEST` partition (80,000 total rows):

| Metric | Recorded value |
| --- | ---: |
| Accuracy | 0.567 |
| Macro precision | 0.570 |
| Macro recall | 0.527 |
| Macro F1 | 0.518 |
| LOW class F1 | 0.649 |
| ELEVATED class F1 | 0.625 |
| HIGH class F1 | 0.279 |

These are results on a **synthetic dataset**, not evidence of deployment performance. In particular, the recorded HIGH-class F1 is low. Before any real-world use, the model needs independently reviewed data provenance and labels, leakage and split audits, subgroup and calibration analysis, prospective validation, threshold review, and a governance process involving qualified domain experts. Do not interpret the scores as clinical risk or an individual's underlying state.

## Explainability and grounded recommendations

### SHAP explanations

`src/ml/shap_explainer.py` uses a cached SHAP `TreeExplainer` for the loaded XGBoost estimator. The API reports top contributors for the selected predicted class, including feature label, signed SHAP value, and a direction label. These describe model attribution for this prediction; they do not establish causation or explain a person's wellbeing in a clinical sense. Explanation and recommendation routes can fail independently if SHAP or its compatible runtime dependencies are unavailable.

### Retrieval and optional language model

Welfare recommendations combine the risk result and explanation with retrieved passages from the local `surakshai_welfare_knowledge` collection. An optional OpenAI-compatible provider may produce structured guidance from this context. Provider configuration uses `SURAKSHAI_LLM_BASE_URL`, `SURAKSHAI_LLM_MODEL`, and `SURAKSHAI_LLM_API_KEY`; without a configured provider, provider-backed recommendation generation fails closed. Returned recommendations must use allowed categories/priorities and cite retrieved source IDs. Generated guidance remains a human-reviewed support aid, not an automatic action.

## Training and model lifecycle

Training uses the bundled file `stress-management-engine-backend/data/surakshai_phase4_synthetic_risk_dataset.csv` and the canonical schema. The trainer uses the dataset's `TRAIN`, `VALIDATION`, and `TEST` split labels, fits XGBoost using the training partition, evaluates on the test partition, and writes the model plus metadata. Default parameters are 300 estimators, learning rate 0.05, max depth 6, subsample 0.9, column subsample 0.9, and random seed 42.

For administrator-managed training, the API accepts a constrained plan, requires a separate confirmation, and stores a job in MongoDB. A separate worker claims queued work, writes candidate artifacts, and validates feature version, feature list/count, classes, metrics, and model loadability. A successful candidate does **not** become active automatically. Promotion is an explicit administrator action; the active pointer and rollback metadata are stored alongside model artifacts. API instances and the worker must share the same MongoDB and durable model directory.

The direct script `scripts/train_phase4_risk_model.py` writes to the baseline model directory and is intended for development. Do not use it as the production candidate-promotion workflow.

## Running locally

Requirements: Python 3.10+, Node.js/npm, MongoDB, and the Python packages in the backend `requirements.txt`.

1. Configure the backend by copying `stress-management-engine-backend/.env.example` to `.env`; set a development JWT secret, MongoDB URI/database, and browser CORS origin. The Vite development server defaults to `http://localhost:5173`, so include that exact origin in `CORS_ALLOWED_ORIGINS`.
2. Install backend dependencies and start MongoDB. From the backend directory, run `python api_server.py` (default API: `http://localhost:5000`).
3. Configure the frontend `VITE_API_BASE_URL` (the provided example uses `http://localhost:5000`). From the frontend directory, run `npm install` and `npm run dev`.
4. Persisted authentication and most application features require MongoDB and an appropriately provisioned account. Demo users are opt-in and development-only; see the backend README for safe setup and seed instructions.
5. To process administrator-confirmed model jobs, run `python scripts/run_model_training_worker.py` from the backend directory in a separate process.

For the direct development training script, use the backend Python environment and run `python scripts/train_phase4_risk_model.py` from the backend directory. It writes into `models/risk/`, so preserve the distinction between local experimentation and the validated candidate lifecycle.

## API and frontend status

The Flask API exposes authentication, consent, operational records and features, risk prediction/history/explanation, welfare recommendations/reports, alerts, support requests, personnel directory, admin user/integration management, and model lifecycle endpoints. The frontend uses a shared Axios client and typed API modules under `stress-management-engine-frontend/src/api/`.

The web UI currently implements login, role-based routing, welfare dashboard/directory/case views, and basic commander/admin dashboards. Several API modules exist without complete corresponding frontend screens (including consent, wellness submission, support requests, and admin user/model management). The API surface should therefore not be read as a claim that every backend feature is available through the current UI. Verify local CORS settings against the actual frontend origin.

## Repository guide

| Path | Responsibility |
| --- | --- |
| `stress-management-engine-backend/src/features/` | Operational history feature generation |
| `stress-management-engine-backend/src/ml/feature_schema.py` | Canonical 31-feature and class contract |
| `stress-management-engine-backend/src/ml/risk_features.py` | Input normalization and wellness-aware vector adapter |
| `stress-management-engine-backend/src/ml/risk_model.py` | Model loading, compatibility validation, prediction |
| `stress-management-engine-backend/src/ml/risk_service.py` | Authorization-aware inference and auditing |
| `stress-management-engine-backend/src/ml/shap_explainer.py` | SHAP explanation generation |
| `stress-management-engine-backend/src/ml/welfare_rag.py` | Local knowledge retrieval |
| `stress-management-engine-backend/src/ml/welfare_provider.py` | Optional recommendation provider |
| `stress-management-engine-backend/src/ml/training_service.py` | Training plans, worker lifecycle, candidate validation and promotion |
| `stress-management-engine-backend/scripts/train_phase4_risk_model.py` | Dataset training/evaluation script |
| `stress-management-engine-backend/models/risk/` | Baseline model, metadata, and runtime-managed active/candidate state |
| `stress-management-engine-backend/tests/` | Backend API, security, workflow, and ML-related tests |
| `stress-management-engine-frontend/src/api/` | Typed frontend API clients |

## Further documentation

- [Backend setup, API reference, configuration, security, and deployment](stress-management-engine-backend/README.md)
- [Backend requirements](stress-management-engine-backend/requirements.txt)
- [Canonical model feature schema](stress-management-engine-backend/src/ml/feature_schema.py)
- [Baseline model metadata and recorded evaluation](stress-management-engine-backend/models/risk/metadata.json)

