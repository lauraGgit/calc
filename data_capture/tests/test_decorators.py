import json
import io

from django.core.management import call_command
from django.conf.urls import url
from django.http import HttpResponse
from django.test import TestCase, override_settings
from django.contrib.auth.models import Permission

from ..decorators import (handle_cancel,
                          staff_login_required,
                          role_permissions_required)
from .common import BaseTestCase
from hourglass.urls import urlpatterns


@handle_cancel
def ok_view(request):
    return HttpResponse('ok')


@handle_cancel(redirect_name='another_view')
def redirect_name_view(request):
    return HttpResponse('ok no args')


@handle_cancel(key_prefix='another_prefix:')
def key_prefix_view(request):
    return HttpResponse('ok no args')


@staff_login_required
def staff_only_view(request):
    return HttpResponse('ok')


@role_permissions_required('Contract Officers')
def co_only_view(request):
    return HttpResponse('ok')


def index(request):
    return HttpResponse('index')

urlpatterns += [
    url(r'^test_view/$', ok_view),
    url(r'^another_view/$', index, name='another_view'),
    url(r'^redirect_name_view/$',
        redirect_name_view, name='redirect_name_view'),
    url(r'^key_prefix_view/$',
        key_prefix_view, name='key_prefix_view'),
    url(r'^$', index, name='index'),
    url(r'^staff_only_view/$', staff_only_view, name='staff_only_view'),
    url(r'^co_only_view/', co_only_view, name='co_only_view'),
    url(r'^login/$', ok_view, name='login')
]


@override_settings(ROOT_URLCONF=__name__)
class HandleCancelTests(TestCase):

    def setupSession(self, key_prefix='data_capture:'):
        session = self.client.session
        session['{}key_a'.format(key_prefix)] = 'value_a'
        session['{}key_b'.format(key_prefix)] = 'value_b'
        session['something_else'] = 'boop'
        session.save()

    def assertSessionOk(self, key_prefix='data_capture:'):
        session = self.client.session
        self.assertNotIn('{}key_a'.format(key_prefix), session)
        self.assertNotIn('{}key_b'.format(key_prefix), session)
        self.assertIn('something_else', session)

    def test_noop_when_not_post(self):
        res = self.client.get('/test_view/')
        self.assertEqual(200, res.status_code)
        self.assertEqual(b'ok', res.content)

    def test_noop_when_cancel_not_in_post(self):
        session = self.client.session
        session['data_capture:key_a'] = 'value_a'
        session.save()
        res = self.client.post('/test_view/')

        session = self.client.session
        self.assertEqual(200, res.status_code)
        self.assertEqual(b'ok', res.content)
        self.assertIn('data_capture:key_a', session)

    def test_removes_keys_from_session_on_post_cancel(self):
        self.setupSession()
        self.client.post('/test_view/', {'cancel': ''})
        self.assertSessionOk()

    def test_returns_redirect(self):
        res = self.client.post('/test_view/', {'cancel': ''})
        self.assertEqual(302, res.status_code)
        self.assertEqual(res['Location'], 'http://testserver/')

    def test_returns_json_redirect_when_ajax_post(self):
        res = self.client.post('/test_view/',
                               {'cancel': ''},
                               HTTP_X_REQUESTED_WITH='XMLHttpRequest')
        self.assertEqual(200, res.status_code)
        json_content = json.loads(res.content.decode('utf-8'))
        self.assertEqual(json_content, {
            'redirect_url': '/'
        })

    def test_works_with_key_prefix_specified(self):
        self.setupSession(key_prefix='another_prefix:')
        self.client.post('/key_prefix_view/', {'cancel': ''})
        self.assertSessionOk(key_prefix='another_prefix:')

    def test_works_with_redirect_name_specified(self):
        self.setupSession()
        res = self.client.post('/redirect_name_view/', {'cancel': ''})
        self.assertSessionOk()
        self.assertEqual(302, res.status_code)
        self.assertEqual(res['Location'], 'http://testserver/another_view/')


@override_settings(ROOT_URLCONF=__name__)
class StaffLoginRequiredTests(BaseTestCase):

    def test_redirects_to_login(self):
        res = self.client.get('/staff_only_view/')
        self.assertEqual(302, res.status_code)
        self.assertTrue(
            res['Location'].startswith('http://testserver/auth/login'))

    def test_staff_user_is_permitted(self):
        self.login(is_staff=True)
        res = self.client.get('/staff_only_view/')
        self.assertEqual(200, res.status_code)
        self.assertEqual(b'ok', res.content)

    def test_non_staff_user_is_denied(self):
        self.login(is_staff=False)
        res = self.client.get('/staff_only_view/')
        self.assertEqual(403, res.status_code)


@override_settings(ROOT_URLCONF=__name__)
class RolePermissionsRequiredTests(BaseTestCase):
    def test_redirects_to_login_when_anonymous_user(self):
        res = self.client.get('/co_only_view/')
        self.assertEqual(302, res.status_code)
        self.assertTrue(
            res['Location'].startswith('http://testserver/auth/login'))

    def test_user_with_sufficient_perms_is_admitted(self):
        user = self.login()
        add_pl = Permission.objects.get(
            codename='add_submittedpricelist')
        add_pl_row = Permission.objects.get(
            codename='add_submittedpricelistrow')
        user.user_permissions.add(add_pl, add_pl_row)
        res = self.client.get('/co_only_view/')
        self.assertEqual(200, res.status_code)
        self.assertEqual(b'ok', res.content)

    def test_permission_denied_when_insufficient_perms(self):
        user = self.login()
        add_pl = Permission.objects.get(
            codename='add_submittedpricelist')
        user.user_permissions.add(add_pl)
        res = self.client.get('/co_only_view/')
        self.assertEqual(403, res.status_code)

    def test_user_in_group_is_admitted(self):
        call_command('initgroups', stdout=io.StringIO())
        self.login(groups=['Contract Officers'])
        res = self.client.get('/co_only_view/')
        self.assertEqual(200, res.status_code)
        self.assertEqual(b'ok', res.content)
