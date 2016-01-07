$('.language').on('click', function(e) {
    var lang = $(this).attr('value')
    $('#i18n_language').val(lang);
    return $('#i18n_form').submit();
});
