"""Personnel-initiated requests for human welfare support."""

from datetime import datetime, timezone
from uuid import uuid4

from pymongo.errors import DuplicateKeyError

from src.security.audit import RESULT_DENIED, RESULT_SUCCESS, get_audit_service
from src.security.permissions import (
    PERMISSION_CREATE_OWN_SUPPORT_REQUEST,
    PERMISSION_MANAGE_SUPPORT_REQUESTS,
    PERMISSION_VIEW_OWN_SUPPORT_REQUESTS,
    PERMISSION_VIEW_SUPPORT_REQUESTS,
    ROLE_ADMIN,
    ROLE_PERSONNEL,
    ROLE_WELFARE_OFFICER,
)
from src.security.rbac import has_permission


SUPPORT_REQUEST_CATEGORIES = (
    'GENERAL_WELFARE',
    'WORKLOAD_FATIGUE',
    'SLEEP_RECOVERY',
    'PERSONAL_SUPPORT',
    'OTHER',
)
SUPPORT_REQUEST_URGENCIES = ('NORMAL', 'URGENT')
SUPPORT_REQUEST_STATUSES = (
    'REQUESTED',
    'ACKNOWLEDGED',
    'SCHEDULED',
    'IN_PROGRESS',
    'RESOLVED',
)
SUPPORT_REQUEST_TRANSITIONS = {
    'REQUESTED': {'ACKNOWLEDGED', 'SCHEDULED', 'IN_PROGRESS', 'RESOLVED'},
    'ACKNOWLEDGED': {'SCHEDULED', 'IN_PROGRESS', 'RESOLVED'},
    'SCHEDULED': {'SCHEDULED', 'IN_PROGRESS', 'RESOLVED'},
    'IN_PROGRESS': {'SCHEDULED', 'RESOLVED'},
    'RESOLVED': set(),
}


class SupportRequestError(Exception):
    """Base error for support-request operations."""


class SupportRequestNotFound(SupportRequestError):
    pass


class DuplicateSupportRequest(SupportRequestError):
    pass


class SupportRequestConflict(SupportRequestError):
    pass


class SupportRequestAuthorizationError(PermissionError):
    pass


def _now():
    return datetime.now(timezone.utc).isoformat()


def _parse_payload(payload):
    if not isinstance(payload, dict):
        raise ValueError('A JSON object is required')
    allowed = {'related_alert_id', 'category', 'message', 'urgency'}
    if set(payload) - allowed:
        raise ValueError('Unsupported support request fields')

    category = payload.get('category')
    if category not in SUPPORT_REQUEST_CATEGORIES:
        raise ValueError('Select a valid support category')

    urgency = payload.get('urgency')
    if urgency not in SUPPORT_REQUEST_URGENCIES:
        raise ValueError('Select a valid urgency')

    related_alert_id = payload.get('related_alert_id')
    if related_alert_id is not None and (
        not isinstance(related_alert_id, str)
        or not related_alert_id.strip()
        or len(related_alert_id) > 160
    ):
        raise ValueError('related_alert_id must be a non-empty identifier')

    message = payload.get('message')
    if message is not None and not isinstance(message, str):
        raise ValueError('message must be text')
    message = message.strip() if isinstance(message, str) else ''
    if len(message) > 2000:
        raise ValueError('message must be 2000 characters or fewer')

    return {
        'related_alert_id': related_alert_id.strip() if related_alert_id else None,
        'category': category,
        'message': message or None,
        'urgency': urgency,
    }


def _parse_follow_up(value):
    if not isinstance(value, str) or not value.strip():
        raise ValueError('scheduled_follow_up is required')
    try:
        parsed = datetime.fromisoformat(value.strip().replace('Z', '+00:00'))
    except ValueError as error:
        raise ValueError('scheduled_follow_up must be an ISO 8601 date-time') from error
    if parsed.tzinfo is None:
        raise ValueError('scheduled_follow_up must include a time zone')
    return parsed.astimezone(timezone.utc).isoformat()


def personnel_request_view(record):
    """Return only fields appropriate for the requesting personnel member."""
    fields = (
        'support_request_id', 'related_alert_id', 'category', 'message',
        'urgency', 'status', 'created_at', 'updated_at', 'acknowledged_at',
        'scheduled_follow_up', 'closed_at',
    )
    return {key: record.get(key) for key in fields}


def staff_request_view(record):
    fields = (
        'support_request_id', 'personnel_id', 'requester_user_id',
        'related_alert_id', 'category', 'message', 'urgency', 'status',
        'created_at', 'updated_at', 'acknowledged_at',
        'scheduled_follow_up', 'closed_at', 'assigned_to_user_id',
    )
    return {key: record.get(key) for key in fields}


class SupportRequestRepository:
    COLLECTION_NAME = 'personnel_support_requests'

    def __init__(self, database=None):
        self.database = database
        self.collection = None if database is None else database.get_collection(self.COLLECTION_NAME)
        if self.collection is not None:
            self.collection.create_index('support_request_id', unique=True)
            self.collection.create_index([('personnel_id', 1), ('created_at', -1)])
            self.collection.create_index([('status', 1), ('created_at', 1)])
            self.collection.create_index(
                [('active_alert_personnel_id', 1), ('active_alert_id', 1)],
                unique=True,
                sparse=True,
            )

    def _ensure_collection(self):
        if self.collection is None and getattr(self, 'database', None) is None:
            from src.db.mongodb import get_database
            self.database = get_database()
        if self.collection is None and self.database is not None:
            self.collection = self.database.get_collection(self.COLLECTION_NAME)
            self.collection.create_index('support_request_id', unique=True)
            self.collection.create_index([('personnel_id', 1), ('created_at', -1)])
            self.collection.create_index([('status', 1), ('created_at', 1)])
            self.collection.create_index(
                [('active_alert_personnel_id', 1), ('active_alert_id', 1)],
                unique=True,
                sparse=True,
            )

    @staticmethod
    def _clean(record):
        return None if record is None else {key: value for key, value in record.items() if key != '_id'}

    def create(self, record):
        self._ensure_collection()
        if self.collection is None:
            raise RuntimeError('Support request database is unavailable')
        try:
            self.collection.insert_one(dict(record))
        except DuplicateKeyError as error:
            raise DuplicateSupportRequest('An active request already exists for this alert') from error
        return dict(record)

    def get(self, support_request_id):
        self._ensure_collection()
        if self.collection is None:
            raise RuntimeError('Support request database is unavailable')
        return self._clean(self.collection.find_one({'support_request_id': support_request_id}))

    def get_active_for_alert(self, personnel_id, alert_id):
        self._ensure_collection()
        if self.collection is None:
            raise RuntimeError('Support request database is unavailable')
        return self._clean(self.collection.find_one({
            'active_alert_personnel_id': personnel_id,
            'active_alert_id': alert_id,
        }))

    def list_for_personnel(self, personnel_id):
        self._ensure_collection()
        if self.collection is None:
            raise RuntimeError('Support request database is unavailable')
        return [self._clean(item) for item in self.collection.find(
            {'personnel_id': personnel_id}
        ).sort('created_at', -1)]

    def list_for_staff(self, status=None):
        self._ensure_collection()
        if self.collection is None:
            raise RuntimeError('Support request database is unavailable')
        query = {} if status is None else {'status': status}
        return [self._clean(item) for item in self.collection.find(query).sort('created_at', 1)]

    def update(self, support_request_id, updates, *, unset_fields=()):
        self._ensure_collection()
        if self.collection is None:
            raise RuntimeError('Support request database is unavailable')
        operation = {'$set': dict(updates)}
        if unset_fields:
            operation['$unset'] = {key: '' for key in unset_fields}
        self.collection.update_one({'support_request_id': support_request_id}, operation)
        return self.get(support_request_id)


class SupportRequestService:
    def __init__(self, repository, alert_repository, audit_service=None):
        self.repository = repository
        self.alert_repository = alert_repository
        self.audit_service = audit_service or get_audit_service()

    @staticmethod
    def _require_personnel(identity, permission):
        if (
            not identity
            or identity.get('role') != ROLE_PERSONNEL
            or not identity.get('user_id')
            or not identity.get('personnel_id')
            or not has_permission(identity, permission)
        ):
            raise SupportRequestAuthorizationError('Forbidden')
        return identity['personnel_id']

    @staticmethod
    def _require_staff(identity, permission):
        if (
            not identity
            or identity.get('role') not in {ROLE_WELFARE_OFFICER, ROLE_ADMIN}
            or not has_permission(identity, permission)
        ):
            raise SupportRequestAuthorizationError('Forbidden')

    def _audit(self, identity, action, record, result=RESULT_SUCCESS):
        self.audit_service.record_event(
            actor_user_id=(identity or {}).get('user_id'),
            actor_role=(identity or {}).get('role'),
            action=action,
            resource_type='personnel_support_request',
            resource_id=(record or {}).get('support_request_id'),
            result=result,
            source='support_request_service',
            purpose='Voluntary human welfare support request',
        )

    def create_for_self(self, payload, identity):
        personnel_id = self._require_personnel(identity, PERMISSION_CREATE_OWN_SUPPORT_REQUEST)
        data = _parse_payload(payload)
        alert_id = data['related_alert_id']
        if alert_id:
            alert = self.alert_repository.get(alert_id)
            if alert is None or alert.get('personnel_id') != personnel_id:
                raise SupportRequestNotFound('Related alert not found')
            existing = self.repository.get_active_for_alert(personnel_id, alert_id)
            if existing:
                self._audit(identity, 'SUPPORT_REQUEST_DUPLICATE_DENIED', existing, RESULT_DENIED)
                raise DuplicateSupportRequest('An active support request already exists for this alert')

        created_at = _now()
        request_id = f'support-{uuid4()}'
        record = {
            'support_request_id': request_id,
            'personnel_id': personnel_id,
            'requester_user_id': identity['user_id'],
            'related_alert_id': alert_id,
            'category': data['category'],
            'message': data['message'],
            'urgency': data['urgency'],
            'status': 'REQUESTED',
            'created_at': created_at,
            'updated_at': created_at,
            'acknowledged_at': None,
            'scheduled_follow_up': None,
            'closed_at': None,
        }
        if alert_id:
            record['active_alert_personnel_id'] = personnel_id
            record['active_alert_id'] = alert_id
        try:
            created = self.repository.create(record)
        except DuplicateSupportRequest:
            existing = self.repository.get_active_for_alert(personnel_id, alert_id) if alert_id else None
            if existing:
                self._audit(identity, 'SUPPORT_REQUEST_DUPLICATE_DENIED', existing, RESULT_DENIED)
            raise DuplicateSupportRequest('An active support request already exists for this alert')
        self._audit(identity, 'SUPPORT_REQUEST_CREATED', created)
        return personnel_request_view(created)

    def list_for_self(self, identity):
        personnel_id = self._require_personnel(identity, PERMISSION_VIEW_OWN_SUPPORT_REQUESTS)
        return [personnel_request_view(item) for item in self.repository.list_for_personnel(personnel_id)]

    def get_for_self(self, support_request_id, identity):
        personnel_id = self._require_personnel(identity, PERMISSION_VIEW_OWN_SUPPORT_REQUESTS)
        record = self.repository.get(support_request_id)
        if record is None or record.get('personnel_id') != personnel_id:
            raise SupportRequestNotFound('Support request not found')
        return personnel_request_view(record)

    def list_for_staff(self, identity, status=None):
        self._require_staff(identity, PERMISSION_VIEW_SUPPORT_REQUESTS)
        if status is not None and status not in SUPPORT_REQUEST_STATUSES:
            raise ValueError('Unknown support request status')
        return [staff_request_view(item) for item in self.repository.list_for_staff(status)]

    def transition_for_staff(self, support_request_id, target_status, identity, scheduled_follow_up=None):
        self._require_staff(identity, PERMISSION_MANAGE_SUPPORT_REQUESTS)
        if target_status not in {'ACKNOWLEDGED', 'SCHEDULED', 'IN_PROGRESS', 'RESOLVED'}:
            raise ValueError('Unsupported support request action')
        record = self.repository.get(support_request_id)
        if record is None:
            raise SupportRequestNotFound('Support request not found')
        if target_status not in SUPPORT_REQUEST_TRANSITIONS.get(record['status'], set()):
            raise SupportRequestConflict(f"Cannot move request from {record['status']} to {target_status}")

        updates = {'status': target_status, 'updated_at': _now()}
        if target_status == 'ACKNOWLEDGED':
            updates['acknowledged_at'] = updates['updated_at']
            updates['assigned_to_user_id'] = identity.get('user_id')
            action = 'SUPPORT_REQUEST_ACKNOWLEDGED'
        elif target_status == 'SCHEDULED':
            updates['scheduled_follow_up'] = _parse_follow_up(scheduled_follow_up)
            updates.setdefault('assigned_to_user_id', identity.get('user_id'))
            action = 'SUPPORT_REQUEST_SCHEDULED'
        elif target_status == 'IN_PROGRESS':
            updates.setdefault('assigned_to_user_id', identity.get('user_id'))
            action = 'SUPPORT_REQUEST_FOLLOW_UP_STARTED'
        else:
            updates['closed_at'] = updates['updated_at']
            updates['scheduled_follow_up'] = record.get('scheduled_follow_up')
            action = 'SUPPORT_REQUEST_RESOLVED'

        unset_fields = ('active_alert_personnel_id', 'active_alert_id') if target_status == 'RESOLVED' else ()
        updated = self.repository.update(support_request_id, updates, unset_fields=unset_fields)
        self._audit(identity, action, updated)
        return staff_request_view(updated)
