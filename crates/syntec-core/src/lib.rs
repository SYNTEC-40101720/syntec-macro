//! Development-only Rust core pilot.
//!
//! This crate intentionally implements only the protocol-compatible lexer
//! preprocessing and tolerant control-flow diagnostics needed for the M3
//! comparison. It is not wired into the VS Code extension yet.

use std::collections::HashSet;

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
pub struct DocumentSnapshot {
    pub uri: String,
    pub version: u32,
    pub language_id: String,
    pub text: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AnalysisRequest {
    pub protocol_version: u32,
    pub document: DocumentSnapshot,
    pub profile: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AnalysisNavigation {
    pub program_entry_name: Option<String>,
    pub macro_program_name: Option<String>,
    pub symbols: Vec<Symbol>,
    pub calls: Vec<NavigationCall>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AnalysisTextEdit {
    pub line: usize,
    pub start_character: usize,
    pub end_line: usize,
    pub end_character: usize,
    pub new_text: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AnalysisResult {
    pub protocol_version: u32,
    pub document: DocumentSnapshot,
    pub profile: String,
    pub backend: &'static str,
    pub diagnostics: Vec<Diagnostic>,
    pub symbols: Vec<Symbol>,
    pub edits: Vec<AnalysisTextEdit>,
    pub navigation: Option<AnalysisNavigation>,
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

fn extract_goto_target(clean: &str) -> Option<String> {
    let chars: Vec<char> = clean.chars().collect();
    for (word, _, end) in word_positions(clean) {
        if word != "GOTO" {
            continue;
        }
        let mut cursor = end;
        while cursor < chars.len() && chars[cursor].is_ascii_whitespace() {
            cursor += 1;
        }
        let start = cursor;
        while cursor < chars.len() && chars[cursor].is_ascii_digit() {
            cursor += 1;
        }
        if cursor > start
            && (cursor == chars.len()
                || (!chars[cursor].is_ascii_alphanumeric() && chars[cursor] != '_'))
        {
            return Some(chars[start..cursor].iter().collect());
        }
    }
    None
}

fn extract_g_codes(clean: &str) -> Vec<(String, usize, usize)> {
    let chars: Vec<char> = clean.chars().collect();
    let mut codes = Vec::new();
    let mut index = 0;
    while index < chars.len() {
        if !chars[index].eq_ignore_ascii_case(&'G')
            || (index > 0 && is_identifier_character(chars[index - 1]))
        {
            index += 1;
            continue;
        }
        let start = index;
        index += 1;
        let digits_start = index;
        while index < chars.len() && chars[index].is_ascii_digit() {
            index += 1;
        }
        if index == digits_start {
            continue;
        }
        if chars.get(index) == Some(&'.') {
            index += 1;
            while index < chars.len() && chars[index].is_ascii_digit() {
                index += 1;
            }
        }
        if index < chars.len()
            && (chars[index].is_ascii_alphanumeric() || chars[index] == '_' || chars[index] == '.')
        {
            continue;
        }
        codes.push((
            chars[start..index]
                .iter()
                .collect::<String>()
                .to_ascii_uppercase(),
            start,
            index,
        ));
    }
    codes
}

fn validate_macro_call_g_code_order(clean: &str, line: usize, diagnostics: &mut Vec<Diagnostic>) {
    let codes = extract_g_codes(clean);
    if codes.len() < 2 {
        return;
    }
    for (code, start, end) in codes.iter().take(codes.len() - 1) {
        if matches!(code.as_str(), "G65" | "G66" | "G66.1") {
            let chars: Vec<char> = clean.chars().collect();
            push_diagnostic(
                diagnostics,
                line,
                utf16_prefix_len(&chars, *start),
                utf16_prefix_len(&chars, *end),
                Severity::Warning,
                "SYNTEC_CALL_MACRO_NOT_LAST_G_CODE",
                format!("{code} 必须是该行最后一个 G 码；请调整 G 码顺序"),
            );
        }
    }
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

fn validate_static_basic_functions(clean: &str, line: usize, diagnostics: &mut Vec<Diagnostic>) {
    let chars: Vec<char> = clean.chars().collect();
    for function_name in ["ALARM", "MSG"] {
        for call in static_function_calls(clean, function_name) {
            let value = call.args.first().and_then(|arg| parse_static_number(arg));
            if value.is_some_and(|value| value.fract() != 0.0 || !(0.0..=65535.0).contains(&value))
            {
                push_diagnostic(
                    diagnostics,
                    line,
                    utf16_prefix_len(&chars, call.start),
                    utf16_prefix_len(&chars, call.end),
                    Severity::Error,
                    "SYNTEC_FUNCTION_ID_RANGE",
                    &format!("{function_name} ID 范围为 0~65535"),
                );
            }
        }
    }

    for call in static_function_calls(clean, "PARAM") {
        for argument in call.args.iter().take(2) {
            let value = parse_static_number(argument);
            if value.is_some_and(|value| value.fract() != 0.0) {
                push_diagnostic(
                    diagnostics,
                    line,
                    utf16_prefix_len(&chars, call.start),
                    utf16_prefix_len(&chars, call.end),
                    Severity::Error,
                    "SYNTEC_FUNCTION_INTEGER_ARGUMENT",
                    "PARAM 引数需为整数",
                );
            }
        }
    }

    for call in static_function_calls(clean, "CHKINF") {
        let value = call.args.first().and_then(|arg| parse_static_number(arg));
        if value.is_some_and(|value| value.fract() != 0.0 || !(1.0..=5.0).contains(&value)) {
            push_diagnostic(
                diagnostics,
                line,
                utf16_prefix_len(&chars, call.start),
                utf16_prefix_len(&chars, call.end),
                Severity::Error,
                "SYNTEC_FUNCTION_CHKINF_CATEGORY_RANGE",
                "CHKINF 类别范围为 1~5",
            );
        }
    }
}

fn is_identifier_character(character: char) -> bool {
    character.is_ascii_alphanumeric() || character == '_'
}

fn validate_variable_access(clean: &str, line: usize, diagnostics: &mut Vec<Diagnostic>) {
    if clean.trim().eq_ignore_ascii_case("%@MACRO") {
        return;
    }
    let chars: Vec<char> = clean.chars().collect();

    let mut index = 0;
    while index < chars.len() {
        if (chars[index] == '#' || chars[index] == '@')
            && (index == 0 || !is_identifier_character(chars[index - 1]))
        {
            let start = index;
            index += 1;
            if index < chars.len() && (chars[index].is_ascii_alphabetic() || chars[index] == '_') {
                index += 1;
                while index < chars.len() && is_identifier_character(chars[index]) {
                    index += 1;
                }
                let variable = chars[start..index].iter().collect::<String>();
                let code = if variable.starts_with('#') {
                    "SYNTEC_NAMED_LOCAL_VARIABLE"
                } else {
                    "SYNTEC_NAMED_GLOBAL_VARIABLE"
                };
                let col = utf16_prefix_len(&chars, start);
                push_diagnostic(
                    diagnostics,
                    line,
                    col,
                    utf16_prefix_len(&chars, index),
                    Severity::Error,
                    code,
                    format!("{variable} 是不支持的命名变量；请使用数字变量编号"),
                );
                continue;
            }
        }
        index += 1;
    }

    for index in 0..chars.len().saturating_sub(1) {
        if (chars[index] != '#' && chars[index] != '@')
            || chars[index + 1] != '0'
            || (index > 0 && is_identifier_character(chars[index - 1]))
        {
            continue;
        }
        let mut cursor = index + 2;
        while cursor < chars.len() && chars[cursor].is_ascii_whitespace() {
            cursor += 1;
        }
        let is_assignment = chars.get(cursor) == Some(&':') && chars.get(cursor + 1) == Some(&'=')
            || chars.get(cursor) == Some(&'=') && chars.get(cursor + 1) != Some(&'=');
        if is_assignment {
            let variable = chars[index..index + 2].iter().collect::<String>();
            let col = utf16_prefix_len(&chars, index);
            push_diagnostic(
                diagnostics,
                line,
                col,
                col + 2,
                Severity::Warning,
                "SYNTEC_VACANT_ASSIGNMENT",
                format!("{variable} 为 VACANT，只读，不建议作为赋值目标"),
            );
        }
    }

    let first_code_character = chars
        .iter()
        .position(|character| !character.is_ascii_whitespace());
    if let Some(start) = first_code_character {
        if chars[start] == '@' {
            let mut cursor = start + 1;
            while cursor < chars.len() && chars[cursor].is_ascii_digit() {
                cursor += 1;
            }
            if cursor > start + 1 {
                let mut assignment_cursor = cursor;
                while assignment_cursor < chars.len()
                    && chars[assignment_cursor].is_ascii_whitespace()
                {
                    assignment_cursor += 1;
                }
                let is_assignment = chars.get(assignment_cursor) == Some(&':')
                    && chars.get(assignment_cursor + 1) == Some(&'=')
                    || chars.get(assignment_cursor) == Some(&'=')
                        && chars.get(assignment_cursor + 1) != Some(&'=');
                if is_assignment {
                    let number = chars[start + 1..cursor]
                        .iter()
                        .collect::<String>()
                        .parse::<usize>()
                        .ok();
                    let mapped_register = number.and_then(|number| {
                        if (401..=655).contains(&number) {
                            Some(number - 400)
                        } else if (10000..=14095).contains(&number) {
                            Some(number - 10000)
                        } else if (100000..=165535).contains(&number) {
                            Some(number - 100000)
                        } else {
                            None
                        }
                    });
                    if let (Some(number), Some(register)) = (number, mapped_register) {
                        let reserved = register <= 49
                            || (81..=102).contains(&register)
                            || (512..=639).contains(&register)
                            || (640..=1023).contains(&register)
                            || (11000..=14999).contains(&register);
                        if reserved {
                            let reason = if (40..=49).contains(&register) {
                                "PLC 警报讯息区"
                            } else if (81..=100).contains(&register) {
                                "对应参数 Pr3401~Pr3420 唯读区"
                            } else if (101..=102).contains(&register) {
                                "刀具状态 FRAM 唯读区"
                            } else if (512..=639).contains(&register) {
                                "CNC 系统介面区（不支持位元存取）"
                            } else if (11000..=14999).contains(&register) {
                                "未列出保留区段（写入可能导致不可预期行为）"
                            } else {
                                "CNC 系统介面区"
                            };
                            push_diagnostic(
                                diagnostics,
                                line,
                                utf16_prefix_len(&chars, start + 1),
                                utf16_prefix_len(&chars, cursor + 1),
                                Severity::Warning,
                                "SYNTEC_PUBLIC_VAR_R_RESERVED_WRITE",
                                format!(
                                    "@{number} 映射到 R{register}（{reason}），属于 R 寄存器保留区段；写入可能导致不可预期行为"
                                ),
                            );
                        }
                    }
                }
            }
        }
    }

    let mut index = 0;
    while index < chars.len() {
        let (prefix, prefix_length) = if index + 3 <= chars.len()
            && chars[index..index + 3]
                .iter()
                .zip(['M', 'A', 'R'])
                .all(|(left, right)| left.eq_ignore_ascii_case(&right))
        {
            ("MAR", 3)
        } else if index + 2 <= chars.len()
            && chars[index..index + 2]
                .iter()
                .zip(['A', 'R'])
                .all(|(left, right)| left.eq_ignore_ascii_case(&right))
        {
            ("AR", 2)
        } else {
            index += 1;
            continue;
        };
        if index > 0 && is_identifier_character(chars[index - 1]) {
            index += 1;
            continue;
        }

        let mut cursor = index + prefix_length;
        if chars.get(cursor) == Some(&'[') {
            let content_start = cursor + 1;
            while cursor < chars.len() && chars[cursor] != ']' {
                cursor += 1;
            }
            if cursor < chars.len() {
                let content = chars[content_start..cursor]
                    .iter()
                    .collect::<String>()
                    .trim()
                    .to_string();
                if let Some(value) = parse_static_number(&content) {
                    if value.fract() != 0.0 || value < 0.0 {
                        let end = cursor + 1;
                        let col = utf16_prefix_len(&chars, index);
                        let variable = chars[index..end]
                            .iter()
                            .collect::<String>()
                            .to_ascii_uppercase();
                        push_diagnostic(
                            diagnostics,
                            line,
                            col,
                            utf16_prefix_len(&chars, end),
                            Severity::Error,
                            "SYNTEC_INVALID_APP_VARIABLE_NUMBER",
                            format!(
                                "{variable} 不是合法 APP 变量编号；AR/MAR 间接静态编号必须为非负整数"
                            ),
                        );
                    }
                }
                index = cursor + 1;
                continue;
            }
        } else if chars
            .get(cursor)
            .is_some_and(|character| *character == '-' || character.is_ascii_digit())
        {
            let token_start = cursor;
            while cursor < chars.len()
                && (chars[cursor] == '-'
                    || chars[cursor] == '+'
                    || chars[cursor] == '.'
                    || chars[cursor].is_ascii_digit())
            {
                cursor += 1;
            }
            let token = chars[token_start..cursor].iter().collect::<String>();
            if (token.starts_with('-') || token.contains('.'))
                && parse_static_number(&token).is_some()
            {
                let col = utf16_prefix_len(&chars, index);
                let variable = chars[index..cursor]
                    .iter()
                    .collect::<String>()
                    .to_ascii_uppercase();
                push_diagnostic(
                    diagnostics,
                    line,
                    col,
                    utf16_prefix_len(&chars, cursor),
                    Severity::Error,
                    "SYNTEC_INVALID_APP_VARIABLE_NUMBER",
                    format!("{variable} 不是合法 APP 变量编号；AR/MAR 直接编号必须为非负整数"),
                );
            }
            index = cursor;
            continue;
        }
        index += 1;
        let _ = prefix;
    }
}

fn validate_assignment_style(clean: &str, line: usize, diagnostics: &mut Vec<Diagnostic>) {
    let chars: Vec<char> = clean.chars().collect();
    let Some(mut index) = chars
        .iter()
        .position(|character| !character.is_ascii_whitespace())
    else {
        return;
    };
    let target_start = index;
    if chars[index] == '#' || chars[index] == '@' {
        index += 1;
        if chars.get(index) == Some(&'[') {
            while index < chars.len() && chars[index] != ']' {
                index += 1;
            }
            if index < chars.len() {
                index += 1;
            }
        } else {
            while index < chars.len() && chars[index].is_ascii_digit() {
                index += 1;
            }
        }
    } else {
        let prefix = if index + 3 <= chars.len()
            && chars[index..index + 3]
                .iter()
                .zip(['M', 'A', 'R'])
                .all(|(left, right)| left.eq_ignore_ascii_case(&right))
        {
            3
        } else if index + 2 <= chars.len()
            && chars[index..index + 2]
                .iter()
                .zip(['A', 'R'])
                .all(|(left, right)| left.eq_ignore_ascii_case(&right))
        {
            2
        } else {
            0
        };
        if prefix == 0 {
            return;
        }
        index += prefix;
        if chars.get(index) == Some(&'[') {
            while index < chars.len() && chars[index] != ']' {
                index += 1;
            }
            if index < chars.len() {
                index += 1;
            }
        } else {
            while index < chars.len() && chars[index].is_ascii_digit() {
                index += 1;
            }
        }
    }
    if index == target_start {
        return;
    }
    while index < chars.len() && chars[index].is_ascii_whitespace() {
        index += 1;
    }
    if chars.get(index) == Some(&'=') && chars.get(index + 1) != Some(&'=') {
        let col = utf16_prefix_len(&chars, index);
        push_diagnostic(
            diagnostics,
            line,
            col,
            col + 1,
            Severity::Warning,
            "SYNTEC_ASSIGNMENT_STYLE_EQUALS",
            "赋值使用 = 支援但不推荐；建议使用 :=",
        );
    }
}

fn validate_string_function_warnings(
    raw: &str,
    line: usize,
    line_start_in_block: bool,
    diagnostics: &mut Vec<Diagnostic>,
) {
    let (kept, string_mask, _, _) = strip_comments_keep_strings(raw, line_start_in_block);
    let chars: Vec<char> = kept.chars().collect();
    for (function_name, start, end) in word_positions(&kept) {
        if function_name != "OPEN" && function_name != "AXID"
            || string_mask.get(start).copied().unwrap_or(false)
        {
            continue;
        }
        let mut cursor = end;
        while cursor < chars.len() && chars[cursor].is_ascii_whitespace() {
            cursor += 1;
        }
        if chars.get(cursor) != Some(&'(') {
            continue;
        }
        let open_index = cursor;
        cursor += 1;
        let mut depth = 1;
        while cursor < chars.len() && depth > 0 {
            if !string_mask[cursor] {
                if chars[cursor] == '(' {
                    depth += 1;
                } else if chars[cursor] == ')' {
                    depth -= 1;
                }
            }
            cursor += 1;
        }
        if depth != 0 {
            continue;
        }
        let close_index = cursor - 1;
        let mut argument_start = open_index + 1;
        while argument_start < close_index && chars[argument_start].is_ascii_whitespace() {
            argument_start += 1;
        }
        if chars.get(argument_start) != Some(&'"') {
            continue;
        }
        let content_start = argument_start + 1;
        let mut quote_index = content_start;
        while quote_index < close_index {
            if chars[quote_index] == '"' && !is_escaped_quote(&chars, quote_index) {
                break;
            }
            quote_index += 1;
        }
        if quote_index >= close_index {
            continue;
        }
        let content = chars[content_start..quote_index].iter().collect::<String>();
        let upper_content = content.to_ascii_uppercase();
        let message_and_code = if function_name == "OPEN"
            && upper_content.len() > 3
            && upper_content.starts_with("COM")
            && upper_content
                .chars()
                .skip(3)
                .all(|character| character.is_ascii_digit())
        {
            Some((
                "串口传输埠仅支持 OPEN(\"COM\")；OPEN(\"COM1\") 会按普通文件名处理",
                "SYNTEC_FUNCTION_OPEN_COM_PORT",
            ))
        } else if function_name == "AXID" {
            Some((
                "AXID 建议使用裸轴名，例如 AXID(Y)",
                "SYNTEC_FUNCTION_AXID_QUOTED_AXIS",
            ))
        } else {
            None
        };
        if let Some((message, code)) = message_and_code {
            push_diagnostic(
                diagnostics,
                line,
                utf16_prefix_len(&chars, start),
                utf16_prefix_len(&chars, close_index + 1),
                Severity::Warning,
                code,
                message,
            );
        }
    }
}

fn split_function_args_with_strings(
    chars: &[char],
    string_mask: &[bool],
    start: usize,
    end: usize,
) -> Vec<String> {
    let mut args = Vec::new();
    let mut argument_start = start;
    let mut depth = 0;
    for index in start..end {
        if string_mask[index] {
            continue;
        }
        match chars[index] {
            '(' => depth += 1,
            ')' => depth -= 1,
            ',' if depth == 0 => {
                args.push(
                    chars[argument_start..index]
                        .iter()
                        .collect::<String>()
                        .trim()
                        .to_string(),
                );
                argument_start = index + 1;
            }
            _ => {}
        }
    }
    let tail = chars[argument_start..end]
        .iter()
        .collect::<String>()
        .trim()
        .to_string();
    if !tail.is_empty() || !args.is_empty() {
        args.push(tail);
    }
    args
}

fn static_function_calls_with_strings(
    text: &str,
    string_mask: &[bool],
    function_name: &str,
) -> Vec<StaticFunctionCall> {
    let chars: Vec<char> = text.chars().collect();
    let mut calls = Vec::new();
    for (word, start, end) in word_positions(text) {
        if word != function_name || string_mask.get(start).copied().unwrap_or(false) {
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
            if !string_mask[cursor] {
                if chars[cursor] == '(' {
                    depth += 1;
                } else if chars[cursor] == ')' {
                    depth -= 1;
                }
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
            args: split_function_args_with_strings(&chars, string_mask, args_start, close_index),
        });
    }
    calls
}

fn is_quoted_string_literal(value: &str) -> bool {
    let chars: Vec<char> = value.trim().chars().collect();
    chars.len() >= 2 && chars.first() == Some(&'"') && chars.last() == Some(&'"')
}

fn is_decimal_literal(value: &str) -> bool {
    let chars: Vec<char> = value.trim().chars().collect();
    let mut index = 0;
    if matches!(chars.first(), Some('+' | '-')) {
        index += 1;
    }
    let digits_start = index;
    while index < chars.len() && chars[index].is_ascii_digit() {
        index += 1;
    }
    if index == digits_start || chars.get(index) != Some(&'.') {
        return false;
    }
    index += 1;
    while index < chars.len() && chars[index].is_ascii_digit() {
        index += 1;
    }
    index == chars.len()
}

fn is_integer_literal(value: &str) -> bool {
    let chars: Vec<char> = value.trim().chars().collect();
    let mut index = 0;
    if matches!(chars.first(), Some('+' | '-')) {
        index += 1;
    }
    let start = index;
    while index < chars.len() && chars[index].is_ascii_digit() {
        index += 1;
    }
    index > start && index == chars.len()
}

fn is_hex_string_literal(value: &str) -> bool {
    let chars: Vec<char> = value.trim().chars().collect();
    if chars.len() < 4 || chars.first() != Some(&'"') || chars.last() != Some(&'"') {
        return false;
    }
    let inner = &chars[1..chars.len() - 1];
    inner.len() >= 2
        && inner.last() == Some(&'h')
        && inner[..inner.len() - 1]
            .iter()
            .all(|character| character.is_ascii_hexdigit())
}

fn is_dynamic_macro_variable(value: &str) -> bool {
    let chars: Vec<char> = value.trim().chars().collect();
    chars.len() >= 2 && chars[0] == '#' && (chars[1].is_ascii_digit() || chars[1] == '[')
}

fn validate_string_argument_functions(
    raw: &str,
    line: usize,
    line_start_in_block: bool,
    diagnostics: &mut Vec<Diagnostic>,
) {
    let (kept, string_mask, _, _) = strip_comments_keep_strings(raw, line_start_in_block);
    let chars: Vec<char> = kept.chars().collect();
    for call in static_function_calls_with_strings(&kept, &string_mask, "SYSDATA") {
        let argument = call.args.first().map(String::as_str).unwrap_or("");
        if is_quoted_string_literal(argument) || is_decimal_literal(argument) {
            push_diagnostic(
                diagnostics,
                line,
                utf16_prefix_len(&chars, call.start),
                utf16_prefix_len(&chars, call.end),
                Severity::Error,
                "SYNTEC_FUNCTION_INTEGER_ARGUMENT",
                "SYSDATA 引数需为整数",
            );
        }
    }

    for call in static_function_calls_with_strings(&kept, &string_mask, "DRVDATA") {
        let station = call.args.first().map(String::as_str).unwrap_or("");
        if is_quoted_string_literal(station) || is_decimal_literal(station) {
            push_diagnostic(
                diagnostics,
                line,
                utf16_prefix_len(&chars, call.start),
                utf16_prefix_len(&chars, call.end),
                Severity::Error,
                "SYNTEC_FUNCTION_INTEGER_ARGUMENT",
                "DRVDATA 站号需为整数",
            );
        }
        if let Some(variable) = call.args.get(1) {
            let valid = is_integer_literal(variable)
                || is_hex_string_literal(variable)
                || is_dynamic_macro_variable(variable);
            if !valid && !variable.trim().is_empty() {
                push_diagnostic(
                    diagnostics,
                    line,
                    utf16_prefix_len(&chars, call.start),
                    utf16_prefix_len(&chars, call.end),
                    Severity::Error,
                    "SYNTEC_FUNCTION_DRVDATA_ARGUMENT_FORMAT",
                    "DRVDATA 第二引数需为十进制整数或 \"xxxh\" 十六进制字符串",
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
        || is_chinese_punctuation(chars[last_non_space])
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

fn is_chinese_punctuation(character: char) -> bool {
    matches!(
        character,
        '；' | '：' | '，' | '。' | '！' | '？' | '【' | '】' | '《' | '》' | '（' | '）' | '、'
    )
}

fn validate_chinese_characters(clean: &str, line: usize, diagnostics: &mut Vec<Diagnostic>) {
    let chars: Vec<char> = clean.chars().collect();
    if let Some(index) = chars.iter().position(|character| {
        ('\u{3400}'..='\u{4dbf}').contains(character)
            || ('\u{4e00}'..='\u{9fff}').contains(character)
    }) {
        let col = utf16_prefix_len(&chars, index);
        push_diagnostic_without_code(
            diagnostics,
            line,
            col,
            col + chars[index].len_utf16(),
            Severity::Error,
            "中文字符：宏程序只允许使用英文字符",
        );
    }
    for (index, character) in chars.iter().enumerate() {
        if is_chinese_punctuation(*character) {
            let col = utf16_prefix_len(&chars, index);
            push_diagnostic_without_code(
                diagnostics,
                line,
                col,
                col + character.len_utf16(),
                Severity::Error,
                format!("中文标点 \"{character}\"：宏程序应使用英文字符"),
            );
        }
    }
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

fn validate_case_line_style(
    clean: &str,
    line: usize,
    stack: &[Block],
    diagnostics: &mut Vec<Diagnostic>,
) {
    let Some(top) = stack.last() else {
        return;
    };
    if top.keyword != "CASE" {
        return;
    }
    let chars: Vec<char> = clean.chars().collect();
    let target: Vec<char> = "DEFAULT".chars().collect();
    let mut cursor = 0;
    while cursor + target.len() <= chars.len() {
        let Some(start) = chars[cursor..]
            .windows(target.len())
            .position(|window| {
                window
                    .iter()
                    .zip(target.iter())
                    .all(|(left, right)| left.eq_ignore_ascii_case(right))
            })
        else {
            break;
        };
        let absolute_start = cursor + start;
        let boundary_before = absolute_start == 0
            || {
                let prev = chars[absolute_start - 1];
                !prev.is_ascii_alphanumeric() && prev != '_'
            };
        let after_default = absolute_start + target.len();
        let boundary_after = after_default >= chars.len()
            || {
                let next = chars[after_default];
                !next.is_ascii_alphanumeric() && next != '_'
            };
        if boundary_before && boundary_after {
            let mut scan = after_default;
            while scan < chars.len() && chars[scan].is_ascii_whitespace() {
                scan += 1;
            }
            if scan < chars.len() && chars[scan] == ':' {
                let col = utf16_prefix_len(&chars, absolute_start);
                let end_col = utf16_prefix_len(&chars, scan + 1);
                push_diagnostic(
                    diagnostics,
                    line,
                    col,
                    end_col,
                    Severity::Warning,
                    "SYNTEC_UNSUPPORTED_DEFAULT",
                    "DEFAULT 支援但不推荐；建议使用 ELSE",
                );
                return;
            }
        }
        cursor = absolute_start + 1;
    }
}

// Robot/LTP single-line TOOLCOR/TOOLCORON style warnings.
// Mirrors `validateRobotSyntaxPreferences` in `src/robotValidator.js`:
//   1. \b(?:TOOLCOR|TOOLCORON)\s+(T)(?=\d|#|@|\[|=)  -> TOOLCOR_T_ARG (error)
//   2. \bTOOLCORON\b                                 -> TOOLCORON_DEPRECATED (warning)
//   3. \bTOOLCOR\s+CLEAR\b                           -> TOOLCOR_CLEAR (warning)
// Each rule mirrors JS `.match` semantics: only the first match per line is reported.
fn validate_robot_toolcor(clean: &str, line: usize, diagnostics: &mut Vec<Diagnostic>) {
    let chars: Vec<char> = clean.chars().collect();
    let len = chars.len();
    if len == 0 {
        return;
    }
    let toolcor: Vec<char> = "TOOLCOR".chars().collect();
    let toolcoron: Vec<char> = "TOOLCORON".chars().collect();
    let clear: Vec<char> = "CLEAR".chars().collect();

    // Rule 1: TOOLCOR_T_ARG. Try TOOLCORON first so "TOOLCORON T1" matches the
    // longer keyword; "TOOLCOR T1" still matches via the shorter branch.
    let mut index = 0;
    while index < len {
        if chars[index].eq_ignore_ascii_case(&'T')
            && (index == 0 || !is_identifier_character(chars[index - 1]))
        {
            let keyword_end = if matches_keyword(&chars, index, &toolcoron) {
                index + toolcoron.len()
            } else if matches_keyword(&chars, index, &toolcor) {
                index + toolcor.len()
            } else {
                index += 1;
                continue;
            };
            let mut cursor = keyword_end;
            if cursor < len && chars[cursor].is_whitespace() {
                while cursor < len && chars[cursor].is_whitespace() {
                    cursor += 1;
                }
                if cursor < len && chars[cursor].eq_ignore_ascii_case(&'T') {
                    let t_pos = cursor;
                    let next = t_pos + 1;
                    if next < len
                        && (chars[next].is_ascii_digit()
                            || matches!(chars[next], '#' | '@' | '[' | '='))
                    {
                        let col = utf16_prefix_len(&chars, t_pos);
                        push_diagnostic(
                            diagnostics,
                            line,
                            col,
                            col + 1,
                            Severity::Error,
                            "SYNTEC_ROBOT_TOOLCOR_T_ARG",
                            "TOOLCOR/TOOLCORON 使用 P_ 指定工具编号；请勿使用 T_",
                        );
                        break;
                    }
                }
            }
        }
        index += 1;
    }

    // Rule 2: TOOLCORON_DEPRECATED.
    let mut index = 0;
    while index + toolcoron.len() <= len {
        if matches_keyword(&chars, index, &toolcoron)
            && (index == 0 || !is_identifier_character(chars[index - 1]))
            && (index + toolcoron.len() == len
                || !is_identifier_character(chars[index + toolcoron.len()]))
        {
            let col = utf16_prefix_len(&chars, index);
            push_diagnostic(
                diagnostics,
                line,
                col,
                col + toolcoron.len(),
                Severity::Warning,
                "SYNTEC_ROBOT_TOOLCORON_DEPRECATED",
                "TOOLCORON 未见官方语法；建议改用 TOOLCOR P_",
            );
            break;
        }
        index += 1;
    }

    // Rule 3: TOOLCOR_CLEAR.
    let mut index = 0;
    while index + toolcor.len() <= len {
        if matches_keyword(&chars, index, &toolcor)
            && (index == 0 || !is_identifier_character(chars[index - 1]))
        {
            let mut cursor = index + toolcor.len();
            let ws_start = cursor;
            while cursor < len && chars[cursor].is_whitespace() {
                cursor += 1;
            }
            if cursor > ws_start
                && cursor + clear.len() <= len
                && matches_keyword(&chars, cursor, &clear)
                && (cursor + clear.len() == len
                    || !is_identifier_character(chars[cursor + clear.len()]))
            {
                let col = utf16_prefix_len(&chars, index);
                let end_col = utf16_prefix_len(&chars, cursor + clear.len());
                push_diagnostic(
                    diagnostics,
                    line,
                    col,
                    end_col,
                    Severity::Warning,
                    "SYNTEC_ROBOT_TOOLCOR_CLEAR",
                    "TOOLCOR CLEAR 未见官方语法；建议改用 TOOLCOR P0",
                );
                break;
            }
        }
        index += 1;
    }
}

fn matches_keyword(chars: &[char], index: usize, keyword: &[char]) -> bool {
    index + keyword.len() <= chars.len()
        && chars[index..index + keyword.len()]
            .iter()
            .zip(keyword.iter())
            .all(|(left, right)| left.eq_ignore_ascii_case(right))
}

// Mirror of `getCommand` in `src/robotValidator.js`:
// `^(G\d+(?:\.\d+)?|M\d+|[A-Z][A-Z0-9_.-]*)\b` (case-insensitive, uppercased).
fn get_command(clean: &str) -> Option<String> {
    let trimmed = clean.trim();
    let chars: Vec<char> = trimmed.chars().collect();
    let len = chars.len();
    if len == 0 {
        return None;
    }
    let boundary_after = |end: usize| end == len || !is_identifier_character(chars[end]);
    if chars[0].eq_ignore_ascii_case(&'G') {
        let mut end = 1;
        let digits_start = end;
        while end < len && chars[end].is_ascii_digit() {
            end += 1;
        }
        if end > digits_start {
            if end < len && chars[end] == '.' {
                let frac_start = end + 1;
                let mut frac = frac_start;
                while frac < len && chars[frac].is_ascii_digit() {
                    frac += 1;
                }
                if frac > frac_start {
                    end = frac;
                }
            }
            if boundary_after(end) {
                return Some(chars[..end].iter().collect::<String>().to_ascii_uppercase());
            }
        }
    }
    if chars[0].eq_ignore_ascii_case(&'M') {
        let mut end = 1;
        while end < len && chars[end].is_ascii_digit() {
            end += 1;
        }
        if end > 1 && boundary_after(end) {
            return Some(chars[..end].iter().collect::<String>().to_ascii_uppercase());
        }
    }
    if chars[0].is_ascii_alphabetic() {
        let mut end = 1;
        while end < len
            && (chars[end].is_ascii_alphanumeric() || chars[end] == '_' || chars[end] == '.' || chars[end] == '-')
        {
            end += 1;
        }
        if is_identifier_character(chars[end - 1]) && boundary_after(end) {
            return Some(chars[..end].iter().collect::<String>().to_ascii_uppercase());
        }
    }
    None
}

// Returns the direct-arg rule args list (longest-first) for the given command,
// mirroring `DIRECT_ARG_RULES` in `src/robotValidator.js`. Each entry is the
// arg word (uppercase) plus the deprecation message; both are looked up by
// command name (case-sensitive on the table, but the command comes from
// `get_command`, which uppercases).
fn direct_arg_rules_for(command: Option<&str>) -> &'static [&'static [&'static str]] {
    match command {
        Some("MOVJ") => &[
            &["X"], &["Y"], &["Z"], &["A"], &["B"], &["C"], &["P"], &["Q"], &["FJ"], &["FEJ"],
            &["PL"], &["ACC"], &["DEC"],
        ],
        Some("MOVL") => &[
            &["X"], &["Y"], &["Z"], &["A"], &["B"], &["C"], &["P"], &["Q"], &["FL"], &["FR"],
            &["FEJ"], &["PL"], &["PQ"], &["PR"], &["ACC"], &["DEC"],
        ],
        Some("MOVC") => &[
            &["X"], &["Y"], &["Z"], &["A"], &["B"], &["C"], &["FL"], &["FR"], &["FEJ"],
            &["PL"], &["PQ"], &["PR"], &["ACC"], &["DEC"],
        ],
        Some("INCMOVJ") => &[
            &["Q"], &["FJ"], &["FEJ"], &["PL"], &["ACC"], &["DEC"],
        ],
        Some("INCMOVL") => &[
            &["P"], &["X"], &["Y"], &["Z"], &["A"], &["B"], &["C"], &["Q"], &["FL"], &["FR"],
            &["FEJ"], &["PL"], &["PQ"], &["PR"], &["ACC"], &["DEC"],
        ],
        Some("USERCOR") => &[&["P"]],
        Some("OBJCORON") => &[&["X"], &["Y"], &["Z"], &["A"], &["B"], &["C"]],
        Some("TOOLCOR") => &[&["P"]],
        Some("G68.18") => &[&["P"], &["R"], &["X"], &["Y"], &["Z"], &["A"], &["B"], &["C"]],
        Some("G192.1") => &[&["P"], &["Q"], &["R"], &["E"]],
        Some("CIRMODE") => &[&["P"]],
        Some("G43.16") => &[&["P"], &["X"], &["Y"], &["Z"], &["A"], &["B"], &["C"]],
        Some("POSEMAP") => &[&["X"], &["Y"], &["Z"], &["A"], &["B"], &["C"], &["Q"], &["R"]],
        Some("SHIFTON") => &[&["P"], &["X"], &["Y"], &["Z"], &["A"], &["B"], &["C"]],
        Some("SKIPCOND") => &[&["E"], &["Q"], &["R"], &["P"]],
        Some("SWAITSIG") => &[&["P"], &["Q"], &["R"], &["L"], &["T"]],
        Some("SYNCOUT") => &[&["S"], &["Q"], &["P"], &["R"], &["L"], &["K"]],
        Some("STITCHON") => &[&["S"], &["Q"], &["L"], &["K"], &["E"]],
        Some("WAITSYNC") => &[&["P"], &["L"]],
        Some("ENDSYNC") => &[&["P"]],
        Some("WEAVEON") => &[&["P"], &["E"], &["Q"], &["K"], &["L"], &["R"], &["I"]],
        _ => &[],
    }
}

fn direct_arg_rule_message(command: Option<&str>) -> Option<&'static str> {
    Some(match command? {
        "MOVJ" => "MOVJ 直接引数不使用 =；请使用 X100. / P1 / FJ50 等写法",
        "MOVL" => "MOVL 直接引数不使用 =；请使用 X100. / P1 / FL100. 等写法",
        "MOVC" => "MOVC 直接引数不使用 =；请使用 X100. / FL100. / PL3 等写法",
        "INCMOVJ" => "INCMOVJ 的 Q/FJ/FEJ/PL/ACC/DEC 为直接引数；请使用 Q1 / FJ30 等写法",
        "INCMOVL" => "INCMOVL 直接引数不使用 =；请使用 P1 / X50. / FL80. 等写法",
        "USERCOR" => "USERCOR 的 P 为直接引数；请使用 P1 等写法",
        "OBJCORON" => "OBJCORON 的 X/Y/Z/A/B/C 为直接引数；请使用 X5. 而非 X=5.",
        "TOOLCOR" => "TOOLCOR 的 P 为直接引数；请使用 P1 等写法",
        "G68.18" => "G68.18 的 P/R/X/Y/Z/A/B/C 为直接引数；请使用 P1 / R0 / X10. 等写法",
        "G192.1" => "G192.1 的 P/Q/R/E 为直接引数；请使用 P1 / Q20001 / R1 等写法",
        "CIRMODE" => "CIRMODE 的 P 为直接引数；请使用 P0 / P1 / P2 等写法",
        "G43.16" => "G43.16 的 P/X/Y/Z/A/B/C 为直接引数；请使用 P1 / X10. 等写法",
        "POSEMAP" => "POSEMAP 的 X/Y/Z/A/B/C/Q/R 为直接引数；请使用 X100. / Q1 / R1 等写法",
        "SHIFTON" => "SHIFTON 的 P/X/Y/Z/A/B/C 为直接引数；请使用 P1 / X20. 等写法",
        "SKIPCOND" => "SKIPCOND 的 E/Q/R/P 为直接引数；请使用 E1 / Q33 / R1 / P0 等写法",
        "SWAITSIG" => "SWAITSIG 的 P/Q/R/L/T 为直接引数；请使用 P1 / Q33 / R1 等写法",
        "SYNCOUT" => "SYNCOUT 的 S/Q/P/R/L/K 为直接引数；请使用 S1 / Q1 / P50 / R1 等写法",
        "STITCHON" => "STITCHON 的 S/Q/L/K/E 为直接引数；请使用 S1 / Q1 / L500 / E10. 等写法",
        "WAITSYNC" => "WAITSYNC 的 P/L 为直接引数；请使用 P1 / L100. 等写法",
        "ENDSYNC" => "ENDSYNC 的 P 为直接引数；请使用 P1 等写法",
        "WEAVEON" => "WEAVEON 的 P/E/Q/K/L/R/I 为直接引数；请使用 P3 或 E5. Q1.0 K30. 等写法",
        _ => return None,
    })
}

// Mirror of `hasDirectArg`: `\b{arg}(?=[#@+\-]?(?:\d|\.|\(|#|@))` (case-insensitive).
fn has_direct_arg(chars: &[char], arg: &[char]) -> bool {
    let len = chars.len();
    let mut index = 0;
    while index + arg.len() <= len {
        let is_start = index == 0 || !is_identifier_character(chars[index - 1]);
        if is_start && matches_keyword(chars, index, arg) {
            let mut next = index + arg.len();
            if next < len && matches!(chars[next], '#' | '@' | '+' | '-') {
                next += 1;
            }
            if next < len
                && (chars[next].is_ascii_digit()
                    || chars[next] == '.'
                    || chars[next] == '('
                    || chars[next] == '#'
                    || chars[next] == '@')
            {
                return true;
            }
        }
        index += 1;
    }
    false
}

// Returns the earliest `(arg_start, arg_len, equals_index)` for a direct-arg
// `=` usage among the given args (sorted by length descending, matching JS:
// `args.sort((a, b) => b.length - a.length)` then `\b(arg)\s*=`). At each
// candidate start position we try longer args first so `PQ` wins over `P`.
fn find_direct_arg_equals(chars: &[char], args: &[&[&str]]) -> Option<(usize, usize, usize)> {
    // Pre-build arg char vectors, longest-first within each command's list.
    let arg_vecs: Vec<Vec<char>> = args
        .iter()
        .map(|word| word.concat().chars().collect())
        .collect();
    // Stable sort by length desc to match JS ordering.
    let mut indexed: Vec<usize> = (0..arg_vecs.len()).collect();
    indexed.sort_by(|a, b| arg_vecs[*b].len().cmp(&arg_vecs[*a].len()));
    let arg_vecs_sorted: Vec<&Vec<char>> = indexed.iter().map(|i| &arg_vecs[*i]).collect();

    let len = chars.len();
    let mut index = 0;
    while index < len {
        let is_start = index == 0 || !is_identifier_character(chars[index - 1]);
        if is_start {
            for arg in arg_vecs_sorted.iter() {
                if arg.is_empty() {
                    continue;
                }
                if matches_keyword(chars, index, arg)
                    && (index + arg.len() == len || !is_identifier_character(chars[index + arg.len()]))
                {
                    let mut scan = index + arg.len();
                    while scan < len && chars[scan].is_whitespace() {
                        scan += 1;
                    }
                    if scan < len && chars[scan] == '=' {
                        return Some((index, arg.len(), scan));
                    }
                }
            }
        }
        index += 1;
    }
    None
}

// Mirror of `getStaticDirectArg`: `\b{arg}([+-]?\d+(?:\.\d*)?)` (case-insensitive).
// Returns `(value, literal, col, end_col)` aligned to UTF-16 character counts.
fn get_static_direct_arg(chars: &[char], arg: &[char]) -> Option<(f64, String, usize, usize)> {
    let len = chars.len();
    let mut index = 0;
    while index + arg.len() <= len {
        let is_start = index == 0 || !is_identifier_character(chars[index - 1]);
        if is_start && matches_keyword(chars, index, arg) {
            let mut cursor = index + arg.len();
            let value_start = cursor;
            if cursor < len && matches!(chars[cursor], '+' | '-') {
                cursor += 1;
            }
            let digits_start = cursor;
            while cursor < len && chars[cursor].is_ascii_digit() {
                cursor += 1;
            }
            if cursor > digits_start {
                if cursor < len && chars[cursor] == '.' {
                    cursor += 1;
                    while cursor < len && chars[cursor].is_ascii_digit() {
                        cursor += 1;
                    }
                }
                let literal: String = chars[value_start..cursor].iter().collect();
                if let Ok(value) = literal.parse::<f64>() {
                    let col = utf16_prefix_len(chars, index);
                    let end_col = utf16_prefix_len(chars, cursor);
                    return Some((value, literal, col, end_col));
                }
            }
        }
        index += 1;
    }
    None
}

// Mirror of `addStaticArgRangeDiagnostic`: skip integer-in-range cases, otherwise
// emit `SYNTEC_ROBOT_STATIC_ARG_RANGE` over the full literal span.
fn add_static_arg_range_diagnostic(
    diagnostics: &mut Vec<Diagnostic>,
    line: usize,
    chars: &[char],
    arg: &[char],
    min: f64,
    max: f64,
    message: impl Into<String>,
) {
    let Some((value, _literal, col, end_col)) = get_static_direct_arg(chars, arg) else {
        return;
    };
    if value.is_finite()
        && value.fract() == 0.0
        && value >= min
        && value <= max
    {
        return;
    }
    push_diagnostic(
        diagnostics,
        line,
        col,
        end_col,
        Severity::Error,
        "SYNTEC_ROBOT_STATIC_ARG_RANGE",
        message,
    );
}

// Mirror of `addStaticSignalQRangeDiagnostic`: a source arg (E/P/S) selects O/A-bit
// (sourceValue != r_bit_source_value) or R-bit encoding (source == r_bit_source_value)
// and Q is constrained accordingly.
fn add_static_signal_q_range_diagnostic(
    diagnostics: &mut Vec<Diagnostic>,
    line: usize,
    chars: &[char],
    command: &str,
    source_arg: &[char],
    r_bit_source_value: f64,
) {
    let Some((source_value, _src_literal, _src_col, _src_end)) =
        get_static_direct_arg(chars, source_arg)
    else {
        return;
    };
    let Some((signal_value, _sig_literal, signal_col, signal_end)) =
        get_static_direct_arg(chars, &"Q".chars().collect::<Vec<_>>())
    else {
        return;
    };
    if !(source_value.fract() == 0.0 && matches!(source_value as i64, 1 | 2 | 3)) {
        return;
    }
    let valid;
    let range;
    if source_value != r_bit_source_value {
        valid = signal_value.fract() == 0.0
            && signal_value >= 0.0
            && signal_value <= 511.0;
        range = "Q 引数范围为 0~511";
    } else {
        let register = (signal_value / 100.0).floor();
        let bit = signal_value % 100.0;
        valid = signal_value.fract() == 0.0
            && signal_value >= 0.0
            && register <= 65535.0
            && bit <= 15.0;
        range = "Q 按 R 编号×100+bit 编码；R 编号范围为 0~65535，末两位 bit 为 00~15";
    }
    if valid {
        return;
    }
    push_diagnostic(
        diagnostics,
        line,
        signal_col,
        signal_end,
        Severity::Error,
        "SYNTEC_ROBOT_STATIC_ARG_RANGE",
        format!("{command} 的 {range}，且必须为整数"),
    );
}

// Mirror of `validateStaticArgumentRanges`: MOVJ/MOVC/INCMOVJ/INCMOVL motion
// ranges, WEAVEON dual-mode ranges, per-command direct ranges, and signal-Q
//联动规则。纯静态数值；动态引数和表达式保持不推断。
fn validate_static_argument_ranges(clean: &str, line: usize, diagnostics: &mut Vec<Diagnostic>) {
    let trimmed = clean.trim();
    if trimmed.is_empty() {
        return;
    }
    let chars: Vec<char> = clean.chars().collect();
    let Some(command) = get_command(clean) else {
        return;
    };

    let p_arg: Vec<char> = "P".chars().collect();
    let q_arg: Vec<char> = "Q".chars().collect();
    let r_arg: Vec<char> = "R".chars().collect();
    let e_arg: Vec<char> = "E".chars().collect();
    let l_arg: Vec<char> = "L".chars().collect();
    let t_arg: Vec<char> = "T".chars().collect();
    let s_arg: Vec<char> = "S".chars().collect();
    let k_arg: Vec<char> = "K".chars().collect();

    match command.as_str() {
        "MOVL" | "MOVC" => {
            add_static_arg_range_diagnostic(diagnostics, line, &chars, &p_arg, 0.0, 20.0,
                format!("{command} 的 P 引数范围为 0~20，且必须为整数"));
            add_static_arg_range_diagnostic(diagnostics, line, &chars, &q_arg, 0.0, 20.0,
                format!("{command} 的 Q 引数范围为 0~20，且必须为整数"));
        }
        "INCMOVJ" => {
            add_static_arg_range_diagnostic(diagnostics, line, &chars, &q_arg, 0.0, 20.0,
                "INCMOVJ 的 Q 引数范围为 0~20，且必须为整数");
        }
        "INCMOVL" => {
            add_static_arg_range_diagnostic(diagnostics, line, &chars, &p_arg, 1.0, 2.0,
                "INCMOVL 的 P 引数范围为 1~2，且必须为整数");
        }
        "WEAVEON" => {
            let has_p = has_direct_arg(&chars, &p_arg);
            let detail_chars: [&[char]; 6] = [
                &"E".chars().collect::<Vec<_>>(),
                &"Q".chars().collect::<Vec<_>>(),
                &"K".chars().collect::<Vec<_>>(),
                &"L".chars().collect::<Vec<_>>(),
                &"R".chars().collect::<Vec<_>>(),
                &"I".chars().collect::<Vec<_>>(),
            ];
            let detail_count = detail_chars
                .iter()
                .filter(|arg| has_direct_arg(&chars, arg))
                .count();
            if has_p && detail_count == 0 {
                add_static_arg_range_diagnostic(diagnostics, line, &chars, &p_arg, 1.0, 50.0,
                    "WEAVEON 的 P 引数范围为 1~50，且必须为整数");
            } else if !has_p {
                add_static_arg_range_diagnostic(diagnostics, line, &chars, &l_arg, 0.0, 1_000_000.0,
                    "WEAVEON 的 L 引数范围为 0~1000000，且必须为整数");
                add_static_arg_range_diagnostic(diagnostics, line, &chars, &r_arg, 0.0, 1.0,
                    "WEAVEON 的 R 引数只能为 0 或 1，且必须为整数");
            }
        }
        _ => {}
    }

    // Per-command direct ranges (do not override above branches).
    let direct_ranges: &[(&[char], f64, f64, &str)] = match command.as_str() {
        "USERCOR" => &[(&p_arg, 0.0, 20.0, "USERCOR 的 P 引数范围为 0~20，且必须为整数")],
        "TOOLCOR" => &[(&p_arg, 0.0, 20.0, "TOOLCOR 的 P 引数范围为 0~20，且必须为整数")],
        "SHIFTON" => &[(&p_arg, 1.0, 2.0, "SHIFTON 的 P 引数范围为 1~2，且必须为整数")],
        "G68.18" => &[
            (&p_arg, 1.0, 20.0, "G68.18 的 P 引数范围为 1~20，且必须为整数"),
            (&r_arg, 0.0, 3.0, "G68.18 的 R 引数范围为 0~3，且必须为整数"),
        ],
        "G43.16" => &[(&p_arg, 1.0, 20.0, "G43.16 的 P 引数范围为 1~20，且必须为整数")],
        "POSEMAP" => &[
            (&q_arg, 0.0, 20.0, "POSEMAP 的 Q 引数范围为 0~20，且必须为整数"),
            (&r_arg, 1.0, 2.0, "POSEMAP 的 R 引数范围为 1~2，且必须为整数"),
        ],
        "SKIPCOND" => &[
            (&e_arg, 1.0, 3.0, "SKIPCOND 的 E 引数范围为 1~3，且必须为整数"),
            (&r_arg, 0.0, 1.0, "SKIPCOND 的 R 引数范围为 0~1，且必须为整数"),
            (&p_arg, 0.0, 1.0, "SKIPCOND 的 P 引数范围为 0~1，且必须为整数"),
        ],
        "SWAITSIG" => &[
            (&p_arg, 1.0, 3.0, "SWAITSIG 的 P 引数范围为 1~3，且必须为整数"),
            (&r_arg, 0.0, 1.0, "SWAITSIG 的 R 引数范围为 0~1，且必须为整数"),
            (&l_arg, 0.0, 2_147_483_648.0, "SWAITSIG 的 L 引数范围为 0~[PHONE]，且必须为整数"),
            (&t_arg, 0.0, 2_147_483_648.0, "SWAITSIG 的 T 引数范围为 0~[PHONE]，且必须为整数"),
        ],
        "SYNCOUT" => &[
            (&s_arg, 1.0, 3.0, "SYNCOUT 的 S 引数范围为 1~3，且必须为整数"),
            (&p_arg, 0.0, 100.0, "SYNCOUT 的 P 引数范围为 0~100，且必须为整数"),
            (&r_arg, 0.0, 1.0, "SYNCOUT 的 R 引数范围为 0~1，且必须为整数"),
            (&l_arg, 0.0, 10_000.0, "SYNCOUT 的 L 引数范围为 0~10000，且必须为整数"),
            (&k_arg, -10_000.0, 10_000.0, "SYNCOUT 的 K 引数范围为 -10000~10000，且必须为整数"),
        ],
        "G192.1" => &[
            (&p_arg, 0.0, 20.0, "G192.1 的 P 引数范围为 0~20，且必须为整数"),
            (&q_arg, 0.0, 65_530.0, "G192.1 的 Q 引数范围为 0~65530，且必须为整数"),
            (&r_arg, 1.0, 2.0, "G192.1 的 R 引数范围为 1~2，且必须为整数"),
            (&e_arg, -10.0, 10.0, "G192.1 的 E 引数范围为 -10~10，且必须为整数"),
        ],
        "CIRMODE" => &[(&p_arg, 0.0, 2.0, "CIRMODE 的 P 引数范围为 0~2，且必须为整数")],
        "WAITSYNC" => &[(&p_arg, 1.0, 4.0, "WAITSYNC 的 P 引数范围为 1~4，且必须为整数")],
        "ENDSYNC" => &[(&p_arg, 1.0, 4.0, "ENDSYNC 的 P 引数范围为 1~4，且必须为整数")],
        _ => &[],
    };
    for (arg, min, max, message) in direct_ranges.iter() {
        add_static_arg_range_diagnostic(diagnostics, line, &chars, arg, *min, *max, *message);
    }

    if command == "SKIPCOND" {
        add_static_signal_q_range_diagnostic(diagnostics, line, &chars, command.as_str(), &e_arg, 3.0);
    }
    if command == "SWAITSIG" {
        add_static_signal_q_range_diagnostic(diagnostics, line, &chars, command.as_str(), &p_arg, 2.0);
    }
    if command == "SYNCOUT" {
        add_static_signal_q_range_diagnostic(diagnostics, line, &chars, command.as_str(), &s_arg, 2.0);
    }
}

// Per-file robot line state. Mirrors `createRobotState` in
// `src/robotValidator.js`. Carries MOVC pair state, SWAITSIG/SYNCOUT
// counters, pending movement line, and STITCHON/WEAVEON/WAITSYNC/G192 active
// flags required by the ROBOT-SIGNAL末批 (`SWAITSIG_LIMIT` / `SYNCOUT_LIMIT`
// / `RANGE_FORBIDDEN_COMMAND`).
#[derive(Default)]
struct RobotLineState {
    pending_movc_line: usize,
    current_movement_line: usize,
    swaitsig_count: usize,
    syncout_count: usize,
    in_stitch_on: bool,
    in_weave_on: bool,
    in_wait_sync: bool,
    in_g192: bool,
}

fn is_movement_command(command: &str) -> bool {
    matches!(command, "MOVJ" | "MOVL" | "MOVC" | "INCMOVJ" | "INCMOVL")
}

fn is_single_line_movc(clean: &str) -> bool {
    let mut x1 = false;
    let mut x2 = false;
    let chars: Vec<char> = clean.chars().collect();
    let len = chars.len();
    let mut index = 0;
    while index + 2 <= len {
        let boundary_before = index == 0 || !is_identifier_character(chars[index - 1]);
        if boundary_before {
            if chars[index].eq_ignore_ascii_case(&'X') {
                let next = chars[index + 1];
                if next.eq_ignore_ascii_case(&'1') {
                    x1 = true;
                }
                if next.eq_ignore_ascii_case(&'2') {
                    x2 = true;
                }
            }
        }
        index += 1;
    }
    x1 && x2
}

// Mirrors `addPendingMovcDiagnostic`: file-end pending MOVC pair error.
fn add_pending_movc_diagnostic(diagnostics: &mut Vec<Diagnostic>, line: usize) {
    push_diagnostic(
        diagnostics,
        line,
        0,
        0,
        Severity::Error,
        "SYNTEC_ROBOT_MOVC_PAIR_REQUIRED",
        "MOVC 必须成对出现：第一行为中间点，第二行为结束点",
    );
}

// Mirror of `clean.search(new RegExp('\\b' + command.replace('.', '\\.') +
// '\\b', 'i'))`: returns the UTF-16 col of the first word-boundary occurrence
// of `command` (case-insensitive). `command` may contain dots like `G04.1`
// which were escaped in JS before searching; we treat the literal string.
fn find_keyword_col(chars: &[char], keyword: &str) -> Option<usize> {
    let kw: Vec<char> = keyword.chars().collect();
    let len = chars.len();
    let mut index = 0;
    while index + kw.len() <= len {
        let before_ok = index == 0 || !is_identifier_character(chars[index - 1]);
        let after_end = index + kw.len();
        let after_ok = after_end == len || !is_identifier_character(chars[after_end]);
        if before_ok && after_ok && matches_keyword(chars, index, &kw) {
            return Some(utf16_prefix_len(chars, index));
        }
        index += 1;
    }
    None
}

// Mirror of `clean.search(/\bSKIP\b/i)` for the SKIP marker used by the
// STITCHON forbidden-movement rule.
fn find_skip_col(chars: &[char]) -> Option<usize> {
    let kw: Vec<char> = "SKIP".chars().collect();
    let len = chars.len();
    let mut index = 0;
    while index + kw.len() <= len {
        let before_ok = index == 0 || !is_identifier_character(chars[index - 1]);
        let after_end = index + kw.len();
        let after_ok = after_end == len || !is_identifier_character(chars[after_end]);
        if before_ok && after_ok && matches_keyword(chars, index, &kw) {
            return Some(utf16_prefix_len(chars, index));
        }
        index += 1;
    }
    None
}

fn is_m_code(command: &str) -> bool {
    // Mirror of `^M\d+$`.
    let bytes = command.as_bytes();
    if bytes.len() < 2 || !bytes[0].eq_ignore_ascii_case(&b'M') {
        return false;
    }
    bytes[1..].iter().all(|b| b.is_ascii_digit())
}

// Push RANGE_FORBIDDEN_COMMAND with appropriate severity / location.
fn push_range_forbidden(
    diagnostics: &mut Vec<Diagnostic>,
    line: usize,
    col: usize,
    end_col: usize,
    severity: Severity,
    message: impl Into<String>,
) {
    push_diagnostic(
        diagnostics,
        line,
        col,
        end_col,
        severity,
        "SYNTEC_ROBOT_RANGE_FORBIDDEN_COMMAND",
        message,
    );
}

// Mirror of `validateRobotLineState` (`src/robotValidator.js`): MOVC pair
// tracking, SWAITSIG/SYNCOUT counters, and the STITCHON/WEAVEON/WAITSYNC/G192
// 生效范围禁忌规则组。
fn validate_robot_line_state(
    state: &mut RobotLineState,
    clean: &str,
    command: Option<&str>,
    line: usize,
    in_conditional_branch: bool,
    diagnostics: &mut Vec<Diagnostic>,
) {
    let Some(command) = command else {
        return;
    };
    let chars: Vec<char> = clean.chars().collect();
    let clean_end = utf16_prefix_len(&chars, chars.len());

    // If a pending MOVC was left open and the new line is a non-MOVC movement,
    // emit the pair error immediately and clear the pending marker.
    if state.pending_movc_line > 0 && command != "MOVC" && is_movement_command(command) {
        add_pending_movc_diagnostic(diagnostics, state.pending_movc_line);
        state.pending_movc_line = 0;
    }

    // A new unpaired MOVC (not single-line X1/X2 syntax, not in a conditional
    // branch) toggles the pending marker.
    if command == "MOVC" && !in_conditional_branch && !is_single_line_movc(clean) {
        state.pending_movc_line = if state.pending_movc_line > 0 { 0 } else { line };
    }

    if is_movement_command(command) {
        state.current_movement_line = line;
        state.swaitsig_count = 0;
        state.syncout_count = 0;
    }

    if command == "WAIT" {
        state.current_movement_line = 0;
        state.swaitsig_count = 0;
        state.syncout_count = 0;
    }

    if command == "SWAITSIG" && state.current_movement_line > 0 {
        state.swaitsig_count += 1;
        if state.swaitsig_count > 1 {
            let col = find_keyword_col(&chars, "SWAITSIG").unwrap_or(0);
            push_diagnostic(
                diagnostics,
                line,
                col,
                clean_end,
                Severity::Error,
                "SYNTEC_ROBOT_SWAITSIG_LIMIT",
                "运动单节后只能下 1 个 SWAITSIG；多个条件请用 WAIT() 隔开或改用 G4.16",
            );
        }
    }

    if command == "SYNCOUT" && state.current_movement_line > 0 {
        state.syncout_count += 1;
        if state.syncout_count > 10 {
            let col = find_keyword_col(&chars, "SYNCOUT").unwrap_or(0);
            push_diagnostic(
                diagnostics,
                line,
                col,
                clean_end,
                Severity::Error,
                "SYNTEC_ROBOT_SYNCOUT_LIMIT",
                "同一有移动量移动单节最多允许 10 个 SYNCOUT",
            );
        }
    }

    // STITCHON 生效范围禁忌
    if state.in_stitch_on && command != "STITCHOFF" {
        let stitch_forbidden_letter = [
            "MOVJ", "USERCOR", "SHIFTON", "SHIFTOFF", "OBJCORON", "OBJCOROFF",
            "OBJCORCLEAR", "SYNCOUT", "WEAVEON", "WEAVEOFF", "WAITSYNC", "ENDSYNC",
        ];
        let move_skip = matches!(command, "MOVL" | "MOVC" | "INCMOVL") && find_skip_col(&chars).is_some();
        if stitch_forbidden_letter.contains(&command) || move_skip {
            let col = find_keyword_col(&chars, command).unwrap_or(0);
            push_range_forbidden(
                diagnostics,
                line,
                col,
                clean_end,
                Severity::Error,
                "STITCHON 生效范围内不支持此指令",
            );
        } else if command == "M96" {
            let col = find_keyword_col(&chars, "M96").unwrap_or(0);
            push_range_forbidden(
                diagnostics,
                line,
                col,
                clean_end,
                Severity::Warning,
                "STITCHON 生效范围内 M96 中断型副程序触发无效",
            );
        }
    }

    // WEAVEON 生效范围禁忌
    if state.in_weave_on && command != "WEAVEOFF" {
        let weave_forbidden = ["MOVJ", "STITCHON", "STITCHOFF", "WAITSYNC", "ENDSYNC"];
        if weave_forbidden.contains(&command) {
            let col = find_keyword_col(&chars, command).unwrap_or(0);
            push_range_forbidden(
                diagnostics,
                line,
                col,
                clean_end,
                Severity::Error,
                "WEAVEON 生效范围内不支持此指令",
            );
        } else if command == "M96" {
            let col = find_keyword_col(&chars, "M96").unwrap_or(0);
            push_range_forbidden(
                diagnostics,
                line,
                col,
                clean_end,
                Severity::Warning,
                "WEAVEON 生效范围内 M96 中断型副程序触发无效",
            );
        }
    }

    // WAITSYNC 生效范围禁忌
    if state.in_wait_sync && command != "ENDSYNC" {
        let wait_sync_forbidden = ["MOVJ", "USERCOR", "G04.1", "SHIFTON"];
        if wait_sync_forbidden.contains(&command) || is_m_code(command) {
            let col = find_keyword_col(&chars, command).unwrap_or(0);
            push_range_forbidden(
                diagnostics,
                line,
                col,
                clean_end,
                Severity::Error,
                "WAITSYNC 生效范围内不支持此指令",
            );
        }
    }

    // G192.1 末端跟踪生效范围禁忌
    if state.in_g192 && command != "G192.2" {
        let g192_forbidden = [
            "MOVJ", "INCMOVJ", "MOVC", "SWAITSIG", "SYNCOUT", "WEAVEON", "WEAVEOFF",
            "WAITSYNC", "ENDSYNC",
        ];
        if g192_forbidden.contains(&command) {
            let col = find_keyword_col(&chars, command).unwrap_or(0);
            push_range_forbidden(
                diagnostics,
                line,
                col,
                clean_end,
                Severity::Error,
                "G192.1 末端跟踪生效范围内不支持此指令",
            );
        }
    }

    // STITCHON/WEAVEON 互斥：在对方生效范围内静默忽略开启指令
    if command == "STITCHON" {
        if !state.in_weave_on {
            state.in_stitch_on = true;
        }
    } else if command == "STITCHOFF" {
        state.in_stitch_on = false;
    }

    if command == "WEAVEON" {
        if !state.in_stitch_on {
            state.in_weave_on = true;
        }
    } else if command == "WEAVEOFF" {
        state.in_weave_on = false;
    }

    if command == "WAITSYNC" {
        state.in_wait_sync = true;
    } else if command == "ENDSYNC" {
        state.in_wait_sync = false;
    }

    if command == "G192.1" {
        state.in_g192 = true;
    } else if command == "G192.2" {
        state.in_g192 = false;
    }
}

fn count_smooth_args(chars: &[char]) -> usize {
    ["PL", "PQ", "PR"]
        .iter()
        .filter(|arg| has_direct_arg(chars, &arg.chars().collect::<Vec<_>>()))
        .count()
}

// Modbus-TCP constant boundary. Mirrors `src/robotValidator.js`.
const MODBUS_R_MIN: f64 = 0.0;
const MODBUS_R_MAX: f64 = 65535.0;
const MODBUS_WRITE_VALUE_MAX: f64 = 65535.0;
const MODBUS_CUSTOM_DATA_MAX: f64 = 254.0;

// Mirror of `getModbusLine`: `^\s*G10\s+(L1900|L1901)\b` (case-insensitive).
// Returns `(code, col, end_col)` aligned to UTF-16 character counts.
fn get_modbus_line(chars: &[char]) -> Option<(String, usize, usize)> {
    let mut start = 0;
    while start < chars.len() && chars[start].is_whitespace() {
        start += 1;
    }
    // `G10`
    let g10: Vec<char> = "G10".chars().collect();
    if start + g10.len() > chars.len() || !matches_keyword(chars, start, &g10) {
        return None;
    }
    let mut cursor = start + g10.len();
    // Required whitespace boundary (matched `\s+` in JS regex).
    if cursor >= chars.len() || !chars[cursor].is_whitespace() {
        return None;
    }
    while cursor < chars.len() && chars[cursor].is_whitespace() {
        cursor += 1;
    }
    // `L1900` or `L1901`.
    for code in ["L1900", "L1901"] {
        let code_chars: Vec<char> = code.chars().collect();
        if matches_keyword(chars, cursor, &code_chars)
            && (cursor + code_chars.len() == chars.len()
                || !is_identifier_character(chars[cursor + code_chars.len()]))
        {
            let col = utf16_prefix_len(chars, start);
            let end_col = utf16_prefix_len(chars, cursor + code_chars.len());
            return Some((code.to_string(), col, end_col));
        }
    }
    None
}

fn add_robot_diagnostic(
    diagnostics: &mut Vec<Diagnostic>,
    line: usize,
    col: usize,
    end_col: usize,
    severity: Severity,
    code: &str,
    message: impl Into<String>,
) {
    push_diagnostic(diagnostics, line, col, end_col, severity, code, message);
}

// Collects the 8 Modbus args (`C/I/A/Q/K/X/P/R`) as a Vec, preserving the JS
// argument map insertion order so iteration diagonal RW/RANGE statements
// appear in source order.
fn collect_modbus_args(chars: &[char]) -> Vec<(char, Option<(f64, String, usize, usize)>)> {
    ['I', 'A', 'Q', 'K', 'X', 'P', 'R', 'C']
        .into_iter()
        .map(|letter| {
            let arg: Vec<char> = std::iter::once(letter).collect();
            (letter, get_static_direct_arg(chars, &arg))
        })
        .collect()
}

// Mirror of `validateG10ModbusArguments` in `src/robotValidator.js`. Emits the
// same diagnostic sequence under the same ordering (INTEGER -> FORMAT ->
// RANGE) using the JS col fallback: arg diagnostics without a concrete arg
// span fall back to the `L1900`/`L1901` col..cleanLine length (UTF-16).
fn join_letters(letters: &[char], separator: &str) -> String {
    letters
        .iter()
        .map(|c| c.to_string())
        .collect::<Vec<_>>()
        .join(separator)
}

fn validate_g10_modbus_arguments(chars: &[char], line: usize, diagnostics: &mut Vec<Diagnostic>) {
    let Some((code, modbus_col, _modbus_end)) = get_modbus_line(chars) else {
        return;
    };
    let clean_length = utf16_prefix_len(chars, chars.len());

    // Inlined helpers mirroring `addFormat` / `addArgDiagnostic` (without
    // closure borrow of `diagnostics`, to keep mutable access straight).
    let add_format = |diagnostics: &mut Vec<Diagnostic>, message: String| {
        add_robot_diagnostic(
            diagnostics,
            line,
            modbus_col,
            clean_length,
            Severity::Error,
            "SYNTEC_ROBOT_G10_MODBUS_FORMAT",
            message,
        );
    };
    let add_arg = |diagnostics: &mut Vec<Diagnostic>, letter: char, message: String, code: &str| {
        let arg: Vec<char> = std::iter::once(letter).collect();
        if let Some((_value, _literal, col, end_col)) = get_static_direct_arg(chars, &arg) {
            add_robot_diagnostic(diagnostics, line, col, end_col, Severity::Error, code, message);
        } else {
            add_robot_diagnostic(diagnostics, line, modbus_col, clean_length, Severity::Error, code, message);
        }
    };

    // JS iterates over `args` (a Map of present args only); we replicate that
    // order by emitting INTEGER for each present arg in declaration order.
    let args = collect_modbus_args(chars);

    // === INTEGER check: any arg with `.` in literal or non-safe-int value. ===
    for (letter, arg) in &args {
        let Some((value, literal, _col, _end)) = arg else { continue };
        if literal.contains('.') || !is_safe_integer(*value) {
            add_arg(
                diagnostics,
                *letter,
                format!("G10 {code} 的 {letter} 引数必须为十进制整数"),
                "SYNTEC_ROBOT_G10_MODBUS_INTEGER",
            );
        }
    }

    let c_arg = args
        .iter()
        .find(|(letter, _)| *letter == 'C')
        .and_then(|(_, arg)| arg.clone());

    if code == "L1900" {
        let has_c = c_arg.is_some();
        if !has_c {
            add_format(diagnostics, "G10 L1900 缺少 C 引数；读取使用 C3，写入使用 C6。".to_string());
        } else if let Some((c_value, _c_literal, _c_col, _c_end)) = &c_arg {
            if is_safe_integer(*c_value) && !matches!(*c_value as i64, 3 | 6) {
                add_arg(
                    diagnostics,
                    'C',
                    "G10 L1900 的 C 引数只能为 3（读取）或 6（写入）".to_string(),
                    "SYNTEC_ROBOT_G10_MODBUS_FORMAT",
                );
            }
        }

        if let Some((c_value, _c_literal, _c_col, _c_end)) = &c_arg {
            if is_safe_integer(*c_value) && *c_value as i64 == 3 {
                let missing: Vec<char> = ['I', 'A', 'Q', 'K']
                    .into_iter()
                    .filter(|letter| !has_direct_arg(chars, &std::iter::once(*letter).collect::<Vec<_>>()))
                    .collect();
                if !missing.is_empty() {
                    add_format(diagnostics, format!("G10 L1900 C3 缺少引数：{}", join_letters(&missing, "/")));
                }
                if has_direct_arg(chars, &"X".chars().collect::<Vec<_>>()) {
                    add_format(diagnostics, "G10 L1900 C3 读取语法不支持 X 引数".to_string());
                }
            } else if is_safe_integer(*c_value) && *c_value as i64 == 6 {
                let missing: Vec<char> = ['I', 'A', 'X']
                    .into_iter()
                    .filter(|letter| !has_direct_arg(chars, &std::iter::once(*letter).collect::<Vec<_>>()))
                    .collect();
                if !missing.is_empty() {
                    add_format(diagnostics, format!("G10 L1900 C6 缺少引数：{}", join_letters(&missing, "/")));
                }
                let unsupported: Vec<char> = ['Q', 'K']
                    .into_iter()
                    .filter(|letter| has_direct_arg(chars, &std::iter::once(*letter).collect::<Vec<_>>()))
                    .collect();
                if !unsupported.is_empty() {
                    add_format(diagnostics, format!("G10 L1900 C6 写入语法不支持 {} 引数", join_letters(&unsupported, "/")));
                }
            }
        }
    } else {
        // L1901 自定义封包
        let missing: Vec<char> = ['P', 'R', 'Q']
            .into_iter()
            .filter(|letter| !has_direct_arg(chars, &std::iter::once(*letter).collect::<Vec<_>>()))
            .collect();
        if !missing.is_empty() {
            add_format(diagnostics, format!("G10 L1901 缺少引数：{}", join_letters(&missing, "/")));
        }
        let unsupported: Vec<char> = ['C', 'I', 'A', 'X']
            .into_iter()
            .filter(|letter| has_direct_arg(chars, &std::iter::once(*letter).collect::<Vec<_>>()))
            .collect();
        if !unsupported.is_empty() {
            add_format(diagnostics, format!("G10 L1901 自定义封包语法不支持 {} 引数", join_letters(&unsupported, "/")));
        }
    }

    // === RANGE check: negative, X range, P/Q R-value range, R custom count. ===
    for (letter, arg) in &args {
        let Some((value, _literal, _col, _end)) = arg else { continue };
        if *value < 0.0 {
            add_arg(
                diagnostics,
                *letter,
                format!("G10 {code} 的 {letter} 引数不可为负数"),
                "SYNTEC_ROBOT_G10_MODBUS_RANGE",
            );
        }
    }

    // X range
    if let Some((x_value, _x_literal, _x_col, _x_end)) = args
        .iter()
        .find(|(letter, _)| *letter == 'X')
        .and_then(|(_, arg)| arg.clone())
    {
        if is_safe_integer(x_value) && (x_value < 0.0 || x_value > MODBUS_WRITE_VALUE_MAX) {
            add_arg(
                diagnostics,
                'X',
                format!("G10 {code} 的 X 写入值范围为 0~{}", MODBUS_WRITE_VALUE_MAX as i64),
                "SYNTEC_ROBOT_G10_MODBUS_RANGE",
            );
        }
    }

    // P/Q R 值编号范围
    for letter in ['P', 'Q'] {
        let Some((value, _literal, _col, _end)) = args
            .iter()
            .find(|(l, _)| *l == letter)
            .and_then(|(_, arg)| arg.clone())
        else {
            continue;
        };
        if is_safe_integer(value) && (value < MODBUS_R_MIN || value > MODBUS_R_MAX) {
            add_arg(
                diagnostics,
                letter,
                format!("G10 {code} 的 {letter} R 值编号范围为 {}~{}", MODBUS_R_MIN as i64, MODBUS_R_MAX as i64),
                "SYNTEC_ROBOT_G10_MODBUS_RANGE",
            );
        }
    }

    // R 自定义资料数量
    if let Some((r_count, _literal, _col, _end)) = args
        .iter()
        .find(|(letter, _)| *letter == 'R')
        .and_then(|(_, arg)| arg.clone())
    {
        if is_safe_integer(r_count) && (r_count < 0.0 || r_count > MODBUS_CUSTOM_DATA_MAX) {
            add_arg(
                diagnostics,
                'R',
                format!("G10 {code} 的 R 自定义资料数量范围为 0~{}", MODBUS_CUSTOM_DATA_MAX as i64),
                "SYNTEC_ROBOT_G10_MODBUS_RANGE",
            );
        }
    }
}

// `Number.isSafeInteger` mirror: must be a finite, within i53 range, with zero
// fractional part. Used for Modbus 整数判定.
fn is_safe_integer(value: f64) -> bool {
    value.is_finite()
        && value.fract() == 0.0
        && value.abs() <= 9_007_199_254_740_991.0
}


// Mirror of `validateRobotSyntaxPreferences` (movement/coordinate subset).
// Order matches JS: MOVJ-II -> MOVC point (early return) -> direct-arg-equals
// (deferred to ROBOT-MOV-B) -> TOOLCOR rules -> coordinate-forbidden syntax.
fn validate_robot_syntax_preferences(clean: &str, line: usize, diagnostics: &mut Vec<Diagnostic>) {
    let trimmed = clean.trim();
    if trimmed.is_empty() {
        return;
    }
    let chars: Vec<char> = clean.chars().collect();
    let command = get_command(clean);

    // MOVJ-II deprecated spelling.
    let movj_ii: Vec<char> = "MOVJ-II".chars().collect();
    let mut index = 0;
    while index + movj_ii.len() <= chars.len() {
        if matches_keyword(&chars, index, &movj_ii)
            && (index == 0 || !is_identifier_character(chars[index - 1]))
            && (index + movj_ii.len() == chars.len()
                || !is_identifier_character(chars[index + movj_ii.len()]))
        {
            let col = utf16_prefix_len(&chars, index);
            push_diagnostic(
                diagnostics,
                line,
                col,
                col + movj_ii.len(),
                Severity::Error,
                "SYNTEC_ROBOT_DEPRECATED_MOVJ_II",
                "MOVJ-II 不是正式指令写法；请使用 MOVJ 第二语法",
            );
            break;
        }
        index += 1;
    }

    // MOVC Xp/Yp/Zp= through-point syntax (early return, matching JS).
    if command.as_deref() == Some("MOVC") {
        let point_args: [&[char]; 3] = [
            &"XP".chars().collect::<Vec<_>>(),
            &"YP".chars().collect::<Vec<_>>(),
            &"ZP".chars().collect::<Vec<_>>(),
        ];
        let mut found: Option<(usize, usize)> = None;
        let mut index = 0;
        while index < chars.len() && found.is_none() {
            if index == 0 || !is_identifier_character(chars[index - 1]) {
                for arg in point_args.iter() {
                    if matches_keyword(&chars, index, arg) {
                        let after = index + arg.len();
                        let mut scan = after;
                        while scan < chars.len() && chars[scan].is_whitespace() {
                            scan += 1;
                        }
                        if scan < chars.len() && chars[scan] == '=' {
                            found = Some((index, after));
                            break;
                        }
                    }
                }
            }
            index += 1;
        }
        if let Some((start, after_arg)) = found {
            let col = utf16_prefix_len(&chars, start);
            let end_col = utf16_prefix_len(&chars, after_arg);
            push_diagnostic(
                diagnostics,
                line,
                col,
                end_col,
                Severity::Error,
                "SYNTEC_ROBOT_UNSUPPORTED_MOVC_POINT_ARG",
                "MOVC 不支持 Xp/Yp/Zp 通过点写法；请使用成对 MOVC 的 X/Y/Z/A/B/C 直接引数",
            );
            return;
        }
    }

    // Direct-arg equals (`X=5.` etc.): mirrors `findDirectArgEquals` in JS.
    if let Some((_arg_start, _arg_len, equals_index)) = find_direct_arg_equals(&chars, direct_arg_rules_for(command.as_deref())) {
        let col = utf16_prefix_len(&chars, equals_index);
        push_diagnostic(
            diagnostics,
            line,
            col,
            col + 1,
            Severity::Error,
            "SYNTEC_ROBOT_DIRECT_ARG_EQUALS",
            direct_arg_rule_message(command.as_deref()).unwrap_or("直接引数不使用 ="),
        );
    }

    // TOOLCOR/TOOLCORON rules (already implemented; preserves JS ordering).
    validate_robot_toolcor(clean, line, diagnostics);

    // Coordinate commands reject CNC feed, G codes, axis assignments and robot
    // movement keywords mixed into the remainder.
    let coordinate = matches!(command.as_deref(), Some("USERCOR") | Some("TOOLCOR") | Some("G68.18"));
    if coordinate {
        let remainder = trimmed.trim_start_matches(|c: char| !c.is_whitespace());
        let remainder = remainder.trim_start();
        if let Some((text, rel_start)) = find_coordinate_forbidden(remainder) {
            let abs_start = chars.len() - remainder.chars().count() + rel_start;
            let _ = abs_start;
            let needle: Vec<char> = text.chars().collect();
            let col = chars
                .windows(needle.len())
                .position(|w| w.iter().eq(needle.iter()))
                .map(|p| utf16_prefix_len(&chars, p))
                .unwrap_or(0);
            let end_col = col + needle.iter().map(|c| c.len_utf16()).sum::<usize>();
            let message = match text.as_str() {
                t if t.starts_with('F') || t.starts_with('f') => {
                    format!("{} 不可使用 CNC 或机器人进给引数 F/FJ/FL", command.unwrap())
                }
                t if t.starts_with('G') || t.starts_with('g') => {
                    format!("{} 不可在语法中插入 G 码", command.unwrap())
                }
                t if t.starts_with('A') || t.starts_with('B') || t.starts_with('C') => {
                    format!("{} 不接受轴向命令", command.unwrap())
                }
                _ => format!("{} 不可与机器人移动语言混用", command.unwrap()),
            };
            push_diagnostic(
                diagnostics,
                line,
                col,
                end_col,
                Severity::Error,
                "SYNTEC_ROBOT_UNSUPPORTED_COORDINATE_SYNTAX",
                message,
            );
        }
    }
}

// Scan the remainder of a coordinate command for the first forbidden token.
// Mirrors the four regexes in `validateRobotSyntaxPreferences`:
//   \bF(?:J|L)?\s*(?=[#@+\-]?(?:\d|\.|\(|#|@))   (feed)
//   \bG\d+(?:\.\d+)?\b                           (G code)
//   \b(?:A|B|C)\d+\s*=                            (axis assignment)
//   \b(?:MOVJ|MOVL|MOVC|INCMOVJ|INCMOVL)\b        (robot movement)
// Returns the matched text (as-is, including trailing \s* for feed) and its
// start offset within `remainder`.
fn find_coordinate_forbidden(remainder: &str) -> Option<(String, usize)> {
    let chars: Vec<char> = remainder.chars().collect();
    let len = chars.len();
    let mut best: Option<(usize, String, usize)> = None; // (start, text, end)
    let mut consider = |start: usize, text: String, end: usize| {
        if best.is_none() || start < best.as_ref().unwrap().0 {
            best = Some((start, text, end));
        }
    };
    let mut index = 0;
    while index < len {
        let boundary = index == 0 || !is_identifier_character(chars[index - 1]);
        let lower = chars[index].to_ascii_lowercase();
        if boundary && (lower == 'f' || lower == 'g' || lower == 'a' || lower == 'b' || lower == 'c')
        {
            // Feed: F(J|L)? followed by optional [#@+-] then digit/dot/(/#/ @.
            if lower == 'f' {
                let mut end = index + 1;
                if end < len
                    && (chars[end].eq_ignore_ascii_case(&'J') || chars[end].eq_ignore_ascii_case(&'L'))
                {
                    end += 1;
                }
                let mut lookahead = end;
                while lookahead < len && chars[lookahead].is_whitespace() {
                    lookahead += 1;
                }
                let mut after = lookahead;
                if after < len && matches!(chars[after], '#' | '@' | '+' | '-') {
                    after += 1;
                }
                if after < len
                    && (chars[after].is_ascii_digit()
                        || chars[after] == '.'
                        || chars[after] == '('
                        || chars[after] == '#'
                        || chars[after] == '@')
                {
                    let text: String = chars[index..lookahead].iter().collect();
                    consider(index, text, lookahead);
                }
            }
            // G code: G\d+(\.\d+)? followed by word boundary.
            if lower == 'g' {
                let mut end = index + 1;
                let digits_start = end;
                while end < len && chars[end].is_ascii_digit() {
                    end += 1;
                }
                if end > digits_start {
                    if end < len && chars[end] == '.' {
                        let frac = end + 1;
                        let mut f = frac;
                        while f < len && chars[f].is_ascii_digit() {
                            f += 1;
                        }
                        if f > frac {
                            end = f;
                        }
                    }
                    if end == len || !is_identifier_character(chars[end]) {
                        let text: String = chars[index..end].iter().collect();
                        consider(index, text, end);
                    }
                }
            }
            // Axis assignment: A|B|C \d+ \s* =.
            if lower == 'a' || lower == 'b' || lower == 'c' {
                let mut end = index + 1;
                while end < len && chars[end].is_ascii_digit() {
                    end += 1;
                }
                if end > index + 1 {
                    let mut scan = end;
                    while scan < len && chars[scan].is_whitespace() {
                        scan += 1;
                    }
                    if scan < len && chars[scan] == '=' {
                        let text: String = chars[index..scan].iter().collect();
                        consider(index, text, scan);
                    }
                }
            }
        }
        if boundary {
            for kw in ["MOVJ", "MOVL", "MOVC", "INCMOVJ", "INCMOVL"] {
                let kw_chars: Vec<char> = kw.chars().collect();
                if matches_keyword(&chars, index, &kw_chars)
                    && (index + kw_chars.len() == len
                        || !is_identifier_character(chars[index + kw_chars.len()]))
                {
                    let text: String = chars[index..index + kw_chars.len()].iter().collect();
                    consider(index, text, index + kw_chars.len());
                }
            }
        }
        index += 1;
    }
    best.map(|(start, text, _)| (text, start))
}

// Mirror of `validateConfirmedSingleLineSyntax` (movement subset; STITCHON/WEAVEON
// state rules are deferred to later batches).
fn validate_robot_confirmed_single_line(clean: &str, line: usize, diagnostics: &mut Vec<Diagnostic>) {
    let trimmed = clean.trim();
    if trimmed.is_empty() {
        return;
    }
    let chars: Vec<char> = clean.chars().collect();
    let Some(command) = get_command(clean) else {
        return;
    };

    // Static argument ranges (motion + WEAVEON + per-command direct ranges +
    // signal Q 联动). Mirrors `validateStaticArgumentRanges` invocation at the
    // top of `validateConfirmedSingleLineSyntax`.
    validate_static_argument_ranges(clean, line, diagnostics);

    // G10 L1900/L1901 Modbus-TCP static argument validation. Mirrors
    // `validateG10ModbusArguments` in `src/robotValidator.js`; preserves JS
    // ordering (INTEGER -> FORMAT -> RANGE) and JS col fallback rules.
    validate_g10_modbus_arguments(&chars, line, diagnostics);

    // Smooth argument conflict: MOVL/MOVC/INCMOVL with more than one of PL/PQ/PR.
    if matches!(command.as_str(), "MOVL" | "MOVC" | "INCMOVL") && count_smooth_args(&chars) > 1 {
        let col = find_first_smooth_arg(&chars).map(|p| utf16_prefix_len(&chars, p)).unwrap_or(0);
        let end_col = utf16_prefix_len(&chars, chars.len());
        push_diagnostic(
            diagnostics,
            line,
            col,
            end_col,
            Severity::Error,
            "SYNTEC_ROBOT_SMOOTH_ARG_CONFLICT",
            format!("{command} 单行只能使用 PL/PQ/PR 其中一个平滑引数"),
        );
    }

    // MOVJ/INCMOVJ do not support PQ/PR.
    if matches!(command.as_str(), "MOVJ" | "INCMOVJ")
        && (has_direct_arg(&chars, &"PQ".chars().collect::<Vec<_>>())
            || has_direct_arg(&chars, &"PR".chars().collect::<Vec<_>>()))
    {
        let col = find_first_smooth_arg(&chars).map(|p| utf16_prefix_len(&chars, p)).unwrap_or(0);
        let end_col = utf16_prefix_len(&chars, chars.len());
        push_diagnostic(
            diagnostics,
            line,
            col,
            end_col,
            Severity::Error,
            "SYNTEC_ROBOT_UNSUPPORTED_SMOOTH_ARG",
            format!("{command} 不支持 PQ/PR；请使用 PL"),
        );
    }

    // MOVJ first syntax does not accept P without X.
    if command == "MOVJ"
        && has_direct_arg(&chars, &"P".chars().collect::<Vec<_>>())
        && !has_direct_arg(&chars, &"X".chars().collect::<Vec<_>>())
    {
        let col = chars
            .iter()
            .position(|c| c.eq_ignore_ascii_case(&'P'))
            .map(|p| utf16_prefix_len(&chars, p))
            .unwrap_or(0);
        let end_col = utf16_prefix_len(&chars, chars.len());
        push_diagnostic(
            diagnostics,
            line,
            col,
            end_col,
            Severity::Error,
            "SYNTEC_ROBOT_UNSUPPORTED_MOVJ_P_ARG",
            "MOVJ 第一语法不支持 P 引数",
        );
    }

    // INCMOVL requires P.
    if command == "INCMOVL"
        && !has_direct_arg(&chars, &"P".chars().collect::<Vec<_>>())
    {
        let kw: Vec<char> = "INCMOVL".chars().collect();
        let col = chars
            .windows(kw.len())
            .position(|w| w.iter().eq(kw.iter()))
            .map(|p| utf16_prefix_len(&chars, p))
            .unwrap_or(0);
        push_diagnostic(
            diagnostics,
            line,
            col,
            col + kw.len(),
            Severity::Error,
            "SYNTEC_ROBOT_MISSING_REQUIRED_ARG",
            "INCMOVL 缺少必填 P 引数",
        );
    }

    // === ROBOT-STITCH-WEAVE batch ===

    // STITCHON L/K conflict/missing, and L integer check.
    if command == "STITCHON" {
        let l_arg: Vec<char> = "L".chars().collect();
        let k_arg: Vec<char> = "K".chars().collect();
        let has_l = has_direct_arg(&chars, &l_arg);
        let has_k = has_direct_arg(&chars, &k_arg);
        let stitch_kw: Vec<char> = "STITCHON".chars().collect();
        let stitch_kw_len = stitch_kw.len();
        let stitch_col = chars
            .windows(stitch_kw_len)
            .position(|w| w.iter().eq(stitch_kw.iter()))
            .map(|p| utf16_prefix_len(&chars, p))
            .unwrap_or(0);
        let stitch_end = utf16_prefix_len(&chars, chars.len());
        // JS: `clean.search(/\b(?:L|K)/i)` = earliest L/K preceded by a
        // word boundary; otherwise fall back to the `STITCHON` keyword col.
        let mut lk_col: Option<usize> = None;
        let mut index = 0;
        while index < chars.len() {
            let is_start = index == 0 || !is_identifier_character(chars[index - 1]);
            if is_start && (chars[index].eq_ignore_ascii_case(&'L') || chars[index].eq_ignore_ascii_case(&'K')) {
                // JS regex `\b(?:L|K)` matches a single letter at a word
                // boundary; only the preceding char matters, the trailing
                // char may extend the identifier (e.g. `LX` still positions
                // on the leading `L`).
                lk_col = Some(utf16_prefix_len(&chars, index));
                break;
            }
            index += 1;
        }
        let col = lk_col.unwrap_or(stitch_col);
        if has_l && has_k {
            push_diagnostic(
                diagnostics,
                line,
                col,
                stitch_end,
                Severity::Error,
                "SYNTEC_ROBOT_STITCH_ARG_CONFLICT",
                "STITCHON 的 L/K 只能择一输入",
            );
        } else if !has_l && !has_k {
            push_diagnostic(
                diagnostics,
                line,
                stitch_col,
                stitch_end,
                Severity::Warning,
                "SYNTEC_ROBOT_STITCH_MISSING_ARG",
                "STITCHON 需指定 L 或 K 其中一个",
            );
        }

        // STITCHON 的 L 不可带小数点 (JS: `getStaticDirectArgNumber('L') !== null
        // && !Number.isInteger(value)`).
        if let Some((l_value, _l_literal, _l_col, _l_end)) = get_static_direct_arg(&chars, &l_arg) {
            if l_value.is_finite() && l_value.fract() != 0.0 {
                push_diagnostic(
                    diagnostics,
                    line,
                    col,
                    stitch_end,
                    Severity::Error,
                    "SYNTEC_ROBOT_STITCH_L_INTEGER",
                    "STITCHON 的 L 引数不可带小数点",
                );
            }
        }
    }

    // WEAVEON P/E/Q/K/L/R/I mixing and Q decimal form warning.
    if command == "WEAVEON" {
        let p_arg: Vec<char> = "P".chars().collect();
        let has_p = has_direct_arg(&chars, &p_arg);
        let detail_args: [&[char]; 6] = [
            &"E".chars().collect::<Vec<_>>(),
            &"Q".chars().collect::<Vec<_>>(),
            &"K".chars().collect::<Vec<_>>(),
            &"L".chars().collect::<Vec<_>>(),
            &"R".chars().collect::<Vec<_>>(),
            &"I".chars().collect::<Vec<_>>(),
        ];
        let detail_present = detail_args.iter().any(|arg| has_direct_arg(&chars, arg));
        let weave_kw: Vec<char> = "WEAVEON".chars().collect();
        let weave_kw_len = weave_kw.len();
        let weave_col = chars
            .windows(weave_kw_len)
            .position(|w| w.iter().eq(weave_kw.iter()))
            .map(|p| utf16_prefix_len(&chars, p))
            .unwrap_or(0);
        let weave_end = utf16_prefix_len(&chars, chars.len());
        if has_p && detail_present {
            push_diagnostic(
                diagnostics,
                line,
                weave_col,
                weave_end,
                Severity::Error,
                "SYNTEC_ROBOT_WEAVEON_MIXED_ARGS",
                "WEAVEON 的 P 语法不可与 E/Q/K/L/R/I 混用",
            );
        }

        // `WEAVEON 的 Q 频率建议使用小数形式`: JS regex `\bQ([+-]?\d+)(?!\.)` —
        // a literal Q with unsigned-or-signed digits that is NOT followed by `.`.
        let q_arg: Vec<char> = "Q".chars().collect();
        if !has_p {
            let mut index = 0;
            while index < chars.len() {
                let is_start = index == 0 || !is_identifier_character(chars[index - 1]);
                if is_start && matches_keyword(&chars, index, &q_arg) {
                    // The regex requires `\bQ` then optional sign then digits;
                    // a following identifier character (e.g. `QX`) still has
                    // the Q match but the inner `[+-]?\d+` will not match, so
                    // we fall through to scanning digits directly.
                    let mut cursor = index + q_arg.len();
                    if cursor < chars.len() && matches!(chars[cursor], '+' | '-') {
                        cursor += 1;
                    }
                    let digits_start = cursor;
                    while cursor < chars.len() && chars[cursor].is_ascii_digit() {
                        cursor += 1;
                    }
                    if cursor > digits_start {
                        // Only trigger when there is no `.` after the digits.
                        let followed_by_dot = cursor < chars.len() && chars[cursor] == '.';
                        if !followed_by_dot {
                            let col = utf16_prefix_len(&chars, index);
                            let end_col = utf16_prefix_len(&chars, cursor);
                            push_diagnostic(
                                diagnostics,
                                line,
                                col,
                                end_col,
                                Severity::Warning,
                                "SYNTEC_ROBOT_WEAVEON_Q_DECIMAL",
                                "WEAVEON 的 Q 频率建议使用小数形式，例如 Q1.0",
                            );
                        }
                    }
                }
                index += 1;
            }
        }
    }
}

fn find_first_smooth_arg(chars: &[char]) -> Option<usize> {
    for arg in ["PL", "PQ", "PR"] {
        let arg_chars: Vec<char> = arg.chars().collect();
        let mut index = 0;
        while index + arg_chars.len() <= chars.len() {
            if (index == 0 || !is_identifier_character(chars[index - 1]))
                && matches_keyword(chars, index, &arg_chars)
            {
                return Some(index);
            }
            index += 1;
        }
    }
    None
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
    let document = DocumentSnapshot {
        uri: String::new(),
        version: 0,
        language_id: "syntec-macro".to_string(),
        text: content.to_string(),
    };
    analyze_request(AnalysisRequest {
        protocol_version: PROTOCOL_VERSION,
        document,
        profile: "generic".to_string(),
    })
}

/// Parse a JSON-serialized `AnalysisRequest` and run the full analysis. Used by
/// the Wasm ABI (`syntec_core_analyze_request_json`) and CLI request mode to
/// enforce P0-B 真实 request 传输: protocol version, URI, version, languageId,
/// text, and profile are all required/validated on the Rust side rather than
/// having the adapter post-fill document/profile. Returns an error string when
/// the request is malformed (the caller Wasm ABI will surface it via an empty
/// pointer/length pair so adapters can take the explicit fallback path).
pub fn analyze_request_json(json: &str) -> Result<AnalysisResult, String> {
    parse_analysis_request(json).map(|request| analyze_request(request))
}

/// Parse a JSON-serialized `AnalysisRequest` and run the full analysis. Used by
/// the Wasm ABI (`syntec_core_analyze_request_json`) and CLI request mode to
/// enforce P0-B 真实 request 传输: protocol version, URI, version, languageId,
/// text, and profile are all required/validated on the Rust side rather than
/// having the adapter post-fill document/profile. Returns an error string when
/// the request is malformed (the caller Wasm ABI will surface it via an empty
/// pointer/length pair so adapters can take the explicit fallback path).
pub fn analyze_request_json(json: &str) -> Result<AnalysisResult, String> {
    parse_analysis_request(json).map(|request| analyze_request(request))
}

/// Minimal JSON parser for `AnalysisRequest`. Avoids pulling in `serde` to keep
/// the Wasm build footprint near 50 KB. Only implements the subset used by the
/// protocol: `protocolVersion` (optional when -1 or absent), `document.{uri,
/// version, languageId, text}`, and `profile`. Detects non-string / non-integer
/// / missing-required cases and surfaces a textual error mirroring JS
/// `normalizeAnalysisRequest` assertions.
pub fn parse_analysis_request(json: &str) -> Result<AnalysisRequest, String> {
    let trimmed = json.trim();
    if trimmed.is_empty() {
        return Err("analysis request must not be empty".to_string());
    }
    let root = JsonValue::parse(trimmed)?.as_object()?;
    let protocol_version = match root.get("protocolVersion") {
        None | Some(JsonValue::Null) => PROTOCOL_VERSION,
        Some(JsonValue::Number(value)) => {
            let n = value.parse::<u32>().map_err(|_| {
                format!("unsupported analysis protocol version: {value}")
            })?;
            if n != PROTOCOL_VERSION {
                return Err(format!("unsupported analysis protocol version: {n}"));
            }
            n
        }
        Some(other) => {
            return Err(format!("analysis request.protocolVersion must be a number, got {other:?}"))
        }
    };
    let document_value = root.get("document").ok_or_else(|| {
        "analysis request must contain a document snapshot".to_string()
    })?;
    let document = parse_document_snapshot(document_value)?;
    let profile = match root.get("profile") {
        None | Some(JsonValue::Null) => "generic".to_string(),
        Some(JsonValue::String(value)) => {
            if value.is_empty() {
                return Err("analysis request.profile must be a non-empty string".to_string());
            }
            value.clone()
        }
        Some(other) => return Err(format!("analysis request.profile must be a string, got {other:?}")),
    };
    Ok(AnalysisRequest { protocol_version, document, profile })
}

fn parse_document_snapshot(value: &JsonValue) -> Result<DocumentSnapshot, String> {
    let object = value.as_object()?;
    let uri = match object.get("uri") {
        Some(JsonValue::String(value)) => value.clone(),
        None => String::new(),
        Some(other) => return Err(format!("document.uri must be a string, got {other:?}")),
    };
    let version = match object.get("version") {
        None | Some(JsonValue::Null) => 0,
        Some(JsonValue::Number(value)) => value
            .parse::<u32>()
            .map_err(|_| format!("document.version must be a non-negative integer, got {value}"))?,
        Some(other) => return Err(format!("document.version must be a number, got {other:?}")),
    };
    let language_id = match object.get("languageId") {
        None | Some(JsonValue::Null) => "syntec-macro".to_string(),
        Some(JsonValue::String(value)) => value.clone(),
        Some(other) => return Err(format!("document.languageId must be a string, got {other:?}")),
    };
    if language_id.is_empty() {
        return Err("document.languageId must be a non-empty string".to_string());
    }
    let text = match object.get("text") {
        Some(JsonValue::String(value)) => value.clone(),
        None => return Err("document.text is required".to_string()),
        Some(other) => return Err(format!("document.text must be a string, got {other:?}")),
    };
    Ok(DocumentSnapshot { uri, version, language_id, text })
}

/// Trivial JSON value model used to validate AnalysisRequest without pulling
/// in serde. Only supports the subset our protocol uses:
/// object / array / string / number (lexed as a `String` to preserve precision
/// and reject non-finite literals) / null / true / false.
#[derive(Debug, Clone, PartialEq)]
enum JsonValue {
    Null,
    True,
    False,
    Number(String),
    String(String),
    Array(Vec<JsonValue>),
    Object(Vec<(String, JsonValue)>),
}

impl JsonValue {
    fn parse(input: &str) -> Result<JsonValue, String> {
        let mut chars = input.chars().peekable();
        parse_value(&mut chars)?;
        parse_value(&mut chars).map_err(|_| "expected a single JSON value".to_string()).and_then(|value| {
            skip_whitespace(&mut chars);
            if chars.peek().is_some() {
                Err("unexpected trailing content after JSON value".to_string())
            } else {
                Ok(value)
            }
        })
    }

    fn as_object(&self) -> Result<&Vec<(String, JsonValue)>, String> {
        match self {
            JsonValue::Object(entries) => Ok(entries),
            other => Err(format!("expected JSON object, got {other:?}")),
        }
    }
}

fn parse_value(chars: &mut std::iter::Peekable<std::str::Chars>) -> Result<JsonValue, String> {
    loop {
        skip_whitespace(chars);
        match chars.peek() {
            None => return Err("unexpected end of input".to_string()),
            Some('{') => return parse_object(chars),
            Some('[') => return parse_array(chars),
            Some('"') => return parse_string(chars).map(JsonValue::String),
            Some('t') => return parse_keyword(chars, "true", JsonValue::True).map(|_| JsonValue::True),
            Some('f') => return parse_keyword(chars, "false", JsonValue::False).map(|_| JsonValue::False),
            Some('n') => return parse_keyword(chars, "null", JsonValue::Null).map(|_| JsonValue::Null),
            Some(c) if c.is_ascii_digit() || *c == '-' => return parse_number(chars).map(JsonValue::Number),
            Some(other) => return Err(format!("unexpected character `{other}`")),
        }
    }
}

fn skip_whitespace(chars: &mut std::iter::Peekable<std::str::Chars>) {
    while let Some(c) = chars.peek() {
        if c.is_whitespace() {
            chars.next();
        } else {
            break;
        }
    }
}

fn parse_object(chars: &mut std::iter::Peekable<std::str::Chars>) -> Result<JsonValue, String> {
    chars.next(); // consume `{`
    let mut entries: Vec<(String, JsonValue)> = Vec::new();
    loop {
        skip_whitespace(chars);
        match chars.peek() {
            None => return Err("unterminated JSON object".to_string()),
            Some('}') => { chars.next(); break; }
            Some(',') => { chars.next(); continue; }
            Some('"') => {
                let key = parse_string(chars)?;
                skip_whitespace(chars);
                match chars.next() {
                    Some(':') => {}
                    Some(other) => return Err(format!("expected `:` after key, got `{other}`")),
                    None => return Err("expected `:` after key, got end of input".to_string()),
                }
                let value = parse_value(chars)?;
                entries.push((key, value));
            }
            Some(other) => return Err(format!("expected string key or `}}`, got `{other}`")),
        }
    }
    Ok(JsonValue::Object(entries))
}

fn parse_array(chars: &mut std::iter::Peekable<std::str::Chars>) -> Result<JsonValue, String> {
    chars.next(); // consume `[`
    let mut items: Vec<JsonValue> = Vec::new();
    loop {
        skip_whitespace(chars);
        match chars.peek() {
            None => return Err("unterminated JSON array".to_string()),
            Some(']') => { chars.next(); break; }
            Some(',') => { chars.next(); continue; }
            _ => {
                items.push(parse_value(chars)?);
            }
        }
    }
    Ok(JsonValue::Array(items))
}

fn parse_string(chars: &mut std::iter::Peekable<std::str::Chars>) -> Result<String, String> {
    if chars.next() != Some('"') {
        return Err("expected `\"` to start string".to_string());
    }
    let mut out = String::new();
    while let Some(c) = chars.next() {
        match c {
            '"' => return Ok(out),
            '\\' => {
                let escaped = chars.next().ok_or_else(|| "truncated escape sequence".to_string())?;
                match escaped {
                    '"' => out.push('"'),
                    '\\' => out.push('\\'),
                    '/' => out.push('/'),
                    'b' => out.push('\u{0008}'),
                    'f' => out.push('\u{000C}'),
                    'n' => out.push('\n'),
                    'r' => out.push('\r'),
                    't' => out.push('\t'),
                    'u' => {
                        let mut code_point = 0u32;
                        for _ in 0..4 {
                            let digit = chars.next().ok_or_else(|| "truncated unicode escape".to_string())?;
                            let value = digit.to_digit(16).ok_or_else(|| format!("invalid unicode escape digit: {digit}"))?;
                            code_point = (code_point << 4) | value;
                        }
                        if let Ok(character) = char::from_u32(code_point) {
                            out.push(character);
                        } else {
                            return Err(format!("invalid unicode code point: {code_point}"));
                        }
                    }
                    other => return Err(format!("invalid escape sequence `\\{other}`")),
                }
            }
            c if c.is_control() => return Err(format!("control character in string: {c:?}")),
            c => out.push(c),
        }
    }
    Err("unterminated string".to_string())
}

fn parse_number(chars: &mut std::iter::Peekable<std::str::Chars>) -> Result<String, String> {
    let mut literal = String::new();
    if chars.peek() == Some(&'-') {
        literal.push(chars.next().unwrap());
    }
    while let Some(&c) = chars.peek() {
        if c.is_ascii_digit() || c == '.' || c == 'e' || c == 'E' || c == '+' || c == '-' {
            literal.push(chars.next().unwrap());
        } else {
            break;
        }
    }
    if literal.is_empty() {
        return Err("expected number".to_string());
    }
    Ok(literal)
}

fn parse_keyword(
    chars: &mut std::iter::Peekable<std::str::Chars>,
    expected: &str,
    value: JsonValue,
) -> Result<JsonValue, String>
{
    for expected_char in expected.chars() {
        match chars.next() {
            Some(c) if c == expected_char => continue,
            Some(other) => return Err(format!("invalid JSON literal: expected `{expected}`, found `{other}`")),
            None => return Err(format!("truncated JSON literal: expected `{expected}`")),
        }
    }
    Ok(value)
}

/// Mirror of `createAnalysisRequest` validation + `analyzeDocument`/`analyzeNavigationDocument`
/// semantics: protocol version, document snapshot (URI/version/languageId/text),
/// and profile must all be present before analysis. Non-fatal defaults follow
/// JS behavior: missing `protocolVersion` is allowed (only the Wasm ABI checks
/// it), missing `languageId` defaults to `syntec-macro`, missing `profile`
/// defaults to `generic`.
pub fn analyze_request(request: AnalysisRequest) -> AnalysisResult {
    let content = request.document.text.as_str();
    let document = request.document.clone();
    let profile = request.profile.clone();
    let mut state = LexState::default();
    let mut stack = Vec::new();
    let mut until_closed_repeats = Vec::new();
    let mut diagnostics = Vec::new();
    let mut labels = HashSet::new();
    let mut goto_targets = Vec::new();
    let mut robot_state = RobotLineState::default();
    // Mirror of `collectMetadata` firstNonCommentIdx/
    // firstNonCommentIsBarePercent/hasMacroHeader tracking.
    let mut first_non_comment_collected = false;
    let mut first_non_comment_bare_percent = false;
    let mut first_non_comment_line_number = 0usize;
    let mut first_non_comment_line_len = 0usize;
    let mut first_non_comment_bare_percent_locator: Option<usize> = None;
    let mut content_has_macro_header = false;

    for (line_index, raw_line) in content.split('\n').enumerate() {
        let line_number = line_index + 1;
        let raw_line = raw_line.trim_end_matches('\r');
        let line_start_in_block = state.in_block_comment;
        let (clean, next_block_comment) = strip_comments_and_strings(raw_line, line_start_in_block);
        state.in_block_comment = next_block_comment;
        let trimmed = clean.trim().to_string();

        // First non-comment/non-empty line handling. Mirror of
        // `collectMetadata` block in `src/validator.js`.
        if !first_non_comment_collected
            && !state.in_block_comment
            && !trimmed.is_empty()
            && !trimmed.starts_with("//")
            && !trimmed.starts_with("(*")
        {
            first_non_comment_collected = true;
            // `^%(?!@)` strings starting with `%` but NOT with `%@`.
            let bare_percent = trimmed.starts_with('%') && !trimmed.starts_with("%@");
            if bare_percent {
                first_non_comment_bare_percent = true;
                first_non_comment_line_number = line_number;
                first_non_comment_line_len = trimmed.len();
                // The warning location is the first-line trimmed length in JS:
                // `lines[firstNonCommentIdx].trim()` -> its `.length`.
                first_non_comment_bare_percent_locator = Some(utf16_prefix_len(&clean.chars().collect::<Vec<_>>(), clean.trim_start().find('%').unwrap_or(0)));
            }
        }

        if !trimmed.starts_with("//") && !trimmed.starts_with("(*") && trimmed.eq_ignore_ascii_case("%@MACRO") {
            content_has_macro_header = true;
        }

        if let Some(label) = n_label_name(trimmed.as_str()) {
            labels.insert(label[1..].to_string());
        }
        if let Some(target) = extract_goto_target(&clean) {
            goto_targets.push((line_number, target));
        }
        // Mirrors `validateRobotLineState` (MOVC pair subset only; signal/stitch
        // and weave state rules are deferred to subsequent batches).
        let command = get_command(&clean);
        let in_conditional_branch = stack.iter().any(|block: &Block| matches!(block.keyword.as_str(), "IF" | "CASE"));
        validate_robot_line_state(&mut robot_state, &clean, command.as_deref(), line_number, in_conditional_branch, &mut diagnostics);
        validate_string_function_warnings(
            raw_line,
            line_number,
            line_start_in_block,
            &mut diagnostics,
        );
        validate_string_argument_functions(
            raw_line,
            line_number,
            line_start_in_block,
            &mut diagnostics,
        );
        validate_chinese_characters(&clean, line_number, &mut diagnostics);
        validate_parentheses(&clean, line_number, &mut diagnostics);
        validate_variable_access(&clean, line_number, &mut diagnostics);
        validate_assignment_style(&clean, line_number, &mut diagnostics);
        validate_macro_call_g_code_order(&clean, line_number, &mut diagnostics);
        validate_unsupported_operators(&clean, line_number, &mut diagnostics);
        validate_control_header_terminator(&clean, line_number, &mut diagnostics);
        validate_statement_terminator(&clean, line_number, &mut diagnostics);
        // Order mirrors `LINE_VALIDATOR_RULES` in `src/validator.js`: syntax
        // preferences first (MOVJ-II / MOVC point / direct-arg equals / TOOLCOR
        // / coordinate syntax), then confirmed single-line syntax (ranges and
        // smooth-arg conflicts). TOOLCOR is shared with `validateRobotToolcor`
        // for legacy parity, which duplicates the JS registered rule but emits
        // identical diagnostics in stable inputs.
        validate_robot_syntax_preferences(&clean, line_number, &mut diagnostics);
        validate_robot_confirmed_single_line(&clean, line_number, &mut diagnostics);
        validate_static_math_functions(&clean, line_number, &mut diagnostics);
        validate_static_io_functions(&clean, line_number, &mut diagnostics);
        validate_static_basic_functions(&clean, line_number, &mut diagnostics);
        validate_case_line_style(&clean, line_number, &stack, &mut diagnostics);
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

    // Mirror of `collectMetadata` post-loop: first non-comment line is bare
    // `%` without `@MACRO` -> push a codeless warning flagging the file as
    // ISO format.
    if first_non_comment_bare_percent && !content_has_macro_header {
        let col = first_non_comment_bare_percent_locator.unwrap_or(0);
        push_diagnostic_without_code(
            &mut diagnostics,
            first_non_comment_line_number,
            col,
            col + first_non_comment_line_len,
            Severity::Warning,
            "此文件缺少 %@MACRO 文件头，将被视为 ISO 格式文件",
        );
    }

    for (line, target) in goto_targets {
        if !labels.contains(&target) {
            push_diagnostic_without_code(
                &mut diagnostics,
                line,
                0,
                0,
                Severity::Warning,
                format!("GOTO 目标 {target} 不存在"),
            );
        }
    }

    // Mirrors `finalizeRobotState`: emit a pending MOVC pair diagnostic if the
    // file ends with an unresolved single-line MOVC.
    if robot_state.pending_movc_line > 0 {
        push_diagnostic(
            &mut diagnostics,
            robot_state.pending_movc_line,
            0,
            0,
            Severity::Error,
            "SYNTEC_ROBOT_MOVC_PAIR_REQUIRED",
            "MOVC 必须成对出现：第一行为中间点，第二行为结束点",
        );
    }

    let (navigation_symbols, navigation_calls) = extract_navigation(content);
    let navigation = Some(AnalysisNavigation {
        program_entry_name: None,
        macro_program_name: None,
        symbols: navigation_symbols,
        calls: navigation_calls,
    });

    AnalysisResult::for_document(document, profile, diagnostics, navigation, &navigation_symbols)
}

/// Construct an `AnalysisResult` for the given request/document using the
/// shared protocol shape. Mirrors `createAnalysisResult` plus
/// `createNavigationResult` in JS: protocol version + document snapshot +
/// profile + backend; top-level `symbols` mirrors `navigation.symbols`.
impl AnalysisResult {
    fn for_document(
        document: DocumentSnapshot,
        profile: &str,
        diagnostics: Vec<Diagnostic>,
        navigation: Option<AnalysisNavigation>,
        navigation_symbols: &[Symbol],
    ) -> Self {
        Self {
            protocol_version: PROTOCOL_VERSION,
            document,
            profile: profile.to_string(),
            backend: "rust",
            diagnostics,
            symbols: navigation_symbols.to_vec(),
            edits: Vec::new(),
            navigation,
        }
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

        let div = analyze_document("#1 := #2 DIV #3;");
        assert_eq!(div.diagnostics.len(), 1);
        assert_eq!(
            div.diagnostics[0].code.as_deref(),
            Some("SYNTEC_UNSUPPORTED_DIV")
        );
        assert_eq!(div.diagnostics[0].col, 9);
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

    #[test]
    fn reports_basic_function_argument_ranges_only() {
        let result = analyze_document("ALARM(65536);\nMSG(-1);\nPARAM(1.5, 2);\nCHKINF(6);");
        let codes = result
            .diagnostics
            .iter()
            .map(|diagnostic| diagnostic.code.as_deref().unwrap_or(""))
            .collect::<Vec<_>>();
        assert_eq!(
            codes,
            [
                "SYNTEC_FUNCTION_ID_RANGE",
                "SYNTEC_FUNCTION_ID_RANGE",
                "SYNTEC_FUNCTION_INTEGER_ARGUMENT",
                "SYNTEC_FUNCTION_CHKINF_CATEGORY_RANGE",
            ]
        );

        let dynamic = analyze_document("ALARM(#1);\nMSG(#2);\nPARAM(#3, #4);\nCHKINF(#5);");
        assert!(dynamic.diagnostics.is_empty());
    }

    #[test]
    fn reports_variable_access_boundaries_only() {
        let result = analyze_document(
            "#TEMP := 1;\n@TEMP := 1;\n#0 := 1;\n@0 := 1;\nAR-1;\nMAR1.5;\nAR[-2];",
        );
        let codes = result
            .diagnostics
            .iter()
            .map(|diagnostic| diagnostic.code.as_deref().unwrap_or(""))
            .collect::<Vec<_>>();
        assert_eq!(
            codes,
            [
                "SYNTEC_NAMED_LOCAL_VARIABLE",
                "SYNTEC_NAMED_GLOBAL_VARIABLE",
                "SYNTEC_VACANT_ASSIGNMENT",
                "SYNTEC_VACANT_ASSIGNMENT",
                "SYNTEC_INVALID_APP_VARIABLE_NUMBER",
                "SYNTEC_INVALID_APP_VARIABLE_NUMBER",
                "SYNTEC_INVALID_APP_VARIABLE_NUMBER",
            ]
        );

        let dynamic = analyze_document("AR[#1];\nMAR[100];\n#1 := 1;");
        assert!(dynamic.diagnostics.is_empty());
    }

    #[test]
    fn reports_reserved_r_writes_without_flagging_writable_ranges() {
        let result = analyze_document(
            "@401 := 1;\n@440 := 1;\n@10081 := 1;\n@10512 := 1;\n@111000 := 1;\n@450 := 1;\n@10500 := 1;",
        );
        let codes = result
            .diagnostics
            .iter()
            .map(|diagnostic| diagnostic.code.as_deref().unwrap_or(""))
            .collect::<Vec<_>>();
        assert_eq!(
            codes,
            [
                "SYNTEC_PUBLIC_VAR_R_RESERVED_WRITE",
                "SYNTEC_PUBLIC_VAR_R_RESERVED_WRITE",
                "SYNTEC_PUBLIC_VAR_R_RESERVED_WRITE",
                "SYNTEC_PUBLIC_VAR_R_RESERVED_WRITE",
                "SYNTEC_PUBLIC_VAR_R_RESERVED_WRITE",
            ]
        );
        assert!(result.diagnostics[0].message.contains("@401 映射到 R1"));
        assert!(result.diagnostics[1].message.contains("PLC 警报讯息区"));
        assert!(result.diagnostics[2]
            .message
            .contains("对应参数 Pr3401~Pr3420 唯读区"));
        assert!(result.diagnostics[3]
            .message
            .contains("CNC 系统介面区（不支持位元存取）"));
        assert!(result.diagnostics[4].message.contains("未列出保留区段"));
    }

    #[test]
    fn reports_string_function_warnings_only_at_code_boundaries() {
        let result = analyze_document(
            "OPEN(\"COM1\");\nAXID(\"Y\");\nOPEN(\"file.nc\");\nAXID(Y);\nMSG(\"OPEN(\\\"COM1\\\")\");",
        );
        let codes = result
            .diagnostics
            .iter()
            .map(|diagnostic| diagnostic.code.as_deref().unwrap_or(""))
            .collect::<Vec<_>>();
        assert_eq!(
            codes,
            [
                "SYNTEC_FUNCTION_OPEN_COM_PORT",
                "SYNTEC_FUNCTION_AXID_QUOTED_AXIS",
            ]
        );
    }

    #[test]
    fn reports_sysdata_and_drvdata_argument_formats() {
        let result = analyze_document(
            "SYSDATA(336.5);\nSYSDATA(\"336\");\nDRVDATA(1000.5, 3366);\nDRVDATA(1000, \"bad\");",
        );
        let codes = result
            .diagnostics
            .iter()
            .map(|diagnostic| diagnostic.code.as_deref().unwrap_or(""))
            .collect::<Vec<_>>();
        assert_eq!(
            codes,
            [
                "SYNTEC_FUNCTION_INTEGER_ARGUMENT",
                "SYNTEC_FUNCTION_INTEGER_ARGUMENT",
                "SYNTEC_FUNCTION_INTEGER_ARGUMENT",
                "SYNTEC_FUNCTION_DRVDATA_ARGUMENT_FORMAT",
            ]
        );

        let valid = analyze_document(
            "SYSDATA(336);\nDRVDATA(1000, 3366);\nDRVDATA(1000, \"1Ah\");\nDRVDATA(1000, #1);",
        );
        assert!(valid.diagnostics.is_empty());
    }

    #[test]
    fn reports_assignment_style_without_flagging_comparisons() {
        let result = analyze_document("#1 = 2;\n@3 = #1;\nAR1 = 3;\nMAR[2] = 4;");
        assert_eq!(result.diagnostics.len(), 4);
        assert!(
            result
                .diagnostics
                .iter()
                .all(|diagnostic| diagnostic.code.as_deref()
                    == Some("SYNTEC_ASSIGNMENT_STYLE_EQUALS"))
        );

        let valid = analyze_document("IF #1 = 2 THEN\n#1 := 2;\nEND_IF;");
        assert!(valid.diagnostics.is_empty());
    }

    #[test]
    fn reports_chinese_code_characters_without_flagging_strings_or_comments() {
        let result =
            analyze_document("中文;\n#1 := 1；\nMSG(\"中文\"); // 中文\n(* 中文 *)\n#2 := 2;");
        assert_eq!(result.diagnostics.len(), 2);
        assert!(result
            .diagnostics
            .iter()
            .all(|diagnostic| diagnostic.code.is_none()));
        assert_eq!(
            result.diagnostics[0].message,
            "中文字符：宏程序只允许使用英文字符"
        );
        assert_eq!(
            result.diagnostics[1].message,
            "中文标点 \"；\"：宏程序应使用英文字符"
        );
    }

    #[test]
    fn reports_goto_and_macro_call_boundaries() {
        let result = analyze_document("GOTO 200;\nN100;\nGOTO 100;\nG65 P1000 G01;");
        assert_eq!(result.diagnostics.len(), 2);
        assert_eq!(
            result.diagnostics[0].code.as_deref(),
            Some("SYNTEC_CALL_MACRO_NOT_LAST_G_CODE")
        );
        assert!(result.diagnostics[1].code.is_none());
        assert_eq!(result.diagnostics[1].message, "GOTO 目标 200 不存在");

        let valid = analyze_document("GOTO 100;\nN100;\nG65 P1000;");
        assert!(valid.diagnostics.is_empty());
    }

    #[test]
    fn warns_case_default_label_with_code() {
        let result = analyze_document("CASE #1 OF\n  DEFAULT:\nEND_CASE;");
        assert_eq!(result.diagnostics.len(), 1);
        let diagnostic = &result.diagnostics[0];
        assert_eq!(diagnostic.severity, Severity::Warning);
        assert_eq!(diagnostic.line, 2);
        assert_eq!(diagnostic.col, 2);
        assert_eq!(diagnostic.end_col, 10);
        assert_eq!(
            diagnostic.code.as_deref(),
            Some("SYNTEC_UNSUPPORTED_DEFAULT")
        );

        // Outside a CASE block, DEFAULT: must not trigger the warning.
        let outside = analyze_document("DEFAULT:");
        assert!(outside.diagnostics.is_empty());

        // Unindented DEFAULT: covers the index 0 boundary case.
        let unindented = analyze_document("CASE #1 OF\nDEFAULT:\nEND_CASE;");
        assert_eq!(unindented.diagnostics.len(), 1);
        assert_eq!(unindented.diagnostics[0].line, 2);
        assert_eq!(unindented.diagnostics[0].col, 0);
        assert_eq!(unindented.diagnostics[0].end_col, 8);
    }

    #[test]
    fn warns_robot_toolcor_t_arg() {
        let result = analyze_document("TOOLCOR T1;");
        assert_eq!(result.diagnostics.len(), 1);
        let diagnostic = &result.diagnostics[0];
        assert_eq!(diagnostic.severity, Severity::Error);
        assert_eq!(diagnostic.line, 1);
        assert_eq!(diagnostic.col, 8);
        assert_eq!(diagnostic.end_col, 9);
        assert_eq!(
            diagnostic.code.as_deref(),
            Some("SYNTEC_ROBOT_TOOLCOR_T_ARG")
        );
    }

    #[test]
    fn warns_robot_toolcoron_deprecated() {
        let result = analyze_document("TOOLCORON P1;");
        assert_eq!(result.diagnostics.len(), 1);
        let diagnostic = &result.diagnostics[0];
        assert_eq!(diagnostic.severity, Severity::Warning);
        assert_eq!(diagnostic.line, 1);
        assert_eq!(diagnostic.col, 0);
        assert_eq!(diagnostic.end_col, 9);
        assert_eq!(
            diagnostic.code.as_deref(),
            Some("SYNTEC_ROBOT_TOOLCORON_DEPRECATED")
        );
    }

    #[test]
    fn warns_robot_toolcor_clear() {
        let result = analyze_document("TOOLCOR CLEAR;");
        assert_eq!(result.diagnostics.len(), 1);
        let diagnostic = &result.diagnostics[0];
        assert_eq!(diagnostic.severity, Severity::Warning);
        assert_eq!(diagnostic.line, 1);
        assert_eq!(diagnostic.col, 0);
        assert_eq!(diagnostic.end_col, 13);
        assert_eq!(
            diagnostic.code.as_deref(),
            Some("SYNTEC_ROBOT_TOOLCOR_CLEAR")
        );
    }

    #[test]
    fn accepts_valid_toolcor() {
        let result = analyze_document("TOOLCOR P1;");
        assert!(result.diagnostics.is_empty());
    }

    #[test]
    fn warns_toolcoron_t_arg_ordering() {
        // TOOLCORON T1 produces both TOOLCOR_T_ARG (T at col 10) and
        // TOOLCORON_DEPRECATED (col 0); the T_ARG is reported first to mirror
        // the JS rule ordering in validateRobotSyntaxPreferences.
        let result = analyze_document("TOOLCORON T1;");
        assert_eq!(result.diagnostics.len(), 2);
        assert_eq!(
            result.diagnostics[0].code.as_deref(),
            Some("SYNTEC_ROBOT_TOOLCOR_T_ARG")
        );
        assert_eq!(result.diagnostics[0].col, 10);
        assert_eq!(result.diagnostics[0].end_col, 11);
        assert_eq!(
            result.diagnostics[1].code.as_deref(),
            Some("SYNTEC_ROBOT_TOOLCORON_DEPRECATED")
        );
        assert_eq!(result.diagnostics[1].col, 0);
        assert_eq!(result.diagnostics[1].end_col, 9);
    }
}
