use std::io::{self, Read, Write};

use syntec_core::{analyze_document, analyze_request_json, result_to_json};

fn escape_field(value: &str) -> String {
    value
        .replace('\\', "\\\\")
        .replace('\t', "\\t")
        .replace('\n', "\\n")
}

fn main() -> io::Result<()> {
    let mut args = std::env::args();
    let _ = args.next();
    let request_mode = match args.next().as_deref() {
        Some("--request") => true,
        Some("--help") | Some("-h") => {
            println!("syntec-core-cli [ --request ]");
            println!("  (default)      read text from stdin, emit legacy line-based diagnostics");
            println!("  --request      read JSON AnalysisRequest from stdin, emit AnalysisResult JSON");
            println!("  --help, -h     show this message");
            return Ok(());
        }
        Some(other) => {
            eprintln!("unknown argument: {other}");
            std::process::exit(2);
        }
        None => false,
    };
    if args.next().is_some() {
        eprintln!("unexpected extra arguments");
        std::process::exit(2);
    }

    let mut input = String::new();
    io::stdin().read_to_string(&mut input)?;

    if request_mode {
        // P0-B 真实 request 传输: the Rust side validates protocolVersion,
        // URI/version/languageId/text/profile here, not the JS adapter.
        match analyze_request_json(&input) {
            Ok(result) => {
                let stdout = io::stdout();
                let mut handle = stdout.lock();
                handle.write_all(result_to_json(&result).as_bytes())?;
                handle.write_all(b"\n")?;
            }
            Err(message) => {
                eprintln!("error: {message}");
                std::process::exit(1);
            }
        }
        return Ok(());
    }

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
            diagnostic.code.as_deref().unwrap_or(""),
            escape_field(&diagnostic.message)
        );
    }
    Ok(())
}
