from django.conf import settings
from django.core import management

import subprocess


_static_assets_built = False


def build_static_assets():
    '''
    Sometimes we need static assets to be available before browser-based
    tests run. We want to be able to have multiple browser-based test suites,
    but we also don't want to needlessly regenerate the static assets
    for each one, so we'll use this function, which ensures that the assets
    are only built once per test run.
    '''

    global _static_assets_built

    if not _static_assets_built:
        subprocess.check_call(['rm', '-rf', settings.STATIC_ROOT])
        subprocess.check_call(['npm', 'run', 'gulp', '--', 'build'])
        management.call_command('collectstatic', '--noinput', '--link',
                                verbosity=0)
        _static_assets_built = True
