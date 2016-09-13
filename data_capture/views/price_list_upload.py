import json
from functools import wraps
from django.views.decorators.http import require_http_methods
from django.shortcuts import render, redirect
from django.http import HttpResponseBadRequest

from .. import forms
from ..decorators import handle_cancel, require_role_permissions
from ..schedules import registry
from .common import add_generic_form_error
from frontend import ajaxform


def gleaned_data_required(f):
    @wraps(f)
    def wrapper(request):
        try:
            d = request.session['data_capture:price_list']['gleaned_data']
        except:
            return redirect('data_capture:step_3')

        return f(request, registry.deserialize(d))
    return wrapper


@require_role_permissions('Contract Officers')
@require_http_methods(["GET", "POST"])
def step_1(request):
    if request.method == 'GET':
        form = forms.Step1Form()
    else:
        form = forms.Step1Form(request.POST)
        if form.is_valid():
            request.session['data_capture:price_list'] = {
                'step_1_POST': request.POST,
            }
            return redirect('data_capture:step_2')

        else:
            add_generic_form_error(request, form)

    return render(request, 'data_capture/price_list/step_1.html', {
            'step_number': 1,
            'form': form,
        })


@require_role_permissions('Contract Officers')
@require_http_methods(["GET", "POST"])
@handle_cancel
def step_2(request):
    # Redirect back to step 1 if we don't have data
    if 'step_1_POST' not in request.session.get('data_capture:price_list',
                                                {}):
        return redirect('data_capture:step_1')

    if request.method == 'GET':
        form = forms.Step2Form()
    else:
        form = forms.Step2Form(request.POST)
        if form.is_valid():
            session_data = request.session['data_capture:price_list']
            session_data['step_2_POST'] = request.POST

            # Changing the value of a subkey doesn't cause the session to save,
            # so do it manually
            request.session.modified = True

            return redirect('data_capture:step_3')
        else:
            add_generic_form_error(request, form)

    return render(request, 'data_capture/price_list/step_2.html', {
        'step_number': 2,
        'form': form
    })


@require_role_permissions('Contract Officers')
@require_http_methods(["GET", "POST"])
@handle_cancel
def step_3(request):
    if 'step_2_POST' not in request.session.get('data_capture:price_list',
                                                {}):
        return redirect('data_capture:step_2')
    else:
        if request.method == 'GET':
            form = forms.Step3Form()
        else:
            session_pl = request.session['data_capture:price_list']
            posted_data = dict(
                request.POST,
                schedule=session_pl['step_1_POST']['schedule'])
            form = forms.Step3Form(posted_data, request.FILES)

            if form.is_valid():
                session_pl['gleaned_data'] = \
                    registry.serialize(form.cleaned_data['gleaned_data'])

                request.session.modified = True

                return ajaxform.redirect(request, 'data_capture:step_4')
            else:
                add_generic_form_error(request, form)

        return ajaxform.render(
            request,
            context={
                'step_number': 3,
                'form': form
            },
            template_name='data_capture/price_list/step_3.html',
            ajax_template_name='data_capture/price_list/upload_form.html',
        )


@require_role_permissions('Contract Officers')
@gleaned_data_required
@handle_cancel
def step_4(request, gleaned_data):
    session_pl = request.session['data_capture:price_list']
    preferred_schedule = registry.get_class(
        session_pl['step_1_POST']['schedule']
    )
    if request.method == 'POST':
        if not gleaned_data.valid_rows:
            # Our UI never should've let the user issue a request
            # like this.
            return HttpResponseBadRequest()
        step_1_form = forms.Step1Form(
            session_pl['step_1_POST']
        )
        if not step_1_form.is_valid():
            raise AssertionError('invalid step 1 data in session')
        price_list = step_1_form.save(commit=False)

        step_2_form = forms.Step2Form(
            session_pl['step_2_POST'],
            instance=price_list
        )
        if not step_2_form.is_valid():
            raise AssertionError('invalid step 2 data in session')
        step_2_form.save(commit=False)

        price_list.submitter = request.user
        price_list.serialized_gleaned_data = json.dumps(
            session_pl['gleaned_data'])
        price_list.save()
        gleaned_data.add_to_price_list(price_list)

        del request.session['data_capture:price_list']

        return redirect('data_capture:step_5')

    return render(request, 'data_capture/price_list/step_4.html', {
        'step_number': 4,
        'gleaned_data': gleaned_data,
        'is_preferred_schedule': isinstance(gleaned_data, preferred_schedule),
        'preferred_schedule': preferred_schedule,
    })


@require_role_permissions('Contract Officers')
def step_5(request):
    return render(request, 'data_capture/price_list/step_5.html', {
        'step_number': 5
    })
