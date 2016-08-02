# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('data_capture', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='submittedpricelist',
            name='contract_end',
            field=models.DateField(help_text='Use MM/DD/YY format, e.g. "10/25/06".'),
        ),
        migrations.AlterField(
            model_name='submittedpricelist',
            name='contract_start',
            field=models.DateField(help_text='Use MM/DD/YY format, e.g. "10/25/06".'),
        ),
        migrations.AlterField(
            model_name='submittedpricelist',
            name='contract_year',
            field=models.IntegerField(),
        ),
    ]
