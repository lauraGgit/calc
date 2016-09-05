from django import template
from django.forms import NumberInput

register = template.Library()


@register.filter('is_number')
def is_number(field):
    return isinstance(field.field.widget, NumberInput)
