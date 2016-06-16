from collections import OrderedDict
from django.shortcuts import render
from django.contrib import messages
from django.http import HttpResponseRedirect
import xlrd

from contracts.models import Contract
from .forms import XlsForm, ProposedPriceListRow, ContractDetailsForm

def get_labor_categories(book):
    sheet = book.sheet_by_name('(3)Labor Categories')

    rownum = 3
    cats = []

    while True:
        sin = sheet.cell_value(rownum, 0)
        if not sin.strip():
            break

        cat = OrderedDict()
        cat['sin'] = sin
        cat['labor_category'] = sheet.cell_value(rownum, 1)
        cat['education_level'] = sheet.cell_value(rownum, 2)
        cat['min_years_experience'] = sheet.cell_value(rownum, 3)
        cat['commercial_list_price'] = sheet.cell_value(rownum, 4)
        cat['unit_of_issue'] = sheet.cell_value(rownum, 5)
        cat['most_favored_customer'] = sheet.cell_value(rownum, 6)
        cat['best_discount'] = sheet.cell_value(rownum, 7)
        cat['mfc_price'] = sheet.cell_value(rownum, 8)
        cat['gsa_discount'] = sheet.cell_value(rownum, 9)
        cat['price_excluding_iff'] = sheet.cell_value(rownum, 10)
        cat['price_including_iff'] = sheet.cell_value(rownum, 11)
        cat['volume_discount'] = sheet.cell_value(rownum, 12)
        cats.append(cat)

        rownum += 1

    return cats

def finish_import_xls(request, form, rows):
    for row in rows:
        contract = Contract(
            idv_piid=form.cleaned_data['idv_piid'],
            contract_start=form.cleaned_data['contract_start'],
            contract_end=form.cleaned_data['contract_end'],
            contract_year=form.cleaned_data['contract_year'],
            vendor_name=form.cleaned_data['vendor_name'],
            labor_category=row.cleaned_data['labor_category'],
            education_level=row.contract_education_level(),
            min_years_experience=row.cleaned_data['min_years_experience'],
            hourly_rate_year1=row.hourly_rate_year1(),
            hourly_rate_year2=None,
            hourly_rate_year3=None,
            hourly_rate_year4=None,
            hourly_rate_year5=None,
            current_price=row.current_price(),
            next_year_price=None,
            second_year_price=None,
            contractor_site=form.cleaned_data['contractor_site'],
            schedule=form.cleaned_data['schedule'],
            business_size=form.cleaned_data['business_size'],
            sin=row.cleaned_data['sin']
        )

        contract.full_clean(exclude=['piid'])

        contract.save()

    messages.add_message(
        request, messages.SUCCESS,
        'Hooray, your data has been added to CALC!'
    )

    # TODO: Use reverse() instead of a hard-coded URL.
    return HttpResponseRedirect('/')

def import_xls_step_2(request, xls_cats=None):
    rows = []

    if xls_cats is None:
        form = ContractDetailsForm(
            request.POST,
            prefix='contract_details'
        )
        num_rows = int(request.POST['num_rows'])
        is_valid = form.is_valid()
        for i in range(num_rows):
            row = ProposedPriceListRow(
                request.POST,
                prefix='xls_row_%d' % i
            )
            rows.append(row)
            if not row.is_valid():
                is_valid = False
        if is_valid:
            return finish_import_xls(request, form, rows)
        else:
            messages.add_message(
                request, messages.ERROR,
                'Alas, your submission had some problems. Please fix them '
                'below.'
            )
    else:
        form = ContractDetailsForm(prefix='contract_details')
        for cat in xls_cats:
            initial_data = {}

            def set_field(field, type_coercer=str):
                key = 'xls_row_%d-%s' % (len(rows), field)
                val = cat[field]

                try:
                    val = type_coercer(val)
                except ValueError:
                    pass

                initial_data[key] = val

            set_field('sin')
            set_field('labor_category')
            set_field('education_level')
            set_field('min_years_experience', type_coercer=int)
            set_field('price_including_iff')

            row = ProposedPriceListRow(
                data=initial_data,
                prefix='xls_row_%d' % len(rows)
            )
            rows.append(row)

    return render(request, 'import_xls_step_2.html', {
        'form': form,
        'header_row': ProposedPriceListRow(),
        'rows': rows
    })

def import_xls(request):
    if request.method == 'POST':
        step = request.POST.get('step', '1')
        if step == '1':
            form = XlsForm(request.POST, request.FILES)
            if form.is_valid():
                f = request.FILES['xls']
                try:
                    book = xlrd.open_workbook(file_contents=f.read())
                    cats = get_labor_categories(book)
                except:
                    # TODO: Log error.
                    cats = None
                if cats:
                    return import_xls_step_2(request, cats)
                messages.add_message(
                    request, messages.ERROR,
                    'Alas, your file does not appear to contain any price '
                    'list information.'
                )
        elif step == '2':
            return import_xls_step_2(request)
    else:
        form = XlsForm()

    return render(request, 'import_xls.html', {
        'form': form,
    })
