import unittest
from unittest.mock import MagicMock, patch
import datetime
from google.api_core.datetime_helpers import DatetimeWithNanoseconds

from backend.services.firestore_client import get_project_for_user


class TestFirestoreClient(unittest.TestCase):

    @patch("backend.services.firestore_client.get_db")
    def test_get_project_for_user_serialization(self, mock_get_db):
        mock_db = MagicMock()
        mock_get_db.return_value = mock_db

        mock_doc = MagicMock()
        mock_doc.id = "proj123"
        mock_doc.exists = True

        now_dt = datetime.datetime.now(datetime.timezone.utc)
        mock_doc.to_dict.return_value = {
            "ownerId": "user123",
            "title": "Test Project",
            "description": "Test Desc",
            "idea": "Test Idea",
            "status": "Active",
            "currentVersion": 1,
            "createdAt": now_dt,
            "updatedAt": now_dt,
            "artifacts": {"brd": {"project_title": "Test Title"}},
            "lastRunMetadata": {},
            "versions": [
                {
                    "version": 1,
                    "title": "Test Project",
                    "idea": "Test Idea",
                    "artifacts": {},
                    "createdAt": now_dt,
                }
            ],
        }

        mock_doc_ref = MagicMock()
        mock_doc_ref.get.return_value = mock_doc
        mock_db.collection.return_value.document.return_value = mock_doc_ref

        result = get_project_for_user("user123", "proj123")

        self.assertIsNotNone(result)
        self.assertEqual(result["id"], "proj123")
        self.assertEqual(result["title"], "Test Project")
        self.assertIsInstance(result["createdAt"], str)
        self.assertIsInstance(result["versions"][0]["createdAt"], str)


if __name__ == "__main__":
    unittest.main()
