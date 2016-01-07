$(document).ready(function() {
        function formatProblem (problem) {
            if (problem.loading) return problem.text;
            var markup = '<div>' + problem.title + '</div>';
            return markup;
        }
        function formatProblemSelection (problem) {
            return problem.title || problem.text;
        }
        $(".js-problem-ajax").select2({
            ajax: {
                url: "/" + window.language_code + "/problem/api/search",
                dataType: 'json',
                delay: 250,
                data: function (params) {
                    return {
                        problem_title: params.term
                    };
                },
                processResults: function (data) {
                    return {
                        results: data.result
                    };
                },
                cache: true
            },
            escapeMarkup: function (markup) { return markup; },
            minimumInputLength: 1,
            templateResult: formatProblem,
            templateSelection: formatProblemSelection
        });
});