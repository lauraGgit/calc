from django import forms
from django.core.exceptions import ValidationError

from contracts.management.commands.load_data import FEDERAL_MIN_CONTRACT_RATE


class XlsForm(forms.Form):
    xls = forms.FileField(
        label="Proposed Price List (PPL) Excel file",
        required=True
    )

class ContractDetailsForm(forms.Form):
    idv_piid = forms.CharField(
        label="Contract number",
        required=True,
        help_text="This must be the full contract number, e.g. GS-35F-XXXX."
    )
    vendor_name = forms.CharField(
        label="Vendor name"
    )
    business_size = forms.CharField(
        label="Business size"
    )
    schedule = forms.CharField(
        label="Schedule",
        initial="IT Schedule 70"
    )
    contractor_site = forms.ChoiceField(
        label="Worksite",
        required=True,
        choices=[
            ('customer', 'customer'),
            ('contractor', 'contractor'),
            ('both', 'both')
        ]
    )
    contract_year = forms.IntegerField(
        label="Current contract year",
        required=True,
        min_value=1,
        max_value=5,
        help_text="This must be a number between 1 and 5."
    )
    contract_start = forms.DateField(
        label="Contract start date",
        required=True,
        help_text="Please specify as MM/DD/YY."
    )
    contract_end = forms.DateField(
        label="Contract end date",
        required=True,
        help_text="Please specify as MM/DD/YY."
    )


# TODO: Ideally this should pull from contracts.models.EDUCATION_CHOICES.
EDU_LEVELS = {
    'Associates': 'AA',
    'Bachelors': 'BA',
    'Masters': 'MA',
    'Ph.D': 'PHD'
}

def validate_education_level(value):
    values = EDU_LEVELS.keys()
    if value not in values:
        raise ValidationError('This field must contain one of the '
                              'following values: %s' % (', '.join(values)))


class ProposedPriceListRow(forms.Form):
    sin = forms.CharField(
        label="SIN",
        required=True
    )
    labor_category = forms.CharField(
        label="Service proposed",
        required=True
    )
    education_level = forms.CharField(
        label="Minimum education / certification level",
        required=True,
        validators=[validate_education_level]
    )
    min_years_experience = forms.IntegerField(
        label="Minimum years of experience",
        required=True
    )
    price_including_iff = forms.DecimalField(
        label="Price offered to GSA (including IFF)",
        required=True
    )

    def contract_education_level(self):
        return EDU_LEVELS[self.cleaned_data['education_level']]

    def hourly_rate_year1(self):
        return self.cleaned_data['price_including_iff']

    def current_price(self):
        price = self.hourly_rate_year1()
        return price if price >= FEDERAL_MIN_CONTRACT_RATE else None
