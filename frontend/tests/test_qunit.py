import os
import subprocess

from django.test import LiveServerTestCase

from .utils import build_static_assets


RUNNER_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                           'vendor', 'runner.js')


class QunitTests(LiveServerTestCase):

    def test_qunit(self):
        subprocess.check_call([
            'phantomjs', RUNNER_PATH, self.live_server_url + '/tests/'
        ])

    @classmethod
    def setUpClass(cls):
        build_static_assets()
        super(QunitTests, cls).setUpClass()
