import json
import unittest

import api_server
from src.security.audit import get_audit_service
from src.security.demo_users import DEVELOPMENT_USERS
from src.welfare.support_requests import (
    SupportRequestRepository,
    SupportRequestService,
)
from tests.user_test_support import install_test_users


class FakeCursor(list):
    def sort(self, field, direction):
        return FakeCursor(sorted(self, key=lambda record: record.get(field, ''), reverse=direction < 0))


class FakeCollection:
    def __init__(self):
        self.records = []

    def create_index(self, *args, **kwargs):
        return None

    @staticmethod
    def matches(record, query):
        return all(record.get(key) == value for key, value in query.items())

    def find(self, query=None):
        query = query or {}
        return FakeCursor([dict(item) for item in self.records if self.matches(item, query)])

    def find_one(self, query):
        record = next((item for item in self.records if self.matches(item, query)), None)
        return None if record is None else dict(record)

    def insert_one(self, record):
        self.records.append(dict(record))

    def update_one(self, query, update):
        for record in self.records:
            if self.matches(record, query):
                record.update(update.get('$set', {}))
                for key in update.get('$unset', {}):
                    record.pop(key, None)
                return


class FakeDatabase:
    def __init__(self):
        self.collections = {}

    def get_collection(self, name):
        return self.collections.setdefault(name, FakeCollection())


class FakeAlertRepository:
    def __init__(self):
        self.alerts = {
            'alert-p001': {'alert_id': 'alert-p001', 'personnel_id': 'P001'},
            'alert-p900': {'alert_id': 'alert-p900', 'personnel_id': 'P900'},
        }

    def get(self, alert_id):
        return self.alerts.get(alert_id)


class SupportRequestApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        install_test_users(api_server)
        cls.client = api_server.app.test_client()
        cls.database = FakeDatabase()
        cls.alert_repository = FakeAlertRepository()
        cls.audit = get_audit_service()
        api_server.welfare_support_request_service = SupportRequestService(
            SupportRequestRepository(cls.database),
            cls.alert_repository,
            cls.audit,
        )

    def setUp(self):
        api_server.welfare_support_request_service.repository.collection.records.clear()
        self.audit._events.clear()

    def headers(self, username, password):
        response = self.client.post('/auth/login', json={
            'username': username,
            'password': password,
        })
        self.assertEqual(response.status_code, 200)
        return {'Authorization': f"Bearer {response.get_json()['access_token']}"}

    def payload(self, **overrides):
        return {
            'category': 'GENERAL_WELFARE',
            'message': 'Please arrange a private conversation.',
            'urgency': 'NORMAL',
            **overrides,
        }

    def test_personnel_create_and_list_only_own_requests(self):
        personnel = self.headers('demo_personnel', 'demo-personnel-password')
        other = self.headers('mock_personnel', DEVELOPMENT_USERS['mock_personnel']['password'])
        created = self.client.post(
            '/personnel/me/support-requests',
            json=self.payload(related_alert_id='alert-p001'),
            headers=personnel,
        )
        other_created = self.client.post(
            '/personnel/me/support-requests',
            json=self.payload(related_alert_id='alert-p900'),
            headers=other,
        )
        self.assertEqual(created.status_code, 201)
        self.assertEqual(other_created.status_code, 201)
        record = created.get_json()
        self.assertEqual(record['status'], 'REQUESTED')
        self.assertEqual(record['related_alert_id'], 'alert-p001')
        self.assertNotIn('personnel_id', record)
        self.assertNotIn('requester_user_id', record)
        self.assertNotIn('assigned_to_user_id', record)

        own_list = self.client.get('/personnel/me/support-requests', headers=personnel).get_json()
        other_list = self.client.get('/personnel/me/support-requests', headers=other).get_json()
        self.assertEqual([item['support_request_id'] for item in own_list['requests']], [record['support_request_id']])
        self.assertEqual(len(other_list['requests']), 1)
        self.assertNotEqual(other_list['requests'][0]['support_request_id'], record['support_request_id'])

    def test_personnel_cannot_submit_another_personnel_id_or_link_their_alert(self):
        personnel = self.headers('demo_personnel', 'demo-personnel-password')
        with_id = self.client.post(
            '/personnel/me/support-requests',
            json=self.payload(personnel_id='P900'),
            headers=personnel,
        )
        other_alert = self.client.post(
            '/personnel/me/support-requests',
            json=self.payload(related_alert_id='alert-p900'),
            headers=personnel,
        )
        self.assertEqual(with_id.status_code, 400)
        self.assertEqual(other_alert.status_code, 404)

    def test_personnel_cannot_read_another_persons_request(self):
        personnel = self.headers('demo_personnel', 'demo-personnel-password')
        other = self.headers('mock_personnel', DEVELOPMENT_USERS['mock_personnel']['password'])
        created = self.client.post(
            '/personnel/me/support-requests', json=self.payload(), headers=other,
        ).get_json()
        response = self.client.get(
            f"/personnel/me/support-requests/{created['support_request_id']}",
            headers=personnel,
        )
        self.assertEqual(response.status_code, 404)

    def test_invalid_category_and_urgency_are_rejected(self):
        personnel = self.headers('demo_personnel', 'demo-personnel-password')
        for request_payload in (
            self.payload(category='UNCONTROLLED'),
            self.payload(urgency='IMMEDIATE'),
        ):
            with self.subTest(request_payload=request_payload):
                response = self.client.post(
                    '/personnel/me/support-requests',
                    json=request_payload,
                    headers=personnel,
                )
                self.assertEqual(response.status_code, 400)

    def test_duplicate_open_alert_request_returns_conflict(self):
        personnel = self.headers('demo_personnel', 'demo-personnel-password')
        first = self.client.post(
            '/personnel/me/support-requests',
            json=self.payload(related_alert_id='alert-p001'),
            headers=personnel,
        )
        duplicate = self.client.post(
            '/personnel/me/support-requests',
            json=self.payload(related_alert_id='alert-p001'),
            headers=personnel,
        )
        self.assertEqual(first.status_code, 201)
        self.assertEqual(duplicate.status_code, 409)
        self.assertEqual(len(self.client.get('/personnel/me/support-requests', headers=personnel).get_json()['requests']), 1)

    def test_welfare_officer_and_admin_can_receive_and_process_requests(self):
        personnel = self.headers('demo_personnel', 'demo-personnel-password')
        welfare = self.headers('demo_welfare', 'demo-welfare-password')
        admin = self.headers('demo_admin', 'demo-admin-password')
        created = self.client.post(
            '/personnel/me/support-requests', json=self.payload(), headers=personnel,
        ).get_json()
        self.assertEqual(self.client.get('/welfare/support-requests', headers=welfare).status_code, 200)
        self.assertEqual(self.client.get('/welfare/support-requests', headers=admin).status_code, 200)
        request_id = created['support_request_id']
        acknowledged = self.client.post(
            f'/welfare/support-requests/{request_id}/acknowledge', headers=welfare,
        )
        self.assertEqual(acknowledged.status_code, 200)
        scheduled = self.client.post(
            f'/welfare/support-requests/{request_id}/schedule',
            json={'scheduled_follow_up': '2030-01-01T10:00:00+00:00'},
            headers=admin,
        )
        self.assertEqual(scheduled.status_code, 200)
        started = self.client.post(
            f'/welfare/support-requests/{request_id}/start', headers=welfare,
        )
        self.assertEqual(started.status_code, 200)
        resolved = self.client.post(
            f'/welfare/support-requests/{request_id}/resolve', headers=admin,
        )
        self.assertEqual(resolved.status_code, 200)
        self.assertEqual(resolved.get_json()['status'], 'RESOLVED')
        self.assertIsNotNone(resolved.get_json()['closed_at'])

    def test_commander_and_personnel_cannot_access_staff_workflow(self):
        commander = self.headers('demo_commander', 'demo-commander-password')
        personnel = self.headers('demo_personnel', 'demo-personnel-password')
        self.assertEqual(self.client.get('/welfare/support-requests', headers=commander).status_code, 403)
        self.assertEqual(self.client.get('/welfare/support-requests', headers=personnel).status_code, 403)
        self.assertEqual(
            self.client.post('/welfare/support-requests/example/acknowledge', headers=personnel).status_code,
            403,
        )
        staff_only_alert_actions = (
            ('acknowledge', None),
            ('review', None),
            ('follow-up', {'scheduled_follow_up': '2030-01-01T10:00:00+00:00'}),
            ('intervention', {'action_type': 'WELFARE_CHECK_IN'}),
            ('resolve', {'resolution_type': 'SUPPORTED'}),
            ('dismiss', {'resolution_type': 'NOT_REQUIRED'}),
        )
        for action, payload in staff_only_alert_actions:
            with self.subTest(action=action):
                response = self.client.post(
                    f'/welfare/alerts/alert-p001/{action}',
                    json=payload,
                    headers=personnel,
                )
                self.assertEqual(response.status_code, 403)

    def test_audit_records_actions_without_support_message(self):
        personnel = self.headers('demo_personnel', 'demo-personnel-password')
        sensitive_message = 'private detail that must not enter audit metadata'
        response = self.client.post(
            '/personnel/me/support-requests',
            json=self.payload(message=sensitive_message),
            headers=personnel,
        )
        self.assertEqual(response.status_code, 201)
        audit_json = json.dumps(self.audit.list_events())
        self.assertIn('SUPPORT_REQUEST_CREATED', audit_json)
        self.assertNotIn(sensitive_message, audit_json)

    def test_request_survives_repository_recreation(self):
        personnel = self.headers('demo_personnel', 'demo-personnel-password')
        created = self.client.post(
            '/personnel/me/support-requests', json=self.payload(), headers=personnel,
        ).get_json()
        service = SupportRequestService(
            SupportRequestRepository(self.database), self.alert_repository, self.audit,
        )
        development_personnel = DEVELOPMENT_USERS['demo_personnel']
        identity = {
            'user_id': development_personnel['user_id'],
            'role': development_personnel['role'],
            'personnel_id': development_personnel['personnel_id'],
        }
        records = service.list_for_self(identity)
        self.assertEqual(records[0]['support_request_id'], created['support_request_id'])


if __name__ == '__main__':
    unittest.main()
