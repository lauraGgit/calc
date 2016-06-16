from django.conf.urls import patterns, include, url
from django.contrib import admin
from django.views.generic import TemplateView
from django.http import HttpResponse

from api import urls as api_urls

urlpatterns = patterns('',
    # Examples:
    # url(r'^$', 'hourglass.views.home', name='home'),
    # url(r'^blog/', include('blog.urls')),
    url(r'^$', TemplateView.as_view(template_name='index.html'), name='index'),
    url(r'^about/$', TemplateView.as_view(template_name='about.html'), name='about'),
    url(r'^xls/$', 'hourglass_site.views.import_xls'),
    url(r'^api/', include(api_urls)),
    url(r'^admin/', include(admin.site.urls)),
    url(r'^tests/$', TemplateView.as_view(template_name='tests.html')),
    url(r'^robots.txt$', lambda r: HttpResponse("User-agent: *\nDisallow: /")),
)

