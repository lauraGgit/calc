import datetime
from django.test import TestCase, override_settings
from django.contrib.auth.models import User

from contracts.models import Contract
from ..schedules import registry
from ..schedules.fake_schedule import FakeSchedulePriceList
from ..models import SubmittedPriceList, SubmittedPriceListRow
from .common import FAKE_SCHEDULE


class ModelTestCase(TestCase):
    DEFAULT_SCHEDULE = FAKE_SCHEDULE

    def setUp(self):
        self.user = User.objects.create_user(username='foo')
        registry._init()

    def create_price_list(self, **kwargs):
        final_kwargs = dict(
            submitter=self.user,
            is_small_business=False,
            contract_number='GS-123-4567',
            vendor_name='UltraCorp',
            schedule=self.DEFAULT_SCHEDULE,
            contract_year=1,
            contract_start=datetime.datetime.now(),
            contract_end=datetime.datetime.now()
        )
        final_kwargs.update(kwargs)
        return SubmittedPriceList(**final_kwargs)


@override_settings(DATA_CAPTURE_SCHEDULES=[FAKE_SCHEDULE])
class ModelsTests(ModelTestCase):
    def create_row(self, **kwargs):
        final_kwargs = dict(
            labor_category='Project Manager',
            min_years_experience=5,
            hourly_rate_year1=10,
        )
        final_kwargs.update(kwargs)
        return SubmittedPriceListRow(**final_kwargs)

    def test_add_row_works(self):
        p = self.create_price_list()
        p.save()
        row = p.add_row(
            labor_category='Project Manager',
            min_years_experience=5,
            hourly_rate_year1=10,
        )
        self.assertEqual(list(p.rows.all()), [row])
        self.assertEqual(row.labor_category, 'Project Manager')
        self.assertEqual(row.min_years_experience, 5)
        self.assertEqual(row.hourly_rate_year1, 10)

    def test_get_schedule_title_works(self):
        p = self.create_price_list(schedule=FAKE_SCHEDULE)
        self.assertEqual(p.get_schedule_title(),
                         FakeSchedulePriceList.title)

    def test_get_business_size_string_works(self):
        p = self.create_price_list(is_small_business=False)
        self.assertEqual(p.get_business_size_string(), 'O')

        p.is_small_business = True
        self.assertEqual(p.get_business_size_string(), 'S')

    def test_approve_works(self):
        p = self.create_price_list(
            contract_number='GS-123-4568',
            schedule=FAKE_SCHEDULE,
        )
        p.save()
        p.rows.add(self.create_row(
            labor_category='Software Engineer'
        ))
        p.approve()

        self.assertEqual(Contract.objects.all().count(), 1)
        self.assertTrue(p.is_approved)

        contract = p.rows.all()[0].contract_model
        self.assertEqual(contract.idv_piid, 'GS-123-4568')
        self.assertEqual(contract.labor_category, 'Software Engineer')
        self.assertEqual(contract.schedule, FakeSchedulePriceList.title)
        self.assertEqual(contract.labor_category, 'Software Engineer')

    def test_unapprove_works(self):
        p = self.create_price_list()
        p.save()
        p.rows.add(self.create_row())
        p.approve()
        p.unapprove()

        self.assertFalse(p.is_approved)
        self.assertEqual(p.rows.all()[0].contract_model, None)
        self.assertEqual(Contract.objects.all().count(), 0)

    def test_row_stringify_works(self):
        self.assertEqual(str(self.create_row()), 'Submitted price list row')
