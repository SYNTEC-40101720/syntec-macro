use std::io::{self, Read};

use syntec_core::analyze_document;

fn escape_field(value: &str) -> String {
    value
        .replace('\\', "\\\\")
        .replace('\t', "\\t")
        .replace('\n', "\\n")
}

fn main() -> io::Result<()> {
    let mut input = String::new();
    io::stdin().read_to_string(&mut input)?;
    let result = analyze_document(&input);

    println!("protocol_version={}", result.protocol_version);
    println!("backend={}", result.backend);
    for diagnostic in result.diagnostics {
        println!(
            "diagnostic\t{}\t{}\t{}\t{}\t{}\t{}",
            diagnostic.line,
            diagnostic.col,
            diagnostic.end_col,
            diagnostic.severity.as_str(),
            diagnostic.code,
            escape_field(&diagnostic.message)
        );
    }
    Ok(())
}
