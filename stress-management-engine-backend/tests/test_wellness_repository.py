import unittest

from src.db.repositories.wellness_repository import WellnessRepository


class MongoLikeCollection:
    def __init__(self):
        self.records = []

    def create_index(self, *_args, **_kwargs):
        return None

    def find_one(self, query):
        return next(
            (record for record in self.records if all(record.get(key) == value for key, value in query.items())),
            None,
        )

    def insert_one(self, document):
        document['_id'] = object()
        self.records.append(dict(document))


class MongoLikeDatabase:
    def __init__(self):
        self.collection = MongoLikeCollection()

    def get_collection(self, _name):
        return self.collection


class WellnessRepositoryTests(unittest.TestCase):
    def test_create_returns_json_safe_record_without_mutating_input(self):
        database = MongoLikeDatabase()
        repository = WellnessRepository(database)
        assessment = {
            'assessment_id': 'assessment-1',
            'personnel_id': 'P900',
            'assessment_date': '2026-10-02',
            'submitted_at': '2026-10-02T00:00:00+00:00',
            'sleep_quality': 3,
            'fatigue_level': 2,
            'perceived_stress': 2,
            'mood_wellbeing': 3,
        }

        created = repository.create(assessment)

        self.assertEqual(created, assessment)
        self.assertNotIn('_id', assessment)
        self.assertNotIn('_id', created)
        self.assertIn('_id', database.collection.records[0])


if __name__ == '__main__':
    unittest.main()
