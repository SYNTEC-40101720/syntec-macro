// M2 Tree-sitter grammar spike. Development-only; not used by the extension.

module.exports = grammar({
  name: 'syntec_macro_spike',

  rules: {
    source_file: $ => seq(
      repeat(choice(
        seq($.content, '\n'),
        '\n'
      )),
      optional($.content)
    ),

    content: $ => repeat1(choice(
      $.line_comment,
      $.string,
      $.macro_header,
      $.variable,
      $.word,
      $.number,
      $.operator,
      $.punctuation,
      $.whitespace
    )),

    line_comment: _ => token(seq('//', /[^\r\n]*/)),
    macro_header: _ => token(/%@MACRO/i),
    string: _ => token(seq('"', repeat(choice(/\\./, /[^"\\\r\n]/)), '"')),
    variable: _ => token(/[#@](?:\[[^\]\r\n]+\]|\d+)/),
    word: _ => token(/[A-Za-z_][A-Za-z0-9_.-]*/),
    number: _ => token(/\d+(?:\.\d*)?/),
    operator: _ => token(choice(':=', '<>', '<=', '>=', '==', /[+\-*\/<>=]/)),
    punctuation: _ => token(/[()\[\],;:%:]/),
    whitespace: _ => token(/[ \t]+/)
  }
});
