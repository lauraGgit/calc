import io
import json
import unittest

from django.core.management import call_command

from ..models import SubmittedPriceList
from ..schedules.fake_schedule import FakeSchedulePriceList
from ..schedules import registry
from .common import StepTestCase, FAKE_SCHEDULE, FAKE_SCHEDULE_EXAMPLE_PATH


class PriceListStepTestCase(StepTestCase):
    url = None

    # TODO: Move individual setUp functions here if applicable
    def set_fake_gleaned_data(self, rows):
        session = self.client.session
        pricelist = FakeSchedulePriceList(rows)
        session['data_capture:price_list']['schedule'] = \
            registry.get_classname(pricelist)
        session['data_capture:price_list']['gleaned_data'] = \
            registry.serialize(pricelist)
        session.save()

    def delete_price_list_from_session(self):
        session = self.client.session
        del session['data_capture:price_list']
        session.save()

    def setUp(self):
        super().setUp()
        registry._init()

    @classmethod
    def setUpClass(cls):
        super(PriceListStepTestCase, cls).setUpClass()
        call_command('initgroups', stdout=io.StringIO())

    @classmethod
    def tearDownClass(cls):
        super(PriceListStepTestCase, cls).tearDownClass()

    def login(self, groups=None, **kwargs):
        if groups is None:
            groups = ['Contract Officers']
        return super().login(groups=groups, **kwargs)

    def test_login_is_required(self):
        if not self.url:
            raise unittest.SkipTest()
        self.assertRedirectsToLogin(self.url)

    def test_group_is_required(self):
        if not self.url:
            raise unittest.SkipTest()
        self.login(groups=[])
        res = self.client.get(self.url)
        self.assertEqual(res.status_code, 403)


class Step1Tests(PriceListStepTestCase):
    url = '/data-capture/step/1'

    valid_form = {
        'schedule': FAKE_SCHEDULE,
        'contract_number': 'GS-123-4567',
        'vendor_name': 'foo'
    }

    def test_get_is_ok(self):
        self.login()
        res = self.client.get(self.url)
        self.assertEqual(res.status_code, 200)

    def test_valid_post_sets_session_data(self):
        self.login()
        self.client.post(self.url, self.valid_form)
        session_pl = self.client.session['data_capture:price_list']
        session_data = session_pl['step_1_POST']
        self.assertEqual(session_data['schedule'], FAKE_SCHEDULE)
        self.assertEqual(session_data['contract_number'], 'GS-123-4567')
        self.assertEqual(session_data['vendor_name'], 'foo')

    def test_valid_post_redirects_to_step_2(self):
        self.login()
        res = self.client.post(self.url, self.valid_form)
        self.assertRedirects(res, Step2Tests.url)

    def test_invalid_post_returns_html(self):
        self.login()
        res = self.client.post(self.url, {})
        self.assertEqual(res.status_code, 200)
        self.assertContains(res, 'This field is required')
        self.assertHasMessage(
            res,
            'error',
            'Oops, please correct the errors below and try again.'
        )


class Step2Tests(PriceListStepTestCase):
    url = '/data-capture/step/2'

    valid_form = {
        'contractor_site': 'Customer',
        'is_small_business': 'False',
        'contract_year': '1',
        'contract_start_0': '1985',
        'contract_start_1': '07',
        'contract_start_2': '08',
        'contract_end_0': '1989',
        'contract_end_1': '04',
        'contract_end_2': '14'
    }

    def setUp(self):
        super().setUp()
        session = self.client.session
        session['data_capture:price_list'] = {
            'step_1_POST': Step1Tests.valid_form,
        }
        session.save()

    def test_get_is_ok(self):
        self.login()
        res = self.client.get(self.url)
        self.assertEqual(res.status_code, 200)

    def test_redirects_to_step_1_if_not_completed(self):
        self.login()
        self.delete_price_list_from_session()
        res = self.client.get(self.url)
        self.assertRedirects(res, Step1Tests.url)

    def test_valid_post_updates_session_data(self):
        self.login()
        self.client.post(self.url, self.valid_form)
        session_pl = self.client.session['data_capture:price_list']
        posted_data = session_pl['step_2_POST']
        self.assertEqual(posted_data['contractor_site'],
                         self.valid_form['contractor_site'])
        self.assertEqual(posted_data['is_small_business'],
                         self.valid_form['is_small_business'])

    def test_valid_post_redirects_to_step_3(self):
        self.login()
        res = self.client.post(self.url, self.valid_form)
        self.assertRedirects(res, Step3Tests.url)

    def test_invalid_post_returns_html(self):
        self.login()
        res = self.client.post(self.url, {})
        self.assertEqual(res.status_code, 200)
        self.assertContains(res, 'This field is required')
        self.assertHasMessage(
            res,
            'error',
            'Oops, please correct the errors below and try again.'
        )

    def test_cancel_clears_session_and_redirects(self):
        self.login()
        res = self.client.post(self.url, {'cancel': ''})
        self.assertEqual(res.status_code, 302)
        self.assertEqual(res['Location'], 'http://testserver/')
        session = self.client.session
        for k in list(session.keys()):
            self.assertFalse(k.startswith('data_capture:'))


class Step3Tests(PriceListStepTestCase):
    url = '/data-capture/step/3'
    csvpath = FAKE_SCHEDULE_EXAMPLE_PATH
    rows = [{
        'education': 'Bachelors',
        'price': '15.00',
        'service': 'Project Manager',
        'sin': '132-40',
        'years_experience': '7'
    }]

    def setUp(self):
        super().setUp()
        session = self.client.session
        session['data_capture:price_list'] = {
            'step_1_POST': Step1Tests.valid_form,
            'step_2_POST': Step2Tests.valid_form,
        }
        session.save()

    def ajax_post(self, data):
        res = self.client.post(self.url, data,
                               HTTP_X_REQUESTED_WITH='XMLHttpRequest')
        self.assertEqual(res.status_code, 200)
        return res, json.loads(res.content.decode('utf-8'))

    def test_get_is_ok(self):
        self.login()
        res = self.client.get(self.url)
        self.assertEqual(res.status_code, 200)

    def test_redirects_to_step_2_if_not_completed(self):
        self.login()
        self.delete_price_list_from_session()
        res = self.client.get(self.url)
        self.assertRedirects(res, Step2Tests.url, target_status_code=302)

    def test_valid_post_updates_session_data(self):
        self.login()
        with open(self.csvpath) as f:
            self.client.post(self.url, {
                'file': f
            })
            session_pl = self.client.session['data_capture:price_list']
            self.assertEqual(session_pl['step_1_POST']['schedule'],
                             FAKE_SCHEDULE)
            gleaned_data = session_pl['gleaned_data']
            gleaned_data = registry.deserialize(gleaned_data)
            assert isinstance(gleaned_data, FakeSchedulePriceList)
            self.assertEqual(gleaned_data.rows, [{
                'education': 'Bachelors',
                'price': '15.00',
                'service': 'Project Manager',
                'sin': '132-40',
                'years_experience': '7'
            }])

    def test_valid_post_via_xhr_returns_json(self):
        self.login()
        with open(self.csvpath) as f:
            res, json_data = self.ajax_post({
                'file': f
            })
            self.assertEqual(json_data, {
                'redirect_url': '/data-capture/step/4'
            })

    def test_valid_post_redirects_to_step_4(self):
        self.login()
        with open(self.csvpath) as f:
            res = self.client.post(self.url, {
                'file': f
            })
            self.assertRedirects(res, Step4Tests.url)

    def test_invalid_post_returns_html(self):
        self.login()
        res = self.client.post(self.url, {})
        self.assertEqual(res.status_code, 200)
        self.assertContains(res, r'<!DOCTYPE html>')
        self.assertContains(res, r'This field is required')
        self.assertHasMessage(
            res,
            'error',
            'Oops, please correct the error below and try again.'
        )

    def test_invalid_post_via_xhr_returns_json(self):
        self.login()
        res, json_data = self.ajax_post({})
        assert '<!DOCTYPE html>' not in json_data['form_html']
        self.assertRegexpMatches(json_data['form_html'],
                                 r'This field is required')
        self.assertHasMessage(
           res,
           'error',
           'Oops, please correct the error below and try again.'
        )

    def test_cancel_clears_session_and_redirects(self):
        self.login()
        res = self.client.post(self.url, {'cancel': ''})
        self.assertEqual(res.status_code, 302)
        self.assertEqual(res['Location'], 'http://testserver/')
        session = self.client.session
        for k in list(session.keys()):
            self.assertFalse(k.startswith('data_capture:'))


class Step4Tests(PriceListStepTestCase):
    url = '/data-capture/step/4'
    rows = [{
        'education': 'Bachelors',
        'price': '15.00',
        'service': 'Project Manager',
        'sin': '132-40',
        'years_experience': '7'
    }, {
        'education': 'School of hard knocks',
        'price': '0',
        'service': 'Oil change & tune up',
        'sin': 'absolved',
        'years_experience': 'vii'
    }]
    session_data = {
        'step_1_POST': Step1Tests.valid_form,
        'step_2_POST': Step2Tests.valid_form,
    }

    def test_gleaned_data_is_required(self):
        # TODO: This login and session-setting code is repeated
        # throughout all these tests--perhaps we should just move it into
        # the test's setUp() code or consolidate in some other way?

        self.login()
        session = self.client.session
        session['data_capture:price_list'] = self.session_data
        session.save()
        res = self.client.get(self.url)
        self.assertRedirects(res, Step3Tests.url)

    def test_get_is_ok(self):
        self.login()
        session = self.client.session
        session['data_capture:price_list'] = self.session_data
        session.save()
        self.set_fake_gleaned_data(self.rows)
        res = self.client.get(self.url)
        self.assertEqual(res.status_code, 200)

    def test_gleaned_data_with_valid_rows_is_required_on_POST(self):
        self.login()
        session = self.client.session
        session['data_capture:price_list'] = self.session_data
        session.save()
        self.set_fake_gleaned_data([])

        res = self.client.post(self.url)
        self.assertEqual(res.status_code, 400)

    def test_valid_post_creates_models(self):
        user = self.login()
        session = self.client.session
        session['data_capture:price_list'] = self.session_data
        session.save()
        self.set_fake_gleaned_data(self.rows)
        self.client.post(self.url)
        p = SubmittedPriceList.objects.filter(
            contract_number='GS-123-4567'
        )[0]
        self.assertEqual(p.schedule, FAKE_SCHEDULE)
        self.assertEqual(p.vendor_name, 'foo')
        self.assertEqual(p.contractor_site, 'Customer')
        self.assertEqual(p.is_small_business, False)
        self.assertEqual(p.submitter, user)
        self.assertEqual(p.contract_year, 1)

    def test_valid_post_clears_session_and_redirects_to_step_5(self):
        self.login()
        session = self.client.session
        session['data_capture:price_list'] = self.session_data
        session.save()
        self.set_fake_gleaned_data(self.rows)
        res = self.client.post(self.url)
        assert 'data_capture:price_list' not in self.client.session
        self.assertRedirects(res, Step5Tests.url)

    def test_cancel_clears_session_and_redirects(self):
        self.login()
        session = self.client.session
        session['data_capture:price_list'] = self.session_data
        session.save()
        self.set_fake_gleaned_data(self.rows)
        res = self.client.post(self.url, {'cancel': ''})
        self.assertEqual(res.status_code, 302)
        self.assertEqual(res['Location'], 'http://testserver/')
        session = self.client.session
        for k in list(session.keys()):
            self.assertFalse(k.startswith('data_capture:'))


class Step5Tests(PriceListStepTestCase):
    url = '/data-capture/step/5'

    def test_get_is_ok(self):
        self.login()
        res = self.client.get(self.url)
        self.assertEqual(res.status_code, 200)
