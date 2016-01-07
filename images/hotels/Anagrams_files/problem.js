var language_to_mode = { "Java": "java", "C++": "c_cpp", "Python": "python" };
var language_to_id = { "Java": "java", "C++": "cpp", "Python": "python" };
var editor = ace.edit("editor");

editor.setTheme("ace/theme/xcode");
editor.getSession().setMode("ace/mode/java");
editor.getSession().setUseWrapMode(true);
editor.getSession().setWrapLimitRange(80, 120);
editor.setAutoScrollEditorIntoView(true)
editor.getSession().setUseSoftTabs(true);
editor.$blockScrolling = Infinity;

function get_code_key() {
    // problem-1000-language-java
    return 'problem-' + $('#problem-id').val() + '-language-' + $('#code-language').val();
}

function fetchCode(language) {
    $('.loading').show();
    $.ajax({
        async: true,
        url: '/problem/api/code/',
        type: 'get',
        data: {
            'problem_id': $("#problem-id").val(),
            'language': language
        },
        success: function(data) {
            var response = eval('(' + data + ')');
            var code = '';
            if (!response['success']) {
                console.log(response['error']);
                code = 'Load failed, please refresh the page';
            } else {
                code = response['code'];
                $.localStorage.setItem(get_code_key(), code);
            }

            editor.setValue(unescape(code), -1);
            $('.loading').hide();
        } // success
    }); // ajax
}

function setLangAndCode(desiredLang) {
    var langMode = 'ace/mode/' + language_to_mode[desiredLang];
    editor.getSession().setMode(langMode);
    $('#code-language').val(desiredLang);
    $.localStorage.setItem('previousLang', desiredLang);

    // set code
    var code = $.localStorage.getItem(get_code_key());
    if (code != null && code != '') { 
        editor.setValue(unescape(code), -1);
    } else {
        fetchCode(desiredLang);
    }

    $('.semi-solution').hide();
    $('#semi-solution-' + language_to_id[desiredLang]).show();
};

$('.reset-to').on('click', function() {
    var problem_id = $('#problem-id').val();
    var language = $('#code-language').val();
    var solution_id = $(this).data('solution-id');
    var updated_at = $(this).data('updated-at');
    $.confirm({
        text: $(this).data('text'),
        title: $(this).data('title'),
        confirmButton: $(this).data('confirm-button'),
        cancelButton: $(this).data('cancel-button'),
        confirm: function(button) {
            var prefix = 'problem-' + problem_id + '-semi-solution-' + solution_id + '-' + language;
            var local_updated_at = $.localStorage.getItem(prefix + '-updated-at');
            if (local_updated_at == updated_at) {
                var code = $.localStorage.getItem(prefix + '-code');
                editor.setValue(unescape(code), -1);
                return;
            }

            $('.loading').show();
            $.ajax({
                async: true,
                url: '/problem/api/semi/',
                type: 'get',
                data: {
                    'solution_id': solution_id,
                    'problem_id': problem_id,
                    'language': language
                },
                success: function(data) {
                    var response = eval('(' + data + ')');
                    editor.setValue(unescape(response['code']), -1);
                    $.localStorage.setItem(prefix + '-updated-at', '' + response['updated_at']);
                    $.localStorage.setItem(prefix + '-code', response['code']);
                    $('.loading').hide();
                } // success
            }); // ajax
        },
    });
});

function editorOnChange (e) {
    $.localStorage.setItem(get_code_key(), escape(editor.getValue()));
};
editor.getSession().addEventListener('change', editorOnChange);
//editor.getSession().setNewLineMode('windows');

function expandEditor() {
    $('#expand-chevron').removeClass('fa-chevron-left').addClass('fa-chevron-right');
    $('#problem-aside').animate({width: '-=150'});
    $('#problem-aside').attr('expanded', 'true');
};

function compressEditor() {
    $('#expand-chevron').removeClass('fa-chevron-right').addClass('fa-chevron-left');
    $('#problem-aside').animate({width: '+=150'});
    $('#problem-aside').attr('expanded', 'false');
};

$('#expand-btn').on('click', function(e) {
    if ($('#problem-aside').attr('expanded') != 'true') {
        expandEditor();
    } else {
        compressEditor();
    }
});

editor.on('focus', function(e) {
    if ($('#problem-aside').attr('expanded') != 'true') {
        expandEditor();
    }
});

editor.setOptions({
    maxLines: Infinity,
    hScrollBarAlwaysVisible: false,
    vScrollBarAlwaysVisible: false
});

$(document).ready(function () {
    var previousLang = $.localStorage.getItem('previousLang');
    if (previousLang != '' && previousLang != null) {
        setLangAndCode(previousLang);
    } else {
        setLangAndCode('Java');
    }
    editor.setOption("maxLines", Math.floor(($(window).height() - 100) / $('#editor > div.ace_scroller > div > div.ace_layer.ace_text-layer > div:nth-child(1)').height()));
});

$(window).resize(function() {
    editor.setOption("maxLines", Math.floor(($(window).height() - 100) / $('#editor > div.ace_scroller > div > div.ace_layer.ace_text-layer > div:nth-child(1)').height()));
});

var submission_id;
var time_interval;
var waiting_time;
var refresh_timeout=null;

function judge_finished(status) {
    return status != 'Pending' && 
           status != 'Rejudge Pending' &&
           status != 'Running' &&
           status != 'Compiling';
}

function set_status(status) {
    var parent = $('#result-status').parent();
    parent.removeClass('text-success')
          .removeClass('text-danger')
          .removeClass('text-info')
          .removeClass('text-warning');
    if (status == 'Pending' || status == 'Rejudge Pending') {
        parent.addClass('text-light'); 
    } else if (status == 'Compiling') {
        parent.addClass('text-primary');
    } else if (status == 'Running') {
        parent.addClass('text-info');
    } else if (status == 'Accepted') {
        parent.addClass('text-success');
    } else if (status == 'Compile Error') {
        parent.addClass('text-warning');
    } else {
        parent.addClass('text-danger');
    }
    $('#result-status').html(status);
    if (!judge_finished(status)) {
        $('#result-status').append(' <i class="fa fa-spinner fa-spin"></i>');
    }
}

function set_progress(progress) {
    $('.progress-bar').attr('progress', progress);
    $('.progress-bar').attr('data-original-title', progress + '%');
    $('.progress-bar').attr('style', 'width: ' + progress + '%');
}

function set_success_result(response) {
    set_status(response['status']);

    $('#result-judge-container').removeClass("hide-first");

    if ('input' in response && response['input'].length !== 0) {
        $('.result-input-data').html(response['input']);
        $('.result-input').fadeIn();
    }

    if ('input_data_url' in response && response['input_data_url'].length !== 0) {
        $('#result-input-data-url').attr('href', response['input_data_url']);
        $('#result-input-data-url').fadeIn();
    }

    if ('output' in response && response['output'].length !== 0) {
        $('.result-output-data').html(response['output']);
        $('.result-output').fadeIn();
    }

    if ('expected' in response && response['expected'].length !== 0) {
        $('.result-expected-data').html(response['expected']);
        $('.result-expected').fadeIn();
    }

    if ('expected_data_url' in response && response['expected_data_url'].length !== 0) {
        $('#result-expected-data-url').attr('href', response['expected_data_url']);
        $('#result-expected-data-url').fadeIn();
    }

    if ('error_message' in response && response['error_message'].length !== 0) {
        $('.result-error-message').html(response['error_message']);
        $('.result-error').fadeIn();
    }

    if ('compile_info' in response && response['compile_info'].length !== 0 && response['status'] != 'Accepted') {
        $('.result-compile-info').html(response['compile_info']);
        $('.result-compile').fadeIn();
    }

    if ('lint_info' in response && response['lint_info'].length !== 0) {
        $('#result-lint-container').removeClass("hide-first");
        $('.result-lint-info').html(response['lint_info']);
        $('.result-lint').fadeIn();
    }

    var passed_percentage = 0;
    if (response['data_total_count']) {
	   passed_percentage = response['data_accepted_count'] * 100 / response['data_total_count'];
	   passed_percentage = Math.round(Math.sqrt(passed_percentage) * 10);
    }
    $('.result-data-passed').html(passed_percentage);
    $('.result-runtime').html(response['time_cost']);

    if (response['data_total_count'] != 0) {
        $('.progress-bar').removeClass("progress-bar-info").addClass("progress-bar-success");
        set_progress(passed_percentage);
    }

    if (!judge_finished(response['status'])) {
        waiting_time += time_interval;
        if (time_interval < 5000) {
            time_interval = time_interval * 3 / 2;   // * 1.5
        }
        if (waiting_time < 10 * 60 * 1000) {
            refresh_timeout = setTimeout(refresh, time_interval);
        } else {
            $("#submit-btn").attr("disabled", false);
            set_status('Request timeout, please try again');
        }
    } else {
        $("#submit-btn").attr("disabled", false);
        if (response['status'] == 'Accepted') { 
            // if this is in home page, show login dialog.
            if (window.location.href.indexOf('problem') == -1) {
                $("#login-window").modal('show').slideUp(1000);
            }
            $('#accepted-message').fadeIn(500);
            $('#recommend-problems').fadeIn(500);
        } // Accepted
    } // judge finished

}


function refresh() {
    $.ajax({
        url: '/submission/api/refresh/',
        type: 'get',
        data: {'id': submission_id, 'waiting_time': waiting_time},
        async: true,
        success: function(data) {
            var response = eval('(' + data + ')');
            set_success_result(response);
        } // success
    }); // ajax
}

$('#back').on('click', function(e) {
    $('#problem-detail').show();
    $('#problem-detail').addClass('animated slideInLeft');
    $('#judge-result').hide();
    $('#forward').show();
});

$('#forward, #submit-btn').on('click', function(e) {
    $('#problem-detail').hide();
    $('#judge-result').show();
    $('#accepted-message').hide();
});

$('#submit-btn').on('click', function(e){
    $(this).attr("disabled", true);
    $('#result-judge-container').removeClass("hide-first");
    $('#result-lint-container').removeClass("hide-first");
    $('.result').hide();
    set_status('Pending');
    $('#recommend-problems').hide();
    set_progress(0);
    time_interval = 100;
    waiting_time = 0;
    if (refresh_timeout !== null) {
        clearTimeout(refresh_timeout);
    }

    $('.result-data-accepted').html('0');
    $('.result-data-total').html('0');
    $('.result-runtime').html('0');

    $.ajax({
        async: true,
        url: '/submission/api/submit/',
        type: 'post',
        data: {
            'code': editor.getValue(),
            'problem_id': $('#problem-id').val(),
            'language': $('#code-language').val(),
            'csrfmiddlewaretoken': $.cookie('csrftoken')
        },
        success: function(data) {
            data = eval('(' + data + ')');
            if (data['success'] == false) {
                if (data['message'] == 'login required') {
                    window.location.replace(data['redirect_uri']);
                } else {
                    set_status(data['message']);
                }
                $("#submit-btn").attr("disabled", false);
                return;
            }
            submission_id = data['id'];
            refresh_timeout = setTimeout(refresh, time_interval);
        }
    });
});

$('#lint-btn').on('click', function(e){
    $('#result-lint-container').removeClass("hide-first");
    $('#problem-detail').hide();
    $('#judge-result').show();
    $('.result-lint-info').hide();
    $.ajax({
        async: true,
        url: '/submission/api/lint/',
        type: 'post',
        data: {
            'code': editor.getValue(),
            'problem_id': $('#problem-id').val(),
            'language': $('#code-language').val(),
            'csrfmiddlewaretoken': $.cookie('csrftoken')
        },
        success: function(data) {
            data = eval('(' + data + ')')
            if (data['success'] == false) {
                if (data['message'] == 'login required') {
                    window.location.replace(data['redirect_uri']);
                } else {
                    set_status(data['message']);
                }
                return;
            }
            $('#result-lint-container').removeClass("hide-first");
            $('.result-lint-info').html(data['lint_info']);
            $('.result-lint-info').fadeIn(1000);
        }
    });
});

$('#edit-btn').on('click', function(e) {
    $('#problem-detail').hide();
    $('#judge-result').show();
    $("#submit-btn").attr("disabled", false);
    $("#lint-btn").attr("disabled", false);
    $("#reset-btn").attr("disabled", false);
    $('#code-language').prop('disabled', false);
    $("#edit-btn").hide();
    editor.setReadOnly(false);
});

$('#yes').on('click', function(e) {
    $(this).hide();
    $('#company-list').show();
});

$('.company').on('click', function(e) {
    console.log($(this).attr('problem_id'));
    $.ajax({
        async: true,
        url: '/vote/interview/',
        type: 'post',
        data: {
            'problem_id': $(this).attr('problem_id'),
            'company_id': $(this).attr('company_id'),
            'csrfmiddlewaretoken': $.cookie('csrftoken')
        },
        success: function(data) {
            $('.company').hide();
            $('#feedback').show();
        } // success
    }); // ajax
});
