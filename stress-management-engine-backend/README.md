# SURAKSHAI Backend

Flask REST API and background model-training worker for the SURAKSHAI React Native + Expo application. The backend manages authentication, role-based access, consent, operational and voluntary wellness records, welfare risk decision support, human-reviewed follow-up workflows, and candidate model lifecycle operations.

The risk output is a prototype decision-support signal. It is not a clinical assessment, diagnosis, fitness-for-duty determination, disciplinary decision, or automated personnel action.

## Contents

- [Architecture](#architecture)
- [Repository layout](#repository-layout)
- [Requirements and local setup](#requirements-and-local-setup)
- [Configuration](#configuration)
- [Run the API](#run-the-api)
- [Authentication and access control](#authentication-and-access-control)
- [API reference](#api-reference)
- [Risk model and welfare workflow](#risk-model-and-welfare-workflow)
- [Admin model training and lifecycle](#admin-model-training-and-lifecycle)
- [MongoDB and data lifecycle](#mongodb-and-data-lifecycle)
- [Development data and seed scripts](#development-data-and-seed-scripts)
- [Deployment notes](#deployment-notes)
- [Tests](#tests)
- [Troubleshooting](#troubleshooting)

## Architecture

```text
React Native + Expo app
        |
        | HTTPS JSON API; Bearer access token
        v
Flask API (api_server.py)
  | authentication, authorization, consent, validation, audit events
  | services and repositories
  +--> MongoDB: users, personnel, operational records, consent, wellness,
  |              risk history, alerts, interventions, support requests, jobs
  +--> Local model artifacts: active XGBoost model and candidate versions
  +--> Optional OpenAI-compatible recommendation provider

Admin training plan --> explicit confirmation --> MongoDB job queue
                                                   |
                                                   v
                                    separate model-training worker
                                                   |
                                                   v
                                    validated candidate artifacts
                                                   |
                                    explicit admin promotion only
```

The current risk pipeline builds a canonical 31-feature vector from operational history and, when the authenticated person's consent permits it, voluntary wellness data. XGBoost produces one of `LOW`, `ELEVATED`, or `HIGH`. SHAP can explain a prediction. Grounded welfare guidance and alerts support authorized human review; they do not trigger automatic personnel actions.

The current SURAKSHAI API and risk pipeline do not use a physiological wearable model. Legacy WorkWell/WESAD references and a separate legacy Chroma collection are not the current risk path.

## Repository layout

| Path | Purpose |
| --- | --- |
| `api_server.py` | Flask app, route registration, request handling, service wiring |
| `config.py` | Environment loading, defaults, bounds, production configuration checks |
| `src/security/` | JWT authentication, RBAC, consent, rate limits, pseudonymization, audit events |
| `src/schemas/` | Validation and normalization for API payloads |
| `src/db/` | MongoDB client and persistence repositories |
| `src/services/` | User, personnel, operational, wellness, risk-history and dashboard services |
| `src/features/` | Longitudinal feature generation and canonical feature contract |
| `src/ml/` | XGBoost risk scoring, SHAP, grounded recommendations and training lifecycle |
| `src/welfare/` | Alert workflows, support requests and welfare repositories |
| `src/reports/` | Privacy-aware welfare report generation |
| `knowledge_base/` | Grounding content for welfare guidance |
| `data/` | Bundled synthetic Phase 4 training dataset |
| `models/risk/` | Baseline risk model and metadata; active pointer and candidate artifacts are runtime-managed |
| `scripts/` | Development seed, training, and worker commands |
| `tests/` | Python `unittest` suite |
| `.env.example` | Safe configuration template; contains placeholders, not deployment credentials |

## Requirements and local setup

Use Python 3.10 or newer and pip. MongoDB is required for persisted users and most authenticated application features. The root and health endpoints can respond without MongoDB, but `/health` is an API liveness check and does not prove that MongoDB or every feature is ready.

Run these commands from `stress-management-engine-backend/`.

### Windows PowerShell

```powershell
py -3 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
Copy-Item .env.example .env
```

### macOS / Linux

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
cp .env.example .env
```

Edit `.env` locally with your development settings. Never commit `.env`, passwords, tokens, database connection strings, or provider API keys. `.env.example` is intended to be safe to commit.

The Phase 4 model training data is bundled at `data/surakshai_phase4_synthetic_risk_dataset.csv`. The model feature order and class contract are defined in `src/ml/feature_schema.py`.

## Configuration

`config.py` loads `.env` from the backend directory and then reads process environment variables. A value already present in the process environment takes precedence. The complete safe template is in [`.env.example`](.env.example).

| Variable | Purpose and behavior |
| --- | --- |
| `APP_ENV` | `development`, `test`, or `production`; defaults to `development`. `SURAKSHAI_ENV` is a legacy fallback when `APP_ENV` is unset. |
| `DEBUG` | Enables Flask debug mode only outside production; defaults to `false`. |
| `JWT_SECRET_KEY` | Signs and verifies access tokens. Required for login/token use. Production requires a random value of at least 32 characters. |
| `JWT_ALGORITHM` | HMAC algorithm: `HS256`, `HS384`, or `HS512`; defaults to `HS256`. |
| `JWT_ACCESS_TOKEN_EXPIRES_MINUTES` | Token lifetime from 1 to 60 minutes; defaults to `60`. |
| `JWT_ISSUER`, `JWT_AUDIENCE` | Token issuer and audience; default to `surakshai-api` and `surakshai-client`. |
| `PSEUDONYMIZATION_SECRET` | Secret used for privacy-preserving personnel references. Production requires a distinct random value of at least 32 characters. Rotating it changes derived pseudonyms. |
| `MONGODB_URI` | MongoDB connection string. Required for persisted application operations and required by production configuration. |
| `MONGODB_DATABASE` | Database name; defaults to `personnel_welfare` and is limited to 38 UTF-8 bytes. Use a separate database for development or staging. |
| `MONGODB_TIMEOUT_MS` | Server-selection timeout from 100 to 30,000 ms; defaults to `3000`. |
| `MONGODB_TLS` | Optional TLS override. Production non-SRV URIs require TLS; `mongodb+srv` uses MongoDB driver's TLS defaults. A URI must not disable TLS in production. |
| `CORS_ALLOWED_ORIGINS` | Comma-separated browser origins; wildcards are rejected. Empty configuration allows `http://localhost:8083` and `http://127.0.0.1:8083` in development, and no origins in production. Production must list explicit HTTPS origins. Native React Native requests do not use browser CORS. |
| `MAX_REQUEST_SIZE_BYTES` | Maximum request body; defaults to 1 MiB and may be set from 1 KiB to 10 MiB. |
| `LOGIN_RATE_LIMIT` | Login attempts per process/window; defaults to 10, maximum 100. |
| `ADMIN_USER_RATE_LIMIT` | Admin user create/update requests per process/window; defaults to 20, maximum 200. |
| `HRMS_SYNC_RATE_LIMIT` | HRMS sync requests per process/window; defaults to 10, maximum 100. |
| `RATE_LIMIT_WINDOW_SECONDS` | Rate-limit window from 1 to 3,600 seconds; defaults to `60`. |
| `SURAKSHAI_ENABLE_DEV_USER_SEED` | Set to `1` only to create development demo accounts, and only with `APP_ENV=development`. Do not enable in production. Account definitions are in `src/security/demo_users.py`; do not use development accounts in production. |
| `SURAKSHAI_ENABLE_SYNTHETIC_SEED` | Must be exactly `1` to run the synthetic staging seed. The scripts reject production and require an explicitly named development/staging database. |
| `SURAKSHAI_SYNTHETIC_PERSONNEL_COUNT` | Synthetic staging batch size from 20 to 50; defaults to `30`. |
| `SURAKSHAI_SYNTHETIC_SEED_BATCH_ID` | Marker used to identify the synthetic records owned by a seed batch. |
| `SURAKSHAI_STAGING_PERSONNEL_PASSWORD` | Local-only password used when the staging script provisions its test personnel account; minimum 12 characters. The service stores a password hash. |
| `SURAKSHAI_RESET_SYNTHETIC_DATA` | Must be exactly `1` for the guarded staging reset script. |
| `SYNTHETIC_DATA_RANDOM_SEED`, `SYNTHETIC_DATA_AS_OF` | Optional reproducibility controls for generated scenarios and their reference date. |
| `SURAKSHAI_LLM_BASE_URL`, `SURAKSHAI_LLM_MODEL`, `SURAKSHAI_LLM_API_KEY` | Optional OpenAI-compatible recommendation provider settings. Leave unset to fail closed when provider-backed recommendation generation is requested. Store the API key as a secret. |
| `SURAKSHAI_EMBEDDING_MODEL` | Embedding model for grounded welfare retrieval; defaults to `sentence-transformers/all-MiniLM-L6-v2`. |
| `WELFARE_ALERT_PERSISTENCE_WINDOW_DAYS` | Alert persistence evaluation window; defaults to 7 days. |
| `WELFARE_ALERT_ELEVATED_OBSERVATIONS`, `WELFARE_ALERT_HIGH_OBSERVATIONS` | Required repeated observations for alert policy; each defaults to 2. |
| `WELFARE_ALERT_COOLDOWN_DAYS` | Alert cooldown; defaults to 7 days. |
| `WELLNESS_RETENTION_DAYS`, `RISK_RETENTION_DAYS`, `AUDIT_RETENTION_DAYS` | Governance placeholders only. Unset means no approved duration; no cleanup job currently reads these settings. |

In production, `JWT_SECRET_KEY` and `PSEUDONYMIZATION_SECRET` must be distinct, random values; `CORS_ALLOWED_ORIGINS` must be an explicit HTTPS allowlist; and MongoDB must use TLS. Set all secrets in the deployment platform's secret/environment settings, not in source control.

## Run the API

Start MongoDB, configure `.env`, activate the virtual environment, then run:

```bash
python api_server.py
```

The development server binds to `0.0.0.0` and uses `PORT` if set, otherwise port `5000`.

```text
GET http://localhost:5000/
GET http://localhost:5000/health
```

`GET /` returns API metadata and the registered route catalog. `GET /health` reports API process health only. It does not ping MongoDB.

For a local request requiring authentication, first obtain a token from `POST /auth/login`, then send it as `Authorization: Bearer <access_token>`. Do not paste real passwords or tokens into source files, shell history, issue reports, or logs.

## Authentication and access control

`POST /auth/login` authenticates a persisted user account and returns a short-lived JWT. Send the token in the `Authorization: Bearer …` header. Token claims identify the user, username and role; a linked `personnel_id` is included when present. Passwords are stored as hashes by the user service, not as plaintext.

The backend enforces permissions and ownership checks. Hiding a mobile screen does not grant or restrict API access by itself.

| Role | Typical access |
| --- | --- |
| `PERSONNEL` | Own profile-linked operations, consent, own wellness check-ins, own risk views and human support requests. Wellness submission requires `WELLNESS_DATA_PROCESSING` consent. |
| `WELFARE_OFFICER` | Authorized welfare directory and case workflows, support-request queue, and permitted wellness records. |
| `COMMANDER` | Limited aggregate and workforce views. This role does not receive individual wellness-record access or admin capabilities. |
| `ADMIN` | User administration, HRMS import, model training/promotion, and authorized welfare administration. |

Each route still applies its own permission and resource checks. Common responses include `401` for missing or invalid authentication, `403` for a denied role/resource/consent check, `404` for an unknown resource, `409` for a conflict or invalid workflow transition, `429` for a rate limit, and `503` when a dependent service is unavailable. Validation errors generally return `400`.

## API reference

All paths are relative to the service origin. The API does not add an `/api` prefix. Unless noted as public, routes require a valid Bearer token and apply backend authorization.

### Public and authentication routes

| Method and path | Purpose |
| --- | --- |
| `GET /` | API metadata, model summary, and currently registered endpoint catalog. |
| `GET /health` | API liveness response; does not verify MongoDB connectivity. |
| `POST /auth/login` | Authenticate with a JSON body containing `username` and `password`; returns `access_token`, expiry details, and a public user identity. Login is rate limited. |

### Consent

| Method and path | Purpose |
| --- | --- |
| `GET /consent` | Read current authenticated user's consent states. |
| `POST /consent` | Append a consent grant/revocation transition. Requires `consent_type` and boolean `granted`. |

Supported consent types are `WELLNESS_DATA_PROCESSING`, `BIOMETRIC_DATA_PROCESSING`, `RECOMMENDATION_PROCESSING`, and `DATA_SHARING`. Current consent state is default-deny. For example:

```json
{
  "consent_type": "WELLNESS_DATA_PROCESSING",
  "granted": true
}
```

Consent changes are associated with the authenticated identity and linked personnel record. Previous transitions are retained; revocation changes the current state and does not erase prior history.

### Personnel, operational, and risk routes

| Method and path | Purpose |
| --- | --- |
| `GET /personnel/<personnel_id>/operational/<domain>` | Read authorized records for one personnel member. Supports `start_date` and `end_date` filters. |
| `GET /personnel/<personnel_id>/features` | Compute the protected canonical feature vector. Supports `reference_date`. |
| `GET /personnel/<personnel_id>/risk-prediction` | Run risk decision support; supports `reference_date`. |
| `GET /personnel/<personnel_id>/risk-history` | Read authorized persisted prediction history. |
| `GET /personnel/<personnel_id>/risk-explanation` | Return a prediction with SHAP-based explanation; supports `reference_date`. |
| `GET /personnel/<personnel_id>/welfare-recommendations` | Retrieve grounded welfare guidance and, when configured, provider-generated text. |
| `GET /personnel/<personnel_id>/welfare-report` | Generate a privacy-aware PDF report for an authorized requester. |
| `GET /personnel/<personnel_id>/alerts` | List alerts visible to that identity for the requested personnel record. |

The supported operational domains are `duty_records`, `leave_records`, `deployment_records`, `transfer_records`, `training_records`, and `workload_records`. Each domain has a strict schema; see `src/schemas/operational.py`. A person identifier follows the form `P001`, `P002`, and so on. The model uses 31 canonical features defined in `src/ml/feature_schema.py`; `personnel_id`, dates, and the target label are not model input features.

### Wellness check-ins

| Method and path | Purpose |
| --- | --- |
| `POST /personnel/me/wellness` | Submit the authenticated personnel member's own voluntary check-in. Requires `WELLNESS_DATA_PROCESSING` consent. |
| `GET /personnel/me/wellness` | List the authenticated user's own assessments. |
| `GET /personnel/me/wellness/<assessment_id>` | Read one of the authenticated user's own assessments. |
| `DELETE /personnel/me/wellness/<assessment_id>` | Delete one of the authenticated user's own assessments. |
| `GET /personnel/<personnel_id>/wellness` | Authorized staff read of an individual personnel member's assessments. |

A check-in body contains an ISO `YYYY-MM-DD` `assessment_date` and four integer values from 1 through 5:

```json
{
  "assessment_date": "2026-09-29",
  "sleep_quality": 3,
  "fatigue_level": 2,
  "perceived_stress": 2,
  "mood_wellbeing": 4
}
```

Future dates, missing or extra fields, and values outside the scale are rejected. The API resolves `/me` from the authenticated identity and its linked personnel ID; clients must not choose another person's ID for own-record endpoints.

### Operational records

| Method and path | Purpose |
| --- | --- |
| `GET /operational/<domain>` | List records in an authorized domain. |
| `POST /operational/<domain>` | Create a validated record when the role has write permission. |
| `GET /operational/<domain>/<record_id>` | Read one authorized record. |
| `PUT /operational/<domain>/<record_id>` or `PATCH ...` | Update an authorized record. |
| `DELETE /operational/<domain>/<record_id>` | Delete an authorized record. |
| `GET /operational/summary` | Return authorized aggregate operational metrics. |

Operational payload requirements and allowed values are defined per domain in `src/schemas/operational.py`. Access is role and resource scoped; the generic route shape does not imply that every role can read or modify every personnel member's records.

### Personnel-initiated support and follow-up

| Method and path | Purpose |
| --- | --- |
| `POST /personnel/me/support-requests` | Create a request for human welfare follow-up. |
| `GET /personnel/me/support-requests` | List the requester's own requests. |
| `GET /personnel/me/support-requests/<support_request_id>` | Read one of the requester's own requests. |
| `GET /welfare/support-requests` | Authorized welfare staff queue; optional `status` filter. |
| `POST /welfare/support-requests/<support_request_id>/acknowledge` | Acknowledge a request. |
| `POST /welfare/support-requests/<support_request_id>/schedule` | Schedule human follow-up. Body: `{"scheduled_follow_up":"<ISO-8601 timestamp with timezone>"}`. |
| `POST /welfare/support-requests/<support_request_id>/start` | Mark human follow-up in progress. |
| `POST /welfare/support-requests/<support_request_id>/resolve` | Resolve after human follow-up. |

Support request categories are `GENERAL_WELFARE`, `WORKLOAD_FATIGUE`, `SLEEP_RECOVERY`, `PERSONAL_SUPPORT`, and `OTHER`. Urgency is `NORMAL` or `URGENT`. The request lifecycle uses `REQUESTED`, `ACKNOWLEDGED`, `SCHEDULED`, `IN_PROGRESS`, and `RESOLVED`. Personnel can view their own requests but cannot change staff workflow state.

### Welfare directory, dashboard, alerts, and interventions

| Method and path | Purpose |
| --- | --- |
| `GET /welfare/personnel` | Privacy-minimized, paginated personnel directory. Supports `page`, `page_size`, `search`, `status`, and `unit`. |
| `GET /welfare/personnel/<personnel_id>` | Read an authorized privacy-minimized directory entry. |
| `GET /welfare/risk-summary` | Authorized aggregate persisted risk summary. |
| `GET /welfare/dashboard/summary` | Authorized welfare dashboard metrics. |
| `GET /welfare/alerts` | List alerts visible to authorized welfare staff. |
| `POST /welfare/alerts/evaluate/<personnel_id>` | Evaluate a prediction against the persistence policy and create/escalate an alert when due. |
| `GET /welfare/alerts/<alert_id>` | Read an alert when visible to the requester. |
| `POST /welfare/alerts/<alert_id>/acknowledge` | Acknowledge an alert. |
| `POST /welfare/alerts/<alert_id>/review` | Move an alert into human review. |
| `POST /welfare/alerts/<alert_id>/intervention` | Create a human support intervention. |
| `POST /welfare/alerts/<alert_id>/follow-up` | Schedule alert follow-up. |
| `POST /welfare/alerts/<alert_id>/resolve` | Resolve an alert explicitly. |
| `POST /welfare/alerts/<alert_id>/dismiss` | Dismiss an alert after authorized review. |
| `PATCH /welfare/interventions/<intervention_id>` | Update intervention status and optional outcome category. |

Alert status transitions are controlled by the service: `OPEN` to `ACKNOWLEDGED` or `DISMISSED`; `ACKNOWLEDGED` to `UNDER_REVIEW`; `UNDER_REVIEW` to `ACTION_PLANNED` or `DISMISSED`; `ACTION_PLANNED` to `FOLLOW_UP` or `RESOLVED`; and `FOLLOW_UP` to `RESOLVED` or `ACTION_PLANNED`. Invalid transitions return a conflict. Workflow actions require authorized staff; no automatic intervention or disciplinary action occurs.

### Admin user and integration routes

All routes in this group require an `ADMIN` account with the corresponding permission.

| Method and path | Purpose |
| --- | --- |
| `GET /admin/users` | List user accounts; optional `status` and `role` filters. |
| `POST /admin/users` | Provision a user with `username`, `password`, `role`, and optional `personnel_id` and `status`. |
| `GET /admin/users/<user_id>` | Read a user account. |
| `PATCH /admin/users/<user_id>` | Update only `password`, `role`, `personnel_id`, or `status`. |
| `POST /admin/integrations/hrms/sync` | Import normalized HRMS personnel records; limited to 500 records per request. |

The HRMS endpoint accepts normalized payloads; it does not connect to an external HRMS and does not create application users. `external_personnel_id` remains an external identifier and is never treated as the internal personnel ID. An optional `personnel_id` explicitly maps a known internal record. Mapping conflicts return `409`; invalid or oversized requests return `400`. Inactive upstream records are marked inactive while related records/history remain retained.

Example HRMS request:

```json
{
  "records": [
    {
      "external_personnel_id": "HRMS-84721",
      "unit_id": "UNIT-A",
      "rank": "Officer",
      "service_years": 5,
      "posting_type": "FIELD",
      "status": "ACTIVE",
      "external_updated_at": "2026-09-27T10:00:00Z"
    }
  ]
}
```

## Risk model and welfare workflow

- The active classifier is an XGBoost multiclass model with `LOW`, `ELEVATED`, and `HIGH` output labels.
- The canonical feature contract is `surakshai-phase4-feature-v1`, with 31 feature values sourced from operational records and optionally consented wellness data.
- Wellness values are incorporated only when consent is currently granted and an eligible assessment is available. Without authorized wellness data, the prediction uses operational features only.
- SHAP supplies an explanation for a prediction; it does not establish causation or clinical meaning.
- The bundled Phase 4 dataset is synthetic development data. It is not evidence of production model validity.
- Alert evaluation uses persistence and cooldown policy settings. It does not automatically contact a person or change duty status.
- Grounded welfare recommendations use the `surakshai_welfare_knowledge` Chroma collection. Optional generated text requires an explicitly configured provider; otherwise provider-backed generation fails closed.

The baseline model and metadata are stored in `models/risk/surakshai_risk_model.json` and `models/risk/metadata.json`. Candidate models are stored separately. The active version is selected by `models/risk/active.json`; promotion saves rollback information in `models/risk/rollback.json`. Keep this directory backed up and available to both the API process and training worker.

## Admin model training and lifecycle

Model-management routes are restricted to `ADMIN`. The service accepts only the canonical bundled dataset, current feature schema, and allow-listed XGBoost training algorithm. It does not accept shell/Python/SQL, arbitrary datasets or paths, model families, random seeds, or arbitrary estimator parameters. Unsupported or ambiguous instructions are rejected.

| Method and path | Purpose |
| --- | --- |
| `POST /admin/model-training/plan` | Validate and persist a plan; does not start training. |
| `POST /admin/model-training/confirm` or `POST /admin/model-training/jobs` | Explicitly confirm/enqueue a plan. |
| `GET /admin/model-training/jobs` | List jobs; supports `status` and `limit` (1–100). `PLANNED` records are omitted from this listing. |
| `GET /admin/model-training/jobs/<job_id>` | Read one job. |
| `GET /admin/models` or `GET /admin/model-training/models` | List active model and successful candidates. |
| `POST /admin/models/<model_id>/promote` or `POST /admin/model-training/models/<model_id>/promote` | Explicitly promote a validated candidate. |

The plan body must contain exactly one request field:

```json
{"instruction":"train a new candidate risk model using the latest approved dataset."}
```

or a strict `config` object containing only `n_estimators` (50-1000), `learning_rate` (0.001-0.3), `max_depth` (2-12), `subsample` (0.5-1.0), and `colsample_bytree` (0.5-1.0). Omitted parameters use established defaults. Every plan is persisted internally as `PLANNED`; requests using the mobile `request_text` field report `AWAITING_CONFIRMATION` in the response. Confirmation is a separate explicit request. For example:

```json
{"plan_id":"<plan_id>","confirmation":true}
```

Confirmation returns `202 Accepted` and enqueues the job in MongoDB. It does not train inside the web request. Job lifecycle is `PLANNED` → `QUEUED` → `RUNNING` → `SUCCEEDED` or `FAILED`. A successful candidate remains separate from the active model until an administrator explicitly promotes it. Candidate loading, feature/class compatibility, and metrics are validated before success/promotion.

Run at least one worker alongside the API:

```bash
python scripts/run_model_training_worker.py
```

The default poll interval is two seconds. `--poll-interval-seconds 5` changes the interval; `--once` processes at most one available job and exits. The interval must be between 0.1 and 60 seconds.

The API, worker, and all API instances must share the same MongoDB and durable/shared model artifact directory. A local ephemeral filesystem can lose candidate artifacts on restart or redeploy. Promotion is an explicit lifecycle operation; do not treat training success as automatic activation.

## MongoDB and data lifecycle

The application uses the database named by `MONGODB_DATABASE`. Collections are created/used by repositories as needed; common collection names include:

| Collection | Data |
| --- | --- |
| `users` | Login identities, role, linked personnel ID, account status, password hash |
| `personnel_identity` | Personnel records used to link authenticated accounts to personnel IDs; the repository also recognizes a legacy `personnel` alias. |
| Operational domain collections | `duty_records`, `leave_records`, `deployment_records`, `transfer_records`, `training_records`, and `workload_records`. |
| `consents` | Append-only grant/revoke transitions, with current state derived by the consent service |
| `wellness_assessments` | Voluntary self-assessments |
| `risk_predictions` | Persisted risk observations/history |
| `welfare_alerts` | Human-reviewed alerts and workflow state |
| `welfare_interventions` | Human support action plans and status |
| `personnel_support_requests` | Personnel-initiated human follow-up requests |
| `model_training_jobs` | Persistent training plans and job status |

Collections are listed for orientation; check the repository implementation before planning a migration. The current lifecycle behavior is:

- Wellness is voluntary and consent-gated; a person can delete their own assessment through the API.
- Consent transitions are retained. Revocation affects current processing authorization, not prior transition history.
- Risk history, alerts, interventions, support requests, personnel history, and audit events have no automatic age-based cleanup.
- Disabled user accounts remain stored but cannot log in.
- Personnel deactivation preserves related records and history.
- The audit service currently uses an in-memory development store. It is not durable across process restarts and is not sufficient as a production audit sink.
- The application does not perform database backups or define backup/restore objectives. Operators must provide an approved encrypted backup, restore, retention, and recovery process.
- Retention variables are placeholders; setting them does not start a deletion or retention job.

Before production use with personnel or wellness data, provide an approved durable, access-controlled audit sink and establish data retention, backup, restore, access review, and secret-rotation procedures.

## Development data and seed scripts

Seed commands write data. Use a disposable development or staging MongoDB database; do not run them against production.

| Script | Purpose |
| --- | --- |
| `scripts/seed_personnel.py` | Create a small development personnel set; explicitly gated by `SURAKSHAI_ENABLE_DEV_USER_SEED=1` and disabled in production. |
| `scripts/seed_staging_dataset.py` | Build a tagged synthetic staging dataset using normal services. Requires explicit development settings and a separately named staging/development database. |
| `scripts/reset_staging_dataset.py` | Remove only records owned by the configured seed batch after the explicit reset flag is enabled. |
| `scripts/train_phase4_risk_model.py` | Development-only direct training command. It writes model plus metadata into the baseline model directory; do not use it as the admin candidate-training flow or run it against production artifacts. |

Example staging seed setup (PowerShell):

```powershell
$env:APP_ENV = 'development'
$env:SURAKSHAI_ENABLE_SYNTHETIC_SEED = '1'
$env:MONGODB_DATABASE = 'surakshai_staging'
$env:SURAKSHAI_STAGING_PERSONNEL_PASSWORD = '<local-development-password>'
python scripts/seed_staging_dataset.py
```

The staging seed defaults to 30 synthetic personnel starting at `P900` and supports counts from 20 to 50. A repeated batch fails closed until records from that exact batch are reset. To reset, set `SURAKSHAI_RESET_SYNTHETIC_DATA=1` and run `python scripts/reset_staging_dataset.py`, then re-run the seed. Reset removes only documents carrying the selected batch marker from known seed-owned collections; it does not drop the database or delete unrelated records, audit events, model artifacts, application configuration, or demo users.

The staging script uses normal application services and creates no training data or model artifacts. It intentionally does not call external recommendation generation or PDF report generation because a configured provider may transmit case context outside the deployment.

## Deployment notes

For Render or another WSGI host, set the backend directory as the service root, install `requirements.txt`, and use a WSGI server such as Gunicorn. A typical web-service start command is:

```bash
gunicorn --bind 0.0.0.0:$PORT api_server:app
```

Set `APP_ENV=production`, the production secrets, MongoDB URI/database/TLS settings, and explicit HTTPS `CORS_ALLOWED_ORIGINS` in the platform environment. Never put secret values in the command, README, `.env.example`, or source. Configure the training worker as a separate long-running worker process with the same code revision, MongoDB settings, and shared durable model-artifact storage:

```bash
python scripts/run_model_training_worker.py
```

### Production deployment constraints

- `python api_server.py` invokes `validate_production_configuration()` before it starts. Gunicorn imports `api_server:app` instead of running the module as `__main__`, so that specific validation function is not invoked by the example Gunicorn command. Validate required production configuration in the deployment/release process and ensure the production values meet the checks documented above.
- Rate limits are process-local. With multiple workers or service instances, configure a shared gateway/proxy rate limit for login, admin user changes, and HRMS sync.
- The audit implementation is in-memory; use an approved durable audit system before production operation requiring persistent audit history.
- Candidate artifacts and `active.json` are files. The API and worker must see the same durable artifacts. Plan for backup and rollback of model artifacts and pointers.
- The current `/health` response is liveness only; use platform checks for database readiness if required.
- Configure an explicit CORS allowlist for browser-based clients. Native React Native requests are not governed by browser CORS; no CORS bypass client library is needed.

## Tests

The backend tests use Python's standard `unittest` framework. From this directory, run the full suite with:

```bash
python -m unittest discover -s tests -p "test_*.py" -v
```

The suite covers API behavior, authentication and security controls, consent persistence, wellness, risk history, welfare workflows, HRMS boundaries, model training, and related services. Tests should use isolated fixtures/mocks and must not target production MongoDB or credentials.

## Troubleshooting

| Symptom | Checks |
| --- | --- |
| Login returns `503` | Check MongoDB reachability, `MONGODB_URI`, database permissions, and `JWT_SECRET_KEY`. The persistent user repository must be available. |
| Login returns `401` | Confirm the account exists, is active, and the username/password are correct. Development seed accounts are created only when explicitly enabled in development. |
| Protected route returns `401` | Send `Authorization: Bearer <access_token>`, check expiry, and confirm JWT issuer/audience/secret settings match the API that issued the token. |
| Protected route returns `403` | Check the token's role, route permission, linked `personnel_id`, resource ownership, and required current consent. Authorization remains enforced on the backend. |
| Wellness submission returns `403` | Verify the authenticated personnel identity is linked and `WELLNESS_DATA_PROCESSING` is currently granted for that identity. The wellness service denies by default. |
| Wellness submission returns `409` | Check whether an assessment already exists for the same personnel/date; duplicate submissions are conflicts. |
| `/health` succeeds while database-backed routes fail | `/health` is liveness only. Check the MongoDB connection and database name separately. |
| Training remains `QUEUED` | Confirm a training worker is running with the same MongoDB configuration and can access the shared model-artifact directory. |
| Candidate model is missing after restart | Check whether the runtime filesystem is ephemeral and whether API/worker share durable storage. |
| Recommendation generation is unavailable | Configure the optional provider settings and check provider reachability. Without a provider, generated recommendations fail closed; grounded retrieval remains separate. |
| Browser request is blocked by CORS | Add the exact browser origin to `CORS_ALLOWED_ORIGINS`; do not use `*`. CORS does not control native React Native networking. |

Do not log passwords, password hashes, JWTs, authorization headers, MongoDB URIs, provider API keys, or request bodies containing sensitive information.

## License and intended use

See [`LICENSE`](LICENSE). The risk and welfare features are research/development decision-support functionality. They require qualified human review and must not be used as a substitute for professional medical advice, diagnosis, treatment, or an employment/fitness decision.
