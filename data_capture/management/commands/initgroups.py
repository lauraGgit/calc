from django.core.management.base import BaseCommand
from django.contrib.auth.models import Group, Permission


ROLES = {}

ROLES['Data Administrators'] = set([
    'auth.add_user',
    'auth.change_user',
    'contracts.add_bulkuploadcontractsource',
    'data_capture.change_submittedpricelist',
    'data_capture.change_submittedpricelistrow',
])

ROLES['Contract Officers'] = set([
    'data_capture.add_submittedpricelist',
    'data_capture.add_submittedpricelistrow',
])

# Data Administrators should also have any perms that Contract Officers do
ROLES['Data Administrators'].update(ROLES['Contract Officers'])


class Command(BaseCommand):
    help = '''\
    Initializes some helpful initial permission groups.
    '''

    def set_perms(self, groupname, perms):
        self.stdout.write("Setting permissions for group '%s'." % groupname)
        if self.verbosity >= 2:
            self.stdout.write("  Permissions: %s" % ', '.join(perms))
        try:
            group = Group.objects.get(name=groupname)
        except Group.DoesNotExist:
            self.stdout.write("  Group does not exist, creating it.")
            group = Group(name=groupname)
            group.save()
        splitnames = [perm.split('.') for perm in perms]
        group.permissions = [
            Permission.objects.get(codename=codename,
                                   content_type__app_label=app_label)
            for app_label, codename in splitnames
        ]
        group.save()

    def handle(self, *args, **kwargs):
        self.verbosity = int(kwargs['verbosity'])
        for groupname, perms in ROLES.items():
            self.set_perms(groupname, perms)
        self.stdout.write("Done.")
        self.stdout.write("Please do not manually change these "
                          "groups; they may be updated in the future.")
