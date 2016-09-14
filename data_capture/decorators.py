from functools import wraps

from django.shortcuts import redirect
from django.contrib.auth import REDIRECT_FIELD_NAME, decorators
from django.core.exceptions import PermissionDenied

from frontend import ajaxform
from .management.commands.initgroups import ROLES


def handle_cancel(*args, redirect_name='index', key_prefix='data_capture:'):
    '''
    Decorator to handle cancel behavior in Data Capture flows.
    The associated request's POST data is checked for a 'cancel' key,
    and, if found, all session keys that start with `key_prefix`
    are deleted and the request is redirected to `redirect_name`.
    '''

    no_args = False
    if len(args) == 1 and callable(args[0]):
        # We were called without args
        function = args[0]
        no_args = True

    def decorator(function):
        @wraps(function)
        def wrapper(request, *args, **kwargs):
            if request.method == 'POST' and 'cancel' in request.POST:
                if key_prefix:
                    # .keys() returns an iterator, which can't be deleted from
                    # while in a loop, so we use list() to get an actual list
                    session_keys = list(request.session.keys())
                    for k in session_keys:
                        if k.startswith(key_prefix):
                            del request.session[k]

                # if AJAX request, then send JSON response
                # that has a 'redirect_url' property
                if request.is_ajax():
                    return ajaxform.ajax_redirect(redirect_name)

                # redirect to the view named redirect_name
                return redirect(redirect_name)

            else:
                # pass through
                return function(request, *args, **kwargs)

        return wrapper

    if no_args:
        return decorator(function)
    else:
        return decorator


def staff_login_required(function=None,
                         redirect_field_name=REDIRECT_FIELD_NAME,
                         login_url=None):
    '''
    Decorator to check that the user accessing the decorated view has their
    is_staff flag set to True.
    It will first redirect to login_url or the default login url if the user is
    not authenticated. If the user is authenticated but is not staff, then
    a PermissionDenied exception will be raised.
    '''

    # Based off code from the Django project
    # License: https://github.com/django/django/blob/c1aec0feda73ede09503192a66f973598aef901d/LICENSE  # NOQA
    # Code reference: https://github.com/django/django/blob/c1aec0feda73ede09503192a66f973598aef901d/django/contrib/auth/decorators.py#L40  # NOQA
    def check_if_staff(user):
        if not user.is_authenticated():
            # returning False will cause the user_passes_test decorator
            # to redirect to the login flow
            return False

        if user.is_staff:
            # then all good
            return True

        # otherwise the user is authenticated but isn't staff, so
        # they do not have the correct permissions and should be directed
        # to the 403 page
        raise PermissionDenied

    actual_decorator = decorators.user_passes_test(
        check_if_staff,
        login_url=login_url,
        redirect_field_name=redirect_field_name
    )
    if function:
        return actual_decorator(function)
    return actual_decorator


def role_permissions_required(role, login_url=None):
    '''
    Decorator to check that a user accessing the decorated view has the
    permissions associated with role.
    Valid role names are those specified in initgroups.py.

    If the user is not-authenticated, then they will first be redirected to
    login. If the user is authenticated but does not have the correct
    permissions, a PermissionDenied exception will be raised.
    '''

    # Based off code from the Django project
    # License: https://github.com/django/django/blob/c1aec0feda73ede09503192a66f973598aef901d/LICENSE  # NOQA
    # Code reference: https://github.com/django/django/blob/c1aec0feda73ede09503192a66f973598aef901d/django/contrib/auth/decorators.py  # NOQA
    def check_perms(user):
        # First check if the user has the permission (even anon users)
        if user.has_perms(ROLES[role]):
            return True

        # Raise an exception if the user is authenticated. If user is not
        # authenticated, then user_passes_test will redirect to the login page
        if user.is_authenticated():
            raise PermissionDenied
        # As the last resort, show the login form
        return False

    return decorators.user_passes_test(check_perms, login_url=login_url)
