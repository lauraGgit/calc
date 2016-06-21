DEBUG=True

SECURE_SSL_REDIRECT = False

REMOTE_TESTING = {
    'enabled': True,
    'hub_url': 'http://selenium:4444/wd/hub',
    'username': '',
    'access_key': '',
    'capabilities': {
        'browser': 'chrome'
        # 'browser': 'internet explorer',
        # 'version': '9.0',
        # 'platform': 'Windows 7'
    }
}
