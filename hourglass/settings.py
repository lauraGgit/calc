"""
Django settings for hourglass project.

For more information on this file, see
https://docs.djangoproject.com/en/1.7/topics/settings/

For the full list of settings and their values, see
https://docs.djangoproject.com/en/1.7/ref/settings/
"""

# Build paths inside the project like this: os.path.join(BASE_DIR, ...)
import os
import dj_database_url
from dotenv import load_dotenv

from .settings_utils import load_cups_from_vcap_services, get_whitelisted_ips

BASE_DIR = os.path.dirname(os.path.dirname(__file__))

DOTENV_PATH = os.path.join(BASE_DIR, '.env')

if os.path.exists(DOTENV_PATH):
    load_dotenv(DOTENV_PATH)

load_cups_from_vcap_services('calc-env')

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = 'DEBUG' in os.environ

HIDE_DEBUG_UI = 'HIDE_DEBUG_UI' in os.environ

if DEBUG:
    os.environ.setdefault(
        'SECRET_KEY',
        'I am an insecure secret key intended ONLY for dev/testing.'
    )

API_HOST = os.environ.get('API_HOST', '/api/')

TEMPLATE_DEBUG = DEBUG
TEMPLATE_DIRS = (
    os.path.join(BASE_DIR, 'hourglass/templates'),
    os.path.join(BASE_DIR, 'hourglass_site/templates'),
)

ALLOWED_HOSTS = ['*']


# Application definition

INSTALLED_APPS = (
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'whitenoise.runserver_nostatic',
    'django.contrib.staticfiles',
    'debug_toolbar',

    'hourglass_site',

    'contracts',
    'data_capture',
    'api',
    'djorm_pgfulltext',
    'rest_framework',
    'corsheaders',
    'uaa_client',
    'styleguide',
    'meta',
)

MIDDLEWARE_CLASSES = (
    'hourglass.middleware.DebugOnlyDebugToolbarMiddleware',
    'hourglass.middleware.ComplianceMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    # 'django.contrib.auth.middleware.SessionAuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
)

AUTHENTICATION_BACKENDS = (
    'uaa_client.authentication.UaaBackend',
)

TEMPLATE_CONTEXT_PROCESSORS = (
    'hourglass.context_processors.api_host',
    "django.contrib.auth.context_processors.auth",
    "django.core.context_processors.debug",
    "django.core.context_processors.i18n",
    "django.core.context_processors.media",
    'django.core.context_processors.request',
    "django.core.context_processors.static",
    "django.core.context_processors.tz",
    "django.contrib.messages.context_processors.messages",
    "django.template.context_processors.request",
)

ROOT_URLCONF = 'hourglass.urls'

WSGI_APPLICATION = 'hourglass.wsgi.application'

# Internationalization
# https://docs.djangoproject.com/en/1.7/topics/i18n/

LANGUAGE_CODE = 'en-us'

TIME_ZONE = 'UTC'

USE_I18N = True

USE_L10N = True

USE_TZ = True

# django cors headers
CORS_ORIGIN_ALLOW_ALL = True

# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/1.7/howto/static-files/
STATIC_URL = '/static/'
STATIC_ROOT = os.path.join(BASE_DIR, 'static')

STATICFILES_DIRS = (
    # os.path.join(BASE_DIR, 'static'),
)

if not DEBUG:
    STATICFILES_STORAGE = ('whitenoise.storage.'
                           'CompressedManifestStaticFilesStorage')


PAGINATION = 200

REST_FRAMEWORK = {
    'COERCE_DECIMAL_TO_STRING': False,
    'WHITELIST': get_whitelisted_ips(),
    'DEFAULT_PERMISSION_CLASSES': (
        'api.permissions.WhiteListPermission',
    ),
}

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': "[%(asctime)s] %(levelname)s [%(name)s:%(lineno)s] "
                      "%(message)s",
            'datefmt': "%d/%b/%Y %H:%M:%S"
        },
        'simple': {
            'format': '%(levelname)s %(message)s'
        },
    },
    'handlers': {
        'file': {
            'level': 'DEBUG',
            'class': 'logging.FileHandler',
            'filename': os.path.join(BASE_DIR, 'logs/hourglass.log'),
            'formatter': 'verbose'
        },
        'contracts_file': {
            'level': 'DEBUG',
            'class': 'logging.FileHandler',
            'filename': os.path.join(BASE_DIR, 'logs/load_data.log'),
            'formatter': 'verbose'
        },
        'console': {
            'level': 'INFO',
            'class': 'logging.StreamHandler',
            'formatter': 'verbose'
        },
    },
    'loggers': {
        'django': {
            'handlers': ['console', 'file'],
            'propagate': True,
            'level': 'INFO',
        },
        'contracts': {
            'handlers': ['console', 'contracts_file'],
            'propagate': True,
            'level': 'INFO',
        },
    },
}

DATABASES = {}
DATABASES['default'] = dj_database_url.config()

SECURE_SSL_REDIRECT = not DEBUG

if 'FORCE_DISABLE_SECURE_SSL_REDIRECT' in os.environ:
    SECURE_SSL_REDIRECT = False

SESSION_COOKIE_SECURE = CSRF_COOKIE_SECURE = SECURE_SSL_REDIRECT

CSRF_COOKIE_HTTPONLY = True

# Amazon ELBs pass on X-Forwarded-Proto.
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

SECRET_KEY = os.environ['SECRET_KEY']

ENABLE_SEO_INDEXING = 'ENABLE_SEO_INDEXING' in os.environ

SECURITY_HEADERS_ON_ERROR_ONLY = 'SECURITY_HEADERS_ON_ERROR_ONLY' in os.environ

DATA_CAPTURE_SCHEDULES = (
    'data_capture.schedules.s70.Schedule70PriceList',
)

if DEBUG and not HIDE_DEBUG_UI:
    DATA_CAPTURE_SCHEDULES += (
        'data_capture.schedules.fake_schedule.FakeSchedulePriceList',
    )

UAA_AUTH_URL = 'https://login.cloud.gov/oauth/authorize'

UAA_TOKEN_URL = 'https://uaa.cloud.gov/oauth/token'

UAA_CLIENT_ID = os.environ.get('UAA_CLIENT_ID', 'calc-dev')

UAA_CLIENT_SECRET = os.environ.get('UAA_CLIENT_SECRET')

LOGIN_URL = 'uaa_client:login'

LOGIN_REDIRECT_URL = '/'

if DEBUG:
    INSTALLED_APPS += ('fake_uaa_provider',)

if not UAA_CLIENT_SECRET:
    if DEBUG:
        # We'll be using the Fake UAA Provider.
        UAA_CLIENT_SECRET = 'fake-uaa-provider-client-secret'
        UAA_AUTH_URL = UAA_TOKEN_URL = 'fake:'
    else:
        raise Exception('UAA_CLIENT_SECRET must be defined in production.')

DEBUG_TOOLBAR_PATCH_SETTINGS = False

DEBUG_TOOLBAR_CONFIG = {
    'SHOW_TOOLBAR_CALLBACK': 'hourglass.middleware.show_toolbar',
}
