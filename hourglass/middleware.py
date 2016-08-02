from django.conf import settings
from django.core.exceptions import MiddlewareNotUsed
from debug_toolbar.middleware import DebugToolbarMiddleware


class ComplianceMiddleware:
    '''
    Middleware to add security-related response headers.

    If the SECURITY_HEADERS_ON_ERROR_ONLY setting is True, then the headers
    will only be added to error responses (400 and above). This behavior is
    needed for cloud.gov deployments because its proxy adds the headers
    to 200 responses, but not to error responses.

    Otherwise, the headers will be added to all responses.
    '''

    def process_response(self, request, response):
        if (not settings.SECURITY_HEADERS_ON_ERROR_ONLY or
                response.status_code >= 400):

            response["X-Content-Type-Options"] = "nosniff"
            response["X-XSS-Protection"] = "1; mode=block"

        return response


def show_toolbar(request):
    '''
    Like debug_toolbar.middleware.show_toolbar, but without the
    INTERNAL_IPS consultation, since the developer may be using
    Docker or accessing their development instance over a mobile/tablet
    device.
    '''

    if not settings.DEBUG:
        raise AssertionError("I should not be used when DEBUG is False!")

    if request.is_ajax():
        return False

    return True


class DebugOnlyDebugToolbarMiddleware(DebugToolbarMiddleware):
    '''
    Like DebugToolbarMiddleware, but tells Django it's unused if
    DEBUG or HIDE_DEBUG_UI is False.
    '''

    def __init__(self):
        if not settings.DEBUG or settings.HIDE_DEBUG_UI:
            raise MiddlewareNotUsed()
        super().__init__()
