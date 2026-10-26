fn main() {
    #[cfg(target_os = "macos")]
    {
        cc::Build::new()
            .file("src/macos_eyedropper.m")
            .flag("-fobjc-arc")
            .compile("macos_eyedropper");
        println!("cargo:rustc-link-lib=framework=AppKit");
    }

    tauri_build::build();
}
