import unittest
from review import review_table
class ReviewTests(unittest.TestCase):
    def test_confused_unit_is_not_confirmed(self):
        r=review_table([["Рис","KF","25,000","100,00","2500,00"]])[0]
        self.assertIsNone(r["unit"])
        self.assertEqual(r["unit_hint"],"кг")
        self.assertTrue(r["arithmetic_ok"])
        self.assertTrue(r["requires_review"])
    def test_amount_mismatch(self):
        r=review_table([["Сыр","кг","4,900","600,00","2400,00"]])[0]
        self.assertFalse(r["arithmetic_ok"])
        self.assertIn("sum_mismatch",r["issues"])
    def test_missing_columns_not_guessed(self):
        self.assertEqual(review_table([["Рис","25","2500"]]),[])
    def test_valid_row_still_reviewed(self):
        r=review_table([["Соус","шт","2","300","600"]])[0]
        self.assertEqual(r["unit"],"шт")
        self.assertTrue(r["requires_review"])
if __name__=="__main__": unittest.main()
