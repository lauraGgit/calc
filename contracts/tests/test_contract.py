from django.test import TestCase
from contracts.mommy_recipes import get_contract_recipe
from itertools import cycle

from ..models import Contract, convert_to_tsquery


class ContractTestCase(TestCase):

    def test_readable_business_size(self):
        business_sizes = ('O', 'S')
        contract1, contract2 = get_contract_recipe().make(
            _quantity=2, business_size=cycle(business_sizes))
        self.assertEqual(contract1.get_readable_business_size(),
                         'other than small business')
        self.assertEqual(
            contract2.get_readable_business_size(), 'small business')

    def test_get_education_code(self):
        c = get_contract_recipe().make()
        self.assertEqual(c.get_education_code('Bachelors'), 'BA')
        self.assertIsNone(c.get_education_code('Nursing'), None)

    def test_normalize_rate(self):
        c = get_contract_recipe().make()
        self.assertEqual(c.normalize_rate('$1,000.00,'), 1000.0)

    def test_convert_to_tsquery(self):
        self.assertEqual(convert_to_tsquery(
            'staff  consultant'), 'staff:* & consultant:*')
        self.assertEqual(convert_to_tsquery(
            'senior typist (st)'), 'senior:* & typist:* & st:*')
        self.assertEqual(convert_to_tsquery('@$(#)%&**#'), '')


class ContractSearchTestCase(TestCase):
    CATEGORIES = [
        'Sign Language Interpreter',
        'Foreign Language Staff Interpreter (Spanish sign language)',
        'Aircraft Servicer',
        'Service Order Dispatcher',
        'Disposal Services',
        'Interpretation Services Class 4: Afrikan,Akan,Albanian',
        'Interpretation Services Class 1: Spanish',
        'Interpretation Services Class 2: French, German, Italian',
    ]

    def assertCategoriesEqual(self, results, categories):
        self.assertEqual([
            result.labor_category
            for result in results
        ], categories)

    def setUp(self):
        self.contracts = get_contract_recipe().make(
            labor_category=cycle(self.CATEGORIES),
            _quantity=len(self.CATEGORIES)
        )

    def test_multi_phrase_search_works_with_single_word_phrase(self):
        results = Contract.objects.multi_phrase_search('interpretation')
        self.assertCategoriesEqual(results, [
            u'Sign Language Interpreter',
            u'Foreign Language Staff Interpreter (Spanish sign language)',
            u'Interpretation Services Class 4: Afrikan,Akan,Albanian',
            u'Interpretation Services Class 1: Spanish',
            u'Interpretation Services Class 2: French, German, Italian'
        ])

    def test_multi_phrase_search_works_with_multi_word_phrase(self):
        results = Contract.objects.multi_phrase_search([
            'interpretation services'
        ])
        self.assertCategoriesEqual(results, [
            u'Interpretation Services Class 4: Afrikan,Akan,Albanian',
            u'Interpretation Services Class 1: Spanish',
            u'Interpretation Services Class 2: French, German, Italian'
        ])

    def test_multi_phrase_search_works_with_multiple_phrases(self):
        results = Contract.objects.multi_phrase_search([
            'interpretation services',
            'disposal'
        ])
        self.assertCategoriesEqual(results, [
            u'Disposal Services',
            u'Interpretation Services Class 4: Afrikan,Akan,Albanian',
            u'Interpretation Services Class 1: Spanish',
            u'Interpretation Services Class 2: French, German, Italian'
        ])

    def test_search_index_works_via_raw_sql(self):
        results = Contract.objects.raw(
            '''
            SELECT id, labor_category
            FROM contracts_contract
            WHERE search_index @@ to_tsquery('Interpretation')
            ORDER BY id
            '''
        )
        self.assertCategoriesEqual(results, [
            u'Sign Language Interpreter',
            u'Foreign Language Staff Interpreter (Spanish sign language)',
            u'Interpretation Services Class 4: Afrikan,Akan,Albanian',
            u'Interpretation Services Class 1: Spanish',
            u'Interpretation Services Class 2: French, German, Italian'
        ])
