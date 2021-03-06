from django.conf import settings
from django.conf.urls import include, url
from django.contrib import admin
from django.views.generic import TemplateView

from data_capture.decorators import staff_login_required

from .healthcheck import healthcheck
from .robots import robots_txt

# Wrap the admin site login with our staff_login_required decorator,
# which will raise a PermissionDenied exception if a logged-in, but non-staff
# user attempts to access the login page.
# ref: http://stackoverflow.com/a/38520951
admin.site.login = staff_login_required(admin.site.login)

urlpatterns = [
    # Examples:
    # url(r'^$', 'hourglass.views.home', name='home'),
    # url(r'^blog/', include('blog.urls')),
    url(r'^$', TemplateView.as_view(template_name='index.html'), name='index'),
    url(r'^about/$', TemplateView.as_view(template_name='about.html'),
        name='about'),
    url(r'^healthcheck/', healthcheck),
    url(r'^api/', include('api.urls')),
    url(r'^data-capture/',
        include('data_capture.urls', namespace='data_capture')),
    url(r'^admin/', include(admin.site.urls)),
    url(r'^styleguide/', include('styleguide.urls', namespace='styleguide')),
    url(r'^robots.txt$', robots_txt),
    url(r'^auth/', include('uaa_client.urls', namespace='uaa_client')),
]

tests_url = url(r'^tests/$', TemplateView.as_view(template_name='tests.html'),
                name="tests")

if settings.DEBUG:
    import debug_toolbar

    urlpatterns += [
        url(r'^', include('fake_uaa_provider.urls',
                          namespace='fake_uaa_provider')),
        url(r'^__debug__/', include(debug_toolbar.urls)),
        tests_url,
    ]
