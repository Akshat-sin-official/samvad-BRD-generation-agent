import unittest
from backend.routes.generate import get_demo_context

class TestGenerateRoutes(unittest.TestCase):
    def test_demo_context_endpoint(self):
        res = get_demo_context()
        self.assertIn("context_data", res)
        self.assertIsInstance(res["context_data"], str)

if __name__ == "__main__":
    unittest.main()
