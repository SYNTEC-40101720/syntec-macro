//! Development-only Rust core pilot.
//!
//! This crate intentionally implements only the protocol-compatible lexer
//! preprocessing and tolerant control-flow diagnostics needed for the M3
//! comparison. It is not wired into the VS Code extension yet.

pub const PROTOCOL_VERSION: u32 = 1;
#[cfg(target_arch = "wasm32")]
const ANALYSIS_SOURCE: &str = "syntec-macro";

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
    pub code: Option<String>,
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
        let end_character = if diagnostic.end_col == 0 {
            diagnostic.col + 1
        } else {
            diagnostic.end_col
        };
        let code_field = diagnostic
            .code
            .as_ref()
            .map(|code| format!(",\"code\":\"{}\"", json_escape(code)))
            .unwrap_or_default();
        json.push_str(&format!(
            "{{\"range\":{{\"start\":{{\"line\":{},\"character\":{}}},\"end\":{{\"line\":{},\"character\":{}}}}},\"message\":\"{}\",\"severity\":\"{}\",\"source\":\"{}\"{}}}",
            diagnostic.line.saturating_sub(1),
            diagnostic.col,
            diagnostic.line.saturating_sub(1),
            end_character,
            json_escape(&diagnostic.message),
            diagnostic.severity.as_str(),
            ANALYSIS_SOURCE,
            code_field,
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
    has_else: bool,
    exited: bool,
}

#[derive(Debug, Default, Clone, Copy)]
struct LexState {
    in_block_comment: bool,
}

const OPENERS: [&str; 5] = ["IF", "FOR", "WHILE", "CASE", "REPEAT"];
const NESTING_DEPTH_LIMIT: usize = 10;
const LOOP_OPENERS: [&str; 3] = ["FOR", "WHILE", "REPEAT"];
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
                "UNTIL" | "ELSE" | "ELSEIF" | "ELSIF" | "DIV" | "EXIT" | "GOTO"
            )
        {
            positions.push((upper, start, index));
        }
    }

    positions
}

fn n_label_name(trimmed: &str) -> Option<String> {
    let upper = trimmed.to_ascii_uppercase();
    let rest = upper.strip_prefix('N')?;
    let digits_end = rest
        .char_indices()
        .find_map(|(index, character)| (!character.is_ascii_digit()).then_some(index))
        .unwrap_or(rest.len());
    if digits_end == 0 || rest[digits_end..].trim() != ";" {
        return None;
    }
    Some(format!("N{}", &rest[..digits_end]))
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

fn utf16_len(value: &str) -> usize {
    value.encode_utf16().count()
}

fn utf16_prefix_len(chars: &[char], index: usize) -> usize {
    chars[..index.min(chars.len())]
        .iter()
        .map(|character| character.len_utf16())
        .sum()
}

fn utf16_boundary(
    source_offsets: &[usize],
    chars: &[char],
    index: usize,
    line_length: usize,
) -> usize {
    if index < source_offsets.len() {
        source_offsets[index]
    } else if index == chars.len() {
        line_length
    } else {
        line_length
    }
}

fn word_positions(line: &str) -> Vec<(String, usize, usize)> {
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
        positions.push((
            chars[start..index]
                .iter()
                .collect::<String>()
                .to_ascii_uppercase(),
            start,
            index,
        ));
    }
    positions
}

fn find_sequence_positions(chars: &[char], sequence: &str) -> Vec<usize> {
    let sequence: Vec<char> = sequence.chars().collect();
    if sequence.is_empty() || sequence.len() > chars.len() {
        return Vec::new();
    }
    (0..=chars.len() - sequence.len())
        .filter(|index| chars[*index..*index + sequence.len()] == sequence)
        .collect()
}

#[derive(Debug, Clone)]
struct StaticFunctionCall {
    start: usize,
    end: usize,
    args: Vec<String>,
}

fn split_function_args(chars: &[char]) -> Vec<String> {
    let mut args = Vec::new();
    let mut start = 0;
    let mut depth = 0;
    for (index, character) in chars.iter().enumerate() {
        match character {
            '(' => depth += 1,
            ')' => depth -= 1,
            ',' if depth == 0 => {
                args.push(
                    chars[start..index]
                        .iter()
                        .collect::<String>()
                        .trim()
                        .to_string(),
                );
                start = index + 1;
            }
            _ => {}
        }
    }
    let tail = chars[start..].iter().collect::<String>().trim().to_string();
    if !tail.is_empty() || !args.is_empty() {
        args.push(tail);
    }
    args
}

fn static_function_calls(clean: &str, function_name: &str) -> Vec<StaticFunctionCall> {
    let chars: Vec<char> = clean.chars().collect();
    let mut calls = Vec::new();
    for (word, start, end) in word_positions(clean) {
        if word != function_name {
            continue;
        }
        let mut cursor = end;
        while cursor < chars.len() && chars[cursor].is_ascii_whitespace() {
            cursor += 1;
        }
        if chars.get(cursor) != Some(&'(') {
            continue;
        }
        let args_start = cursor + 1;
        cursor = args_start;
        let mut depth = 1;
        while cursor < chars.len() && depth > 0 {
            match chars[cursor] {
                '(' => depth += 1,
                ')' => depth -= 1,
                _ => {}
            }
            cursor += 1;
        }
        if depth != 0 {
            continue;
        }
        let close_index = cursor - 1;
        calls.push(StaticFunctionCall {
            start,
            end: close_index + 1,
            args: split_function_args(&chars[args_start..close_index]),
        });
    }
    calls
}

fn parse_static_number(value: &str) -> Option<f64> {
    let value = value.trim();
    let chars: Vec<char> = value.chars().collect();
    let mut index = 0;
    if matches!(chars.first(), Some('+' | '-')) {
        index += 1;
    }
    let digits_start = index;
    while index < chars.len() && chars[index].is_ascii_digit() {
        index += 1;
    }
    if index == digits_start {
        return None;
    }
    if chars.get(index) == Some(&'.') {
        index += 1;
        while index < chars.len() && chars[index].is_ascii_digit() {
            index += 1;
        }
    }
    (index == chars.len()).then(|| value.parse().ok()).flatten()
}

fn push_math_domain_diagnostic(
    clean_chars: &[char],
    diagnostics: &mut Vec<Diagnostic>,
    line: usize,
    call: &StaticFunctionCall,
    message: &str,
) {
    push_diagnostic(
        diagnostics,
        line,
        utf16_prefix_len(clean_chars, call.start),
        utf16_prefix_len(clean_chars, call.end),
        Severity::Error,
        "SYNTEC_FUNCTION_MATH_DOMAIN",
        message,
    );
}

fn validate_static_math_functions(clean: &str, line: usize, diagnostics: &mut Vec<Diagnostic>) {
    let chars: Vec<char> = clean.chars().collect();

    for call in static_function_calls(clean, "ATAN2") {
        let y = call
            .args
            .first()
            .and_then(|value| parse_static_number(value));
        let x = call
            .args
            .get(1)
            .and_then(|value| parse_static_number(value));
        if y == Some(0.0) && x == Some(0.0) {
            push_math_domain_diagnostic(
                &chars,
                diagnostics,
                line,
                &call,
                "ATAN2(0,0) 会触发 COR-004 运算域错误",
            );
        }
    }

    for call in static_function_calls(clean, "POW") {
        let base = call
            .args
            .first()
            .and_then(|value| parse_static_number(value));
        if base.is_some_and(|value| value < 0.0) {
            push_math_domain_diagnostic(
                &chars,
                diagnostics,
                line,
                &call,
                "POW 基底不可为负值，否则触发 COR-122",
            );
        }
    }

    for call in static_function_calls(clean, "LN") {
        let value = call.args.first().and_then(|arg| parse_static_number(arg));
        if value.is_some_and(|value| value <= 0.0) {
            push_math_domain_diagnostic(&chars, diagnostics, line, &call, "LN 引数需为正数");
        }
    }

    for call in static_function_calls(clean, "SQRT") {
        let value = call.args.first().and_then(|arg| parse_static_number(arg));
        if value.is_some_and(|value| value < 0.0) {
            push_math_domain_diagnostic(
                &chars,
                diagnostics,
                line,
                &call,
                "SQRT 引数需大于或等于 0",
            );
        }
    }

    for function_name in ["ACOS", "ASIN"] {
        for call in static_function_calls(clean, function_name) {
            let value = call.args.first().and_then(|arg| parse_static_number(arg));
            if value.is_some_and(|value| !(-1.0..=1.0).contains(&value)) {
                push_math_domain_diagnostic(
                    &chars,
                    diagnostics,
                    line,
                    &call,
                    &format!("{function_name} 引数范围为 -1~1"),
                );
            }
        }
    }
}

fn validate_static_io_functions(clean: &str, line: usize, diagnostics: &mut Vec<Diagnostic>) {
    let chars: Vec<char> = clean.chars().collect();
    for function_name in ["READDI", "READDO", "READABIT", "SETDO", "SETABIT"] {
        for call in static_function_calls(clean, function_name) {
            let value = call.args.first().and_then(|arg| parse_static_number(arg));
            if value.is_some_and(|value| value.fract() != 0.0 || !(0.0..=511.0).contains(&value)) {
                push_diagnostic(
                    diagnostics,
                    line,
                    utf16_prefix_len(&chars, call.start),
                    utf16_prefix_len(&chars, call.end),
                    Severity::Error,
                    "SYNTEC_FUNCTION_IO_POINT_RANGE",
                    &format!("{function_name} 点编号范围为 0~511"),
                );
            }
        }
    }

    for (function_name, argument_index) in [("SETDO", 1usize), ("SETABIT", 1), ("SETRREGBIT", 2)] {
        for call in static_function_calls(clean, function_name) {
            let value = call
                .args
                .get(argument_index)
                .and_then(|arg| parse_static_number(arg));
            if value.is_some_and(|value| value != 0.0 && value != 1.0) {
                push_diagnostic(
                    diagnostics,
                    line,
                    utf16_prefix_len(&chars, call.start),
                    utf16_prefix_len(&chars, call.end),
                    Severity::Error,
                    "SYNTEC_FUNCTION_IO_VALUE_RANGE",
                    &format!("{function_name} 写入值应为 0 或 1"),
                );
            }
        }
    }

    for function_name in ["READRREGBIT", "SETRREGBIT"] {
        for call in static_function_calls(clean, function_name) {
            let register = call.args.first().and_then(|arg| parse_static_number(arg));
            if register
                .is_some_and(|value| value.fract() != 0.0 || !(0.0..=65535.0).contains(&value))
            {
                push_diagnostic(
                    diagnostics,
                    line,
                    utf16_prefix_len(&chars, call.start),
                    utf16_prefix_len(&chars, call.end),
                    Severity::Error,
                    "SYNTEC_FUNCTION_R_REGISTER_RANGE",
                    &format!("{function_name} 的 R 值编号范围为 0~65535"),
                );
            }
            let bit = call.args.get(1).and_then(|arg| parse_static_number(arg));
            if bit.is_some_and(|value| value.fract() != 0.0 || !(0.0..=31.0).contains(&value)) {
                push_diagnostic(
                    diagnostics,
                    line,
                    utf16_prefix_len(&chars, call.start),
                    utf16_prefix_len(&chars, call.end),
                    Severity::Error,
                    "SYNTEC_FUNCTION_R_BIT_RANGE",
                    &format!("{function_name} 的 bit 范围为 0~31"),
                );
            }
        }
    }
}

fn parse_numeric_token(chars: &[char], start: usize) -> Option<(usize, bool)> {
    if start >= chars.len() {
        return None;
    }
    let mut index = start;
    let mut has_digit = false;
    let mut has_decimal = false;
    if chars[index] == '.' {
        if !chars
            .get(index + 1)
            .is_some_and(|character| character.is_ascii_digit())
        {
            return None;
        }
        has_decimal = true;
        index += 1;
    }
    while index < chars.len() && chars[index].is_ascii_digit() {
        has_digit = true;
        index += 1;
    }
    if index < chars.len() && chars[index] == '.' {
        has_decimal = true;
        index += 1;
        while index < chars.len() && chars[index].is_ascii_digit() {
            has_digit = true;
            index += 1;
        }
    }
    has_digit.then_some((index, has_decimal))
}

fn validate_static_mod_decimal(clean: &str, line: usize, diagnostics: &mut Vec<Diagnostic>) {
    let chars: Vec<char> = clean.chars().collect();
    let mut scan = 0;
    while scan < chars.len() {
        let Some((lhs_end, lhs_decimal)) = parse_numeric_token(&chars, scan) else {
            scan += 1;
            continue;
        };
        let mut cursor = lhs_end;
        let whitespace_start = cursor;
        while cursor < chars.len() && chars[cursor].is_ascii_whitespace() {
            cursor += 1;
        }
        if cursor == whitespace_start
            || cursor + 3 > chars.len()
            || !chars[cursor..cursor + 3]
                .iter()
                .zip(['M', 'O', 'D'])
                .all(|(left, right)| left.eq_ignore_ascii_case(&right))
        {
            scan += 1;
            continue;
        }
        cursor += 3;
        let rhs_whitespace_start = cursor;
        while cursor < chars.len() && chars[cursor].is_ascii_whitespace() {
            cursor += 1;
        }
        if cursor == rhs_whitespace_start {
            scan += 1;
            continue;
        }
        let Some((rhs_end, rhs_decimal)) = parse_numeric_token(&chars, cursor) else {
            scan += 1;
            continue;
        };
        if lhs_decimal || rhs_decimal {
            let col = utf16_prefix_len(&chars, scan);
            let end_col = utf16_prefix_len(&chars, rhs_end);
            push_diagnostic_without_code(
                diagnostics,
                line,
                col,
                end_col,
                Severity::Error,
                "MOD 仅适用于 Long 型态；静态数字操作数不可带小数点",
            );
        }
        scan = rhs_end;
    }
}

fn validate_unsupported_operators(clean: &str, line: usize, diagnostics: &mut Vec<Diagnostic>) {
    if clean.trim().is_empty() || clean.trim().eq_ignore_ascii_case("%@MACRO") {
        return;
    }

    let chars: Vec<char> = clean.chars().collect();
    let mut push_sequence = |sequence: &str, code: &str, message: &str| {
        let sequence_length = sequence.chars().count();
        for start in find_sequence_positions(&chars, sequence) {
            let col = utf16_prefix_len(&chars, start);
            push_diagnostic(
                diagnostics,
                line,
                col,
                col + sequence_length,
                Severity::Error,
                code,
                message,
            );
        }
    };

    push_sequence(
        "==",
        "SYNTEC_UNSUPPORTED_EQUALITY_OPERATOR",
        "== 不支持；等于比较请使用单独的 =",
    );
    push_sequence(
        "!=",
        "SYNTEC_UNSUPPORTED_INEQUALITY_OPERATOR",
        "!= 不支持；不等于比较请使用 <>",
    );
    push_sequence(
        "&&",
        "SYNTEC_UNSUPPORTED_LOGICAL_AND_OPERATOR",
        "&& 不支持；逻辑且请使用 AND 或 &",
    );
    push_sequence(
        "||",
        "SYNTEC_UNSUPPORTED_LOGICAL_OR_OPERATOR",
        "|| 不支持；逻辑或请使用 OR",
    );
    push_sequence(
        "+=",
        "SYNTEC_UNSUPPORTED_COMPOUND_ASSIGNMENT",
        "+= 不支持；请写成 #1 := #1 + 1 这类完整赋值",
    );
    push_sequence(
        "++",
        "SYNTEC_UNSUPPORTED_INCREMENT",
        "++ 不支持；请写成 #1 := #1 + 1 这类完整赋值",
    );

    for start in find_sequence_positions(&chars, "%") {
        let mut range_start = start;
        while range_start > 0 && chars[range_start - 1].is_ascii_whitespace() {
            range_start -= 1;
        }
        let mut range_end = start + 1;
        while range_end < chars.len() && chars[range_end].is_ascii_whitespace() {
            range_end += 1;
        }
        let has_non_space_before = range_start > 0;
        let has_non_space_after = range_end < chars.len();
        let followed_by_equals = chars.get(start + 1) == Some(&'=');
        if has_non_space_before && has_non_space_after && !followed_by_equals {
            let col = utf16_prefix_len(&chars, range_start);
            let end_col = utf16_prefix_len(&chars, range_end);
            push_diagnostic(
                diagnostics,
                line,
                col,
                end_col,
                Severity::Error,
                "SYNTEC_UNSUPPORTED_PERCENT_OPERATOR",
                "% 不支持；取模请使用 MOD，且仅适用于 Long 型态",
            );
        }
    }

    for start in find_sequence_positions(&chars, "!") {
        if chars.get(start + 1) == Some(&'=') {
            continue;
        }
        let col = utf16_prefix_len(&chars, start);
        push_diagnostic(
            diagnostics,
            line,
            col,
            col + 1,
            Severity::Error,
            "SYNTEC_UNSUPPORTED_LOGICAL_NOT_OPERATOR",
            "! 不支持；NOT 是补数运算，逻辑条件请写成明确比较",
        );
    }

    validate_static_mod_decimal(clean, line, diagnostics);

    let fanuc_replacements = [
        ("EQ", "="),
        ("NE", "<>"),
        ("GT", ">"),
        ("GE", ">="),
        ("LT", "<"),
        ("LE", "<="),
    ];
    for (keyword, start, end) in word_positions(clean) {
        if let Some((_, replacement)) = fanuc_replacements
            .iter()
            .find(|(candidate, _)| *candidate == keyword)
        {
            let col = utf16_prefix_len(&chars, start);
            let message = format!("{keyword} 不支持；请使用 {replacement}");
            push_diagnostic(
                diagnostics,
                line,
                col,
                utf16_prefix_len(&chars, end),
                Severity::Error,
                "SYNTEC_UNSUPPORTED_FANUC_COMPARISON",
                message,
            );
        }
    }
}

fn has_word(text: &str, word: &str) -> Option<(usize, usize)> {
    word_positions(text)
        .into_iter()
        .find(|(candidate, _, _)| candidate == word)
        .map(|(_, start, end)| (start, end))
}

fn starts_with_word(text: &str, word: &str) -> bool {
    let trimmed = text.trim_start();
    let chars: Vec<char> = trimmed.chars().collect();
    let word_chars: Vec<char> = word.chars().collect();
    chars.len() >= word_chars.len()
        && chars[..word_chars.len()]
            .iter()
            .zip(word_chars.iter())
            .all(|(left, right)| left.eq_ignore_ascii_case(right))
        && chars
            .get(word_chars.len())
            .is_none_or(|character| !character.is_ascii_alphanumeric() && *character != '_')
}

fn is_control_header(statement: &str) -> bool {
    if starts_with_word(statement, "REPEAT") || statement.eq_ignore_ascii_case("ELSE") {
        return true;
    }
    let markers = [
        ("IF", "THEN"),
        ("ELSEIF", "THEN"),
        ("ELSIF", "THEN"),
        ("FOR", "DO"),
        ("WHILE", "DO"),
        ("CASE", "OF"),
    ];
    markers.iter().any(|(opener, marker)| {
        starts_with_word(statement, opener)
            && has_word(statement, marker)
                .map(|(_, end)| statement[end..].trim().is_empty())
                .unwrap_or(false)
    })
}

fn validate_control_header_terminator(clean: &str, line: usize, diagnostics: &mut Vec<Diagnostic>) {
    let chars: Vec<char> = clean.chars().collect();
    let Some(last_non_space) = chars
        .iter()
        .rposition(|character| !character.is_ascii_whitespace())
    else {
        return;
    };
    if chars[last_non_space] != ';' {
        return;
    }
    let statement: String = chars[..last_non_space].iter().collect();
    if !is_control_header(statement.trim()) {
        return;
    }
    let col = utf16_prefix_len(&chars, last_non_space);
    push_diagnostic(
        diagnostics,
        line,
        col,
        col + 1,
        Severity::Error,
        "SYNTEC_CONTROL_STRUCTURE_TRAILING_SEMICOLON",
        "控制结构行不应以 ; 结尾",
    );
}

fn normalize_numeric_target(prefix: &str, digits: &str) -> String {
    let padding = 4usize.saturating_sub(digits.len());
    format!("{prefix}{}{}", "0".repeat(padding), digits)
}

fn is_call_terminator(character: Option<&char>) -> bool {
    character.is_none_or(|value| value.is_ascii_whitespace() || *value == ';')
}

fn strip_comments_keep_strings(
    line: &str,
    mut in_block_comment: bool,
) -> (String, Vec<bool>, Vec<usize>, bool) {
    let chars: Vec<char> = line.chars().collect();
    let mut source_offsets = Vec::with_capacity(chars.len());
    let mut source_offset = 0;
    for character in &chars {
        source_offsets.push(source_offset);
        source_offset += character.len_utf16();
    }

    let mut result = String::with_capacity(line.len());
    let mut string_mask = Vec::with_capacity(chars.len());
    let mut result_offsets = Vec::with_capacity(chars.len());
    let mut in_string = false;
    let mut index = 0;

    while index < chars.len() {
        let offset = source_offsets[index];
        if in_block_comment {
            if index + 1 < chars.len() && chars[index] == '*' && chars[index + 1] == ')' {
                result.push(' ');
                result.push(' ');
                string_mask.extend([false, false]);
                result_offsets.push(offset);
                result_offsets.push(source_offsets[index + 1]);
                index += 2;
                in_block_comment = false;
            } else {
                result.push(' ');
                string_mask.push(false);
                result_offsets.push(offset);
                index += 1;
            }
            continue;
        }

        if !in_string && index + 1 < chars.len() && chars[index] == '/' && chars[index + 1] == '/' {
            for cursor in index..chars.len() {
                result.push(' ');
                string_mask.push(false);
                result_offsets.push(source_offsets[cursor]);
            }
            break;
        }
        if !in_string && index + 1 < chars.len() && chars[index] == '(' && chars[index + 1] == '*' {
            result.push(' ');
            result.push(' ');
            string_mask.extend([false, false]);
            result_offsets.push(offset);
            result_offsets.push(source_offsets[index + 1]);
            index += 2;
            in_block_comment = true;
            continue;
        }

        let character = chars[index];
        let escaped = character == '"' && is_escaped_quote(&chars, index);
        result.push(character);
        string_mask.push(in_string);
        result_offsets.push(offset);
        if character == '"' && !escaped {
            in_string = !in_string;
        }
        index += 1;
    }

    (result, string_mask, result_offsets, in_block_comment)
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
        let (clean, string_mask, source_offsets, next_state) =
            strip_comments_keep_strings(raw_line, state.in_block_comment);
        state.in_block_comment = next_state;
        let trimmed = clean.trim();
        let line_length = utf16_len(raw_line);
        if trimmed.eq_ignore_ascii_case("%@MACRO") {
            symbols.push(Symbol {
                name: "%@MACRO".to_string(),
                kind: "macroHeader".to_string(),
                line: line_index,
                start_character: 0,
                end_character: line_length,
            });
        } else if let Some(name) = n_label_name(trimmed) {
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
            if string_mask[index] {
                index += 1;
                continue;
            }
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
            if string_mask[cursor] {
                index = command_end;
                continue;
            }
            let p_index = cursor;
            cursor += 1;
            if *prefix == "G" && cursor < chars.len() && chars[cursor] == '"' {
                let content_start = cursor + 1;
                cursor = content_start;
                while cursor < chars.len() {
                    if chars[cursor] == '"' && !is_escaped_quote(&chars, cursor) {
                        break;
                    }
                    cursor += 1;
                }
                if cursor == content_start
                    || cursor >= chars.len()
                    || !is_call_terminator(chars.get(cursor + 1))
                {
                    index = command_end;
                    continue;
                }
                let target_name: String = chars[content_start..cursor].iter().collect();
                calls.push(NavigationCall {
                    target_name,
                    line: line_index,
                    start: utf16_boundary(&source_offsets, &chars, content_start, line_length),
                    end: utf16_boundary(&source_offsets, &chars, cursor, line_length),
                });
                index = cursor + 1;
                continue;
            }

            let digits_start = cursor;
            while cursor < chars.len() && chars[cursor].is_ascii_digit() {
                cursor += 1;
            }
            if digits_start == cursor || !is_call_terminator(chars.get(cursor)) {
                index = command_end;
                continue;
            }
            let digits: String = chars[digits_start..cursor].iter().collect();
            calls.push(NavigationCall {
                target_name: normalize_numeric_target(prefix, &digits),
                line: line_index,
                start: utf16_boundary(&source_offsets, &chars, p_index, line_length),
                end: utf16_boundary(&source_offsets, &chars, cursor, line_length),
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
        code: Some(code.to_string()),
        message: message.into(),
    });
}

fn push_diagnostic_without_code(
    diagnostics: &mut Vec<Diagnostic>,
    line: usize,
    col: usize,
    end_col: usize,
    severity: Severity,
    message: impl Into<String>,
) {
    diagnostics.push(Diagnostic {
        line,
        col,
        end_col,
        severity,
        code: None,
        message: message.into(),
    });
}

fn is_case_label(statement: &str) -> bool {
    let trimmed = statement.trim();
    let Some(body) = trimmed.strip_suffix(':') else {
        return false;
    };
    let body = body.trim();
    !body.is_empty()
        && body.chars().all(|character| {
            character.is_ascii_alphanumeric()
                || character.is_ascii_whitespace()
                || matches!(character, '#' | '@' | '[' | ']' | ',' | '+' | '-' | '.')
        })
}

fn is_dangling_comparison(statement: &str) -> bool {
    let trimmed = statement.trim();
    let Some(first) = trimmed.chars().next() else {
        return false;
    };
    matches!(first, '#' | '@' | '[' | '(' | '+' | '-' | '.' | '0'..='9')
        && ["<>", "<=", ">=", "<", ">"]
            .iter()
            .any(|operator| trimmed.contains(operator))
}

fn validate_statement_terminator(clean: &str, line: usize, diagnostics: &mut Vec<Diagnostic>) {
    let chars: Vec<char> = clean.chars().collect();
    let Some(last_non_space) = chars
        .iter()
        .rposition(|character| !character.is_ascii_whitespace())
    else {
        return;
    };
    let statement: String = chars[..=last_non_space].iter().collect();
    let trimmed = statement.trim();
    if trimmed.eq_ignore_ascii_case("%@MACRO")
        || trimmed == "%"
        || chars[last_non_space] == ';'
        || trimmed.eq_ignore_ascii_case("ELSE")
        || is_control_header(trimmed)
        || is_case_label(trimmed)
        || is_dangling_comparison(trimmed)
    {
        return;
    }

    let end_col = utf16_prefix_len(&chars, last_non_space + 1);
    push_diagnostic(
        diagnostics,
        line,
        end_col,
        end_col + 1,
        Severity::Error,
        "SYNTEC_MISSING_SEMICOLON",
        "语句应以 ; 结尾",
    );
}

fn validate_parentheses(clean: &str, line: usize, diagnostics: &mut Vec<Diagnostic>) {
    let chars: Vec<char> = clean.chars().collect();
    let mut parentheses = Vec::new();
    let mut brackets = Vec::new();

    for (index, character) in chars.iter().enumerate() {
        match character {
            '(' => parentheses.push(index),
            ')' => {
                if parentheses.pop().is_none() {
                    let col = utf16_prefix_len(&chars, index);
                    push_diagnostic_without_code(
                        diagnostics,
                        line,
                        col,
                        col + 1,
                        Severity::Warning,
                        "括号不匹配：多余的右括号",
                    );
                }
            }
            '[' => brackets.push(index),
            ']' => {
                if brackets.pop().is_none() {
                    let col = utf16_prefix_len(&chars, index);
                    push_diagnostic_without_code(
                        diagnostics,
                        line,
                        col,
                        col + 1,
                        Severity::Warning,
                        "括号不匹配：多余的右方括号",
                    );
                }
            }
            _ => {}
        }
    }

    if let Some(&index) = parentheses.first() {
        let col = utf16_prefix_len(&chars, index);
        push_diagnostic_without_code(
            diagnostics,
            line,
            col,
            col + 1,
            Severity::Warning,
            format!("括号不匹配：缺少 {} 个右括号", parentheses.len()),
        );
    }
    if let Some(&index) = brackets.first() {
        let col = utf16_prefix_len(&chars, index);
        push_diagnostic_without_code(
            diagnostics,
            line,
            col,
            col + 1,
            Severity::Warning,
            format!("括号不匹配：缺少 {} 个右方括号", brackets.len()),
        );
    }
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
        let current = &stack[stack.len() - 1].keyword;
        push_diagnostic(
            diagnostics,
            line,
            col,
            end_col,
            Severity::Error,
            "SYNTEC_CONTROL_NESTING_ORDER",
            format!("{closer} 嵌套顺序错误：当前未闭合的是 {current}"),
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
        validate_parentheses(&clean, line_number, &mut diagnostics);
        validate_unsupported_operators(&clean, line_number, &mut diagnostics);
        validate_control_header_terminator(&clean, line_number, &mut diagnostics);
        validate_statement_terminator(&clean, line_number, &mut diagnostics);
        validate_static_math_functions(&clean, line_number, &mut diagnostics);
        validate_static_io_functions(&clean, line_number, &mut diagnostics);
        let positions = keyword_positions(&clean);
        let has_end_repeat = positions
            .iter()
            .any(|(keyword, _, _)| keyword == "END_REPEAT" || keyword == "ENDREPEAT");
        let mut closed_repeat_by_until = false;

        for (keyword, col, end_col) in positions {
            if keyword == "ELSIF" {
                push_diagnostic(
                    &mut diagnostics,
                    line_number,
                    col,
                    end_col,
                    Severity::Error,
                    "SYNTEC_UNSUPPORTED_ELSIF",
                    "ELSIF 不支持，请使用 ELSEIF",
                );
                continue;
            }
            if keyword == "DIV" {
                push_diagnostic(
                    &mut diagnostics,
                    line_number,
                    col,
                    end_col,
                    Severity::Error,
                    "SYNTEC_UNSUPPORTED_DIV",
                    "DIV 不支持；整数除法请使用 /，分子与分母皆为整数时结果仍为整数",
                );
                continue;
            }

            if is_opener(&keyword) {
                if stack.len() >= NESTING_DEPTH_LIMIT {
                    push_diagnostic(
                        &mut diagnostics,
                        line_number,
                        col,
                        end_col,
                        Severity::Warning,
                        "SYNTEC_CONTROL_NESTING_DEPTH_EXCEEDED",
                        format!(
                            "{keyword} 嵌套深度已达 {NESTING_DEPTH_LIMIT} 层，超过可能触发控制器 COM-007（巢状超过 10 层）"
                        ),
                    );
                }
                stack.push(Block {
                    keyword,
                    line: line_number,
                    has_else: false,
                    exited: false,
                });
                continue;
            }

            if keyword == "ELSE" {
                let branch_index = stack
                    .iter()
                    .rposition(|block| block.keyword == "IF" || block.keyword == "CASE");
                if let Some(branch_index) = branch_index {
                    if let Some(if_index) = (0..=branch_index)
                        .rev()
                        .find(|index| stack[*index].keyword == "IF")
                    {
                        stack[if_index].has_else = true;
                    }
                } else {
                    push_diagnostic(
                        &mut diagnostics,
                        line_number,
                        col,
                        end_col,
                        Severity::Error,
                        "SYNTEC_CONTROL_UNMATCHED_ELSE",
                        "ELSE 没有匹配的 IF 或 CASE",
                    );
                }
                continue;
            }

            if keyword == "ELSEIF" {
                let if_index = stack.iter().rposition(|block| block.keyword == "IF");
                match if_index {
                    None => push_diagnostic(
                        &mut diagnostics,
                        line_number,
                        col,
                        end_col,
                        Severity::Error,
                        "SYNTEC_CONTROL_UNMATCHED_ELSEIF",
                        "ELSEIF 没有匹配的 IF",
                    ),
                    Some(if_index) if stack[if_index].has_else => push_diagnostic(
                        &mut diagnostics,
                        line_number,
                        col,
                        end_col,
                        Severity::Error,
                        "SYNTEC_CONTROL_ELSEIF_AFTER_ELSE",
                        "IF 块已有 ELSE，再次遇到 ELSEIF",
                    ),
                    Some(_) => {}
                }
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

            if keyword == "EXIT" {
                if let Some(loop_index) = stack
                    .iter()
                    .rposition(|block| LOOP_OPENERS.contains(&block.keyword.as_str()))
                {
                    stack[loop_index].exited = true;
                    for index in (0..loop_index).rev() {
                        if stack[index].keyword == "IF" {
                            stack[index].exited = true;
                        }
                    }
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
        if block.exited {
            continue;
        }
        let expected_closer = if block.keyword == "REPEAT" {
            "UNTIL".to_string()
        } else {
            format!("END_{}", block.keyword)
        };
        push_diagnostic(
            &mut diagnostics,
            block.line,
            0,
            0,
            Severity::Warning,
            "SYNTEC_CONTROL_UNCLOSED_BLOCK",
            format!(
                "{} 块缺少对应的 {}（文件结束）",
                block.keyword, expected_closer
            ),
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
        assert_eq!(
            result.diagnostics[0].code.as_deref(),
            Some("SYNTEC_CONTROL_UNMATCHED_END")
        );
    }

    #[test]
    fn reports_unclosed_block_as_warning() {
        let result = analyze_document("IF #1 = 1 THEN");
        assert_eq!(result.diagnostics.len(), 1);
        assert_eq!(result.diagnostics[0].severity, Severity::Warning);
        assert_eq!(
            result.diagnostics[0].code.as_deref(),
            Some("SYNTEC_CONTROL_UNCLOSED_BLOCK")
        );
        assert_eq!(
            result.diagnostics[0].message,
            "IF 块缺少对应的 END_IF（文件结束）"
        );
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

    #[test]
    fn normalizes_numeric_and_named_navigation_calls() {
        let result = analyze_document("G65 P100;\nG66 P\"MyMacro\";\nM198 P7;\nM98 P1234;");
        assert_eq!(
            result
                .calls
                .iter()
                .map(|call| call.target_name.as_str())
                .collect::<Vec<_>>(),
            ["G0100", "MyMacro", "O0007", "O1234"]
        );
        assert_eq!(result.calls[0].start, 4);
        assert_eq!(result.calls[0].end, 8);
        assert_eq!(result.calls[1].start, 6);
        assert_eq!(result.calls[1].end, 13);
    }

    #[test]
    fn navigation_ignores_strings_and_comments() {
        let result =
            analyze_document("MSG(\"G65 P9999\"); // M98 P8888\n(* G66 P7777 *)\nG65 P42;");
        assert_eq!(result.calls.len(), 1);
        assert_eq!(result.calls[0].target_name, "G0042");
    }

    #[test]
    fn navigation_positions_use_utf16_offsets() {
        let result = analyze_document("G65 P\"宏😀\";");
        assert_eq!(result.calls.len(), 1);
        assert_eq!(result.calls[0].start, 6);
        assert_eq!(result.calls[0].end, 9);
    }

    #[test]
    fn validates_else_and_else_if_boundaries() {
        let unmatched_else = analyze_document("ELSE");
        assert_eq!(
            unmatched_else.diagnostics[0].code.as_deref(),
            Some("SYNTEC_CONTROL_UNMATCHED_ELSE")
        );

        let unmatched_else_if = analyze_document("ELSEIF #1 = 1 THEN");
        assert_eq!(
            unmatched_else_if.diagnostics[0].code.as_deref(),
            Some("SYNTEC_CONTROL_UNMATCHED_ELSEIF")
        );

        let after_else = analyze_document("IF #1 = 1 THEN\nELSE\nELSEIF #2 = 2 THEN\nEND_IF;");
        assert_eq!(
            after_else.diagnostics[0].code.as_deref(),
            Some("SYNTEC_CONTROL_ELSEIF_AFTER_ELSE")
        );
    }

    #[test]
    fn warns_when_control_flow_nesting_exceeds_ten_levels() {
        let source = (0..11)
            .map(|_| "IF #1 = 1 THEN")
            .chain((0..11).map(|_| "END_IF;"))
            .collect::<Vec<_>>()
            .join("\n");
        let result = analyze_document(&source);
        assert!(result.diagnostics.iter().any(|diagnostic| {
            diagnostic.code.as_deref() == Some("SYNTEC_CONTROL_NESTING_DEPTH_EXCEEDED")
        }));
    }

    #[test]
    fn exit_suppresses_unclosed_loop_and_enclosing_if_warnings() {
        let result = analyze_document("IF #1 = 1 THEN\nWHILE #2 = 1 DO\nEXIT;");
        assert!(result.diagnostics.is_empty());
    }

    #[test]
    fn reports_unsupported_control_keywords() {
        let elsif = analyze_document("ELSIF #1 = 1 THEN");
        assert_eq!(elsif.diagnostics.len(), 1);
        assert_eq!(
            elsif.diagnostics[0].code.as_deref(),
            Some("SYNTEC_UNSUPPORTED_ELSIF")
        );

        let div = analyze_document("#1 = #2 DIV #3;");
        assert_eq!(div.diagnostics.len(), 1);
        assert_eq!(
            div.diagnostics[0].code.as_deref(),
            Some("SYNTEC_UNSUPPORTED_DIV")
        );
        assert_eq!(div.diagnostics[0].col, 8);
    }

    #[test]
    fn reports_control_header_trailing_semicolon() {
        let result = analyze_document("IF #1 = 1 THEN;");
        assert!(result.diagnostics.iter().any(|diagnostic| {
            diagnostic.code.as_deref() == Some("SYNTEC_CONTROL_STRUCTURE_TRAILING_SEMICOLON")
                && diagnostic.col == 14
        }));
    }

    #[test]
    fn reports_common_unsupported_operators() {
        let result = analyze_document(
            "#1 == #2;\n#1 != #2;\n#1 && #2;\n#1 || #2;\n#1 += 1;\n#1++;\n#1 % #2;\n!#1;\n#1 EQ #2;",
        );
        let codes = result
            .diagnostics
            .iter()
            .map(|diagnostic| diagnostic.code.as_deref().unwrap_or(""))
            .collect::<Vec<_>>();
        assert_eq!(
            codes,
            [
                "SYNTEC_UNSUPPORTED_EQUALITY_OPERATOR",
                "SYNTEC_UNSUPPORTED_INEQUALITY_OPERATOR",
                "SYNTEC_UNSUPPORTED_LOGICAL_AND_OPERATOR",
                "SYNTEC_UNSUPPORTED_LOGICAL_OR_OPERATOR",
                "SYNTEC_UNSUPPORTED_COMPOUND_ASSIGNMENT",
                "SYNTEC_UNSUPPORTED_INCREMENT",
                "SYNTEC_UNSUPPORTED_PERCENT_OPERATOR",
                "SYNTEC_UNSUPPORTED_LOGICAL_NOT_OPERATOR",
                "SYNTEC_UNSUPPORTED_FANUC_COMPARISON",
            ]
        );
    }

    #[test]
    fn reports_parenthesis_warnings_without_diagnostic_codes() {
        let result = analyze_document("(#1 + 1;\n#1 := [1 + 2;\n);\nMSG(\"(\");");
        assert_eq!(result.diagnostics.len(), 3);
        assert!(result
            .diagnostics
            .iter()
            .all(|diagnostic| diagnostic.code.is_none()));
        assert_eq!(result.diagnostics[0].message, "括号不匹配：缺少 1 个右括号");
        assert_eq!(
            result.diagnostics[1].message,
            "括号不匹配：缺少 1 个右方括号"
        );
        assert_eq!(result.diagnostics[2].message, "括号不匹配：多余的右括号");
    }

    #[test]
    fn reports_static_mod_decimal_operands_only() {
        let decimal = analyze_document("1 MOD 2.5;");
        assert_eq!(decimal.diagnostics.len(), 1);
        assert_eq!(decimal.diagnostics[0].code, None);
        assert_eq!(
            decimal.diagnostics[0].message,
            "MOD 仅适用于 Long 型态；静态数字操作数不可带小数点"
        );

        let integer = analyze_document("1 MOD 2;");
        assert!(integer.diagnostics.is_empty());
    }

    #[test]
    fn reports_missing_semicolons_without_flagging_headers() {
        let missing = analyze_document("#1 := 1");
        assert_eq!(missing.diagnostics.len(), 1);
        assert_eq!(
            missing.diagnostics[0].code.as_deref(),
            Some("SYNTEC_MISSING_SEMICOLON")
        );
        assert_eq!(missing.diagnostics[0].col, 7);

        assert!(!analyze_document("IF #1 = 1 THEN")
            .diagnostics
            .iter()
            .any(|diagnostic| diagnostic.code.as_deref() == Some("SYNTEC_MISSING_SEMICOLON")));
        assert!(analyze_document("IF #1 = 1 THEN\nELSE\nEND_IF;")
            .diagnostics
            .is_empty());
        assert!(analyze_document("1:").diagnostics.is_empty());
    }

    #[test]
    fn reports_static_math_domain_diagnostics_only() {
        let result = analyze_document(
            "#1 := ATAN2(0, 0);\n#2 := POW(-1, 2);\n#3 := LN(0);\n#4 := SQRT(-1);\n#5 := ACOS(1.1);\n#6 := ASIN(-1.1);",
        );
        assert_eq!(result.diagnostics.len(), 6);
        assert!(result
            .diagnostics
            .iter()
            .all(|diagnostic| diagnostic.code.as_deref() == Some("SYNTEC_FUNCTION_MATH_DOMAIN")));

        let dynamic = analyze_document("#1 := ATAN2(#2, #3);\n#4 := SQRT(#5 + 1);\n#6 := ACOS(1);");
        assert!(dynamic.diagnostics.is_empty());
    }

    #[test]
    fn reports_static_io_and_register_ranges_only() {
        let result = analyze_document(
            "READDI(512);\nSETDO(1, 2);\nREADRREGBIT(65536, 0);\nREADRREGBIT(1, 32);",
        );
        let codes = result
            .diagnostics
            .iter()
            .map(|diagnostic| diagnostic.code.as_deref().unwrap_or(""))
            .collect::<Vec<_>>();
        assert_eq!(
            codes,
            [
                "SYNTEC_FUNCTION_IO_POINT_RANGE",
                "SYNTEC_FUNCTION_IO_VALUE_RANGE",
                "SYNTEC_FUNCTION_R_REGISTER_RANGE",
                "SYNTEC_FUNCTION_R_BIT_RANGE",
            ]
        );

        let dynamic = analyze_document(
            "READDI(#1);\nSETDO(#1, #2);\nREADRREGBIT(#3, #4);\nSETRREGBIT(1, 2, 1);",
        );
        assert!(dynamic.diagnostics.is_empty());
    }
}
