from django.db import models
from django.contrib.auth.models import User

from contracts.models import Contract, EDUCATION_CHOICES


class SubmittedPriceList(models.Model):
    # This is the equivalent of Contract.idv_piid.
    contract_number = models.CharField(
        max_length=128,
        help_text='This should be the full contract number, e.g. GS-XXX-XXXX.'
    )
    vendor_name = models.CharField(max_length=128)
    is_small_business = models.BooleanField()
    schedule = models.CharField(
        max_length=128
    )
    contractor_site = models.CharField(
        verbose_name='Worksite',
        choices=[
            ('Customer', 'Customer'),
            ('Contractor', 'Contractor'),
            ('Both', 'Both'),
        ],
        max_length=128
    )
    contract_year = models.IntegerField()
    contract_start = models.DateField(
        help_text='Use MM/DD/YY format, e.g. "10/25/06".'
    )
    contract_end = models.DateField(
        help_text='Use MM/DD/YY format, e.g. "10/25/06".'
    )

    submitter = models.ForeignKey(User)
    is_approved = models.BooleanField(default=False)
    serialized_gleaned_data = models.TextField(
        help_text=(
            'The JSON-serialized data from the upload, including '
            'information about any rows that failed validation.'
        )
    )

    def add_row(self, **kwargs):
        row = SubmittedPriceListRow(**kwargs)
        self.rows.add(row)
        row.save()
        return row

    def get_schedule_title(self):
        # We're importing here to avoid a circular import. Kinda icky.
        from .schedules.registry import get_class

        return get_class(self.schedule).title

    def get_business_size_string(self):
        # TODO: Based on contracts/docs/s70/s70_data.csv, it seems
        # business size is either 'S' or 'O'. Assuming here that
        # 'S' means 'Small Business' and 'O' means 'Other'
        # but WE REALLY, REALLY NEED TO VERIFY THIS.

        if self.is_small_business:
            return 'S'
        return 'O'

    def approve(self):
        self.is_approved = True
        for row in self.rows.all():
            if row.contract_model is not None:
                raise AssertionError()
            contract = Contract(
                idv_piid=self.contract_number,
                contract_start=self.contract_start,
                contract_end=self.contract_end,
                contract_year=self.contract_year,
                vendor_name=self.vendor_name,
                labor_category=row.labor_category,
                education_level=row.education_level,
                min_years_experience=row.min_years_experience,
                hourly_rate_year1=row.hourly_rate_year1,
                hourly_rate_year2=None,
                hourly_rate_year3=None,
                hourly_rate_year4=None,
                hourly_rate_year5=None,
                current_price=row.hourly_rate_year1,
                next_year_price=None,
                second_year_price=None,
                contractor_site=self.contractor_site,
                schedule=self.get_schedule_title(),
                business_size=self.get_business_size_string(),
                sin=row.sin,
            )
            contract.full_clean(exclude=['piid'])
            contract.save()
            row.contract_model = contract
            row.save()

        self.save()

    def unapprove(self):
        self.is_approved = False

        for row in self.rows.all():
            row.contract_model.delete()

        self.save()


class SubmittedPriceListRow(models.Model):
    labor_category = models.TextField()
    education_level = models.CharField(
        choices=EDUCATION_CHOICES, max_length=5, null=True,
        blank=True)
    min_years_experience = models.IntegerField()
    hourly_rate_year1 = models.DecimalField(max_digits=10, decimal_places=2)
    current_price = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True)
    sin = models.TextField(null=True, blank=True)

    price_list = models.ForeignKey(
        SubmittedPriceList,
        on_delete=models.CASCADE,
        related_name='rows'
    )

    # If this row is represented in the Contract model objects, this will be
    # non-null. Note that we're explicitly calling it "contract model" here
    # because the Contract model isn't named very accurately: it doesn't
    # really represent a contract, but rather *part* of a contract, so
    # to avoid confusion, we're referring to it as the "contract model".
    contract_model = models.OneToOneField(
        Contract,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )

    def __str__(self):
        # This is really just so price list rows don't appear as
        # 'SubmittedPriceListRow object' in Django admin.

        return 'Submitted price list row'
