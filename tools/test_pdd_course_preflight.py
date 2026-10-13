import importlib.util
import unittest
from pathlib import Path

SPEC = importlib.util.spec_from_file_location("preflight", Path(__file__).with_name("pdd_course_preflight.py"))
module = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(module)


class CoursePreflightTests(unittest.TestCase):
    def test_valid_section(self):
        result = module.analyze({"sections": [{"id": "s1", "title": "Основы", "blocks": [
            {"type": "img", "src": "img/a.png"},
            {"type": "quiz", "questions": [{"q": "?", "options": ["Да", "Нет"], "correct": 0}]}
        ]}]})
        self.assertEqual(result["sections"], 1)
        self.assertEqual(result["images_unique"], 1)
        self.assertEqual(result["types"]["questions"], 1)
        self.assertFalse(result["problems"])

    def test_duplicate_section_rejected(self):
        with self.assertRaises(ValueError):
            module.analyze({"sections": [{"id": "s1", "blocks": []}, {"id": "s1", "blocks": []}]})

    def test_invalid_answer_reported(self):
        result = module.analyze({"sections": [{"id": "s1", "blocks": [
            {"type": "quiz", "questions": [{"options": ["Да"], "correct": 1}]}
        ]}]})
        self.assertTrue(result["problems"])

    def test_unknown_block_reported(self):
        result = module.analyze({"sections": [{"id": "s1", "blocks": [{"type": "video"}]}]})
        self.assertEqual(len(result["problems"]), 1)


if __name__ == "__main__":
    unittest.main()
