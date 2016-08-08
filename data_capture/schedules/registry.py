from django.conf import settings
from django.forms import ValidationError
from django.utils.module_loading import import_string


def _classname(cls):
    return '%s.%s' % (cls.__module__, cls.__name__)


def _init():
    global CHOICES, CLASSES

    CHOICES = []
    CLASSES = {}

    for classname in settings.DATA_CAPTURE_SCHEDULES:
        cls = import_string(classname)
        CHOICES.append((classname, cls.title))
        CLASSES[classname] = cls


def get_choices():
    for choice in CHOICES:
        yield choice


def get_class(classname):
    return CLASSES[classname]


def get_classname(instance):
    classname = _classname(instance.__class__)
    if classname not in CLASSES:
        raise KeyError(classname)
    return classname


def load_from_upload(classname, f):
    return CLASSES[classname].load_from_upload(f)


def smart_load_from_upload(classname, f):
    '''
    Attempt to intelligently load the given Django UploadedFile,
    interpreting it as a price list for the given schedule class name.

    If interpreting it under the preferred schedule results in either
    a ValidationError or no valid rows, attempts will be made to
    re-interpret the file under different schedules. The first found
    that yields better interpretations of the data will be returned.

    If no better matches are found, the original result or exception
    (from interpreting the data under the preferred price list) will
    be returned.
    '''

    original_error = None
    pricelist = None

    try:
        pricelist = load_from_upload(classname, f)
    except ValidationError as e:
        original_error = e

    if original_error or not pricelist.valid_rows:
        # See if any of our other registered schedules can make better sense
        # of it.
        next_best_pricelist = None
        for fallback, _ in CHOICES:
            if fallback == classname:
                continue
            try:
                f.seek(0)
                next_best_pricelist = load_from_upload(fallback, f)
                if next_best_pricelist.valid_rows:
                    pricelist = next_best_pricelist
                    break
            except ValidationError as e:
                pass

    if pricelist is None:
        raise original_error

    return pricelist


def serialize(pricelist):
    classname = _classname(pricelist.__class__)

    if classname not in CLASSES:
        raise KeyError(classname)

    return (classname, pricelist.serialize())


def deserialize(data):
    classname, d = data

    return CLASSES[classname].deserialize(d)


_init()
