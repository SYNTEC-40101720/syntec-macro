//! Development-only Rust core pilot.
//!
//! This crate intentionally implements only the protocol-compatible lexer
//! preprocessing and tolerant control-flow diagnostics needed for the M3
//! comparison. It is not wired into the VS Code extension yet.

pub const PROTOCOL_VERSION: u32 = 1;

/// Minimal ABI probe for the first Wasm boundary milestone.
#[cfg(target_arch = "wasm32")]
#[no_mangle]
pub extern "C" fn syntec_core_protocol_version() -> u32 {
    PROTOCOL_VERSION
}

/// Allocate a UTF-8 input buffer for the minimal Wasm ABI probe.
#[cfg(target_arch = "wasm32")]
#[no_mangle]
pub extern "C" fn syntec_core_alloc(size: usize) -> *mut u8 {
    let mut buffer = Vec::<u8>::with_capacity(size);
    let pointer = buffer.as_mut_ptr();
    std::mem::forget(buffer);
    pointer
}

/// Release a buffer allocated by `syntec_core_alloc`.
#[cfg(target_arch = "wasm32")]
#[no_mangle]
pub unsafe extern "C" fn syntec_core_dealloc(pointer: *mut u8, capacity: usize) {
    if !pointer.is_null() {
        drop(Vec::from_raw_parts(pointer, 0, capacity));
    }
}

/// Count control-flow diagnostics for a UTF-8 input buffer.
#[cfg(target_arch = "wasm32")]
#[no_mangle]
pub unsafe extern "C" fn syntec_core_diagnostic_count(pointer: *const u8, length: usize) -> usize {
    if pointer.is_null() {
        return 0;
    }
    let bytes = std::slice::from_raw_parts(pointer, length);
    let Ok(text) = std::str::from_utf8(bytes) else {
        return 0;
    };
    analyze_document(text).diagnostics.len()
}

/// Serialize a protocol-compatible diagnostic result into a returned Wasm buffer.
#[cfg(target_arch = "wasm32")]
#[no_mangle]
pub unsafe extern "C" fn syntec_core_analyze_json(pointer: *const u8, length: usize) -> u64 {
    if pointer.is_null() {
        return 0;
    }
    let bytes = std::slice::from_raw_parts(pointer, length);
    let Ok(text) = std::str::from_utf8(bytes) else {
        return 0;
    };
    let json = result_to_json(&analyze_document(text))
        .into_bytes()
        .into_boxed_slice();
    let length = json.len() as u32;
    let pointer = Box::into_raw(json) as *mut u8 as u32;
    ((pointer as u64) << 32) | length as u64
}

/// Release a JSON result returned by `syntec_core_analyze_json`.
#[cfg(target_arch = "wasm32")]
#[no_mangle]
pub unsafe extern "C" fn syntec_core_free_output(pointer: *mut u8, length: usize) {
    if !pointer.is_null() {
        let slice = std::ptr::slice_from_raw_parts_mut(pointer, length);
        drop(Box::from_raw(slice));
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Severity {
    Error,
    Warning,
}

impl Severity {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Error => "error",
            Self::Warning => "warning",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Diagnostic {
    pub line: usize,
    pub col: usize,
    pub end_col: usize,
    pub severity: Severity,
    pub code: String,
    pub message: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Symbol {
    pub name: String,
    pub kind: String,
    pub line: usize,
    pub start_character: usize,
    pub end_character: usize,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct NavigationCall {
    pub target_name: String,
    pub line: usize,
    pub start: usize,
    pub end: usize,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AnalysisResult {
    pub protocol_version: u32,
    pub backend: &'static str,
    pub diagnostics: Vec<Diagnostic>,
    pub symbols: Vec<Symbol>,
    pub calls: Vec<NavigationCall>,
}

#[cfg(target_arch = "wasm32")]
fn json_escape(value: &str) -> String {
    let mut escaped = String::with_capacity(value.len());
    for character in value.chars() {
        match character {
            '"' => escaped.push_str("\\\""),
            '\\' => escaped.push_str("\\\\"),
            '\n' => escaped.push_str("\\n"),
            '\r' => escaped.push_str("\\r"),
            '\t' => escaped.push_str("\\t"),
            character if character.is_control() => {
                escaped.push_str(&format!("\\u{:04x}", character as u32));
            }
            character => escaped.push(character),
        }
    }
    escaped
}

#[cfg(target_arch = "wasm32")]
fn result_to_json(result: &AnalysisResult) -> String {
    let mut json = format!(
        "{{\"protocolVersion\":{},\"backend\":\"{}\",\"diagnostics\":[",
        result.protocol_version,
        json_escape(result.backend)
    );
    for (index, diagnostic) in result.diagnostics.iter().enumerate() {
        if index > 0 {
            json.push(',');
        }
        json.push_str(&format!(
            "{{\"line\":{},\"col\":{},\"endCol\":{},\"severity\":\"{}\",\"code\":\"{}\",\"message\":\"{}\"}}",
            diagnostic.line,
            diagnostic.col,
            diagnostic.end_col,
            diagnostic.severity.as_str(),
            json_escape(&diagnostic.code),
            json_escape(&diagnostic.message)
        ));
    }
    json.push_str("],\"symbols\":[");
    for (index, symbol) in result.symbols.iter().enumerate() {
        if index > 0 {
            json.push(',');
        }
        json.push_str(&format!(
            "{{\"name\":\"{}\",\"kind\":\"{}\",\"line\":{},\"startCharacter\":{},\"endCharacter\":{}}}",
            json_escape(&symbol.name),
            json_escape(&symbol.kind),
            symbol.line,
            symbol.start_character,
            symbol.end_character
        ));
    }
    json.push_str("],\"edits\":[],\"navigation\":{\"programEntryName\":null,\"macroProgramName\":null,\"symbols\":[");
    for (index, symbol) in result.symbols.iter().enumerate() {
        if index > 0 {
            json.push(',');
        }
        json.push_str(&format!(
            "{{\"name\":\"{}\",\"kind\":\"{}\",\"line\":{},\"startCharacter\":{},\"endCharacter\":{}}}",
            json_escape(&symbol.name),
            json_escape(&symbol.kind),
            symbol.line,
            symbol.start_character,
            symbol.end_character
        ));
    }
    json.push_str("],\"calls\":[");
    for (index, call) in result.calls.iter().enumerate() {
        if index > 0 {
            json.push(',');
        }
        json.push_str(&format!(
            "{{\"targetName\":\"{}\",\"line\":{},\"start\":{},\"end\":{}}}",
            json_escape(&call.target_name),
            call.line,
            call.start,
            call.end
        ));
    }
    json.push_str("]}}");
    json
}

#[derive(Debug, Clone)]
struct Block {
    keyword: String,
    line: usize,
}

#[derive(Debug, Default, Clone, Copy)]
struct LexState {
    in_block_comment: bool,
}

const OPENERS: [&str; 5] = ["IF", "FOR", "WHILE", "CASE", "REPEAT"];
const CLOSERS: [(&str, &str); 10] = [
    ("END_IF", "IF"),
    ("END_FOR", "FOR"),
    ("END_WHILE", "WHILE"),
    ("END_CASE", "CASE"),
    ("END_REPEAT", "REPEAT"),
    ("ENDIF", "IF"),
    ("ENDFOR", "FOR"),
    ("ENDWHILE", "WHILE"),
    ("ENDCASE", "CASE"),
    ("ENDREPEAT", "REPEAT"),
];

fn is_opener(keyword: &str) -> bool {
    OPENERS.contains(&keyword)
}

fn closer_opener(keyword: &str) -> Option<&'static str> {
    CLOSERS
        .iter()
        .find_map(|(closer, opener)| (*closer == keyword).then_some(*opener))
}

fn is_escaped_quote(chars: &[char], index: usize) -> bool {
    let mut slash_count = 0;
    let mut cursor = index;
    while cursor > 0 {
        cursor -= 1;
        if chars[cursor] != '\\' {
            break;
        }
        slash_count += 1;
    }
    slash_count % 2 == 1
}

fn strip_comments_and_strings(line: &str, mut in_block_comment: bool) -> (String, bool) {
    let chars: Vec<char> = line.chars().collect();
    let mut result = String::with_capacity(line.len());
    let mut in_string = false;
    let mut index = 0;

    while index < chars.len() {
        if in_block_comment {
            if index + 1 < chars.len() && chars[index] == '*' && chars[index + 1] == ')' {
                result.push(' ');
                result.push(' ');
                index += 2;
                in_block_comment = false;
            } else {
                result.push(' ');
                index += 1;
            }
            continue;
        }

        if !in_string && index + 1 < chars.len() && chars[index] == '/' && chars[index + 1] == '/' {
            result.extend(std::iter::repeat(' ').take(chars.len() - index));
            break;
        }
        if !in_string && index + 1 < chars.len() && chars[index] == '(' && chars[index + 1] == '*' {
            result.push(' ');
            result.push(' ');
            index += 2;
            in_block_comment = true;
            continue;
        }
        if chars[index] == '"' && !is_escaped_quote(&chars, index) {
            in_string = !in_string;
            result.push(' ');
        } else {
            result.push(if in_string { ' ' } else { chars[index] });
        }
        index += 1;
    }

    (result, in_block_comment)
}

fn keyword_positions(line: &str) -> Vec<(String, usize, usize)> {
    let chars: Vec<char> = line.chars().collect();
    let mut positions = Vec::new();
    let mut index = 0;

    while index < chars.len() {
        if !chars[index].is_ascii_alphabetic() && chars[index] != '_' {
            index += 1;
            continue;
        }
        let start = index;
        index += 1;
        while index < chars.len() && (chars[index].is_ascii_alphanumeric() || chars[index] == '_') {
            index += 1;
        }
        let word: String = chars[start..index].iter().collect();
        let upper = word.to_ascii_uppercase();
        if is_opener(&upper)
            || closer_opener(&upper).is_some()
            || matches!(
                upper.as_str(),
                "UNTIL" | "ELSE" | "ELSEIF" | "EXIT" | "GOTO"
            )
        {
            positions.push((upper, start, index));
        }
    }

    positions
}

fn is_n_label(trimmed: &str) -> bool {
    let Some(rest) = trimmed.strip_prefix('N') else {
        return false;
    };
    let Some(number) = rest.strip_suffix(';') else {
        return false;
    };
    !number.is_empty() && number.chars().all(|character| character.is_ascii_digit())
}

fn command_matches(chars: &[char], index: usize, command: &str) -> bool {
    let command_chars: Vec<char> = command.chars().collect();
    if index + command_chars.len() > chars.len() {
        return false;
    }
    if !chars[index..index + command_chars.len()]
        .iter()
        .zip(command_chars.iter())
        .all(|(left, right)| left.eq_ignore_ascii_case(right))
    {
        return false;
    }
    let before_is_word = index > 0
        && (chars[index - 1].is_ascii_alphanumeric()
            || chars[index - 1] == '_'
            || chars[index - 1] == '.');
    let end = index + command_chars.len();
    let after_is_word = end < chars.len()
        && (chars[end].is_ascii_alphanumeric() || chars[end] == '_' || chars[end] == '.');
    !before_is_word && !after_is_word
}

fn extract_navigation(content: &str) -> (Vec<Symbol>, Vec<NavigationCall>) {
    let mut state = LexState::default();
    let mut symbols = Vec::new();
    let mut calls = Vec::new();
    let commands = [
        ("G66.1", "G"),
        ("G65", "G"),
        ("G66", "G"),
        ("M198", "O"),
        ("M98", "O"),
    ];

    for (line_index, raw_line) in content.split('\n').enumerate() {
        let raw_line = raw_line.trim_end_matches('\r');
        let (clean, next_state) = strip_comments_and_strings(raw_line, state.in_block_comment);
        state.in_block_comment = next_state;
        let trimmed = clean.trim();
        let line_length = raw_line.chars().count();
        if trimmed.eq_ignore_ascii_case("%@MACRO") {
            symbols.push(Symbol {
                name: "%@MACRO".to_string(),
                kind: "macroHeader".to_string(),
                line: line_index,
                start_character: 0,
                end_character: line_length,
            });
        } else if is_n_label(trimmed) {
            let name = trimmed.trim_end_matches(';').to_string();
            symbols.push(Symbol {
                name,
                kind: "label".to_string(),
                line: line_index,
                start_character: 0,
                end_character: line_length,
            });
        }

        let chars: Vec<char> = clean.chars().collect();
        let mut index = 0;
        while index < chars.len() {
            let Some((command, prefix)) = commands
                .iter()
                .find(|(command, _)| command_matches(&chars, index, command))
            else {
                index += 1;
                continue;
            };
            let command_end = index + command.chars().count();
            let mut cursor = command_end;
            while cursor < chars.len() && chars[cursor].is_ascii_whitespace() {
                cursor += 1;
            }
            if cursor >= chars.len() || !chars[cursor].eq_ignore_ascii_case(&'P') {
                index = command_end;
                continue;
            }
            let start = cursor;
            cursor += 1;
            let digits_start = cursor;
            while cursor < chars.len() && chars[cursor].is_ascii_digit() {
                cursor += 1;
            }
            if digits_start == cursor {
                index = command_end;
                continue;
            }
            let digits: String = chars[digits_start..cursor].iter().collect();
            calls.push(NavigationCall {
                target_name: format!("{prefix}{digits}"),
                line: line_index,
                start,
                end: cursor,
            });
            index = cursor;
        }
    }
    (symbols, calls)
}

fn push_diagnostic(
    diagnostics: &mut Vec<Diagnostic>,
    line: usize,
    col: usize,
    end_col: usize,
    severity: Severity,
    code: &str,
    message: impl Into<String>,
) {
    diagnostics.push(Diagnostic {
        line,
        col,
        end_col,
        severity,
        code: code.to_string(),
        message: message.into(),
    });
}

fn close_block(
    stack: &mut Vec<Block>,
    closer: &str,
    line: usize,
    col: usize,
    end_col: usize,
    diagnostics: &mut Vec<Diagnostic>,
) -> bool {
    let Some(opener) = closer_opener(closer) else {
        return false;
    };
    let match_index = stack.iter().rposition(|block| block.keyword == opener);
    let Some(match_index) = match_index else {
        push_diagnostic(
            diagnostics,
            line,
            col,
            end_col,
            Severity::Error,
            "SYNTEC_CONTROL_UNMATCHED_END",
            format!("{closer} 没有匹配的 {opener}"),
        );
        return false;
    };

    if match_index != stack.len() - 1 {
        push_diagnostic(
            diagnostics,
            line,
            col,
            end_col,
            Severity::Error,
            "SYNTEC_CONTROL_NESTING_ORDER",
            format!("{closer} 嵌套顺序错误"),
        );
    }
    stack.truncate(match_index);
    true
}

pub fn analyze_document(content: &str) -> AnalysisResult {
    let mut state = LexState::default();
    let mut stack = Vec::new();
    let mut until_closed_repeats = Vec::new();
    let mut diagnostics = Vec::new();

    for (line_index, raw_line) in content.split('\n').enumerate() {
        let line_number = line_index + 1;
        let (clean, next_block_comment) =
            strip_comments_and_strings(raw_line.trim_end_matches('\r'), state.in_block_comment);
        state.in_block_comment = next_block_comment;
        let positions = keyword_positions(&clean);
        let has_end_repeat = positions
            .iter()
            .any(|(keyword, _, _)| keyword == "END_REPEAT" || keyword == "ENDREPEAT");
        let mut closed_repeat_by_until = false;

        for (keyword, col, end_col) in positions {
            if is_opener(&keyword) {
                stack.push(Block {
                    keyword,
                    line: line_number,
                });
                continue;
            }

            if keyword == "UNTIL" {
                let repeat_index = stack.iter().rposition(|block| block.keyword == "REPEAT");
                if let Some(repeat_index) = repeat_index {
                    stack.truncate(repeat_index);
                    closed_repeat_by_until = true;
                    if !has_end_repeat {
                        until_closed_repeats.push(line_number);
                    }
                } else {
                    push_diagnostic(
                        &mut diagnostics,
                        line_number,
                        col,
                        end_col,
                        Severity::Error,
                        "SYNTEC_CONTROL_UNMATCHED_UNTIL",
                        "UNTIL 没有匹配的 REPEAT",
                    );
                }
                continue;
            }

            if closer_opener(&keyword).is_some() {
                if closed_repeat_by_until && closer_opener(&keyword) == Some("REPEAT") {
                    continue;
                }
                if keyword == "END_REPEAT" || keyword == "ENDREPEAT" {
                    if until_closed_repeats.pop().is_some() {
                        continue;
                    }
                }
                close_block(
                    &mut stack,
                    &keyword,
                    line_number,
                    col,
                    end_col,
                    &mut diagnostics,
                );
            }
        }
    }

    for block in stack {
        push_diagnostic(
            &mut diagnostics,
            block.line,
            0,
            0,
            Severity::Warning,
            "SYNTEC_CONTROL_UNCLOSED_BLOCK",
            format!("{} 块缺少闭合语句", block.keyword),
        );
    }

    let (symbols, calls) = extract_navigation(content);
    AnalysisResult {
        protocol_version: PROTOCOL_VERSION,
        backend: "rust",
        diagnostics,
        symbols,
        calls,
    }
}

#[cfg(test)]
mod tests {
    use super::{analyze_document, Severity};

    #[test]
    fn accepts_balanced_if() {
        let result = analyze_document("IF #1 = 1 THEN\nEND_IF;");
        assert!(result.diagnostics.is_empty());
    }

    #[test]
    fn ignores_comments_and_strings() {
        let result = analyze_document("MSG(\"IF END_IF // text\"); // IF\nEND_IF;");
        assert_eq!(result.diagnostics.len(), 1);
        assert_eq!(result.diagnostics[0].code, "SYNTEC_CONTROL_UNMATCHED_END");
    }

    #[test]
    fn reports_unclosed_block_as_warning() {
        let result = analyze_document("IF #1 = 1 THEN");
        assert_eq!(result.diagnostics.len(), 1);
        assert_eq!(result.diagnostics[0].severity, Severity::Warning);
        assert_eq!(result.diagnostics[0].code, "SYNTEC_CONTROL_UNCLOSED_BLOCK");
    }

    #[test]
    fn accepts_repeat_until_end_repeat_on_one_line() {
        let result = analyze_document("REPEAT\nUNTIL #1 = 1 END_REPEAT;");
        assert!(result.diagnostics.is_empty());
    }

    #[test]
    fn extracts_macro_symbols_and_static_calls() {
        let result = analyze_document("%@MACRO\nN10;\nG65 P1000;");
        assert_eq!(result.symbols.len(), 2);
        assert_eq!(result.symbols[1].name, "N10");
        assert_eq!(result.calls[0].target_name, "G1000");
    }
}
