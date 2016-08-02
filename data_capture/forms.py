from django import forms

from .models import SubmittedPriceList
from .schedules import registry


class Step1Form(forms.Form):
    schedule = forms.ChoiceField(
        choices=registry.get_choices
    )

    file = forms.FileField()

    def clean(self):
        cleaned_data = super().clean()
        schedule = cleaned_data.get('schedule')
        file = cleaned_data.get('file')

        if schedule and file:
            gleaned_data = registry.smart_load_from_upload(schedule, file)

            if gleaned_data.is_empty():
                raise forms.ValidationError(
                    "The file you uploaded doesn't have any data we can "
                    "glean from it."
                )

            cleaned_data['gleaned_data'] = gleaned_data

        return cleaned_data


class Step3Form(forms.ModelForm):
    is_small_business = forms.ChoiceField(
        label='Business size',
        choices=[
            (None, '---------'),
            (True, 'Small business'),
            (False, 'Not a small business'),
        ],
        required=True
    )

    class Meta:
        model = SubmittedPriceList
        fields = [
            'contract_number',
            'vendor_name',
            'is_small_business',
            'contractor_site',
            'contract_year',
            'contract_start',
            'contract_end',
        ]
